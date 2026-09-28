// Adapted from AI Edita temporary-media-host.mjs: expose exactly ONE approved file.
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mediaHostPath } from "./store.mjs";

const TUNNEL_START_ATTEMPTS = 3;
// Quick Tunnel prints its public hostname before every recursive DNS resolver
// can see it. Keep the same route alive long enough for propagation; replacing
// the hostname every few seconds restarts that propagation window.
const PUBLIC_ROUTE_VALIDATION_ATTEMPTS = 60;
const PUBLIC_ROUTE_VALIDATION_INTERVAL_MS = 1500;

export class MediaHostUnavailableError extends Error {
	constructor(message) {
		super(message);
		this.name = "MediaHostUnavailableError";
		this.code = "MEDIA_HOST_UNAVAILABLE";
		this.retryable = true;
	}
}

function networkReason(error) {
	const cause = error?.cause;
	return [cause?.code, cause?.message || error?.message]
		.filter(Boolean)
		.join(": ")
		.slice(0, 500);
}

async function stopTunnel(child) {
	if (!child || child.exitCode !== null) return;
	child.kill();
	await Promise.race([
		new Promise((resolve) => child.once("exit", resolve)),
		new Promise((resolve) => setTimeout(resolve, 2000)),
	]);
}

async function tunnelAddress(child) {
	return new Promise((resolve, reject) => {
		let output = "",
			settled = false;
		const finish = (error, url) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (error) reject(error);
			else resolve(url);
		};
		const timer = setTimeout(
			() => finish(new Error("o endereço HTTPS temporário não ficou pronto")),
			45000,
		);
		const collect = (chunk) => {
			output = (output + chunk.toString()).slice(-10000);
			const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
			if (match) finish(null, match[0]);
		};
		child.stdout.on("data", collect);
		child.stderr.on("data", collect);
		child.once("error", (error) =>
			finish(new Error(`falha ao iniciar o túnel: ${networkReason(error)}`)),
		);
		child.once("exit", (code) =>
			finish(
				new Error(`o túnel encerrou antes de ficar pronto (código ${code})`),
			),
		);
	});
}

async function validatePublicVideo(
	videoUrl,
	size,
	isStopped,
	{ fetchImpl, wait },
) {
	let lastCheck = "o endereço não respondeu";
	for (
		let attempt = 0;
		attempt < PUBLIC_ROUTE_VALIDATION_ATTEMPTS && !isStopped();
		attempt++
	) {
		try {
			const head = await fetchImpl(videoUrl, {
				method: "HEAD",
				redirect: "error",
				signal: AbortSignal.timeout(5000),
			});
			const range = await fetchImpl(videoUrl, {
				method: "GET",
				headers: { Range: "bytes=0-0" },
				redirect: "error",
				signal: AbortSignal.timeout(5000),
			});
			const sample = await range.arrayBuffer();
			const headType = head.headers.get("content-type") || "";
			const rangeType = range.headers.get("content-type") || "";
			lastCheck = [
				`HEAD HTTP ${head.status}`,
				`tamanho ${head.headers.get("content-length") || "ausente"}/${size}`,
				`tipo HEAD ${headType || "ausente"}`,
				`Range HTTP ${range.status}`,
				`Content-Range ${range.headers.get("content-range") || "ausente"}`,
				`tipo Range ${rangeType || "ausente"}`,
				`amostra ${sample.byteLength} byte(s)`,
			].join(", ");
			if (
				head.ok &&
				Number(head.headers.get("content-length")) === size &&
				headType.toLowerCase().startsWith("video/mp4") &&
				range.status === 206 &&
				range.headers.get("content-range") === `bytes 0-0/${size}` &&
				rangeType.toLowerCase().startsWith("video/mp4") &&
				sample.byteLength === 1
			)
				return { reachable: true, lastCheck };
		} catch (error) {
			lastCheck = networkReason(error) || "falha de rede desconhecida";
			/* DNS propagation may lag behind the tunnel announcement. */
		}
		await wait(PUBLIC_ROUTE_VALIDATION_INTERVAL_MS);
	}
	return { reachable: false, lastCheck };
}

export async function startMediaHost(
	file,
	{
		spawnImpl = spawn,
		fetchImpl = fetch,
		wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	} = {},
) {
	const executable = mediaHostPath();
	if (!executable)
		throw new Error(
			"Cloudflare Tunnel não configurado. Revise Configurações → Publicação.",
		);
	const size = fs.statSync(file).size;
	const route = "/media/" + randomBytes(32).toString("hex") + ".mp4";
	const server = http.createServer((req, res) => {
		if (req.url !== route || !["GET", "HEAD"].includes(req.method)) {
			res.writeHead(404).end();
			return;
		}
		let start = 0,
			end = size - 1;
		if (req.headers.range) {
			const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
			if (!match) {
				res.writeHead(416).end();
				return;
			}
			start = Number(match[1]);
			end = match[2] ? Math.min(Number(match[2]), size - 1) : end;
			if (start > end || start >= size) {
				res.writeHead(416).end();
				return;
			}
		}
		res.writeHead(req.headers.range ? 206 : 200, {
			"Content-Type": "video/mp4",
			"Content-Length": end - start + 1,
			"Accept-Ranges": "bytes",
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
			...(req.headers.range
				? { "Content-Range": "bytes " + start + "-" + end + "/" + size }
				: {}),
		});
		if (req.method === "HEAD") res.end();
		else
			fs.createReadStream(file, { start, end })
				.on("error", () => res.destroy())
				.pipe(res);
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	let stopped = false;
	let child = null;
	const stop = async () => {
		if (stopped) return;
		stopped = true;
		await stopTunnel(child);
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	};
	const expiry = setTimeout(() => void stop(), 20 * 60000);
	expiry.unref();
	try {
		let lastCheck = "o endereço não respondeu";
		for (
			let tunnelAttempt = 1;
			tunnelAttempt <= TUNNEL_START_ATTEMPTS && !stopped;
			tunnelAttempt++
		) {
			child = spawnImpl(
				executable,
				[
					"tunnel",
					"--url",
					"http://127.0.0.1:" + server.address().port,
					"--protocol",
					"http2",
					"--no-autoupdate",
					"--loglevel",
					"info",
				],
				{ windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
			);
			try {
				const base = await tunnelAddress(child);
				const videoUrl = base + route;
				const validation = await validatePublicVideo(
					videoUrl,
					size,
					() => stopped,
					{ fetchImpl, wait },
				);
				lastCheck = validation.lastCheck;
				if (validation.reachable)
					return {
						videoUrl,
						stop: async () => {
							clearTimeout(expiry);
							await stop();
						},
					};
			} catch (error) {
				lastCheck = networkReason(error) || "falha de rede desconhecida";
			}
			await stopTunnel(child);
			child = null;
			if (tunnelAttempt < TUNNEL_START_ATTEMPTS) await wait(1500);
		}
		throw new MediaHostUnavailableError(
			`A conexão temporária oscilou após ${TUNNEL_START_ATTEMPTS} rotas (${lastCheck}).`,
		);
	} catch (error) {
		clearTimeout(expiry);
		await stop();
		throw error;
	}
}
