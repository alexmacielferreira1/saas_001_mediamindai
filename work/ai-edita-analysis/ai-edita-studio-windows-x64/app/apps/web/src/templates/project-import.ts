import { z } from "zod";
import { templateEngine } from "./engine";
import { processMediaAssets } from "@/media/processing";
import { storageService } from "@/services/storage/service";
import { buildDefaultScene } from "@/timeline/scenes";
import {
	buildElementFromMedia,
	buildTextElement,
} from "@/timeline/element-utils";
import { scalarChannel } from "@/integrations/editorial-commands";
import { mediaTimeFromSeconds } from "@/wasm";
import { CURRENT_PROJECT_VERSION } from "@/services/storage/migrations";
import type { MediaAsset } from "@/media/types";
import type { TProject } from "@/project/types";
import type { TimelineElement, TimelineTrack } from "@/timeline";

const clipSchema = z.object({
	type: z.enum(["video", "image", "audio", "text"]),
	name: z.string(),
	start: z.number(),
	duration: z.number(),
	assetId: z.string(),
	sourceStart: z.number(),
	rate: z.number(),
	lane: z.number().int(),
	params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
	animations: z.record(z.string(), z.array(z.number())),
});
export const projectPlanSchema = z.object({
	name: z.string(),
	width: z.number(),
	height: z.number(),
	fps: z.number(),
	duration: z.number(),
	background: z.string(),
	assets: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			hint: z.string(),
			type: z.enum(["video", "image", "audio"]),
		}),
	),
	tracks: z.array(
		z.object({
			name: z.string(),
			main: z.boolean(),
			clips: z.array(clipSchema),
		}),
	),
	warnings: z.array(z.string()),
	skipped: z.number(),
});
export type LegacyProjectPlan = z.infer<typeof projectPlanSchema>;
export async function inspectLegacyProject(file: File) {
	if (file.size > 23 * 1024 * 1024)
		throw new Error("JSON: máximo 23 MB / maximum 23 MB.");
	return projectPlanSchema.parse(
		await templateEngine({
			op: "import_project",
			document: JSON.parse((await file.text()).replace(/^\uFEFF/, "")),
		}),
	);
}

