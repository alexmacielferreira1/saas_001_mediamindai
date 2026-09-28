import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireLocalRequest, IntegrationError } from "@/integrations/server";
import { workspaceError } from "@/operations/http";
import { dataRoot } from "@/operations/store.mjs";
import { mergeProjectElementLibraries } from "@/services/storage/project-element-merge";
import {
	clearDocuments,
	changeDocument,
	deleteDocument,
	getAllDocuments,
	getDocument,
	listDocuments,
	setDocument,
} from "@/operations/sqlite-store.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const querySchema = z.object({
	collection: z.enum([
		"projects",
		"saved-sounds",
		"media-metadata",
		"media-files",
	]),
	projectId: z
		.string()
		.regex(/^[a-zA-Z0-9_-]{1,128}$/)
		.optional(),
	key: z
		.string()
		.regex(/^[a-zA-Z0-9_-]{1,128}$/)
		.optional(),
	values: z.enum(["0", "1"]).optional(),
});

type StorageQuery = z.infer<typeof querySchema>;

function requirePortableMode(request: Request): StorageQuery {
	if (process.env.AI_EDITA_LOCAL_MODE !== "1") {
		throw new IntegrationError("Armazenamento local indisponível.", 404);
	}
	requireLocalRequest({ request, browser: false });
	if (request.headers.get("x-opencut-client") !== "integrations") {
		throw new IntegrationError("Cliente local inválido.", 403);
	}

	const url = new URL(request.url);
	const parsed = querySchema.parse({
		collection: url.searchParams.get("collection"),
		projectId: url.searchParams.get("projectId") || undefined,
		key: url.searchParams.get("key") || undefined,
		values: url.searchParams.get("values") || undefined,
	});

	if (
		(parsed.collection === "media-metadata" ||
			parsed.collection === "media-files") &&
		!parsed.projectId
	) {
		throw new IntegrationError("Projeto não informado.");
	}

	return parsed;
}

function collectionDirectory(query: StorageQuery) {
	return path.join(dataRoot(), "editor", "media", query.projectId!, "files");
}

function namespace(query: StorageQuery) {
	return query.projectId
		? `${query.collection}:${query.projectId}`
		: query.collection;
}

function itemPath(query: StorageQuery) {
	if (!query.key) throw new IntegrationError("Chave não informada.");
	return path.join(collectionDirectory(query), `${query.key}.bin`);
}

function listKeys(query: StorageQuery) {
	return listDocuments({ root: dataRoot(), namespace: namespace(query) });
}

function jsonResponse({
	value,
	status = 200,
}: {
	value: unknown;
	status?: number;
}) {
	return Response.json(value, {
		status,
		headers: { "Cache-Control": "no-store" },
	});
}

async function writeFile({
	request,
	query,
}: {
	request: Request;
	query: StorageQuery;
}) {
	const file = itemPath(query);
	if (!query.key) throw new IntegrationError("Chave não informada.");
	const directory = path.dirname(file);
	fs.mkdirSync(directory, { recursive: true });

	const temp = `${file}.${randomBytes(8).toString("hex")}.tmp`;
	const handle = await fs.promises.open(temp, "wx", 0o600);
	let bytes = 0;
	try {
		const reader = request.body?.getReader();
		if (!reader) throw new IntegrationError("Arquivo vazio.");
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			bytes += chunk.value.byteLength;
			await handle.writeFile(chunk.value);
		}
	} catch (error) {
		await handle.close().catch(() => {});
		await fs.promises.unlink(temp).catch(() => {});
		throw error;
	}
	await handle.close();

	await fs.promises.rm(file, { force: true });
	await fs.promises.rename(temp, file);
	setDocument({
		root: dataRoot(),
		namespace: namespace(query),
		key: query.key,
		value: {
			name: path.basename(
				decodeURIComponent(request.headers.get("x-ai-file-name") || query.key),
			),
			type: request.headers.get("content-type") || "application/octet-stream",
			lastModified:
				Number(request.headers.get("x-ai-last-modified")) || Date.now(),
			bytes,
		},
	});
	return jsonResponse({ value: { ok: true, bytes } });
}

