import fs from "node:fs";
import { z } from "zod";
import { requireLocalRequest, IntegrationError } from "@/integrations/server";
import { workspaceError } from "@/operations/http";
import {
	librarySnapshot,
	migrateProjectElements,
	readElementLibrary,
	updateLocalElementFolder,
	storeLibraryImage,
	readLibraryAsset,
	libraryAssetPath,
} from "@/services/storage/local-element-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
function authorize(request: Request) {
	if (process.env.AI_EDITA_LOCAL_MODE !== "1")
		throw new IntegrationError(
			"A biblioteca do computador está disponível no aplicativo local do AI Edita.",
			404,
		);
	requireLocalRequest({ request, browser: false });
	if (request.headers.get("x-opencut-client") !== "integrations")
		throw new IntegrationError("Cliente local inválido.", 403);
}
const json = (value: unknown) =>
	Response.json(value, { headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
	try {
		authorize(request);
		const id = new URL(request.url).searchParams.get("file");
		if (!id) return json(librarySnapshot());
		const asset = readLibraryAsset(id);
		if (!asset || !fs.existsSync(libraryAssetPath(asset)))
			return new Response(null, { status: 404 });
		// Elements have a validated 30 MiB limit; originals retain alpha and full resolution.
		return new Response(await fs.promises.readFile(libraryAssetPath(asset)), {
			headers: {
				"Content-Type": asset.mime,
				"Content-Length": String(asset.size),
				"X-AI-File-Name": encodeURIComponent(asset.name),
				"X-AI-Last-Modified": String(asset.lastModified),
				"Cache-Control": "no-store",
				"X-Content-Type-Options": "nosniff",
				"Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
			},
		});
	} catch (error) {
		return workspaceError(error);
	}
}
export async function POST(request: Request) {
	try {
		authorize(request);
		const contentType = request.headers.get("content-type") ?? "";
		if (contentType.startsWith("application/json")) {
			if (Number(request.headers.get("content-length") ?? 0) > 4096)
				throw new IntegrationError("Solicitação muito grande.", 413);
			const input = z
				.discriminatedUnion("action", [
					z.object({ action: z.literal("sync") }),
					z.object({
						action: z.literal("folder"),
						name: z.string(),
						folderId: z.string().optional(),
					}),
				])
				.parse(await request.json());
			if (input.action === "sync")
				return json(librarySnapshot(await migrateProjectElements()));
			return json(updateLocalElementFolder(input));
		}
		if (!contentType.startsWith("multipart/form-data"))
			throw new IntegrationError("Envio de imagem inválido.", 415);
		if (Number(request.headers.get("content-length") ?? 0) > 33 * 1024 * 1024)
			throw new IntegrationError("Imagem muito grande.", 413);
		const form = await request.formData();
		const file = form.get("file");
		if (!(file instanceof File) || !file.size || file.size > 30 * 1024 * 1024)
			throw new IntegrationError("Selecione uma imagem de até 30 MB.");
		const folderId = z.string().parse(form.get("folderId"));
		const folder = readElementLibrary().folders.find((f) => f.id === folderId);
		if (!folder)
			throw new IntegrationError("Pasta não encontrada na biblioteca.");
		const preview = z
			.object({
				width: z.number().positive(),
				height: z.number().positive(),
				thumbnailUrl: z.string().max(2 * 1024 * 1024),
			})
			.parse(JSON.parse(z.string().parse(form.get("preview"))));
		const { asset, sha256 } = await storeLibraryImage({
			bytes: Buffer.from(await file.arrayBuffer()),
			metadata: {
				...preview,
				name: file.name,
				lastModified: Number(form.get("lastModified")) || Date.now(),
			},
		});
		const result = updateLocalElementFolder({
			folderId,
			name: folder.name,
			additions: [{ mediaId: asset.id, sha256 }],
		});
		return json({
			...result,
			asset,
			duplicate: folder.items.some((i) => i.sha256 === sha256),
		});
	} catch (error) {
		return workspaceError(error);
	}
}