// Storage/platform adapter. Conversion, lane assignment and keyframe semantics
// are resolved by Rust. No mutation of the active editor/project is performed.
export async function saveLegacyProjectCopy({
	plan,
	files,
	onProgress,
}: {
	plan: LegacyProjectPlan;
	files: Record<string, File>;
	onProgress: (text: string) => void;
}) {
	for (const a of plan.assets)
		if (!files[a.id])
			throw new Error("Religue todas as mídias / Relink every media file.");
	const total = plan.assets.reduce((n, a) => n + files[a.id].size, 0);
	if (!(await storageService.canStoreFile({ size: total })).canStore)
		throw new Error(
			"Espaço insuficiente no navegador / Not enough browser storage.",
		);
	const projectId = crypto.randomUUID();
	const imported = new Map<string, MediaAsset>();
	let writing = false;
	try {
		for (const [i, wanted] of plan.assets.entries()) {
			onProgress(
				`Mídia / Media ${i + 1}/${plan.assets.length}: ${files[wanted.id].name}`,
			);
			const results = await processMediaAssets({ files: [files[wanted.id]] });
			const asset = results[0];
			// Register immediately so the finally block also releases incompatible media.
			if (asset) imported.set(wanted.id, { ...asset, id: crypto.randomUUID() });
			if (
				!asset ||
				(asset.type !== wanted.type &&
					!(wanted.type === "audio" && asset.type === "video"))
			)
				throw new Error(
					`Mídia incompatível / Incompatible media: ${wanted.name}`,
				);
			if (
				asset.type !== "image" &&
				(!asset.duration || !Number.isFinite(asset.duration))
			)
				throw new Error(
					`Duração não identificada / Unknown media duration: ${wanted.name}`,
				);
		}
		const scene = buildDefaultScene({
			name: "AI Edita · importado",
			isMain: true,
		});
		let hasMain = false;
		for (const sourceTrack of plan.tracks) {
			const lanes = new Map<number, TimelineTrack>();
			for (const clip of sourceTrack.clips) {
				const startTime = mediaTimeFromSeconds({ seconds: clip.start }),
					duration = mediaTimeFromSeconds({ seconds: clip.duration });
				let element: TimelineElement;
				if (clip.type === "text")
					element = {
						...buildTextElement({
							startTime,
							raw: { name: clip.name, duration, params: clip.params },
						}),
						id: crypto.randomUUID(),
					};
				else {
					const asset = imported.get(clip.assetId);
					if (!asset) throw new Error("Missing linked asset.");
					const consumed = clip.duration * clip.rate;
					if (
						clip.type !== "image" &&
						clip.sourceStart + consumed > (asset.duration ?? 0) + 1 / plan.fps
					)
						throw new Error(
							`Arquivo curto para o corte / File is too short for clip: ${clip.name}. Religue a mídia correta.`,
						);
					element = {
						...buildElementFromMedia({
							mediaId: asset.id,
							mediaType: clip.type,
							name: clip.name || asset.name,
							startTime,
							duration,
						}),
						id: crypto.randomUUID(),
					};
					element.params = { ...element.params, ...clip.params };
					if (element.type === "video" || element.type === "audio") {
						element.sourceDuration = mediaTimeFromSeconds({
							seconds: asset.duration ?? 0,
						});
						element.trimStart = mediaTimeFromSeconds({
							seconds: clip.sourceStart,
						});
						element.trimEnd = mediaTimeFromSeconds({
							seconds: Math.max(
								0,
								(asset.duration ?? 0) - clip.sourceStart - consumed,
							),
						});
						element.retime = { rate: clip.rate, maintainPitch: true };
					}
				}
				element.animations = Object.fromEntries(
					Object.entries(clip.animations).map(([key, points]) => [
						key,
						scalarChannel({ points }),
					]),
				);
				let track = lanes.get(clip.lane);
				if (!track) {
					const base = {
						id: crypto.randomUUID(),
						name: sourceTrack.name || "Importado",
						muted: false,
						hidden: false,
					};
					track =
						element.type === "audio"
							? { ...base, type: "audio", elements: [] }
							: element.type === "text"
								? { ...base, type: "text", elements: [] }
								: { ...base, type: "video", elements: [] };
					lanes.set(clip.lane, track);
					if (track.type === "audio") scene.tracks.audio.push(track);
					else if (track.type === "video" && sourceTrack.main && !hasMain) {
						scene.tracks.main = track;
						hasMain = true;
					} else scene.tracks.overlay.unshift(track);
				}
				if (track.type === "audio" && element.type === "audio")
					track.elements.push(element);
				else if (track.type === "text" && element.type === "text")
					track.elements.push(element);
				else if (
					track.type === "video" &&
					(element.type === "video" || element.type === "image")
				)
					track.elements.push(element);
				else throw new Error("Incompatible imported lane.");
			}
		}
		const now = new Date(),
			canvasSize = { width: plan.width, height: plan.height };
		const project: TProject = {
			version: CURRENT_PROJECT_VERSION,
			metadata: {
				id: projectId,
				name: (plan.name || "AI Edita") + " · importado",
				createdAt: now,
				updatedAt: now,
				duration: mediaTimeFromSeconds({ seconds: plan.duration }),
			},
			scenes: [scene],
			currentSceneId: scene.id,
			settings: {
				canvasSize,
				canvasSizeMode: "custom",
				fps: { numerator: Math.round(plan.fps * 1000), denominator: 1000 },
				background: { type: "color", color: plan.background },
			},
		};
		writing = true;
		for (const asset of imported.values())
			await storageService.saveMediaAsset({ projectId, mediaAsset: asset });
		await storageService.saveProject({ project });
		return projectId;
	} catch (error) {
		if (writing) {
			try {
				await storageService.deleteProjectMedia({ projectId });
				await storageService.deleteProject({ id: projectId });
			} catch {
				throw new Error(
					`Falha ao importar e limpar a cópia incompleta ${projectId}. O projeto original não mudou. / Import and partial-copy cleanup failed; original unchanged.`,
				);
			}
		}
		throw error;
	} finally {
		for (const asset of imported.values()) {
			if (asset.url) URL.revokeObjectURL(asset.url);
		}
	}
}
