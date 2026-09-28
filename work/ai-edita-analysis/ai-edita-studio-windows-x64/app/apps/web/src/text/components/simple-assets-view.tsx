"use client";

import { useState } from "react";
import { Palette, Sparkles, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FontPicker } from "@/components/ui/font-picker";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { FontPackLibrary } from "@/fonts/font-pack-library";
import { useEditor } from "@/editor/use-editor";
import { useI18n } from "@/i18n";
import { StylePackLibrary } from "@/templates/style-pack-library";
import { addModelText } from "@/templates/commands";
import type { EditModel } from "@/templates/contract";
import { DEFAULTS } from "@/timeline/defaults";
import { buildTextElement } from "@/timeline/element-utils";
import { mediaTimeToSeconds, type MediaTime } from "@/wasm";
import { TEXT_PRESETS, TEXT_STYLE_PRESETS, type TextPreset } from "../presets";
import { cssFontFamily } from "@/fonts/css";

const FONT_SAMPLES = ["Arial", "Georgia", "Impact", "Trebuchet MS"];
const TABS = ["text", "styles", "fonts"] as const;
type TextTab = (typeof TABS)[number];

export function SimpleTextView() {
	const editor = useEditor();
	const pt = useI18n().locale === "pt-BR";
	const [activeTab, setActiveTab] = useState<TextTab>("text");
	const [fontFamily, setFontFamily] = useState("Arial");
	const [content, setContent] = useState("");
	const labels: Record<TextTab, string> = {
		text: pt ? "Texto" : "Text",
		styles: pt ? "Estilos" : "Styles",
		fonts: pt ? "Fontes" : "Fonts",
	};
	const resolvedContent = content.trim() || (pt ? "Seu texto" : "Your text");

	const addPreset = ({
		currentTime,
		preset,
	}: {
		currentTime: MediaTime;
		preset: TextPreset;
	}) => {
		const element = buildTextElement({
			raw: {
				...DEFAULTS.text.element,
				name: preset.name,
				params: {
					...DEFAULTS.text.element.params,
					...preset.params,
					content: resolvedContent,
					fontFamily,
				},
			},
			startTime: currentTime,
		});
		editor.timeline.insertElement({ element, placement: { mode: "auto" } });
	};

	const addImportedStyle = async (model: EditModel) => {
		await addModelText({
			editor,
			input: {
				templateId: model.id,
				textLayerIndex: 0,
				startSeconds: mediaTimeToSeconds({
					time: editor.playback.getCurrentTime(),
				}),
				durationSeconds: model.duration,
				texts: [resolvedContent],
				acknowledgeAdaptations: model.warnings.length > 0,
			},
		});
		return pt
			? "Texto adicionado na posição atual. Ctrl+Z desfaz."
			: "Text added at the playhead. Ctrl+Z undoes it.";
	};

	const presets =
		activeTab === "text" ? TEXT_PRESETS.slice(0, 2) : TEXT_STYLE_PRESETS;

	return (
		<PanelView
			title={pt ? "Texto" : "Text"}
			contentClassName="space-y-4"
			footer={
				activeTab === "fonts" ? (
					<div className="shrink-0 border-t bg-background p-2">
						<Button
							type="button"
							className="w-full"
							onClick={() =>
								addPreset({
									currentTime: editor.playback.getCurrentTime(),
									preset: TEXT_PRESETS[0],
								})
							}
						>
							{pt ? "Adicionar com esta fonte" : "Add with this font"}
						</Button>
					</div>
				) : undefined
			}
		>
			<div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
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

			<label className="block space-y-1 text-xs">
				<span>
					{pt ? "O que você quer escrever?" : "What do you want to write?"}
				</span>
				<input
					value={content}
					onChange={(event) => setContent(event.target.value)}
					placeholder={pt ? "Digite seu texto…" : "Type your text…"}
					maxLength={2000}
					className="w-full rounded-lg border bg-input px-3 py-2"
				/>
			</label>

			{activeTab === "fonts" ? (
				<div className="space-y-4">
					<FontPackLibrary
						selectedFamily={fontFamily}
						onSelectFamily={setFontFamily}
					/>
					<div className="rounded-xl border bg-card p-3">
						<div className="mb-2 flex items-center gap-2 text-xs font-medium">
							<Type className="size-4 text-primary" />
							{pt ? "Escolha uma fonte" : "Choose a font"}
						</div>
						<FontPicker
							defaultValue={fontFamily}
							onValueChange={setFontFamily}
						/>
					</div>
					<div className="grid grid-cols-2 gap-2">
						{FONT_SAMPLES.map((family) => (
							<button
								type="button"
								key={family}
								onClick={() => setFontFamily(family)}
								className={
									"rounded-xl border bg-card p-3 text-left hover:border-primary " +
									(fontFamily === family ? "border-primary bg-primary/5" : "")
								}
							>
								<span className="text-[10px] text-muted-foreground">
									{family}
								</span>
								<span
									className="mt-2 block truncate text-xl"
									style={{ fontFamily: cssFontFamily({ family }) }}
								>
									{resolvedContent}
								</span>
							</button>
						))}
					</div>
				</div>
			) : (
				<div className="space-y-4">
					{activeTab === "styles" && (
						<StylePackLibrary capability="text" onUse={addImportedStyle} />
					)}
					<div>
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
												{resolvedContent}
											</span>
										</div>
									}
									dragData={{
										id: "temp-text-" + preset.id,
										type: DEFAULTS.text.element.type,
										name: preset.name,
										content: resolvedContent,
									}}
									aspectRatio={1.35}
									onAddToTimeline={({ currentTime }) =>
										addPreset({ currentTime, preset })
									}
								/>
							))}
						</div>
					</div>
				</div>
			)}
		</PanelView>
	);
}
