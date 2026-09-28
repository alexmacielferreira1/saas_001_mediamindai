import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { dataRoot } from "@/operations/store.mjs";
import {
	changeDocument,
	getAllDocuments,
	getDocument,
	setDocument,
} from "@/operations/sqlite-store.mjs";
import { runElementLibraryEngine } from "./project-element-merge";
import {
	elementLibrarySchema,
	elementUpdateSchema,
	elementFilesSchema,
	libraryAssetSchema,
	EMPTY_ELEMENT_LIBRARY,
	type ElementLibrary,
	type LibraryAsset,
} from "@/stickers/element-library-contract";

const catalogNamespace = "element-library";
const mediaNamespace = "element-library-media";
const validId = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const elementLibraryDirectory = () =>
	path.join(dataRoot(), "element-library", "files");
const extension = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"image/svg+xml": "svg",
};
export function libraryAssetPath(asset: LibraryAsset) {
	return path.join(
		elementLibraryDirectory(),
		`${validId.parse(asset.id)}.${extension[asset.mime]}`,
	);
}
export function readLibraryAsset(id: string): LibraryAsset | null {
	const value: unknown = getDocument({
		root: dataRoot(),
		namespace: mediaNamespace,
		key: validId.parse(id),
	});
	return value === null ? null : libraryAssetSchema.parse(value);
}
export function readElementLibrary(): ElementLibrary {
	return elementLibrarySchema.parse(
		getDocument({
			root: dataRoot(),
			namespace: catalogNamespace,
			key: "catalog",
		}) ?? EMPTY_ELEMENT_LIBRARY,
	);
}
export function librarySnapshot(warnings: string[] = []) {
	return {
		library: readElementLibrary(),
		directory: elementLibraryDirectory(),
		warnings,
		assets: getAllDocuments({
			root: dataRoot(),
			namespace: mediaNamespace,
		}).map((row: { value: unknown }) => libraryAssetSchema.parse(row.value)),
	};
}
export function updateLocalElementFolder(args: {
	folderId?: string;
	name: string;
	additions?: { mediaId: string; sha256: string }[];
}) {
	return changeDocument({
		root: dataRoot(),
		namespace: catalogNamespace,
		key: "catalog",
		fallback: () => ({ folders: [] }),
		change: (current: ElementLibrary) => {
			const result = elementUpdateSchema.parse(
				runElementLibraryEngine({
					op: "element_library",
					library: current,
					newId: randomUUID(),
					...args,
				}),
			);
			current.folders = result.library.folders;
			return result;
		},
	});
}

/** File-system adapter; accepted formats, folder limits and deduplication come from Rust. */
export async function storeLibraryImage({
	bytes,
	metadata,
}: {
	bytes: Buffer;
	metadata: unknown;
}) {
	const input = z
		.object({
			name: z.string(),
			lastModified: z.number().optional(),
			width: z.number().optional(),
			height: z.number().optional(),
			thumbnailUrl: z.string().optional(),
		})
		.parse(metadata);
	const sha256 = createHash("sha256").update(bytes).digest("hex");
	const plan = elementFilesSchema.parse(
		runElementLibraryEngine({
			op: "element_files",
			files: [
				{
					name: input.name,
					size: bytes.length,
					sha256,
				},
			],
		}),
	);
	const accepted = plan.accepted[0];
	if (!accepted)
		throw new Error(plan.rejected[0]?.reason ?? "Imagem inválida.");
	const id = `el-${sha256}`;
	const asset =
		readLibraryAsset(id) ??
		libraryAssetSchema.parse({
			...input,
			name: path.basename(input.name),
			id,
			type: "image",
			mime: accepted.mime,
			size: bytes.length,
			lastModified: input.lastModified ?? Date.now(),
		});
	const directory = elementLibraryDirectory();
	await fs.promises.mkdir(directory, { recursive: true });
	// Content-addressed files are immutable; retries and concurrent imports share one copy.
	// Write a complete temporary file, then publish it atomically. Never truncate an existing image.
	const destination = libraryAssetPath(asset);
	if (!fs.existsSync(destination)) {
		const temp = path.join(directory, `${id}-${randomUUID()}.tmp`);
		try {
			await fs.promises.writeFile(temp, bytes, { flag: "wx", mode: 0o600 });
			try {
				await fs.promises.link(temp, destination);
			} catch (error) {
				if (
					!(
						error instanceof Error &&
						"code" in error &&
						error.code === "EEXIST"
					)
				)
					throw error;
			}
		} finally {
			await fs.promises.unlink(temp).catch(() => {});
		}
	}
	setDocument({
		root: dataRoot(),
		namespace: mediaNamespace,
		key: id,
		value: asset,
	});
	return { asset, sha256 };
}

let migration: Promise<string[]> | null = null;
export function migrateProjectElements(): Promise<string[]> {
	// Serialize migration requests from multiple browser tabs; retain old project files and settings.
	if (!migration)
		migration = migrate().finally(() => {
			migration = null;
		});
	return migration;
}
async function migrate() {
	const warnings: string[] = [];
	const projects: { key: string; value: unknown }[] = getAllDocuments({
		root: dataRoot(),
		namespace: "projects",
	});
	for (const row of projects) {
		const legacy = z
			.object({
				settings: z.object({ elementLibrary: elementLibrarySchema.optional() }),
			})
			.safeParse(row.value);
		const library = legacy.success
			? legacy.data.settings.elementLibrary
			: undefined;
		if (!library?.folders.length) continue;
		const fingerprint = createHash("sha256")
			.update(JSON.stringify(library))
			.digest("hex");
		const marker: unknown = getDocument({
			root: dataRoot(),
			namespace: "element-library-migrations",
			key: row.key,
		});
		if (marker === fingerprint) continue;
		let complete = true;
		for (const folder of library.folders) {
			try {
				const target = updateLocalElementFolder({ name: folder.name });
				for (const item of folder.items) {
					try {
						// Validate identifiers before constructing any legacy filesystem path.
						const source = path.join(
							dataRoot(),
							"editor",
							"media",
							validId.parse(row.key),
							"files",
							`${validId.parse(item.mediaId)}.bin`,
						);
						const metadata: unknown = getDocument({
							root: dataRoot(),
							namespace: `media-metadata:${row.key}`,
							key: item.mediaId,
						});
						if (!metadata || !fs.existsSync(source)) {
							complete = false;
							warnings.push(
								`${folder.name}: um arquivo antigo não foi encontrado.`,
							);
							continue;
						}
						const stored = await storeLibraryImage({
							bytes: await fs.promises.readFile(source),
							metadata,
						});
						updateLocalElementFolder({
							folderId: target.folderId,
							name: folder.name,
							additions: [{ mediaId: stored.asset.id, sha256: stored.sha256 }],
						});
					} catch (error) {
						complete = false;
						warnings.push(
							`${folder.name}: ${error instanceof Error ? error.message : "falha ao recuperar uma imagem"}`,
						);
					}
				}
			} catch (error) {
				complete = false;
				warnings.push(
					`${folder.name}: ${error instanceof Error ? error.message : "falha ao recuperar a pasta"}`,
				);
			}
		}
		if (complete)
			setDocument({
				root: dataRoot(),
				namespace: "element-library-migrations",
				key: row.key,
				value: fingerprint,
			});
	}
	return warnings;
}
