// Adapted from the user's AI Edita src/meta-api.mjs and instagram-insights.mjs.
// Multi-account transport; secrets never leave the Node adapter.
import fs from "node:fs";
import {
	readSettings,
	readWorkspace,
	changeWorkspace,
	vault,
	readInsights,
	saveInsights,
} from "./store.mjs";

function parseDebugInfo(value) {
	if (typeof value !== "string") return value || {};
	try {
		return JSON.parse(value);
	} catch {
		return { message: value };
	}
}

function providerError(response, payload, token, fallback) {
	const error = payload?.error || {};
	const debug = parseDebugInfo(payload?.debug_info);
	const nested = parseDebugInfo(debug?.message);
	const message = String(
		error.error_user_msg ||
			error.message ||
			nested?.message ||
			debug?.message ||
			fallback,
	);
	const type = error.type || nested?.type || debug?.type;
	const code = error.error_subcode || error.code || nested?.code || debug?.code;
	const trace =
		error.fbtrace_id ||
		payload?.fbtrace_id ||
		response.headers.get("x-fb-trace-id");
	const details = [
		"HTTP " + response.status,
		type ? "tipo " + type : null,
		code ? "código " + code : null,
		trace ? "rastreio " + trace : null,
	].filter(Boolean);
	const result = new Error(
		(message + (details.length ? " (" + details.join("; ") + ")" : ""))
			.replaceAll(token, "[redigido]")
			.slice(0, 800),
	);
	result.name = "MetaProviderError";
	result.httpStatus = response.status;
	result.metaCode = Number.isFinite(Number(code)) ? Number(code) : null;
	result.metaTrace = trace || null;
	result.isTransient =
		error.is_transient === true ||
		nested?.is_transient === true ||
		debug?.is_transient === true ||
		response.status === 429 ||
		response.status >= 500 ||
		[1, 2, 4, 17, 32, 613].includes(result.metaCode);
	return result;
}

export function isTransientProviderError(error) {
	if (error?.isTransient === true) return true;
	if ([408, 429].includes(error?.httpStatus) || error?.httpStatus >= 500)
		return true;
	if ([1, 2, 4, 17, 32, 613].includes(error?.metaCode)) return true;
	return /\bHTTP (?:408|429|5\d\d)\b|fetch failed|timed? ?out|timeout/i.test(
		String(error?.message || error),
	);
}

