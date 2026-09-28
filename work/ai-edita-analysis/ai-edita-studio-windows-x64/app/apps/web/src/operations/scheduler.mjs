// Durable Node scheduler adapted from AI Edita scheduler/publisher.
import fs from "node:fs";
import path from "node:path";
import {
	readWorkspace,
	readSettings,
	changeWorkspace,
	dataRoot,
} from "./store.mjs";
import { accountClient, isTransientProviderError } from "./instagram.mjs";
import { startMediaHost } from "./media-host.mjs";
import { rules, transition, publicationStates } from "./policy.mjs";
const runtime = (globalThis.__aiEditaScheduler ??= {
	active: false,
	running: false,
	lastTick: null,
});
const MAX_MEDIA_DELIVERY_ATTEMPTS = 5;
export function schedulerStatus() {
	return {
		active:
			runtime.active && readSettings().schedulerEnabled && !runtime.lastError,
		lastTick: runtime.lastTick,
		error: runtime.lastError || null,
	};
}

function writers(id) {
	const patch = (extra) =>
		changeWorkspace((state) => {
			const current = state.publications.find((job) => job.id === id);
			if (!current) throw new Error("Publicação não encontrada.");
			Object.assign(current, extra);
		});
	const update = (status, extra = {}) =>
		changeWorkspace((state) => {
			const current = state.publications.find((job) => job.id === id);
			if (!current) throw new Error("Publicação não encontrada.");
			transition(current, status);
			Object.assign(current, extra);
		});
	return { patch, update };
}

function failJob(id, error) {
	const latest = readWorkspace().publications.find((job) => job.id === id);
	if (!latest) return;
	const stageLabels = {
		hosting_media: "Preparação do link temporário falhou",
		creating_container: "Criação do contêiner na Meta falhou",
		uploading_media: "Envio do arquivo à Meta falhou",
		processing: "Processamento do vídeo pela Meta falhou",
		processing_wait: "Consulta do processamento na Meta falhou",
		publishing: "Confirmação da publicação na Meta falhou",
	};
	const label =
		stageLabels[latest.deliveryStage] || "Publicação no Instagram falhou";
	const { update } = writers(id);
	update(latest.status === "publishing" ? "needs_review" : "failed", {
		error: label + ": " + error.message,
		lastProviderError: error.message,
		lastCheckedAt: new Date().toISOString(),
	});
}

function scheduleMediaDeliveryRetry(id, error) {
	if (error?.retryable !== true) return false;
	const latest = readWorkspace().publications.find((job) => job.id === id);
	if (!latest) return false;
	const attempts = Number(latest.deliveryAttempts || 0);
	if (
		!rules().media_delivery_retry_allowed(
			publicationStates.indexOf(latest.status),
			Number(Boolean(latest.containerId)),
			attempts,
			MAX_MEDIA_DELIVERY_ATTEMPTS,
		)
	)
		return false;
	const nextAttempt = attempts + 1;
	const retryAt = new Date(
		Date.now() + rules().media_delivery_retry_delay_ms(nextAttempt),
	).toISOString();
	const { patch } = writers(id);
	patch({
		deliveryStage: "hosting_media",
		deliveryAttempts: nextAttempt,
		nextDeliveryAttemptAt: retryAt,
		lastProviderError: error.message,
		lastCheckedAt: new Date().toISOString(),
		error:
			`A conexão de entrega oscilou. O AI Edita tentará novamente sozinho ` +
			`(${nextAttempt}/${MAX_MEDIA_DELIVERY_ATTEMPTS}) às ${new Date(retryAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. ` +
			"Nenhuma solicitação foi enviada à Meta.",
	});
	return true;
}

