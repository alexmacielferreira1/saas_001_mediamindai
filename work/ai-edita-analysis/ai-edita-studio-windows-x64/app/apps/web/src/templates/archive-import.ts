import { strFromU8, unzip, type UnzipFileInfo } from "fflate";

export const MAX_TEMPLATE_ARCHIVE_BYTES = 128 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 2_000;
const MAX_DECLARED_ARCHIVE_BYTES = 1024 * 1024 * 1024;
const MAX_DRAFT_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_DRAFT_BYTES = 20 * 1024 * 1024;

export type ArchivedTemplateDocument = {
	entry: string;
	label: string;
	document: unknown;
};

function archiveError(message: string) {
	return new Error(`${message} / Invalid template ZIP.`);
}

export function normalizeArchivePath(name: string) {
	const normalized = name.replaceAll("\\", "/").normalize("NFC");
	const parts = normalized.split("/");
	const fileParts = normalized.endsWith("/") ? parts.slice(0, -1) : parts;
	if (
		!normalized ||
		normalized.includes("\0") ||
		normalized.startsWith("/") ||
		/^[a-z]:/i.test(normalized) ||
		fileParts.some((part) => !part || part === "." || part === "..")
	)
		throw archiveError("Caminho inseguro no pacote");
	return normalized;
}

function isDraftContent(name: string) {
	const lower = name.toLocaleLowerCase();
	return (
		lower === "draft_content.json" || lower.endsWith("/draft_content.json")
	);
}

export function selectCapCutDraftEntries(entries: string[]) {
	const drafts = entries
		.map(normalizeArchivePath)
		.filter(isDraftContent)
		.sort((left, right) => left.localeCompare(right));
	if (!drafts.length) return [];
	const projectRoots = drafts.filter((entry) => {
		const parts = entry.toLocaleLowerCase().split("/");
		return !parts.includes("subdraft") && !parts.includes("timelines");
	});
	if (projectRoots.length) return projectRoots;
	const shallowest = Math.min(
		...drafts.map((entry) => entry.split("/").length),
	);
	return drafts.filter((entry) => entry.split("/").length === shallowest);
}

function extractDrafts(bytes: Uint8Array) {
	return new Promise<Record<string, Uint8Array>>((resolve, reject) => {
		let entries = 0;
		let declaredBytes = 0;
		let draftBytes = 0;
		const filter = (file: UnzipFileInfo) => {
			entries += 1;
			if (entries > MAX_ARCHIVE_ENTRIES)
				throw archiveError("O pacote contém arquivos demais");
			normalizeArchivePath(file.name);
			declaredBytes += file.originalSize;
			if (declaredBytes > MAX_DECLARED_ARCHIVE_BYTES)
				throw archiveError("O pacote expandido é grande demais");
			if (!isDraftContent(file.name.replaceAll("\\", "/"))) return false;
			if (file.originalSize > MAX_DRAFT_BYTES)
				throw archiveError("Um draft_content.json excede 20 MB");
			draftBytes += file.originalSize;
			if (draftBytes > MAX_TOTAL_DRAFT_BYTES)
				throw archiveError("Os projetos do pacote excedem 20 MB");
			return true;
		};
		try {
			unzip(bytes, { filter }, (error, files) => {
				if (error)
					reject(archiveError("Não foi possível descompactar o pacote"));
				else
					resolve(
						Object.fromEntries(
							Object.entries(files).map(([name, contents]) => [
								normalizeArchivePath(name),
								contents,
							]),
						),
					);
			});
		} catch {
			reject(archiveError("Não foi possível ler o pacote"));
		}
	});
}

function labelForEntry({
	entry,
	archiveName,
	multiple,
}: {
	entry: string;
	archiveName: string;
	multiple: boolean;
}) {
	const parts = entry.split("/");
	const projectName = parts.at(-2)?.trim();
	const archiveLabel = archiveName.replace(/\.zip$/i, "").trim() || "CapCut";
	if (!projectName) return archiveLabel;
	return multiple ? `${archiveLabel} · ${projectName}` : projectName;
}

export async function readCapCutTemplateArchive(
	file: Pick<File, "name" | "size" | "arrayBuffer">,
) {
	if (file.size > MAX_TEMPLATE_ARCHIVE_BYTES)
		throw archiveError("O ZIP excede 128 MB");
	const extracted = await extractDrafts(
		new Uint8Array(await file.arrayBuffer()),
	);
	const selected = selectCapCutDraftEntries(Object.keys(extracted));
	if (!selected.length)
		throw archiveError("Nenhum draft_content.json do CapCut foi encontrado");
	return selected.map<ArchivedTemplateDocument>((entry) => {
		const bytes = extracted[entry];
		if (!bytes || bytes.length > MAX_DRAFT_BYTES)
			throw archiveError("Projeto CapCut ausente ou grande demais");
		let document: unknown;
		try {
			document = JSON.parse(strFromU8(bytes).replace(/^\uFEFF/, ""));
		} catch {
			throw archiveError(`JSON inválido em ${entry}`);
		}
		if (!document || typeof document !== "object" || Array.isArray(document))
			throw archiveError(`Projeto inválido em ${entry}`);
		return {
			entry,
			label: labelForEntry({
				entry,
				archiveName: file.name,
				multiple: selected.length > 1,
			}),
			document,
		};
	});
}
