"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/editor/use-editor";
import { useI18n } from "@/i18n";
import { applyModelToCaptions } from "./commands";

export function CaptionComposer({
	templateId,
	acknowledged,
	disabled,
	onResult,
	onBusyChange,
}: {
	templateId: string;
	acknowledged: boolean;
	disabled: boolean;
	onResult: (text: string) => void;
	onBusyChange: (busy: boolean) => void;
}) {
	const editor = useEditor();
	const selected = useEditor((e) => e.selection.getSelectedElements());
	const pt = useI18n().locale === "pt-BR";
	const [textMode, setTextMode] = useState<"single" | "distribute" | "repeat">(
		"distribute",
	);
	const [textLayerIndex, setTextLayerIndex] = useState(0);
	const [replace, setReplace] = useState(false);
	const [busy, setBusy] = useState(false);
	return (
		<details className="rounded-lg border border-primary/40 p-3 space-y-3">
			<summary className="cursor-pointer font-medium">
				{pt
					? "Composição completa nas legendas"
					: "Complete composition on captions"}
			</summary>
			<p className="text-xs text-muted-foreground">
				{pt
					? "Selecione as legendas de uma voz na timeline. Todas as camadas do modelo serão adaptadas à duração de cada trecho. As posições passam a ser as do modelo; os vídeos não mudam."
					: "Select captions for one voice. All title layers adapt to each caption duration. Uses title positions; video stays unchanged."}
			</p>
			<label className="block text-xs">
				{pt ? "Distribuição da fala" : "Speech layout"}
				<select
					className="mt-1 w-full rounded border bg-input p-2"
					value={textMode}
					onChange={(e) => {
						if (
							e.target.value === "single" ||
							e.target.value === "repeat" ||
							e.target.value === "distribute"
						)
							setTextMode(e.target.value);
					}}
				>
					<option value="distribute">
						{pt ? "Distribuir entre as camadas" : "Distribute across layers"}
					</option>
					<option value="repeat">
						{pt ? "Repetir em todas as camadas" : "Repeat on every layer"}
					</option>
					<option value="single">
						{pt
							? "Substituir uma camada, manter as demais"
							: "Replace one layer, keep others"}
					</option>
				</select>
			</label>
			{textMode === "single" && (
				<label className="block text-xs">
					{pt ? "Número da camada de texto" : "Text layer number"}
					<input
						className="mt-1 w-full rounded border bg-input p-2"
						type="number"
						min={1}
						max={400}
						value={textLayerIndex + 1}
						onChange={(e) => setTextLayerIndex(Number(e.target.value) - 1)}
					/>
				</label>
			)}
			<label className="flex items-start gap-2 text-xs">
				<input
					type="checkbox"
					checked={replace}
					onChange={(e) => setReplace(e.target.checked)}
				/>
				{pt
					? "Substituir as legendas selecionadas (Ctrl+Z restaura)"
					: "Replace selected captions (Ctrl+Z restores them)"}
			</label>
			<Button
				variant="secondary"
				className="w-full"
				disabled={disabled || busy || !selected.length}
				onClick={() => {
					void (async () => {
						setBusy(true);
						onBusyChange(true);
						try {
							const r = await applyModelToCaptions({
								editor,
								input: {
									templateId,
									elements: selected,
									textMode,
									textLayerIndex,
									replaceCaptions: replace,
									acknowledgeAdaptations: acknowledged,
								},
							});
							onResult(
								r.captionCount +
									(pt
										? " trechos receberam a composição completa. Ctrl+Z desfaz."
										: " captions received the full composition. Ctrl+Z undoes it."),
							);
						} catch (e) {
							onResult(e instanceof Error ? e.message : "Failed");
						} finally {
							setBusy(false);
							onBusyChange(false);
						}
					})();
				}}
			>
				{busy
					? pt
						? "Aplicando…"
						: "Applying…"
					: pt
						? "Aplicar composição aos trechos"
						: "Apply composition to captions"}
			</Button>
		</details>
	);
}
