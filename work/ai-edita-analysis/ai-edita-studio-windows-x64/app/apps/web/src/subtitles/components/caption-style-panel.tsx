"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { EditorCore } from "@/core";
import { useI18n } from "@/i18n";
import { applyModelStyle } from "@/templates/commands";
import type { EditModel } from "@/templates/contract";
import { StylePackLibrary } from "@/templates/style-pack-library";
import type { ElementRef } from "@/timeline";
import type { CaptionStyleId } from "../builtin-caption-styles";
import { applyBuiltinCaptionStyle } from "../apply-builtin-caption-style";
import { CaptionStyleGrid } from "./caption-style-grid";

export type { CaptionStyleId } from "../builtin-caption-styles";

export function CaptionStylePanel({
	editor,
	value,
	onChange,
	targets,
}: {
	editor: EditorCore;
	value: CaptionStyleId;
	onChange: (value: CaptionStyleId) => void;
	targets: ElementRef[];
}) {
	const pt = useI18n().locale === "pt-BR";
	const [applyingStyle, setApplyingStyle] = useState<CaptionStyleId | null>(
		null,
	);
	const applyBuiltinStyle = async ({ style }: { style: CaptionStyleId }) => {
		onChange(style);
		if (targets.length === 0 || applyingStyle) return;

		setApplyingStyle(style);
		try {
			const captionElements = editor.timeline
				.getElementsWithTracks({ elements: targets })
				.flatMap(({ element, track }) =>
					element.type === "text" ? [{ trackId: track.id, element }] : [],
				);
			await applyBuiltinCaptionStyle({
				editor,
				targets: captionElements,
				style,
			});
			toast.success(
				pt
					? `Estilo aplicado agora em ${captionElements.length} legenda(s). Ctrl+Z desfaz.`
					: `Style applied now to ${captionElements.length} caption(s). Ctrl+Z undoes it.`,
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
			setApplyingStyle(null);
		}
	};
	const applyImportedStyle = async (model: EditModel) => {
		await applyModelStyle({
			editor,
			input: {
				templateId: model.id,
				textLayerIndex: 0,
				elements: targets,
				includeMotion: true,
				replaceExisting: true,
				acknowledgeAdaptations: model.warnings.length > 0,
			},
		});
		return pt
			? `Estilo aplicado em ${targets.length} legenda(s). Ctrl+Z desfaz.`
			: `Style applied to ${targets.length} caption(s). Ctrl+Z undoes it.`;
	};

	return (
		<div className="space-y-4">
			<StylePackLibrary
				capability="captions"
				onUse={applyImportedStyle}
				actionDisabled={targets.length === 0}
				actionHint={
					pt
						? "Selecione as legendas na timeline para aplicar um estilo importado."
						: "Select timeline captions to apply an imported style."
				}
			/>
			<section className="space-y-2">
				<div className="flex items-center gap-2">
					<Sparkles className="size-4 text-primary" />
					<div>
						<strong className="text-sm">
							{targets.length > 0
								? pt
									? "Estilo das legendas existentes"
									: "Style existing captions"
								: pt
									? "Estilo das próximas legendas"
									: "Style for new captions"}
						</strong>
						<p className="text-[11px] text-muted-foreground">
							{targets.length > 0
								? pt
									? "Clique para aplicar agora; também será usado nas próximas."
									: "Click to apply now; it will also be used for new captions."
								: pt
									? "Escolha visualmente antes de transcrever."
									: "Choose visually before transcribing."}
						</p>
					</div>
				</div>
				<CaptionStyleGrid
					value={value}
					onSelect={(style) => void applyBuiltinStyle({ style })}
					disabled={applyingStyle !== null}
				/>
			</section>
		</div>
	);
}
