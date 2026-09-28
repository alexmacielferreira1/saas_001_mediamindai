"use client";

import { useState } from "react";
import {
	Check,
	ScanLine,
	SlidersHorizontal,
	Sparkles,
	WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { useEditor } from "@/editor/use-editor";
import { useI18n } from "@/i18n";
import { VISUAL_ADJUSTMENT_PRESETS } from "@/effects/presets";
import type { ParamValues } from "@/params";

export function AdjustmentsView() {
	const editor = useEditor();
	const selected = useEditor((instance) =>
		instance.selection.getSelectedElements(),
	);
	const scene = useEditor((instance) => instance.scenes.getActiveScene());
	const [applyToAll, setApplyToAll] = useState(false);
	const [view, setView] = useState<"adjust" | "quality">("adjust");
	const pt = useI18n().locale === "pt-BR";

	const allVisuals = [scene.tracks.main, ...scene.tracks.overlay].flatMap(
		(track) =>
			track.elements.flatMap((element) =>
				element.type === "video" || element.type === "image"
					? [{ trackId: track.id, elementId: element.id }]
					: [],
			),
	);
	const selectedVisuals = editor.timeline
		.getElementsWithTracks({ elements: selected })
		.flatMap(({ track, element }) =>
			element.type === "video" || element.type === "image"
				? [{ trackId: track.id, elementId: element.id }]
				: [],
		);

	function applyPreset(params: Partial<ParamValues>) {
		const targets = applyToAll ? allVisuals : selectedVisuals;
		if (targets.length === 0) {
			toast.error(
				pt
					? "Selecione um vídeo ou imagem na timeline."
					: "Select a video or image in the timeline.",
			);
			return;
		}
		editor.timeline.applyClipEffectPreset({
			elements: targets,
			effectType: "color-grade",
			params,
		});
		toast.success(
			pt
				? `Ajuste aplicado em ${targets.length} clipe${targets.length === 1 ? "" : "s"}.`
				: `Adjustment applied to ${targets.length} clip${targets.length === 1 ? "" : "s"}.`,
		);
	}

	function applyQualityPreset({
		params,
		color,
	}: {
		params: Partial<ParamValues>;
		color?: Partial<ParamValues>;
	}) {
		const targets = applyToAll ? allVisuals : selectedVisuals;
		if (targets.length === 0) {
			toast.error(
				pt
					? "Selecione um vídeo ou imagem na timeline."
					: "Select a video or image in the timeline.",
			);
			return;
		}
		editor.timeline.applyClipEffectPreset({
			elements: targets,
			effectType: "video-quality",
			params,
		});
		if (color) {
			editor.timeline.applyClipEffectPreset({
				elements: targets,
				effectType: "color-grade",
				params: color,
			});
		}
		toast.success(
			pt
				? `Qualidade aplicada em ${targets.length} clipe${targets.length === 1 ? "" : "s"}.`
				: `Quality applied to ${targets.length} clip${targets.length === 1 ? "" : "s"}.`,
		);
	}

	return (
		<PanelView title={pt ? "Ajustes de imagem" : "Image adjustments"}>
			<div className="space-y-4 pb-5">
				<div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-xs">
					<button
						type="button"
						className={`rounded-md px-2 py-2 font-medium ${view === "adjust" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
						onClick={() => setView("adjust")}
					>
						{pt ? "Ajustar" : "Adjust"}
					</button>
					<button
						type="button"
						className={`rounded-md px-2 py-2 font-medium ${view === "quality" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
						onClick={() => setView("quality")}
					>
						{pt ? "Qualidade do vídeo" : "Video quality"}
					</button>
				</div>
				<div className="rounded-xl border bg-card/60 p-3">
					<div className="flex items-start gap-2">
						<WandSparkles className="mt-0.5 size-4 text-primary" />
						<div className="min-w-0">
							<p className="text-sm font-medium">
								{view === "adjust"
									? pt
										? "Correção visual editável"
										: "Editable visual correction"
									: pt
										? "Melhoria de qualidade editável"
										: "Editable quality enhancement"}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{view === "adjust"
									? pt
										? "Escolha um ponto de partida e refine todos os controles no painel de propriedades."
										: "Choose a starting point and refine every control in properties."
									: pt
										? "Reduza ruído e recupere definição sem alterar o arquivo original."
										: "Reduce noise and recover definition without changing the original file."}
							</p>
						</div>
					</div>
					<Button
						type="button"
						variant={applyToAll ? "default" : "outline"}
						size="sm"
						className="mt-3 w-full justify-start"
						onClick={() => setApplyToAll((value) => !value)}
					>
						{applyToAll ? (
							<Check className="size-4" />
						) : (
							<SlidersHorizontal className="size-4" />
						)}
						{pt ? "Aplicar a todos os vídeos" : "Apply to all videos"}
					</Button>
				</div>

				{view === "adjust" ? (
					<div className="grid grid-cols-2 gap-2">
						{VISUAL_ADJUSTMENT_PRESETS.map((preset) => (
							<button
								key={preset.id}
								type="button"
								className="overflow-hidden rounded-xl border bg-card text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
								onClick={() => applyPreset(preset.params)}
							>
								<div className="h-16" style={{ background: preset.accent }} />
								<div className="p-2.5">
									<p className="text-xs font-semibold">{preset.name}</p>
									<p className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
										{preset.description}
									</p>
								</div>
							</button>
						))}
					</div>
				) : (
					<div className="grid grid-cols-2 gap-2">
						<button
							type="button"
							className="rounded-xl border bg-card p-3 text-left hover:border-primary"
							onClick={() =>
								applyQualityPreset({
									params: { denoise: 0.22, sharpness: 0.3, clarity: 0.14 },
									color: {
										contrast: 1.05,
										vibrance: 0.1,
										highlights: -0.04,
										shadows: 0.06,
									},
								})
							}
						>
							<Sparkles className="mb-3 size-5 text-primary" />
							<p className="text-xs font-semibold">
								{pt ? "Aprimorar automático" : "Auto enhance"}
							</p>
							<p className="mt-1 text-[10px] leading-4 text-muted-foreground">
								{pt
									? "Limpeza e definição equilibradas para conteúdo social."
									: "Balanced cleanup and definition for social content."}
							</p>
						</button>
						<button
							type="button"
							className="rounded-xl border bg-card p-3 text-left hover:border-primary"
							onClick={() =>
								applyQualityPreset({
									params: { denoise: 0.62, sharpness: 0.16, clarity: 0.04 },
								})
							}
						>
							<ScanLine className="mb-3 size-5 text-primary" />
							<p className="text-xs font-semibold">
								{pt ? "Reduzir ruído" : "Reduce noise"}
							</p>
							<p className="mt-1 text-[10px] leading-4 text-muted-foreground">
								{pt
									? "Suaviza granulação de gravações escuras."
									: "Softens grain in low-light recordings."}
							</p>
						</button>
						<button
							type="button"
							className="rounded-xl border bg-card p-3 text-left hover:border-primary"
							onClick={() =>
								applyQualityPreset({
									params: { denoise: 0.08, sharpness: 0.68, clarity: 0.28 },
								})
							}
						>
							<WandSparkles className="mb-3 size-5 text-primary" />
							<p className="text-xs font-semibold">
								{pt ? "Mais nitidez" : "More sharpness"}
							</p>
							<p className="mt-1 text-[10px] leading-4 text-muted-foreground">
								{pt
									? "Realça telas, textos e detalhes finos."
									: "Enhances screens, text and fine detail."}
							</p>
						</button>
						<button
							type="button"
							className="rounded-xl border bg-card p-3 text-left hover:border-primary"
							onClick={() =>
								applyQualityPreset({
									params: { denoise: 0, sharpness: 0, clarity: 0 },
								})
							}
						>
							<SlidersHorizontal className="mb-3 size-5 text-muted-foreground" />
							<p className="text-xs font-semibold">
								{pt ? "Neutro" : "Neutral"}
							</p>
							<p className="mt-1 text-[10px] leading-4 text-muted-foreground">
								{pt
									? "Zera a melhoria; ajuste fino nas propriedades."
									: "Resets enhancement; fine-tune in properties."}
							</p>
						</button>
					</div>
				)}
			</div>
		</PanelView>
	);
}
