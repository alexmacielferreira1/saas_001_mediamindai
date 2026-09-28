"use client";

import { useState } from "react";
import { Type, Sparkles, Palette, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FontPicker } from "@/components/ui/font-picker";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { useAssetsPanelStore } from "@/components/editor/panels/assets/assets-panel-store";
import { useEditor } from "@/editor/use-editor";
import { useI18n } from "@/i18n";
import { DEFAULTS } from "@/timeline/defaults";
import { buildTextElement } from "@/timeline/element-utils";
import type { MediaTime } from "@/wasm";
import { TEXT_PRESETS, type TextPreset } from "../presets";

const TABS = ["add", "fonts", "styles", "packs"] as const;
type TextTab = (typeof TABS)[number];

export function TextView() {
	const editor = useEditor();
	const { locale } = useI18n();
	const [activeTab, setActiveTab] = useState<TextTab>("add");
	const [fontFamily, setFontFamily] = useState("Arial");
	const pt = locale === "pt-BR";
	const labels: Record<TextTab, string> = {
		add: pt ? "Adicionar" : "Add",
		fonts: pt ? "Fontes" : "Fonts",
		styles: pt ? "Estilos" : "Styles",
		packs: pt ? "Pacotes" : "Packs",
	};

	const addPreset = ({
		currentTime,
		preset,
	}: {
		currentTime: MediaTime;
		preset: TextPreset;
	}) => {
		const activeScene = editor.scenes.getActiveScene();
		if (!activeScene) return;
		const element = buildTextElement({
			raw: {
				...DEFAULTS.text.element,
				name: preset.name,
				params: {
					...DEFAULTS.text.element.params,
					...preset.params,
					content: preset.content,
					fontFamily,
				},
			},
			startTime: currentTime,
		});
		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});
	};

	const presets =
		activeTab === "styles"
			? TEXT_PRESETS.slice(1)
			: activeTab === "fonts"
				? [TEXT_PRESETS[0], TEXT_PRESETS[1]]
				: TEXT_PRESETS;

	return (
		<PanelView title={pt ? "Texto" : "Text"}>
			<div className="mb-3 grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
				{TABS.map((tab) => (
					<button
						type="button"
						key={tab}
						onClick={() => setActiveTab(tab)}
						className={
							"rounded-md px-1 py-2 text-[11px] transition-colors " +
							(activeTab === tab
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground")
						}
					>
						{labels[tab]}
					</button>
				))}
			</div>

			{activeTab === "fonts" && (
				<div className="mb-3 space-y-2 rounded-lg border p-3">
					<div className="flex items-center gap-2 text-xs font-medium">
						<Type className="size-4 text-primary" />
						{pt ? "Escolha a fonte antes de adicionar" : "Choose a font first"}
					</div>
					<FontPicker defaultValue={fontFamily} onValueChange={setFontFamily} />
					<p className="text-[11px] text-muted-foreground">
						{pt
							? "Fontes importadas aparecem em Minhas fontes."
							: "Imported fonts appear under My fonts."}
					</p>
				</div>
			)}

			{activeTab === "packs" ? (
				<div className="space-y-3">
					<div className="rounded-xl border bg-card p-4">
						<PackageOpen className="mb-3 size-6 text-primary" />
						<h3 className="text-sm font-semibold">
							{pt ? "Modelos e fontes extras" : "Extra models and fonts"}
						</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							{pt
								? "Instale arquivos .aiedita comprados separadamente. O pacote fica disponível em todos os projetos e não é redistribuído com o aplicativo."
								: "Install separately purchased .aiedita files. Packs become available to every project and are not redistributed with the app."}
						</p>
						<Button
							className="mt-4 w-full"
							size="sm"
							onClick={() =>
								useAssetsPanelStore.getState().setActiveTab("models")
							}
						>
							{pt ? "Abrir biblioteca de modelos" : "Open model library"}
						</Button>
					</div>
				</div>
			) : (
				<>
					<div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
						{activeTab === "styles" ? (
							<Palette className="size-4" />
						) : (
							<Sparkles className="size-4" />
						)}
						{pt
							? "Clique no + ou arraste para a timeline"
							: "Click + or drag to the timeline"}
					</div>
					<div className="grid grid-cols-2 gap-2">
						{presets.map((preset) => (
							<DraggableItem
								key={preset.id}
								name={preset.name}
								containerClassName="w-full"
								preview={
									<div
										className="flex size-full items-center justify-center bg-[#101612] p-2 text-center"
										style={{
											color: String(preset.params.color ?? "#ffffff"),
											fontFamily,
											fontWeight:
												preset.params.fontWeight === "bold" ? 700 : 400,
											fontStyle:
												preset.params.fontStyle === "italic"
													? "italic"
													: "normal",
										}}
									>
										<span className="text-xs leading-tight">
											{preset.content}
										</span>
									</div>
								}
								dragData={{
									id: "temp-text-" + preset.id,
									type: DEFAULTS.text.element.type,
									name: preset.name,
									content: preset.content,
								}}
								aspectRatio={1.35}
								onAddToTimeline={({ currentTime }) =>
									addPreset({ currentTime, preset })
								}
							/>
						))}
					</div>
				</>
			)}
		</PanelView>
	);
}
