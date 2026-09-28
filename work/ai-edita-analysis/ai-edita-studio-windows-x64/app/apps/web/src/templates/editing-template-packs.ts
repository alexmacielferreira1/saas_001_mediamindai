import { strFromU8, unzip, type UnzipFileInfo } from "fflate";
import { z } from "zod";
import { normalizeArchivePath } from "./archive-import";
import { editingOptionsSchema } from "./editing-contract";
import type { EditingTemplatePreset } from "./editing-template-library";
import { templateEngine } from "./engine";

// Purchased theme packs are recipe DATA only. The Rust planner re-validates every
// recipe (allow-listed keys, bounded values, shipped fonts/sounds) on install and
// again on every apply, so a tampered localStorage entry can never reach the timeline.
const STORAGE_KEY = "ai-edita-editing-template-packs-v1";
export const PACK_FORMAT = "ai-edita-editing-template-pack";
const MAX_PACK_BYTES = 512 * 1024;
const MAX_ZIP_BYTES = 8 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 64;

const installedTemplateSchema = z.strictObject({
	id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/),
	version: z.number().int().min(1).max(99),
	name: z.string().min(1).max(60),
	description: z.string().max(240),
	source: z.string().max(60),
	recipe: z.record(z.string(), z.unknown()),
});
const installedPackSchema = z.strictObject({
	manifest: z.strictObject({
		id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/),
		name: z.string().max(80),
		publisher: z.string().max(80),
		release: z.string().max(40),
		description: z.string().max(500),
		license: z.string().max(500).optional(),
	}),
	templates: z.array(installedTemplateSchema).min(1).max(20),
});
const storeSchema = z.strictObject({
	format: z.literal("ai-edita-installed-editing-template-packs"),
	version: z.literal(1),
	packs: z.array(installedPackSchema).max(50),
});

export type InstalledEditingTemplate = z.infer<typeof installedTemplateSchema>;
export type InstalledEditingTemplatePack = z.infer<typeof installedPackSchema>;

export function loadInstalledEditingTemplatePacks(): InstalledEditingTemplatePack[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? storeSchema.parse(JSON.parse(raw) as unknown).packs : [];
	} catch (error) {
		console.error("[AI Edita] Failed to restore template packs.", error);
		return [];
	}
}

function savePacks(packs: InstalledEditingTemplatePack[]) {
	const document = storeSchema.parse({
		format: "ai-edita-installed-editing-template-packs",
		version: 1,
		packs,
	});
	localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
	return document.packs;
}

export function findInstalledEditingTemplate(id: string) {
	for (const pack of loadInstalledEditingTemplatePacks()) {
		const template = pack.templates.find((item) => item.id === id);
		if (template) return template;
	}
	return undefined;
}

/** Card shown in the Templates tab for an installed theme. */
export function installedTemplateCard(
	template: InstalledEditingTemplate,
): EditingTemplatePreset {
	const captions = template.recipe.captions as { position?: unknown } | undefined;
	const motion = template.recipe.motion as { accent?: unknown } | undefined;
	const accent = typeof motion?.accent === "string" ? motion.accent : "#B9F443";
	const position =
		typeof captions?.position === "number" ? captions.position : 0.75;
	return {
		id: template.id,
		name: template.name,
		description: template.description,
		baseTemplateId: template.id,
		baseVersion: template.version,
		options: editingOptionsSchema.parse({
			accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#B9F443",
			captionPosition: Math.min(0.8, Math.max(0.52, position)),
		}),
	};
}

