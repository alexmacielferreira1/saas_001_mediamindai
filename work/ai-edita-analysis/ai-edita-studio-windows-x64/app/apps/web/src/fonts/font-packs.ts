"use client";

import { useEffect, useSyncExternalStore } from "react";
import { z } from "zod";

const DATABASE_NAME = "ai-edita-font-packs";
const STORE_NAME = "items";
const DATABASE_VERSION = 1;
const CATALOG_KEY = "catalog";
const MAX_FONT_BYTES = 8 * 1024 * 1024;
export const MAX_FONT_PACK_BYTES = 128 * 1024 * 1024;
const PACK_FAMILY_PREFIX = "AI Edita Pack - ";

const safeFamily = z
	.string()
	.min(PACK_FAMILY_PREFIX.length + 1)
	.max(120)
	.startsWith(PACK_FAMILY_PREFIX)
	.refine(
		(value) =>
			!/[<>{};"'\\/\r\n]/.test(value) &&
			!value.toLocaleLowerCase().includes("url("),
		"Invalid packaged font family.",
	);

export const fontPackManifestSchema = z
	.object({
		id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,99}$/),
		name: z.string().min(1).max(100),
		publisher: z.string().min(1).max(100),
		release: z.string().min(1).max(40),
		description: z.string().max(500),
		rightsNotice: z.string().min(1).max(1000),
	})
	.strict();

export const fontPackAssetSchema = z
	.object({
		id: z.string().regex(/^[a-f0-9]{64}$/),
		family: safeFamily,
		label: z.string().min(1).max(100),
		weight: z.number().int().min(100).max(900),
		style: z.enum(["normal", "italic"]),
		fileName: z
			.string()
			.min(1)
			.max(160)
			.refine((value) => !/[\\/\r\n]/.test(value)),
		mimeType: z.enum(["font/otf", "font/ttf"]),
		bytes: z.number().int().positive().max(MAX_FONT_BYTES),
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
		data: z
			.string()
			.min(4)
			.max(Math.ceil((MAX_FONT_BYTES * 4) / 3) + 8),
	})
	.strict()
	.refine((font) => font.id === font.sha256, {
		message: "Font id must match its SHA-256.",
	});

export const fontPackSchema = z
	.object({
		format: z.literal("ai-edita-font-pack"),
		version: z.literal(1),
		manifest: fontPackManifestSchema,
		fonts: z.array(fontPackAssetSchema).min(1).max(500),
	})
	.strict();

export type FontPack = z.infer<typeof fontPackSchema>;
export type FontPackManifest = z.infer<typeof fontPackManifestSchema>;
export type FontPackAsset = z.infer<typeof fontPackAssetSchema>;

export type InstalledFontPack = FontPackManifest & {
	fontCount: number;
	familyCount: number;
};

type StoredFontMetadata = Omit<FontPackAsset, "data"> & {
	packId: string;
	storageKey: string;
};

type FontCatalog = {
	id: typeof CATALOG_KEY;
	kind: "catalog";
	version: 1;
	packs: InstalledFontPack[];
	fonts: StoredFontMetadata[];
};

type StoredFont = StoredFontMetadata & {
	id: string;
	kind: "font";
	data: ArrayBuffer;
};

const EMPTY_CATALOG: FontCatalog = {
	id: CATALOG_KEY,
	kind: "catalog",
	version: 1,
	packs: [],
	fonts: [],
};

let catalogSnapshot = EMPTY_CATALOG;
let catalogPromise: Promise<FontCatalog> | null = null;
const listeners = new Set<() => void>();
const loadedFaces = new Map<string, Promise<void>>();

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = () => {
			const database = request.result;
			if (!database.objectStoreNames.contains(STORE_NAME))
				database.createObjectStore(STORE_NAME, { keyPath: "id" });
		};
	});
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
	});
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () =>
			reject(transaction.error ?? new Error("Font transaction aborted."));
	});
}

function emitCatalog(next: FontCatalog) {
	catalogSnapshot = next;
	for (const listener of listeners) listener();
}

export async function loadFontCatalog(): Promise<FontCatalog> {
	if (catalogPromise) return catalogPromise;
	catalogPromise = (async () => {
		const database = await openDatabase();
		try {
			const transaction = database.transaction(STORE_NAME, "readonly");
			const saved = await requestResult<FontCatalog | undefined>(
				transaction.objectStore(STORE_NAME).get(CATALOG_KEY),
			);
			if (
				saved?.kind !== "catalog" ||
				saved.version !== 1 ||
				!Array.isArray(saved.fonts) ||
				!Array.isArray(saved.packs)
			)
				return EMPTY_CATALOG;
			emitCatalog(saved);
			return saved;
		} finally {
			database.close();
		}
	})();
	try {
		return await catalogPromise;
	} catch (error) {
		catalogPromise = null;
		throw error;
	}
}