async function monitorAndPublish({
	id,
	api,
	initialStatus = null,
	wait,
	statusIntervalMs,
	maxStatusChecks,
}) {
	const { patch, update } = writers(id);
	let ready = false;
	for (let index = 0; index < maxStatusChecks; index++) {
		let result;
		if (index === 0 && initialStatus) {
			result = initialStatus;
		} else {
			if (index > 0) await wait(statusIntervalMs);
			try {
				result = await api.containerStatus(
					readWorkspace().publications.find((job) => job.id === id).containerId,
				);
			} catch (error) {
				patch({
					providerStatus: "UNAVAILABLE",
					statusChecks: index + 1,
					lastCheckedAt: new Date().toISOString(),
					lastProviderError: error.message,
				});
				if (!isTransientProviderError(error)) throw error;
				continue;
			}
		}

		patch({
			providerStatus: result.status_code || "UNKNOWN",
			statusChecks: index + 1,
			lastCheckedAt: new Date().toISOString(),
			lastProviderError: null,
		});
		if (result.status_code === "FINISHED") {
			ready = true;
			break;
		}
		if (result.status_code === "PUBLISHED") {
			update("needs_review", {
				deliveryStage: "processing_wait",
				error:
					"A Meta informa que este contêiner já foi publicado. Confira o Instagram antes de criar outro envio.",
			});
			return;
		}
		if (["ERROR", "EXPIRED"].includes(result.status_code)) {
			throw new Error("Instagram: " + (result.status || result.status_code));
		}
	}

	if (!ready) {
		const current = readWorkspace().publications.find((job) => job.id === id);
		update("needs_review", {
			deliveryStage: "processing_wait",
			error:
				current.providerStatus === "IN_PROGRESS"
					? "A Meta continua processando o vídeo. Nenhum novo envio foi criado; consulte este contêiner novamente mais tarde."
					: "A Meta não confirmou o estado do vídeo após as novas tentativas. Nenhum novo envio foi criado; consulte novamente mais tarde.",
		});
		return;
	}

	const containerId = readWorkspace().publications.find(
		(job) => job.id === id,
	).containerId;
	// Persist BEFORE external publishing. A lost reply is never retried automatically.
	update("publishing", { deliveryStage: "publishing" });
	const published = await api.publish(containerId);
	update("published", {
		mediaId: published.id,
		publishedAt: new Date().toISOString(),
		error: null,
		deliveryStage: "published",
	});
	try {
		const media = await api.published(published.id);
		patch({ permalink: media.permalink || null });
	} catch {
		/* Confirmed media ID still proves publishing; permalink can arrive later. */
	}
}

export async function publishJob(
	id,
	{
		client = null,
		hostFactory = startMediaHost,
		wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
		statusIntervalMs = 60_000,
		maxStatusChecks = 5,
	} = {},
) {
	const state = readWorkspace(),
		job = state.publications.find((j) => j.id === id);
	if (!job || job.status !== "scheduled") return;
	const asset = state.assets.find(
		(a) => a.id === job.assetId && a.kind === "export",
	);
	if (!asset || !fs.existsSync(asset.file))
		throw new Error("Exportação não encontrada.");
	const { update, patch } = writers(id);
	let host;
	try {
		const api = client || accountClient(job.accountId);
		let containerId;
		let initialStatus;
		if (
			api.account?.loginType === "facebook" &&
			typeof api.createResumableReelContainer === "function" &&
			typeof api.uploadReelFile === "function"
		) {
			update("uploading", {
				deliveryStage: "creating_container",
				error: null,
				nextDeliveryAttemptAt: null,
			});
			let upload;
			try {
				upload = await api.createResumableReelContainer({
					caption: job.caption,
				});
			} catch (error) {
				if (error?.metaCode !== 100 || !/video_url/i.test(error.message))
					throw error;
				host = await hostFactory(asset.file);
				containerId = await api.createReelContainer({
					videoUrl: host.videoUrl,
					caption: job.caption,
				});
			}
			if (!upload) {
				update("processing", {
					containerId,
					deliveryStage: "processing",
					providerStatus: "WAITING",
					statusChecks: 0,
					lastCheckedAt: null,
					lastProviderError: null,
				});
				await monitorAndPublish({
					id,
					api,
					wait,
					statusIntervalMs,
					maxStatusChecks,
				});
				return;
			}
			containerId = upload.id;
			patch({ containerId, deliveryStage: "uploading_media" });
			try {
				await api.uploadReelFile({
					uploadUrl: upload.uploadUrl,
					file: asset.file,
				});
			} catch (uploadError) {
				// Rupload can return a processing error even after accepting the
				// complete binary. The container status is the authoritative signal:
				// continue only when Meta itself confirms active/finished processing.
				const confirmed = await api
					.containerStatus(containerId)
					.catch(() => null);
				if (!["IN_PROGRESS", "FINISHED"].includes(confirmed?.status_code)) {
					throw uploadError;
				}
				initialStatus = confirmed;
			}
		} else {
			patch({
				deliveryStage: "hosting_media",
				error: null,
				lastProviderError: null,
			});
			host = await hostFactory(asset.file);
			update("uploading", {
				deliveryStage: "creating_container",
				error: null,
				nextDeliveryAttemptAt: null,
			});
			containerId = await api.createReelContainer({
				videoUrl: host.videoUrl,
				caption: job.caption,
			});
		}
		update("processing", {
			containerId,
			deliveryStage: "processing",
			providerStatus: initialStatus?.status_code || "WAITING",
			statusChecks: initialStatus ? 1 : 0,
			lastCheckedAt: initialStatus ? new Date().toISOString() : null,
			lastProviderError: null,
		});
		await monitorAndPublish({
			id,
			api,
			initialStatus,
			wait,
			statusIntervalMs,
			maxStatusChecks,
		});
	} catch (error) {
		if (!scheduleMediaDeliveryRetry(id, error)) failJob(id, error);
	} finally {
		await host?.stop().catch(() => {});
	}
}