function isZip(bytes: Uint8Array) {
	return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function packEntriesFromZip(bytes: Uint8Array) {
	if (bytes.byteLength > MAX_ZIP_BYTES)
		throw new Error("O pacote ZIP excede 8 MB.");
	return new Promise<string[]>((resolve, reject) => {
		let entries = 0;
		let packBytes = 0;
		const filter = (file: UnzipFileInfo) => {
			entries += 1;
			if (entries > MAX_ZIP_ENTRIES)
				throw new Error("O pacote ZIP contém arquivos demais.");
			const name = normalizeArchivePath(file.name).toLowerCase();
			if (!name.endsWith(".pack.json") && !name.endsWith(".aiedita-pack"))
				return false;
			packBytes += file.originalSize;
			if (file.originalSize > MAX_PACK_BYTES || packBytes > MAX_PACK_BYTES * 4)
				throw new Error("O pacote de templates é grande demais.");
			return true;
		};
		try {
			unzip(bytes, { filter }, (error, files) => {
				if (error) reject(new Error("ZIP de templates inválido."));
				else
					resolve(
						Object.keys(files)
							.sort()
							.map((name) => strFromU8(files[name])),
					);
			});
		} catch (error) {
			reject(error instanceof Error ? error : new Error("ZIP inválido."));
		}
	});
}

/** Returns true when the file looks like a template pack (ZIP or pack JSON). */
export async function isEditingTemplatePackFile(file: File) {
	const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
	if (isZip(head)) return true;
	return new TextDecoder().decode(head).includes(`"${PACK_FORMAT}"`);
}

export async function validateEditingTemplatePack(document: unknown) {
	return installedPackSchema.parse(
		await templateEngine({ op: "editing_pack_validate", document }),
	);
}

export type PackImportStatus = "new" | "same" | "update";
export type PlannedPack = {
	pack: InstalledEditingTemplatePack;
	status: PackImportStatus;
	previousRelease?: string;
};

/**
 * Reads and validates every pack in a `.zip`, `.pack.json` or `.aiedita-pack` file without
 * installing anything, and says whether each one is new, already installed as-is, or an
 * update/replacement of an installed pack.
 */
export async function planEditingTemplatePackFile(file: File): Promise<PlannedPack[]> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	let texts: string[];
	if (isZip(bytes)) texts = await packEntriesFromZip(bytes);
	else {
		if (bytes.byteLength > MAX_PACK_BYTES)
			throw new Error("O pacote de templates excede 512 KB.");
		texts = [new TextDecoder().decode(bytes)];
	}
	if (!texts.length)
		throw new Error("Nenhum pacote de templates foi encontrado no arquivo.");
	const installed = loadInstalledEditingTemplatePacks();
	const planned: PlannedPack[] = [];
	for (const text of texts) {
		let document: unknown;
		try {
			document = JSON.parse(text.replace(/^\uFEFF/, "")) as unknown;
		} catch {
			throw new Error("O pacote de templates não é um JSON válido.");
		}
		const pack = await validateEditingTemplatePack(document);
		if (planned.some((item) => item.pack.manifest.id === pack.manifest.id)) continue;
		const current = installed.find((item) => item.manifest.id === pack.manifest.id);
		const others = installed.filter((item) => item.manifest.id !== pack.manifest.id);
		const taken = new Set(others.flatMap((item) => item.templates.map((t) => t.id)));
		const clash = pack.templates.find((template) => taken.has(template.id));
		if (clash)
			throw new Error(`O template ${clash.name} já está instalado por outro pacote.`);
		planned.push({
			pack,
			status: !current
				? "new"
				: JSON.stringify(current) === JSON.stringify(pack)
					? "same"
					: "update",
			...(current && { previousRelease: current.manifest.release }),
		});
	}
	return planned;
}

/** Installs planned packs (replacing installed packs with the same manifest id). */
export function commitEditingTemplatePacks(planned: PlannedPack[]) {
	let packs = loadInstalledEditingTemplatePacks();
	for (const { pack } of planned)
		packs = [...packs.filter((item) => item.manifest.id !== pack.manifest.id), pack];
	return savePacks(packs);
}

/**
 * Installs every pack found in a file, replacing packs with the same manifest id.
 * The Templates tab uses plan/commit instead so it can ask before replacing.
 */
export async function installEditingTemplatePackFile(file: File) {
	const bytes = new Uint8Array(await file.arrayBuffer());
	let texts: string[];
	if (isZip(bytes)) texts = await packEntriesFromZip(bytes);
	else {
		if (bytes.byteLength > MAX_PACK_BYTES)
			throw new Error("O pacote de templates excede 512 KB.");
		texts = [new TextDecoder().decode(bytes)];
	}
	if (!texts.length)
		throw new Error("Nenhum pacote de templates foi encontrado no arquivo.");
	let packs = loadInstalledEditingTemplatePacks();
	const installed: InstalledEditingTemplatePack[] = [];
	for (const text of texts) {
		let document: unknown;
		try {
			document = JSON.parse(text.replace(/^﻿/, "")) as unknown;
		} catch {
			throw new Error("O pacote de templates não é um JSON válido.");
		}
		const pack = await validateEditingTemplatePack(document);
		const others = packs.filter((item) => item.manifest.id !== pack.manifest.id);
		const taken = new Set(
			others.flatMap((item) => item.templates.map((template) => template.id)),
		);
		const clash = pack.templates.find((template) => taken.has(template.id));
		if (clash)
			throw new Error(
				`O template ${clash.name} já está instalado por outro pacote.`,
			);
		packs = [...others, pack];
		installed.push(pack);
	}
	savePacks(packs);
	return { packs, installed };
}

export function removeInstalledEditingTemplatePack(manifestId: string) {
	return savePacks(
		loadInstalledEditingTemplatePacks().filter(
			(pack) => pack.manifest.id !== manifestId,
		),
	);
}
