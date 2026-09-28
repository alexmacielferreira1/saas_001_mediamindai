import { z } from "zod";

export const elementLibrarySchema = z.object({
	folders: z.array(
		z.object({
			id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
			name: z.string(),
			items: z.array(
				z.object({
					mediaId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
					sha256: z.string(),
				}),
			),
		}),
	),
});
export type ElementLibrary = z.infer<typeof elementLibrarySchema>;
export type ElementFolder = ElementLibrary["folders"][number];
export const EMPTY_ELEMENT_LIBRARY: ElementLibrary = { folders: [] };
export const elementUpdateSchema = z.object({
	library: elementLibrarySchema,
	folderId: z.string(),
});
export const elementFilesSchema = z.object({
	accepted: z.array(
		z.object({ index: z.number().int(), sha256: z.string(), mime: z.string() }),
	),
	rejected: z.array(z.object({ name: z.string(), reason: z.string() })),
	duplicates: z.number(),
});
export const libraryAssetSchema = z.object({
	id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
	name: z.string().max(1024),
	type: z.literal("image"),
	mime: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
	size: z.number().nonnegative(),
	lastModified: z.number(),
	width: z.number().positive().optional(),
	height: z.number().positive().optional(),
	thumbnailUrl: z
		.string()
		.max(2 * 1024 * 1024)
		.regex(/^data:image\/(png|jpeg|webp);base64,/)
		.optional(),
});
export type LibraryAsset = z.infer<typeof libraryAssetSchema>;
export const librarySnapshotSchema = z.object({
	library: elementLibrarySchema,
	assets: z.array(libraryAssetSchema),
	directory: z.string(),
	warnings: z.array(z.string()).default([]),
});
