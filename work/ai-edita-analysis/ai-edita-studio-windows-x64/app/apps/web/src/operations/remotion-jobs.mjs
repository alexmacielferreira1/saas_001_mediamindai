import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { bundle } from "@remotion/bundler";
import {
	makeCancelSignal,
	renderMedia,
	selectComposition,
} from "@remotion/renderer";
import { dataRoot } from "./store.mjs";
import { getDocument } from "./sqlite-store.mjs";

const globalKey = Symbol.for("ai-edita.remotion-runtime.v1");
const terminalStatuses = new Set(["succeeded", "failed", "cancelled"]);

function runtime() {
	if (!globalThis[globalKey]) {
		globalThis[globalKey] = {
			processing: false,
			bundlePromise: null,
			cancel: new Map(),
			recovered: false,
		};
	}
	return globalThis[globalKey];
}

function roots() {
	const root = path.join(dataRoot(), "remotion");
	return {
		root,
		jobs: path.join(root, "jobs"),
		outputs: path.join(root, "outputs"),
		cache: path.join(root, "cache", "bundle"),
		state: path.join(root, "jobs.json"),
	};
}

function ensureDirectories() {
	const value = roots();
	for (const directory of [value.root, value.jobs, value.outputs, path.dirname(value.cache)]) {
		fs.mkdirSync(directory, { recursive: true });
	}
	return value;
}

function readState() {
	const { state } = ensureDirectories();
	if (!fs.existsSync(state)) return { version: 1, jobs: [] };
	try {
		const value = JSON.parse(fs.readFileSync(state, "utf8"));
		return value?.version === 1 && Array.isArray(value.jobs)
			? value
			: { version: 1, jobs: [] };
	} catch {
		return { version: 1, jobs: [] };
	}
}

function writeState(state) {
	const locations = ensureDirectories();
	const temporary = `${locations.state}.${process.pid}.${randomUUID()}.tmp`;
	fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
	fs.renameSync(temporary, locations.state);
}

function mutateState(update) {
	const state = readState();
	const result = update(state);
	writeState(state);
	return result;
}

function canonical(value) {
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canonical(value[key])]),
		);
	}
	return value;
}

function snapshotHash(snapshot) {
	const copy = structuredClone(snapshot);
	delete copy.createdAt;
	for (const media of copy.media ?? []) media.src = "";
	return createHash("sha256").update(JSON.stringify(canonical(copy))).digest("hex");
}

function safeId(value, label) {
	if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
		throw new Error(`${label} inválido.`);
	}
	return value;
}

function mediaExtension({ name, type }) {
	const extension = path.extname(String(name || "")).toLowerCase();
	if (/^\.[a-z0-9]{1,8}$/.test(extension)) return extension;
	if (type === "image") return ".png";
	if (type === "audio") return ".wav";
	return ".mp4";
}

function mediaMime(filePath) {
	switch (path.extname(filePath).toLowerCase()) {
		case ".png": return "image/png";
		case ".jpg":
		case ".jpeg": return "image/jpeg";
		case ".webp": return "image/webp";
		case ".gif": return "image/gif";
		case ".mp3": return "audio/mpeg";
		case ".wav": return "audio/wav";
		case ".m4a": return "audio/mp4";
		case ".mov": return "video/quicktime";
		case ".webm": return "video/webm";
		default: return "video/mp4";
	}
}

function publicJob(job) {
	return {
		id: job.id,
		projectId: job.projectId,
		status: job.status,
		progress: job.progress,
		step: job.step,
		error: job.error,
		warnings: job.warnings ?? [],
		createdAt: job.createdAt,
		updatedAt: job.updatedAt,
		startedAt: job.startedAt,
		finishedAt: job.finishedAt,
		downloadUrl:
			job.status === "succeeded" ? `/api/remotion/jobs/${job.id}/file` : null,
	};
}

function findEntryPoint() {
	const candidates = [
		path.join(process.cwd(), "src", "remotion", "entry.tsx"),
		path.join(process.cwd(), "apps", "web", "src", "remotion", "entry.tsx"),
		path.join(process.cwd(), "remotion-source", "entry.tsx"),
		path.join(process.cwd(), "apps", "web", "remotion-source", "entry.tsx"),
	];
	const entry = candidates.find((candidate) => fs.existsSync(candidate));
	if (!entry) {
		throw new Error(
			"Fonte da composição Remotion não encontrada no pacote. Recompile o AI Edita.",
		);
	}
	return entry;
}