export class InstagramClient {
	constructor(account, token, fetchImpl = fetch) {
		this.account = account;
		this.token = token;
		this.fetch = fetchImpl;
		this.base =
			"https://" +
			(account.loginType === "facebook"
				? "graph.facebook.com/"
				: "graph.instagram.com/") +
			readSettings().apiVersion;
	}
	async request(route, body) {
		const response = await this.fetch(this.base + route, {
			method: body ? "POST" : "GET",
			headers: {
				Authorization: "Bearer " + this.token,
				...(body
					? { "Content-Type": "application/x-www-form-urlencoded" }
					: {}),
			},
			body: body ? new URLSearchParams(body) : undefined,
			signal: AbortSignal.timeout(25000),
		});
		const payload = await response.json().catch(() => ({}));
		if (!response.ok)
			throw providerError(
				response,
				payload,
				this.token,
				"A Meta recusou a solicitação.",
			);
		return payload;
	}
	profile() {
		return this.request(
			"/" +
				this.account.igUserId +
				"?fields=id,username," +
				(this.account.loginType === "facebook" ? "" : "account_type,") +
				"profile_picture_url,followers_count,media_count",
		);
	}
	async createReelContainer({ videoUrl, caption }) {
		if (!/^https:\/\//.test(videoUrl))
			throw new Error(
				"O Instagram exige um endereço HTTPS para receber o vídeo.",
			);
		const result = await this.request("/" + this.account.igUserId + "/media", {
			media_type: "REELS",
			video_url: videoUrl,
			caption,
			share_to_feed: "true",
		});
		if (!/^\d+$/.test(result.id || ""))
			throw new Error("O Instagram não confirmou a criação do contêiner.");
		return result.id;
	}
	async createResumableReelContainer({ caption }) {
		if (this.account.loginType !== "facebook") {
			throw new Error(
				"O envio resumível exige uma conexão do tipo Facebook Login for Business.",
			);
		}
		const result = await this.request("/" + this.account.igUserId + "/media", {
			media_type: "REELS",
			upload_type: "resumable",
			caption,
			share_to_feed: "true",
		});
		if (!/^\d+$/.test(result.id || "")) {
			throw new Error("O Instagram não abriu a sessão de envio do vídeo.");
		}
		const fallback =
			"https://rupload.facebook.com/ig-api-upload/" +
			readSettings().apiVersion +
			"/" +
			result.id;
		const uploadUrl = new URL(result.uri || fallback);
		if (
			uploadUrl.protocol !== "https:" ||
			uploadUrl.hostname !== "rupload.facebook.com" ||
			!uploadUrl.pathname.startsWith("/ig-api-upload/")
		) {
			throw new Error("A Meta retornou um endereço de envio inválido.");
		}
		return { id: result.id, uploadUrl: uploadUrl.href };
	}
	async uploadReelFile({ uploadUrl, file }) {
		const size = fs.statSync(file).size;
		const response = await this.fetch(uploadUrl, {
			method: "POST",
			headers: {
				Authorization: "OAuth " + this.token,
				"Content-Type": "application/octet-stream",
				"Content-Length": String(size),
				offset: "0",
				file_size: String(size),
			},
			body: fs.createReadStream(file),
			duplex: "half",
			signal: AbortSignal.timeout(20 * 60 * 1000),
		});
		const payload = await response.json().catch(() => ({}));
		if (!response.ok || payload.success === false) {
			throw providerError(
				response,
				payload,
				this.token,
				"A Meta recusou o arquivo de vídeo.",
			);
		}
		return payload;
	}
	containerStatus(id) {
		return this.request("/" + id + "?fields=status_code,status");
	}
	publishingLimit() {
		return this.request(
			"/" +
				this.account.igUserId +
				"/content_publishing_limit?fields=quota_usage,config",
		);
	}
	async publish(id) {
		const result = await this.request(
			"/" + this.account.igUserId + "/media_publish",
			{ creation_id: id },
		);
		if (!/^\d+$/.test(result.id || ""))
			throw new Error(
				"A publicação não retornou confirmação. Revise a conta antes de tentar novamente.",
			);
		return result;
	}
	published(id) {
		return this.request("/" + id + "?fields=id,permalink,timestamp");
	}
}
export function accountClient(accountId) {
	const account = readWorkspace().accounts.find((a) => a.id === accountId);
	const token = vault().accounts[accountId];
	if (!account || !token)
		throw new Error("Conecte essa conta em Configurações → Instagram.");
	return new InstagramClient(account, token);
}
export async function verifyAccount(accountId) {
	try {
		const profile = await accountClient(accountId).profile();
		if (!profile.username || !/^\d+$/.test(String(profile.id || "")))
			throw new Error("A Meta não confirmou o perfil profissional.");
		changeWorkspace((state) =>
			Object.assign(
				state.accounts.find((a) => a.id === accountId),
				{
					igUserId: String(profile.id),
					username: profile.username,
					status: "connected",
					error: null,
					verifiedAt: new Date().toISOString(),
					followers: profile.followers_count ?? null,
					mediaCount: profile.media_count ?? null,
				},
			),
		);
		return profile;
	} catch (error) {
		changeWorkspace((state) => {
			const a = state.accounts.find((a) => a.id === accountId);
			if (a) Object.assign(a, { status: "error", error: error.message });
		});
		throw error;
	}
}
export async function instagramInsights(accountId, force = false) {
	const client = accountClient(accountId);
	if (!force) {
		const cached = readInsights(accountId);
		if (cached && Date.now() - Date.parse(cached.fetchedAt) < 600000)
			return { ...cached, cached: true };
	}
	const profile = await verifyAccount(accountId);
	const payload = await client.request(
		"/" +
			client.account.igUserId +
			"/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=30",
	);
	const media = [];
	for (const item of payload.data || []) {
		let insights = {},
			insightsError;
		const common = ["views", "reach", "shares", "saved", "total_interactions"];
		try {
			let metrics;
			try {
				metrics = await client.request(
					"/" +
						item.id +
						"/insights?metric=" +
						[
							...common,
							...(item.media_type === "VIDEO"
								? ["ig_reels_avg_watch_time", "ig_reels_video_view_total_time"]
								: []),
						].join(","),
				);
			} catch {
				metrics = await client.request(
					"/" + item.id + "/insights?metric=" + common.join(","),
				);
				insightsError = "Métricas avançadas de retenção indisponíveis.";
			}
			insights = Object.fromEntries(
				(metrics.data || []).map((m) => [
					m.name,
					m.values?.[0]?.value ?? m.total_value?.value ?? null,
				]),
			);
		} catch (error) {
			insightsError = error.message;
		}
		media.push({ ...item, insights, insightsError });
	}
	// Partial provider data stays unavailable; never turn missing metrics into fake zeros.
	const totals = {};
	for (const metric of [
		"views",
		"reach",
		"shares",
		"saved",
		"total_interactions",
	]) {
		totals[metric] =
			media.length && media.every((m) => typeof m.insights[metric] === "number")
				? media.reduce((sum, m) => sum + m.insights[metric], 0)
				: null;
	}
	const result = {
		accountId,
		profile,
		media,
		totals,
		fetchedAt: new Date().toISOString(),
		cached: false,
	};
	saveInsights(accountId, result);
	return result;
}