export async function schedulerTick() {
	if (runtime.running || !readSettings().schedulerEnabled) return;
	const lock = path.join(dataRoot(), "publisher.lock");
	fs.mkdirSync(dataRoot(), { recursive: true });
	let handle;
	try {
		handle = fs.openSync(lock, "wx");
		fs.writeFileSync(handle, String(process.pid));
	} catch {
		return;
	}
	runtime.running = true;
	runtime.lastTick = new Date().toISOString();
	runtime.lastError = null;
	try {
		for (const job of readWorkspace().publications) {
			if (!readSettings().schedulerEnabled) break;
			if (
				rules().publication_expired(
					publicationStates.indexOf(job.status),
					Date.parse(job.publishAt),
					Date.now(),
				)
			) {
				changeWorkspace((s) => {
					const current = s.publications.find((j) => j.id === job.id);
					transition(current, "needs_review");
					current.error = current.deliveryAttempts
						? "A conexão temporária permaneceu indisponível por 15 minutos. Nenhuma solicitação foi enviada à Meta; revise e reagende para não publicar fora do horário."
						: "O servidor perdeu o horário por mais de 15 minutos. Revise e reagende; não publicamos fora do horário automaticamente.";
				});
				continue;
			}
			if (
				job.nextDeliveryAttemptAt &&
				Date.parse(job.nextDeliveryAttemptAt) > Date.now()
			)
				continue;
			if (
				rules().publication_due(
					publicationStates.indexOf(job.status),
					Date.parse(job.publishAt),
					Date.now(),
				)
			) {
				try {
					await publishJob(job.id);
				} catch (error) {
					changeWorkspace((s) => {
						const current = s.publications.find((j) => j.id === job.id);
						current.status = "failed";
						current.error = error.message;
					});
				}
			}
		}
	} finally {
		runtime.running = false;
		fs.closeSync(handle);
		fs.unlinkSync(lock);
	}
}
export function startScheduler() {
	if (runtime.active) return;
	const lock = path.join(dataRoot(), "publisher.lock");
	if (fs.existsSync(lock)) {
		const pid = Number(fs.readFileSync(lock, "utf8"));
		if (!Number.isInteger(pid) || pid <= 0) return;
		try {
			process.kill(pid, 0);
			return;
		} catch (error) {
			if (error.code !== "ESRCH") return;
			fs.unlinkSync(lock);
		}
	}
	changeWorkspace((state) => {
		for (const job of state.publications)
			if (["uploading", "processing", "publishing"].includes(job.status)) {
				job.status = "needs_review";
				job.deliveryStage = "interrupted";
				job.error =
					"Servidor reiniciado durante a entrega. Confira o Instagram antes de criar outra publicação.";
			}
		for (const task of state.tasks)
			if (task.status === "editing") {
				task.status = "failed";
				task.lease = "";
				task.message =
					"O servidor reiniciou. O projeto salvo foi preservado; confira antes de continuar.";
			}
		for (const thread of state.threads) {
			thread.busy = false;
			if (thread.workflow?.status === "resuming")
				thread.workflow.status = "interrupted";
		}
	});
	runtime.active = true;
	runtime.timer = setInterval(
		() =>
			void schedulerTick().catch(() => {
				runtime.lastError =
					"Falha no agendador. Confira o armazenamento local.";
			}),
		15000,
	);
	runtime.timer.unref();
	void schedulerTick().catch(() => {
		runtime.lastError = "Falha ao iniciar a fila de publicação.";
	});
}
