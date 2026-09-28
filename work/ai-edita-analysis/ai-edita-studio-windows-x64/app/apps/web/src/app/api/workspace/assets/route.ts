import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireLocalRequest } from "@/integrations/server";
import { workspaceError } from "@/operations/http";
import {
	dataRoot,
	changeWorkspace,
	readWorkspace,
} from "@/operations/store.mjs";
import { probeMedia } from "@/operations/probe.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(request: Request) {
	let file: string | undefined;
	try {
		requireLocalRequest({ request, browser: true });
		const kind =
			request.headers.get("x-ai-kind") === "export" ? "export" : "source";
		const mimeType = request.headers.get("content-type") || "";
		if (!["video/mp4", "video/quicktime", "video/webm"].includes(mimeType))
			throw new Error("Envie MP4, MOV ou WebM.");
		if (kind === "export" && mimeType !== "video/mp4")
			throw new Error("Exporte em MP4 para publicar.");
		const max = 500 * 1024 * 1024;
		if (Number(request.headers.get("content-length")) > max)
			throw new Error("Limite: 500 MB por vídeo.");
		const id = randomUUID();
		const name = path
			.basename(
				decodeURIComponent(request.headers.get("x-ai-filename") || "video.mp4"),
			)
			.replace(/[\r\n]/g, "")
			.slice(0, 180);
		const projectId = request.headers.get("x-ai-project") || undefined;
		if (projectId && !/^[a-f0-9-]{36}$/.test(projectId))
			throw new Error("Projeto inválido.");
		const directory = path.join(dataRoot(), "media");
		fs.mkdirSync(directory, { recursive: true });
		file = path.join(
			directory,
			id +
				(mimeType === "video/quicktime"
					? ".mov"
					: mimeType === "video/webm"
						? ".webm"
						: ".mp4"),
		);
		const handle = await fs.promises.open(file, "wx");
		let bytes = 0;
		try {
			const reader = request.body?.getReader();
			if (!reader) throw new Error("Arquivo vazio.");
			while (true) {
				const chunk = await reader.read();
				if (chunk.done) break;
				bytes += chunk.value.byteLength;
				if (bytes > max) {
					await reader.cancel();
					throw new Error("Limite: 500 MB por vídeo.");
				}
				await handle.writeFile(chunk.value);
			}
		} finally {
			await handle.close();
		}
		if (bytes < 32) throw new Error("Arquivo de vídeo inválido.");
		const media = await probeMedia(file, kind);
		const asset = {
			id,
			name,
			kind,
			mimeType,
			bytes,
			projectId,
			file,
			createdAt: new Date().toISOString(),
			media,
		};
		changeWorkspace((state: { assets: Array<typeof asset> }) =>
			state.assets.push(asset),
		);
		const { file: _file, ...safe } = asset;
		return Response.json(safe, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		if (file) await fs.promises.unlink(file).catch(() => {});
		return workspaceError(error);
	}
}
export async function GET(request: Request) {
	try {
		requireLocalRequest({ request, browser: false });
		const id = new URL(request.url).searchParams.get("id");
		const asset = readWorkspace().assets.find(
			(a: { id: string }) => a.id === id,
		);
		if (!asset || !fs.existsSync(asset.file))
			return new Response("Arquivo não encontrado", { status: 404 });
		const range = request.headers.get("range");
		const match = range && /^bytes=(\d+)-(\d*)$/.exec(range);
		const start = match ? Number(match[1]) : 0;
		const end =
			match && match[2]
				? Math.min(Number(match[2]), asset.bytes - 1)
				: asset.bytes - 1;
		if ((range && !match) || start > end || start >= asset.bytes)
			return new Response(null, {
				status: 416,
				headers: { "Content-Range": "bytes */" + asset.bytes },
			});
		const iterator = fs
			.createReadStream(asset.file, { start, end })
			[Symbol.asyncIterator]();
		const stream = new ReadableStream<Uint8Array>({
			async pull(controller) {
				const next = await iterator.next();
				if (next.done) controller.close();
				else if (Buffer.isBuffer(next.value)) controller.enqueue(next.value);
				else controller.error(new Error("Falha ao ler mídia."));
			},
			async cancel() {
				await iterator.return?.();
			},
		});
		return new Response(stream, {
			status: match ? 206 : 200,
			headers: {
				"Content-Type": asset.mimeType,
				"Content-Length": String(end - start + 1),
				"Accept-Ranges": "bytes",
				...(match
					? {
							"Content-Range": "bytes " + start + "-" + end + "/" + asset.bytes,
						}
					: {}),
				"Cache-Control": "no-store",
				"X-Content-Type-Options": "nosniff",
				"Content-Disposition":
					"inline; filename*=UTF-8''" + encodeURIComponent(asset.name),
			},
		});
	} catch (error) {
		return workspaceError(error);
	}
}