function readFile(query: StorageQuery) {
	const file = itemPath(query);
	if (!fs.existsSync(file)) return new Response(null, { status: 404 });
	if (!query.key) throw new IntegrationError("Chave não informada.");
	const metadataResult = z
		.object({
			name: z.string().optional(),
			type: z.string().optional(),
			lastModified: z.number().optional(),
		})
		.safeParse(
			getDocument({
				root: dataRoot(),
				namespace: namespace(query),
				key: query.key,
			}),
		);
	const metadata = metadataResult.success ? metadataResult.data : null;
	const size = fs.statSync(file).size;
	const iterator = fs.createReadStream(file)[Symbol.asyncIterator]();
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
		headers: {
			"Cache-Control": "no-store",
			"Content-Length": String(size),
			"Content-Type": metadata?.type || "application/octet-stream",
			"X-AI-File-Name": encodeURIComponent(metadata?.name || query.key),
			"X-AI-Last-Modified": String(metadata?.lastModified || Date.now()),
			"X-Content-Type-Options": "nosniff",
		},
	});
}

export async function GET(request: Request) {
	try {
		const query = requirePortableMode(request);
		if (query.key) {
			if (query.collection === "media-files") return readFile(query);
			const value = getDocument({
				root: dataRoot(),
				namespace: namespace(query),
				key: query.key,
			});
			return value === null
				? new Response(null, { status: 404 })
				: jsonResponse({ value });
		}

		const keys = listKeys(query);
		if (query.values !== "1") return jsonResponse({ value: keys });
		if (query.collection === "media-files") {
			throw new IntegrationError("Listagem de arquivos inválida.");
		}
		return jsonResponse({
			value: getAllDocuments({
				root: dataRoot(),
				namespace: namespace(query),
			}).map((item: { value: unknown }) => item.value),
		});
	} catch (error) {
		return workspaceError(error);
	}
}

export async function PUT(request: Request) {
	try {
		const query = requirePortableMode(request);
		if (!query.key) throw new IntegrationError("Chave não informada.");
		if (query.collection === "media-files")
			return await writeFile({ request, query });
		if (!request.headers.get("content-type")?.startsWith("application/json")) {
			throw new IntegrationError("JSON inválido.", 415);
		}
		if (Number(request.headers.get("content-length") || 0) > 64 * 1024 * 1024) {
			throw new IntegrationError("Registro local muito grande.", 413);
		}
		const incoming: unknown = await request.json();
		if (query.collection === "projects") {
			const document = z.record(z.string(), z.unknown()).parse(incoming);
			changeDocument({
				root: dataRoot(),
				namespace: namespace(query),
				key: query.key,
				fallback: () => ({}),
				change: (stored: Record<string, unknown>) => {
					const oldSettings = z
						.record(z.string(), z.unknown())
						.safeParse(stored.settings);
					const nextSettings = z
						.record(z.string(), z.unknown())
						.safeParse(document.settings);
					const previous = oldSettings.success
						? oldSettings.data.elementLibrary
						: undefined;
					const next = nextSettings.success
						? nextSettings.data.elementLibrary
						: undefined;
					if (previous || next) {
						document.settings = {
							...(nextSettings.success ? nextSettings.data : {}),
							elementLibrary: mergeProjectElementLibraries({
								current: previous,
								incoming: next,
								knownMediaIds: Object.keys(stored).length
									? listDocuments({
											root: dataRoot(),
											namespace: `media-metadata:${query.key}`,
										})
									: undefined,
							}),
						};
					}
					for (const key of Object.keys(stored)) delete stored[key];
					Object.defineProperties(
						stored,
						Object.getOwnPropertyDescriptors(document),
					);
				},
			});
		} else {
			setDocument({
				root: dataRoot(),
				namespace: namespace(query),
				key: query.key,
				value: incoming,
			});
		}
		return jsonResponse({ value: { ok: true } });
	} catch (error) {
		return workspaceError(error);
	}
}

export async function DELETE(request: Request) {
	try {
		const query = requirePortableMode(request);
		if (query.key) {
			if (query.collection === "media-files") {
				await fs.promises.rm(itemPath(query), { force: true });
			}
			deleteDocument({
				root: dataRoot(),
				namespace: namespace(query),
				key: query.key,
			});
		} else {
			if (query.collection === "media-files") {
				await fs.promises.rm(collectionDirectory(query), {
					recursive: true,
					force: true,
				});
			}
			clearDocuments({
				root: dataRoot(),
				namespace: namespace(query),
			});
		}
		return jsonResponse({ value: { ok: true } });
	} catch (error) {
		return workspaceError(error);
	}
}
