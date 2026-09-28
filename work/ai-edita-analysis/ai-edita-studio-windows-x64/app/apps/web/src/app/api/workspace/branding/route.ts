import {
	readFileSync,
	existsSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { z } from "zod";
import { requireLocalRequest } from "@/integrations/server";
import { workspaceError } from "@/operations/http";
import {
	dataRoot,
	publicSettings,
	readSettings,
	saveSettings,
} from "@/operations/store.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const kindSchema = z.enum(["logoLight", "logoDark", "appIcon"]);
const contentTypes = new Map([
	["image/png", "png"],
	["image/jpeg", "jpg"],
	["image/webp", "webp"],
	["image/svg+xml", "svg"],
]);
const maxAssetBytes = 2 * 1024 * 1024;

function validateImage({
	contentType,
	bytes,
}: {
	contentType: string;
	bytes: Buffer;
}) {
	const valid =
		(contentType === "image/png" &&
			bytes
				.subarray(0, 8)
				.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
		(contentType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) ||
		(contentType === "image/webp" &&
			bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
			bytes.subarray(8, 12).toString("ascii") === "WEBP");
	if (valid) return;
	if (contentType === "image/svg+xml") {
		const svg = bytes.toString("utf8");
		if (
			/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svg) &&
			!/<(?:script|foreignObject)\b|\bon\w+\s*=|(?:href|src)\s*=\s*["']https?:/i.test(
				svg,
			)
		)
			return;
	}
	throw new Error("O conteúdo do arquivo não corresponde a uma imagem segura.");
}

function assetDirectory() {
	return path.join(dataRoot(), "branding");
}

function assetCandidates(kind: string) {
	return [...contentTypes.entries()].map(([contentType, extension]) => ({
		contentType,
		file: path.join(assetDirectory(), `${kind}.${extension}`),
	}));
}

function updateAssetUrl({
	kind,
	url,
}: {
	kind: "logoLight" | "logoDark" | "appIcon";
	url: string;
}) {
	const settings = readSettings();
	const revision = settings.revision + 1;
	saveSettings({
		...settings,
		revision,
		appearance: { ...settings.appearance, [kind]: url },
	});
	return publicSettings();
}

export async function GET(request: Request) {
	try {
		const kind = kindSchema.parse(
			new URL(request.url).searchParams.get("kind"),
		);
		const asset = assetCandidates(kind).find(({ file }) => existsSync(file));
		if (!asset) return new Response("Not found", { status: 404 });
		return new Response(readFileSync(asset.file), {
			headers: {
				"Content-Type": asset.contentType,
				"Cache-Control": "private, max-age=31536000, immutable",
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		return workspaceError(error);
	}
}

export async function POST(request: Request) {
	try {
		requireLocalRequest({ request, browser: true });
		const kind = kindSchema.parse(
			new URL(request.url).searchParams.get("kind"),
		);
		const contentType =
			request.headers.get("content-type")?.split(";", 1)[0] || "";
		const extension = contentTypes.get(contentType);
		if (!extension) throw new Error("Use uma imagem PNG, JPG, WEBP ou SVG.");
		const declaredSize = Number(request.headers.get("content-length") || 0);
		if (declaredSize > maxAssetBytes)
			throw new Error("A imagem deve ter no máximo 2 MB.");
		const bytes = Buffer.from(await request.arrayBuffer());
		if (!bytes.length || bytes.length > maxAssetBytes)
			throw new Error("A imagem deve ter entre 1 byte e 2 MB.");
		validateImage({ contentType, bytes });

		mkdirSync(assetDirectory(), { recursive: true });
		for (const candidate of assetCandidates(kind)) {
			if (
				candidate.file !== path.join(assetDirectory(), `${kind}.${extension}`)
			)
				rmSync(candidate.file, { force: true });
		}
		writeFileSync(path.join(assetDirectory(), `${kind}.${extension}`), bytes, {
			mode: 0o600,
		});
		const version = Date.now();
		return Response.json(
			updateAssetUrl({
				kind,
				url: `/api/workspace/branding?kind=${kind}&v=${version}`,
			}),
		);
	} catch (error) {
		return workspaceError(error);
	}
}

export async function DELETE(request: Request) {
	try {
		requireLocalRequest({ request, browser: true });
		const kind = kindSchema.parse(
			new URL(request.url).searchParams.get("kind"),
		);
		for (const { file } of assetCandidates(kind)) rmSync(file, { force: true });
		return Response.json(updateAssetUrl({ kind, url: "" }));
	} catch (error) {
		return workspaceError(error);
	}
}