// Bump when the bundler configuration changes so a running server rebuilds.
const BUNDLE_VERSION = 2;

async function serveUrl() {
	const state = runtime();
	if (!state.bundlePromise || state.bundleVersion !== BUNDLE_VERSION) {
		const locations = ensureDirectories();
		fs.rmSync(locations.cache, { recursive: true, force: true });
		const entryPoint = findEntryPoint();
		// The composition shares modules with the editor through the "@/" alias
		// (tsconfig paths), which Remotion's webpack does not read on its own.
		const sourceRoot = path.resolve(path.dirname(entryPoint), "..");
		state.bundleVersion = BUNDLE_VERSION;
		state.bundlePromise = bundle({
			entryPoint,
			outDir: locations.cache,
			enableCaching: true,
			webpackOverride: (config) => ({
				...config,
				resolve: {
					...config.resolve,
					alias: { ...config.resolve?.alias, "@": sourceRoot },
				},
			}),
		}).catch((error) => {
			// Never keep a failed bundle: the next render should retry.
			state.bundlePromise = null;
			throw error;
		});
	}
	return state.bundlePromise;
}

async function startAssetServer(assetFiles) {
	const token = randomBytes(24).toString("hex");
	const byName = new Map(
		Object.values(assetFiles).map((filePath) => [path.basename(filePath), filePath]),
	);
	const server = http.createServer((request, response) => {
		const url = new URL(request.url ?? "/", "http://127.0.0.1");
		if (url.searchParams.get("token") !== token || !url.pathname.startsWith("/assets/")) {
			response.writeHead(403).end();
			return;
		}
		const filePath = byName.get(decodeURIComponent(url.pathname.slice(8)));
		if (!filePath || !fs.existsSync(filePath)) {
			response.writeHead(404).end();
			return;
		}
		const stat = fs.statSync(filePath);
		const headers = {
			"Access-Control-Allow-Origin": "*",
			"Accept-Ranges": "bytes",
			"Cache-Control": "private, no-store",
			"Content-Type": mediaMime(filePath),
		};
		const range = request.headers.range;
		if (!range) {
			response.writeHead(200, { ...headers, "Content-Length": stat.size });
			fs.createReadStream(filePath).pipe(response);
			return;
		}
		const [startText, endText] = range.replace("bytes=", "").split("-");
		const start = Math.max(0, Number(startText) || 0);
		const end = Math.min(stat.size - 1, endText ? Number(endText) : stat.size - 1);
		if (start > end) {
			response.writeHead(416).end();
			return;
		}
		response.writeHead(206, {
			...headers,
			"Content-Length": end - start + 1,
			"Content-Range": `bytes ${start}-${end}/${stat.size}`,
		});
		fs.createReadStream(filePath, { start, end }).pipe(response);
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	const baseUrl = `http://127.0.0.1:${address.port}`;
	return {
		urls: Object.fromEntries(
			Object.entries(assetFiles).map(([id, filePath]) => [
				id,
				`${baseUrl}/assets/${encodeURIComponent(path.basename(filePath))}?token=${token}`,
			]),
		),
		close: () => new Promise((resolve) => server.close(resolve)),
	};
}

async function availableRenderPort() {
	return await new Promise((resolve, reject) => {
		const probe = net.createServer();
		probe.unref();
		probe.once("error", reject);
		probe.listen(0, "127.0.0.1", () => {
			const address = probe.address();
			const port = typeof address === "object" && address ? address.port : 0;
			probe.close((error) => (error ? reject(error) : resolve(port)));
		});
	});
}

function updateJob(id, patch) {
	return mutateState((state) => {
		const job = state.jobs.find((candidate) => candidate.id === id);
		if (!job) throw new Error("Renderização Remotion não encontrada.");
		Object.assign(job, patch, { updatedAt: new Date().toISOString() });
		return structuredClone(job);
	});
}

function claimNextJob() {
	return mutateState((state) => {
		const job = state.jobs.find(
			(candidate) => candidate.status === "queued" && !candidate.cancelRequested,
		);
		if (!job) return null;
		const now = new Date().toISOString();
		Object.assign(job, {
			status: "running",
			progress: 0.01,
			step: "Preparando composição Remotion",
			startedAt: now,
			updatedAt: now,
			ownerPid: process.pid,
		});
		return structuredClone(job);
	});
}

async function renderJob(job) {
	const snapshot = JSON.parse(fs.readFileSync(job.snapshotPath, "utf8"));
	const server = await startAssetServer(job.assetFiles);
	const mappedSnapshot = {
		...snapshot,
		media: snapshot.media.map((asset) => ({
			...asset,
			src: server.urls[asset.id] ?? "",
		})),
	};
	const { cancelSignal, cancel } = makeCancelSignal();
	runtime().cancel.set(job.id, cancel);
	const locations = ensureDirectories();
	const temporaryOutput = path.join(job.jobDir, "rendering.mp4");
	const outputPath = path.join(locations.outputs, `${job.id}.mp4`);
	try {
		updateJob(job.id, { progress: 0.025, step: "Compilando composição compartilhada" });
		const bundled = await serveUrl();
		const composition = await selectComposition({
			serveUrl: bundled,
			id: "AiEditaVideo",
			inputProps: mappedSnapshot,
			port: await availableRenderPort(),
			logLevel: "warn",
		});
		updateJob(job.id, { progress: 0.05, step: "Renderizando vídeo e áudio" });
		await renderMedia({
			serveUrl: bundled,
			composition,
			inputProps: mappedSnapshot,
			codec: "h264",
			audioCodec: "aac",
			// Remotion defaults to ~320 kbps, and the Reels profile this app validates
			// against caps audio at 128 kbps: every rendered video used to be rejected
			// right after it was produced.
			audioBitrate: "128k",
			pixelFormat: "yuv420p",
			outputLocation: temporaryOutput,
			overwrite: true,
			concurrency: 1,
			colorSpace: "bt709",
			crf: 18,
			cancelSignal,
			licenseKey: process.env.REMOTION_LICENSE_KEY || null,
			port: await availableRenderPort(),
			logLevel: "warn",
			onProgress: ({ progress }) => {
				updateJob(job.id, {
					status: "running",
					ownerPid: process.pid,
					progress: Math.max(0.05, Math.min(0.98, 0.05 + progress * 0.93)),
					step: `Renderizando (${Math.round(progress * 100)}%)`,
				});
			},
		});
		fs.rmSync(outputPath, { force: true });
		fs.renameSync(temporaryOutput, outputPath);
		updateJob(job.id, {
			status: "succeeded",
			progress: 1,
			step: "MP4 Remotion pronto",
			outputPath,
			finishedAt: new Date().toISOString(),
		});
	} catch (error) {
		const latest = readState().jobs.find((candidate) => candidate.id === job.id);
		const cancelled = latest?.cancelRequested || /cancel/i.test(String(error?.message || error));
		updateJob(job.id, {
			status: cancelled ? "cancelled" : "failed",
			step: cancelled ? "Renderização cancelada" : "Falha no render Remotion",
			error: cancelled ? null : String(error?.stack || error?.message || error).slice(0, 6000),
			finishedAt: new Date().toISOString(),
		});
		fs.rmSync(temporaryOutput, { force: true });
	} finally {
		runtime().cancel.delete(job.id);
		await server.close();
	}
}

export function kickRemotionQueue() {
	const state = runtime();
	if (state.processing) return;
	state.processing = true;
	queueMicrotask(async () => {
		try {
			for (;;) {
				const job = claimNextJob();
				if (!job) break;
				await renderJob(job);
			}
		} finally {
			state.processing = false;
		}
	});
}

export function listRemotionJobs() {
	kickRemotionQueue();
	return readState().jobs.map(publicJob);
}

export function getRemotionJob(id, { internal = false } = {}) {
	kickRemotionQueue();
	const job = readState().jobs.find((candidate) => candidate.id === id) ?? null;
	return internal || !job ? job : publicJob(job);
}

export function enqueueRemotionJob(snapshot) {
	if (snapshot.schema !== "ai-edita.remotion-snapshot" || snapshot.version !== 1) {
		throw new Error("Snapshot Remotion incompatível.");
	}
	const projectId = safeId(snapshot.projectId, "Projeto");
	if (snapshot.audio?.some((element) => element.src && !element.mediaId)) {
		throw new Error(
			"A exportação Remotion não usa URLs externas. Importe o áudio para o projeto primeiro.",
		);
	}
	const hash = snapshotHash(snapshot);
	const existing = readState().jobs.find(
		(job) =>
			job.snapshotHash === hash &&
			(job.status === "queued" || job.status === "running" || job.status === "succeeded"),
	);
	if (existing) return publicJob(existing);

	const id = randomUUID();
	const locations = ensureDirectories();
	const jobDir = path.join(locations.jobs, id);
	const assetsDir = path.join(jobDir, "assets");
	fs.mkdirSync(assetsDir, { recursive: true });
	const assetFiles = {};
	for (const asset of snapshot.media) {
		const mediaId = safeId(asset.id, "Mídia");
		const source = path.join(
			dataRoot(),
			"editor",
			"media",
			projectId,
			"files",
			`${mediaId}.bin`,
		);
		if (!fs.existsSync(source)) {
			throw new Error(`A mídia “${mediaId}” não está persistida no ambiente isolado.`);
		}
		const metadata = getDocument({
			root: dataRoot(),
			namespace: `media-files:${projectId}`,
			key: mediaId,
		}) ?? { name: mediaId, type: asset.type };
		const destination = path.join(
			assetsDir,
			`${mediaId}${mediaExtension({ name: metadata.name, type: asset.type })}`,
		);
		fs.copyFileSync(source, destination);
		assetFiles[mediaId] = destination;
	}
	const storedSnapshot = {
		...structuredClone(snapshot),
		createdAt: new Date().toISOString(),
		media: snapshot.media.map((asset) => ({ ...asset, src: "" })),
	};
	const snapshotPath = path.join(jobDir, "snapshot.json");
	fs.writeFileSync(snapshotPath, `${JSON.stringify(storedSnapshot, null, 2)}\n`, "utf8");
	const now = new Date().toISOString();
	const job = {
		id,
		projectId,
		status: "queued",
		progress: 0,
		step: "Na fila Remotion",
		error: null,
		warnings: snapshot.warnings ?? [],
		createdAt: now,
		updatedAt: now,
		startedAt: null,
		finishedAt: null,
		cancelRequested: false,
		snapshotHash: hash,
		snapshotPath,
		jobDir,
		assetFiles,
		outputPath: null,
	};
	mutateState((state) => {
		state.jobs.unshift(job);
		state.jobs = state.jobs.slice(0, 80);
	});
	kickRemotionQueue();
	return publicJob(job);
}

export function cancelRemotionJob(id) {
	const job = updateJob(id, {
		cancelRequested: true,
		step: "Cancelamento solicitado",
	});
	if (job.status === "queued") {
		return publicJob(
			updateJob(id, {
				status: "cancelled",
				step: "Cancelada antes de iniciar",
				finishedAt: new Date().toISOString(),
			}),
		);
	}
	if (!terminalStatuses.has(job.status)) runtime().cancel.get(id)?.();
	return publicJob(job);
}

export function remotionOutputPath(id) {
	const job = getRemotionJob(id, { internal: true });
	if (!job || job.status !== "succeeded" || !job.outputPath) return null;
	const expectedRoot = `${path.resolve(roots().outputs)}${path.sep}`;
	const resolved = path.resolve(job.outputPath);
	return resolved.startsWith(expectedRoot) && fs.existsSync(resolved) ? resolved : null;
}

const startup = runtime();
if (!startup.recovered) {
	startup.recovered = true;
	for (const job of readState().jobs) {
		let ownerAlive = job.ownerPid === process.pid;
		if (!ownerAlive && Number.isInteger(job.ownerPid)) {
			try {
				process.kill(job.ownerPid, 0);
				ownerAlive = true;
			} catch {
				ownerAlive = false;
			}
		}
		if (job.status === "running" && !ownerAlive) {
			updateJob(job.id, {
				status: job.cancelRequested ? "cancelled" : "queued",
				step: job.cancelRequested
					? "Cancelada após reinício"
					: "Recuperada após reinício",
				finishedAt: job.cancelRequested ? new Date().toISOString() : null,
			});
		}
	}
}
