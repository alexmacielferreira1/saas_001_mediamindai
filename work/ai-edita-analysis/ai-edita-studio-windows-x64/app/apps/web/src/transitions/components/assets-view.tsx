"use client";

import { useMemo, useState } from "react";
import { Check, Layers3, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { useEditor } from "@/editor/use-editor";
import { useI18n } from "@/i18n";
import { effectsRegistry } from "@/effects";
import { buildEffectElement } from "@/timeline/element-utils";
import { findNearestCut, findTimelineCuts } from "@/transitions/cuts";
import {
	mediaTime,
	mediaTimeFromSeconds,
	TICKS_PER_SECOND,
	type MediaTime,
} from "@/wasm";

const TRANSITION_COLORS: Record<string, string> = {
	"transition-crossfade": "linear-gradient(100deg,#172554,#8b5cf6,#f8fafc)",
	"transition-dip-black": "linear-gradient(135deg,#6b7280,#020617,#6b7280)",
	"transition-dip-white": "linear-gradient(135deg,#64748b,#ffffff,#64748b)",
	"transition-flash":
		"radial-gradient(circle,#ffffff 0%,#d9f99d 35%,#111827 100%)",
	"transition-zoom":
		"radial-gradient(circle,#b6ff2b 0%,#17210e 42%,#030712 100%)",
	"transition-blur": "linear-gradient(100deg,#0f172a,#67e8f9,#0f172a)",
	"transition-whip":
		"linear-gradient(100deg,#111827 0 28%,#b6ff2b 44% 55%,#111827 72%)",
	"transition-glitch":
		"linear-gradient(100deg,#22d3ee 0 30%,#f43f5e 30% 56%,#a3e635 56%)",
	"transition-light-leak":
		"radial-gradient(circle at 15% 20%,#fff7ad,#fb7185 35%,#581c87 70%,#020617)",
};

export function TransitionsView() {
	const editor = useEditor();
	const scene = useEditor((instance) => instance.scenes.getActiveScene());
	const playhead = useEditor((instance) => instance.playback.getCurrentTime());
	const pt = useI18n().locale === "pt-BR";
	const [durationSeconds, setDurationSeconds] = useState(0.45);
	const [selectedType, setSelectedType] = useState("transition-crossfade");
	const definitions = useMemo(
		() =>
			effectsRegistry
				.getAll()
				.filter((effect) => effect.type.startsWith("transition-")),
		[],
	);
	const cuts = findTimelineCuts({
		elements: scene.tracks.main.elements,
		tolerance: mediaTime({ ticks: Math.round(TICKS_PER_SECOND / 20) }),
	});

	function buildTransitionAt({
		cutTime,
		effectType,
	}: {
		cutTime: MediaTime;
		effectType: string;
	}) {
		const duration = mediaTimeFromSeconds({ seconds: durationSeconds });
		const startTime = mediaTime({ ticks: Math.max(0, cutTime - duration / 2) });
		const definition = effectsRegistry.get(effectType);
		const element = buildEffectElement({ effectType, startTime, duration });
		return {
			...element,
			name: `${pt ? "Transição" : "Transition"} · ${definition.name}`,
		};
	}

	function addAtPlayhead(effectType = selectedType) {
		const cut = findNearestCut({ cuts, time: playhead });
		if (!cut) {
			toast.error(
				pt
					? "Não há um corte contínuo na faixa principal."
					: "No contiguous cut was found.",
			);
			return;
		}
		editor.timeline.insertElements({
			items: [
				{
					element: buildTransitionAt({ cutTime: cut.time, effectType }),
					placement: { mode: "auto", trackType: "effect" },
				},
			],
		});
		toast.success(
			pt
				? "Transição adicionada no corte mais próximo."
				: "Transition added to the nearest cut.",
		);
	}

	function applyToAll() {
		if (cuts.length === 0) {
			toast.error(
				pt
					? "Não há cortes contínuos para receber transições."
					: "No contiguous cuts were found.",
			);
			return;
		}
		const transitionElements = scene.tracks.overlay.flatMap((track) =>
			track.type === "effect"
				? track.elements.filter((element) =>
						element.effectType.startsWith("transition-"),
					)
				: [],
		);
		const duration = mediaTimeFromSeconds({ seconds: durationSeconds });
		const pendingCuts = cuts.filter(
			(cut) =>
				!transitionElements.some((element) => {
					const center = element.startTime + element.duration / 2;
					return Math.abs(center - cut.time) <= Math.max(1, duration / 6);
				}),
		);
		if (pendingCuts.length === 0) {
			toast.info(
				pt
					? "Todos os cortes já possuem transição."
					: "Every cut already has a transition.",
			);
			return;
		}
		editor.timeline.insertElements({
			items: pendingCuts.map((cut) => ({
				element: buildTransitionAt({
					cutTime: cut.time,
					effectType: selectedType,
				}),
				placement: { mode: "auto" as const, trackType: "effect" as const },
			})),
		});
		toast.success(
			pt
				? `${pendingCuts.length} transições aplicadas em uma única ação.`
				: `${pendingCuts.length} transitions applied in one action.`,
		);
	}

	return (
		<PanelView title={pt ? "Transições" : "Transitions"}>
			<div className="space-y-4 pb-5">
				<div className="rounded-xl border bg-card/60 p-3">
					<div className="flex items-start gap-2">
						<Layers3 className="mt-0.5 size-4 text-primary" />
						<div>
							<p className="text-sm font-medium">
								{cuts.length}{" "}
								{pt ? "cortes contínuos encontrados" : "contiguous cuts found"}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{pt
									? "Cada estilo mistura os dois clipes no corte. Selecione e aplique no corte mais próximo ou em todos."
									: "Pick a style, then add it at the nearest cut or apply it to all cuts."}
							</p>
						</div>
					</div>
					<label className="mt-3 flex items-center justify-between gap-3 text-xs">
						<span>{pt ? "Duração" : "Duration"}</span>
						<select
							className="rounded-md border bg-background px-2 py-1.5"
							value={durationSeconds}
							onChange={(event) =>
								setDurationSeconds(Number(event.target.value))
							}
						>
							<option value={0.25}>0,25s</option>
							<option value={0.45}>0,45s</option>
							<option value={0.7}>0,70s</option>
							<option value={1}>1,00s</option>
						</select>
					</label>
				</div>

				<div className="grid grid-cols-2 gap-2">
					{definitions.map((definition) => {
						const selected = selectedType === definition.type;
						return (
							<button
								key={definition.type}
								type="button"
								className={`overflow-hidden rounded-xl border bg-card text-left transition-colors hover:border-primary ${selected ? "border-primary ring-1 ring-primary" : ""}`}
								onClick={() => setSelectedType(definition.type)}
								onDoubleClick={() => addAtPlayhead(definition.type)}
							>
								<div
									className="relative h-16 overflow-hidden"
									style={{ background: TRANSITION_COLORS[definition.type] }}
								>
									<div className="absolute inset-y-0 left-1/2 w-px bg-white/80" />
									{selected && (
										<span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-1 text-primary-foreground">
											<Check className="size-3" />
										</span>
									)}
								</div>
								<p className="p-2.5 text-xs font-semibold">{definition.name}</p>
							</button>
						);
					})}
				</div>

				<div className="grid grid-cols-2 gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => addAtPlayhead()}
					>
						<Sparkles className="size-4" />
						{pt ? "Neste corte" : "Nearest cut"}
					</Button>
					<Button type="button" onClick={applyToAll}>
						{pt ? "Aplicar a todos" : "Apply to all"}
					</Button>
				</div>
			</div>
		</PanelView>
	);
}