function subscribeCatalog(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useFontPackCatalog() {
	const catalog = useSyncExternalStore(
		subscribeCatalog,
		() => catalogSnapshot,
		() => EMPTY_CATALOG,
	);
	useEffect(() => {
		void loadFontCatalog();
	}, []);
	return catalog;
}

export function usePackagedFontFamilies() {
	const catalog = useFontPackCatalog();
	return [...new Set(catalog.fonts.map((font) => font.family))];
}

export function packagedFontLabel({ family }: { family: string }) {
	return (
		catalogSnapshot.fonts.find((font) => font.family === family)?.label ??
		family
	);
}

export function isPackagedFont({ family }: { family: string }) {
	return catalogSnapshot.fonts.some((font) => font.family === family);
}

function decodeBase64(value: string): ArrayBuffer {
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value))
		throw new Error("Invalid packaged font encoding.");
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++)
		bytes[index] = binary.charCodeAt(index);
	return bytes.buffer;
}

function validFontSignature(buffer: ArrayBuffer) {
	const bytes = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
	if (bytes.length !== 4) return false;
	const tag = String.fromCharCode(...bytes);
	return (
		tag === "OTTO" ||
		tag === "true" ||
		tag === "typ1" ||
		(bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0)
	);
}

async function sha256(buffer: ArrayBuffer) {
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
	return [...digest]
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
}

async function prepareFont({
	font,
	packId,
}: {
	font: FontPackAsset;
	packId: string;
}): Promise<StoredFont> {
	const data = decodeBase64(font.data);
	if (data.byteLength !== font.bytes)
		throw new Error(`Tamanho inválido: ${font.label} / Invalid size.`);
	if (!validFontSignature(data))
		throw new Error(`Arquivo de fonte inválido: ${font.label} / Invalid font.`);
	if ((await sha256(data)) !== font.sha256)
		throw new Error(`SHA-256 inválido: ${font.label} / Invalid checksum.`);
	const face = new FontFace(font.family, data.slice(0), {
		weight: String(font.weight),
		style: font.style,
	});
	try {
		await face.load();
	} catch {
		throw new Error(`Fonte incompatível: ${font.label} / Unsupported font.`);
	}
	const storageKey = `font:${packId}:${font.id}`;
	return {
		...font,
		id: storageKey,
		packId,
		storageKey,
		kind: "font",
		data,
	};
}

export async function installFontPack(input: FontPack) {
	const pack = fontPackSchema.parse(input);
	const seenHashes = new Set<string>();
	const seenFaces = new Set<string>();
	for (const font of pack.fonts) {
		if (seenHashes.has(font.sha256))
			throw new Error(`Fonte duplicada: ${font.label} / Duplicate font.`);
		seenHashes.add(font.sha256);
		const face = `${font.family}\u0000${font.weight}\u0000${font.style}`;
		if (seenFaces.has(face))
			throw new Error(`Estilo duplicado: ${font.label} / Duplicate face.`);
		seenFaces.add(face);
	}

	const prepared: StoredFont[] = [];
	for (const font of pack.fonts)
		prepared.push(await prepareFont({ font, packId: pack.manifest.id }));

	const current = await loadFontCatalog();
	const previous = current.packs.find((item) => item.id === pack.manifest.id);
	const remainingFonts = current.fonts.filter(
		(font) => font.packId !== pack.manifest.id,
	);
	const metadata = prepared.map(
		({ data: _data, kind: _kind, ...font }) => font,
	);
	const next: FontCatalog = {
		id: CATALOG_KEY,
		kind: "catalog",
		version: 1,
		packs: [
			...current.packs.filter((item) => item.id !== pack.manifest.id),
			{
				...pack.manifest,
				fontCount: prepared.length,
				familyCount: new Set(metadata.map((font) => font.family)).size,
			},
		],
		fonts: [...remainingFonts, ...metadata],
	};

	const database = await openDatabase();
	try {
		const transaction = database.transaction(STORE_NAME, "readwrite");
		const store = transaction.objectStore(STORE_NAME);
		for (const old of current.fonts.filter(
			(font) => font.packId === pack.manifest.id,
		))
			store.delete(old.storageKey);
		for (const font of prepared) store.put(font);
		store.put(next);
		await transactionComplete(transaction);
	} finally {
		database.close();
	}
	loadedFaces.clear();
	catalogPromise = Promise.resolve(next);
	emitCatalog(next);
	return {
		installed: prepared.length,
		families: new Set(metadata.map((font) => font.family)).size,
		updated: Boolean(previous),
	};
}

async function loadStoredFace(font: StoredFontMetadata) {
	if (loadedFaces.has(font.storageKey)) return loadedFaces.get(font.storageKey);
	const task = (async () => {
		const database = await openDatabase();
		try {
			const transaction = database.transaction(STORE_NAME, "readonly");
			const stored = await requestResult<StoredFont | undefined>(
				transaction.objectStore(STORE_NAME).get(font.storageKey),
			);
			if (!stored?.data) throw new Error(`Fonte não encontrada: ${font.label}`);
			const face = new FontFace(font.family, stored.data, {
				weight: String(font.weight),
				style: font.style,
			});
			await face.load();
			document.fonts.add(face);
		} finally {
			database.close();
		}
	})();
	loadedFaces.set(font.storageKey, task);
	try {
		await task;
	} catch (error) {
		loadedFaces.delete(font.storageKey);
		throw error;
	}
}

export async function ensurePackagedFont({ family }: { family: string }) {
	const catalog = await loadFontCatalog();
	const fonts = catalog.fonts.filter((font) => font.family === family);
	if (!fonts.length) return false;
	await Promise.all(fonts.map(loadStoredFace));
	return true;
}
