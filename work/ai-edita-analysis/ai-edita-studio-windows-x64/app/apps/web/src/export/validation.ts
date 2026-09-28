import type { MediaAsset } from "@/media/types";
import type { SceneTracks, TimelineElement } from "@/timeline";
import { TICKS_PER_SECOND } from "@/wasm";

export interface ExportDiagnostic {
	severity: "error" | "warning";
	code: string;
	message: string;
	elementId?: string;
}

function allElements(tracks: SceneTracks): TimelineElement[] {
	const elements: TimelineElement[] = [];
	for (const track of [tracks.main, ...tracks.overlay, ...tracks.audio]) {
		for (const element of track.elements) elements.push(element);
	}
	return elements;
}

export function validateExportTimeline({
	tracks,
	mediaAssets,
	includeAudio,
}: {
	tracks: SceneTracks;
	mediaAssets: MediaAsset[];
	includeAudio: boolean;
}): ExportDiagnostic[] {
	const diagnostics: ExportDiagnostic[] = [];
	const mediaMap = new Map(mediaAssets.map((asset) => [asset.id, asset]));
	const elements = allElements(tracks);

	for (const element of elements) {
		if (
			!Number.isFinite(element.startTime) ||
			!Number.isFinite(element.duration) ||
			element.startTime < 0 ||
			element.duration <= 0
		) {
			diagnostics.push({
				severity: "error",
				code: "invalid-timing",
				message: `O item “${element.name}” possui tempo ou duração inválidos.`,
				elementId: element.id,
			});
		}

		const needsMedia =
			element.type === "video" ||
			element.type === "image" ||
			(includeAudio &&
				element.type === "audio" &&
				element.sourceType === "upload");
		if (!needsMedia || !("mediaId" in element)) continue;
		const asset = mediaMap.get(element.mediaId);
		if (!asset?.file || !asset.url) {
			diagnostics.push({
				severity: "error",
				code: "missing-media",
				message: `A mídia de “${element.name}” não está disponível. Importe o arquivo novamente antes de exportar.`,
				elementId: element.id,
			});
		}
	}

	const visualElements = [tracks.main, ...tracks.overlay].flatMap((track) =>
		track.elements.filter(
			(element) =>
				element.type === "video" ||
				element.type === "image" ||
				element.type === "text" ||
				element.type === "sticker" ||
				element.type === "graphic",
		),
	);
	if (visualElements.length === 0) {
		diagnostics.push({
			severity: "error",
			code: "empty-visual",
			message:
				"O projeto não possui imagem, vídeo, texto ou gráfico visível para exportar.",
		});
	}

	const main = [...tracks.main.elements].sort(
		(left, right) => left.startTime - right.startTime,
	);
	const gapTolerance = TICKS_PER_SECOND / 30;
	for (let index = 1; index < main.length; index++) {
		const previous = main[index - 1];
		const current = main[index];
		const gap = current.startTime - (previous.startTime + previous.duration);
		if (gap <= gapTolerance) continue;
		diagnostics.push({
			severity: "warning",
			code: "main-gap",
			message: `Existe um espaço vazio de ${(gap / TICKS_PER_SECOND).toFixed(2)}s antes de “${current.name}”.`,
			elementId: current.id,
		});
	}

	return diagnostics;
}
