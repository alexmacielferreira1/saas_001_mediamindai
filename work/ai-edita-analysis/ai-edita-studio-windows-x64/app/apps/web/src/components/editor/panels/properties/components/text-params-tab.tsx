"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useEditor } from "@/editor/use-editor";
import { useI18n } from "@/i18n";
import { applyBuiltinCaptionStyle } from "@/subtitles/apply-builtin-caption-style";
import type { CaptionStyleId } from "@/subtitles/builtin-caption-styles";
import { CaptionStyleGrid } from "@/subtitles/components/caption-style-grid";
import { applyModelStyle } from "@/templates/commands";
import type { EditModel } from "@/templates/contract";
import { StylePackLibrary } from "@/templates/style-pack-library";
import type { TextElement } from "@/timeline";
import {
	transformEditorialTextCase,
	type EditorialTextCase,
} from "@/integrations/editorial-engine";
import {
	copyCaptionVisualParams,
	getCaptionElements,
	isCaptionElement,
	useCaptionStyleLinkStore,
} from "./caption-style-link";
import { ElementParamsTab } from "./element-params-tab";

export function TextParamsTab({
	element,
	trackId,
	paramKeys,
}: {
	element: TextElement;
	trackId: string;
	paramKeys: readonly string[];
}) {
	const editor = useEditor();
	const pt = useI18n().locale === "pt-BR";
	const checkboxId = useId();
	const applyToAll = useCaptionStyleLinkStore((state) => state.applyToAll);
	const setApplyToAll = useCaptionStyleLinkStore(
		(state) => state.setApplyToAll,
	);
	const [captionStyle, setCaptionStyle] = useState<CaptionStyleId>("clean");
	const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
	const [pendingAction, setPendingAction] = useState<"case" | "style" | null>(
		null,
	);
	const tracks = useEditor(
		(instance) => instance.scenes.getActiveScene().tracks,
	);
	const captionElements = getCaptionElements({ tracks });
	const selectedCaptionTargets: Array<{
		trackId: string;
		element: TextElement;
	}> = isCaptionElement(element) ? [{ trackId, element }] : [];
	const selectedIsCaption = selectedCaptionTargets.length === 1;
	const captionPeers = captionElements.filter(
		({ element: caption }) => caption.id !== element.id,
	);
	const linkedElements = applyToAll && selectedIsCaption ? captionPeers : [];
	const showApplyToAll = selectedIsCaption && captionElements.length > 1;
	const captionTargets =
		applyToAll && selectedIsCaption ? captionElements : selectedCaptionTargets;
	const targetCount = captionTargets.length;

	const handleApplyToAllChange = (checked: boolean) => {
		setApplyToAll(checked);
		if (!checked || !selectedIsCaption) return;

		editor.timeline.updateElements({
			updates: captionPeers.map(
				({ trackId: captionTrackId, element: caption }) => ({
					trackId: captionTrackId,
					elementId: caption.id,
					patch: {
						params: copyCaptionVisualParams({
							source: element,
							target: caption,
							paramKeys,
						}),
					},
				}),
			),
		});
	};

	const handleTextCase = async (mode: EditorialTextCase) => {
		if (targetCount === 0 || pendingAction) return;
		setPendingAction("case");
		try {
			const contents = await Promise.all(
				captionTargets.map(({ element: caption }) =>
					transformEditorialTextCase({
						text: String(caption.params.content ?? ""),
						mode,
					}),
				),
			);
			editor.timeline.updateElements({
				updates: captionTargets.map(
					({ trackId: captionTrackId, element: caption }, index) => ({
						trackId: captionTrackId,
						elementId: caption.id,
						patch: { params: { content: contents[index] } },
					}),
				),
			});
			toast.success(
				pt
					? `Capitalização atualizada em ${targetCount} legenda(s).`
					: `Capitalization updated in ${targetCount} caption(s).`,
			);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: pt
						? "Não foi possível alterar a capitalização."
						: "Could not change capitalization.",
			);
		} finally {
			setPendingAction(null);
		}
	};

	const handleApplyBuiltinStyle = async ({
		style,
	}: {
		style: CaptionStyleId;
	}) => {
		if (targetCount === 0 || pendingAction) return;
		setPendingAction("style");
		try {
			await applyBuiltinCaptionStyle({
				editor,
				targets: captionTargets,
				style,
			});
			toast.success(
				pt
					? `Estilo de legenda aplicado em ${targetCount} legenda(s). Ctrl+Z desfaz.`
					: `Caption style applied to ${targetCount} caption(s). Ctrl+Z undoes it.`,
			);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: pt
						? "Não foi possível aplicar o estilo."
						: "Could not apply the style.",
			);
		} finally {
			setPendingAction(null);
		}
	};

	const handleApplyImportedStyle = async (
		model: EditModel,
	): Promise<string> => {
		if (targetCount === 0 || pendingAction)
			throw new Error(
				pt ? "Selecione uma legenda." : "Select a caption first.",
			);
		setPendingAction("style");
		try {
			await applyModelStyle({
				editor,
				input: {
					templateId: model.id,
					textLayerIndex: 0,
					elements: captionTargets.map(
						({ trackId: captionTrackId, element: caption }) => ({
							trackId: captionTrackId,
							elementId: caption.id,
						}),
					),
					includeMotion: true,
					replaceExisting: true,
					acknowledgeAdaptations: model.warnings.length > 0,
				},
			});
			setSelectedModelId(model.id);
			return pt
				? `Modelo aplicado em ${targetCount} legenda(s). Ctrl+Z desfaz.`
				: `Model applied to ${targetCount} caption(s). Ctrl+Z undoes it.`;
		} finally {
			setPendingAction(null);
		}
	};

	return (
		<>
			{showApplyToAll && (
				<div className="bg-background/95 sticky top-0 z-20 border-b p-4 shadow-sm backdrop-blur-sm">
					<label
						htmlFor={checkboxId}
						className="flex cursor-pointer items-start gap-2"
					>
						<Checkbox
							id={checkboxId}
							checked={applyToAll}
							onCheckedChange={(checked) =>
								handleApplyToAllChange(checked === true)
							}
							className="mt-0.5 cursor-pointer"
						/>
						<span>
							<span className="block text-sm font-medium">
								{pt ? "Aplicar a todas as legendas" : "Apply to all captions"}
							</span>
							<span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
								{pt
									? `Sincroniza o visual das ${captionElements.length} legendas do projeto, sem alterar os textos.`
									: `Syncs the appearance of all ${captionElements.length} project captions without changing their text.`}
							</span>
						</span>
					</label>
				</div>
			)}
			{selectedIsCaption && (
				<div className="space-y-3 border-b p-4">
					<section className="flex items-center justify-between gap-3">
						<div className="text-xs font-medium">
							{pt ? "Capitalização" : "Capitalization"}
						</div>
						<div className="inline-flex shrink-0 rounded-md bg-muted p-0.5">
							<Button
								variant="ghost"
								size="sm"
								disabled={pendingAction !== null}
								onClick={() => void handleTextCase("uppercase")}
								className="h-6 w-8 rounded-sm px-0 text-[11px] font-semibold"
								aria-label={pt ? "Transformar em maiúsculas" : "Uppercase"}
								title={pt ? "Transformar em maiúsculas" : "Uppercase"}
							>
								TT
							</Button>
							<Button
								variant="ghost"
								size="sm"
								disabled={pendingAction !== null}
								onClick={() => void handleTextCase("lowercase")}
								className="h-6 w-8 rounded-sm px-0 text-[11px] font-medium"
								aria-label={pt ? "Transformar em minúsculas" : "Lowercase"}
								title={pt ? "Transformar em minúsculas" : "Lowercase"}
							>
								tt
							</Button>
							<Button
								variant="ghost"
								size="sm"
								disabled={pendingAction !== null}
								onClick={() => void handleTextCase("sentence")}
								className="h-6 w-8 rounded-sm px-0 text-[11px] font-medium"
								aria-label={
									pt
										? "Manter somente a primeira letra maiúscula"
										: "Sentence case"
								}
								title={
									pt
										? "Manter somente a primeira letra maiúscula"
										: "Sentence case"
								}
							>
								Tt
							</Button>
						</div>
					</section>

					<section className="space-y-2">
						<div>
							<strong className="text-sm">
								{pt ? "Modelos de legenda" : "Caption models"}
							</strong>
							<p className="text-[11px] leading-4 text-muted-foreground">
								{pt
									? "Clique em uma prévia para aplicar imediatamente."
									: "Click a preview to apply it immediately."}
							</p>
						</div>
						<div className="max-h-60 space-y-2 overflow-y-auto overscroll-contain rounded-lg border bg-muted/10 p-2 pr-1.5">
							<CaptionStyleGrid
								compact
								value={selectedModelId ? null : captionStyle}
								disabled={pendingAction !== null}
								onSelect={(style) => {
									setCaptionStyle(style);
									setSelectedModelId(null);
									void handleApplyBuiltinStyle({ style });
								}}
							/>
							<StylePackLibrary
								capability="captions"
								displayMode="compact-picker"
								selectedId={selectedModelId}
								actionDisabled={pendingAction !== null || targetCount === 0}
								onUse={handleApplyImportedStyle}
							/>
						</div>
						<p className="text-[11px] text-muted-foreground">
							{applyToAll
								? pt
									? `A ação será aplicada às ${targetCount} legendas do projeto.`
									: `The action will be applied to all ${targetCount} project captions.`
								: pt
									? "A ação será aplicada somente à legenda selecionada."
									: "The action will be applied only to the selected caption."}
						</p>
					</section>
				</div>
			)}
			<ElementParamsTab
				element={element}
				trackId={trackId}
				paramKeys={paramKeys}
				sectionKey="text"
				linkedElements={linkedElements}
			/>
		</>
	);
}
