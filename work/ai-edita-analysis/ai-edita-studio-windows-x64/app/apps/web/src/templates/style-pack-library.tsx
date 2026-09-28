"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Check, PackageOpen, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensurePresetFont } from "@/fonts/preset-fonts";
import { useI18n } from "@/i18n";
import { packSchema, type EditModel } from "./contract";
import { templateEngine } from "./engine";
import { installModelPack, loadModels, useModelStore } from "./store";
import { cssFontFamily } from "@/fonts/css";

const MAX_STYLE_PACK_BYTES = 23 * 1024 * 1024;

/** Perceived brightness of a #rgb/#rrggbb colour, 0 (black) to 1 (white). */
function luminance(color: string): number {
	const hex = color.trim().replace("#", "");
	const full =
		hex.length === 3
			? hex
					.split("")
					.map((digit) => digit + digit)
					.join("")
			: hex;
	if (!/^[0-9a-fA-F]{6}$/.test(full)) return 1;
	const [red, green, blue] = [0, 2, 4].map(
		(start) => Number.parseInt(full.slice(start, start + 2), 16) / 255,
	);
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function StylePackPreview({
	model,
	capability,
	compact = false,
}: {
	model: EditModel;
	capability: "captions" | "text";
	compact?: boolean;
}) {
	const layer = model.layers.find((item) => item.type === "text");
	const params = layer?.params ?? {};
	const family = String(params.fontFamily ?? "Arial");
	const rawContent = String(
		params.content ?? (capability === "captions" ? "SUA LEGENDA" : "SEU TEXTO"),
	).trim();
	const maxContentLength = compact ? 18 : 32;
	const content =
		rawContent.length > maxContentLength
			? rawContent.slice(0, maxContentLength - 1) + "…"
			: rawContent;
	// The model is written for a 1080 px frame, where the type is ~90 px and the outline
	// ~8 px. Copying those pixels into a thumbnail swallows the glyphs and tears the word
	// apart, so the preview keeps the model's proportions instead: the type is sized to fit
	// the tile, and everything else is expressed in ems of that type.
	const designSize = Math.max(8, Number(params.fontSize ?? 16));
	const perEm = (value: number, max: number) =>
		Math.min(max, Math.max(0, value) / designSize);
	const characters = Math.max(5, content.length);
	const fontSize = `${Math.min(compact ? 15 : 19, 165 / characters).toFixed(2)}cqw`;
	const outline = perEm(Number(params.outlineWidth ?? 0), 0.05);
	const shadow = perEm(Number(params.shadowBlur ?? 0), 0.25);
	const letterSpacing = `${perEm(Number(params.letterSpacing ?? 0), 0.4).toFixed(3)}em`;
	const background =
		params["background.enabled"] === true
			? String(params["background.color"] ?? "#000000")
			: undefined;
	// A dark caption on the dark tile is an invisible preview: show it over light, the way
	// it will look over a bright shot.
	const onLight =
		!background && luminance(String(params.color ?? "#ffffff")) < 0.45;
	useEffect(() => {
		void ensurePresetFont({ family });
	}, [family]);
	return (
		<div
			className={
				"flex items-center justify-center overflow-hidden text-center " +
				(onLight ? "bg-[#e9ece7] " : "bg-[#0d130f] ") +
				(compact ? "aspect-square rounded p-1" : "aspect-[4/3] rounded-lg p-2")
			}
			style={{ containerType: "inline-size" }}
		>
			<span
				className="inline-block max-w-full leading-tight"
				style={{
					color: String(params.color ?? "#ffffff"),
					fontFamily: cssFontFamily({ family }),
					fontSize,
					fontWeight:
						params.fontWeight === "bold"
							? 800
							: Math.max(400, Number(params.fontWeight ?? 700) || 700),
					fontStyle: params.fontStyle === "italic" ? "italic" : "normal",
					letterSpacing,
					WebkitTextStroke:
						outline > 0
							? `${outline}em ${String(params.outlineColor ?? "#000000")}`
							: undefined,
					textShadow:
						shadow > 0
							? `0 0.04em ${shadow}em ${String(params.shadowColor ?? "#000000")}`
							: undefined,
					background,
					borderRadius: background
						? `${perEm(Number(params["background.cornerRadius"] ?? 8), 0.4).toFixed(3)}em`
						: undefined,
					padding: background ? "0.12em 0.3em" : undefined,
				}}
			>
				{content || (capability === "captions" ? "SUA LEGENDA" : "SEU TEXTO")}
			</span>
		</div>
	);
}

export function StylePackLibrary({
	capability,
	onUse,
	actionDisabled = false,
	actionHint,
	displayMode = "library",
	selectedId,
}: {
	capability: "captions" | "text";
	onUse: (model: EditModel) => Promise<string>;
	actionDisabled?: boolean;
	actionHint?: string;
	displayMode?: "library" | "compact-picker";
	selectedId?: string | null;
}) {
	const pt = useI18n().locale === "pt-BR";
	const inputRef = useRef<HTMLInputElement>(null);
	const library = useModelStore();
	const [busyId, setBusyId] = useState<string | null>(null);
	const [notice, setNotice] = useState("");
	const [error, setError] = useState("");
	const compactPicker = displayMode === "compact-picker";

	useEffect(() => {
		void loadModels().catch((reason) =>
			setError(reason instanceof Error ? reason.message : "Failed"),
		);
	}, []);

	const compatiblePacks = library.installedPacks.filter((pack) =>
		pack.manifest.capabilities.includes(capability),
	);
	const styles = compatiblePacks.flatMap((pack) =>
		pack.templates.map((model) => ({ model, packName: pack.manifest.name })),
	);

	const importPack = async (file: File) => {
		setBusyId("import");
		setNotice("");
		setError("");
		try {
			if (file.size > MAX_STYLE_PACK_BYTES)
				throw new Error(pt ? "O pacote excede 23 MB." : "Pack exceeds 23 MB.");
			const document: unknown = JSON.parse(
				(await file.text()).replace(/^\uFEFF/, ""),
			);
			const pack = packSchema.parse(
				await templateEngine({
					op: "import",
					document,
					label: file.name.replace(/\.(json|aiedita)$/i, ""),
				}),
			);
			if (!pack.manifest)
				throw new Error(
					pt
						? "Escolha um pacote .aiedita publicado. Projetos e modelos antigos não são importados nesta área."
						: "Choose a published .aiedita pack. Legacy projects and templates are not imported here.",
				);
			if (!pack.manifest.capabilities.includes(capability))
				throw new Error(
					capability === "captions"
						? pt
							? "Este arquivo não é um pacote de legendas."
							: "This is not a caption pack."
						: pt
							? "Este arquivo não é um pacote de estilos de texto."
							: "This is not a text style pack.",
				);
			const result = await installModelPack({
				manifest: pack.manifest,
				templates: pack.templates,
			});
			setNotice(
				pt
					? `${result.installed} estilo(s) ${result.updated ? "atualizados" : "instalados"}. Disponíveis em todos os projetos.`
					: `${result.installed} style(s) ${result.updated ? "updated" : "installed"}. Available in every project.`,
			);
		} catch (reason) {
			setError(
				reason instanceof Error
					? reason.message
					: pt
						? "Não foi possível importar o pacote."
						: "Could not import pack.",
			);
		} finally {
			setBusyId(null);
		}
	};

	return (
		<section
			className={compactPicker ? "space-y-1.5" : "space-y-3"}
			data-i18n-skip="true"
		>
			<input
				ref={inputRef}
				type="file"
				accept=".aiedita,application/json"
				aria-label={
					capability === "captions"
						? pt
							? "Arquivo de pacote de legendas"
							: "Caption pack file"
						: pt
							? "Arquivo de pacote de textos"
							: "Text pack file"
				}
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void importPack(file);
				}}
			/>
			{!compactPicker && (
				<div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
					<div className="flex items-start gap-2">
						<PackageOpen className="mt-0.5 size-5 shrink-0 text-primary" />
						<div className="min-w-0 flex-1">
							<strong className="text-sm">
								{capability === "captions"
									? pt
										? "Seus estilos de legenda"
										: "Your caption styles"
									: pt
										? "Seus estilos de texto"
										: "Your text styles"}
							</strong>
							<p className="mt-0.5 text-[11px] text-muted-foreground">
								{pt
									? "Importe uma vez. O pacote fica disponível em todos os projetos."
									: "Import once. The pack stays available in every project."}
							</p>
						</div>
					</div>
					<Button
						type="button"
						size="sm"
						className="mt-3 w-full"
						disabled={busyId !== null}
						onClick={() => inputRef.current?.click()}
					>
						<Upload className="size-4" />
						{busyId === "import"
							? pt
								? "Importando…"
								: "Importing…"
							: capability === "captions"
								? pt
									? "Importar pacote de legendas"
									: "Import caption pack"
								: pt
									? "Importar pacote de textos"
									: "Import text pack"}
					</Button>
				</div>
			)}

			{library.storageWarning && (
				<p role="alert" className="text-xs text-destructive">
					{library.storageWarning}
				</p>
			)}
			{error && (
				<p
					role="alert"
					className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive"
				>
					{error}
				</p>
			)}
			{notice && (
				<p
					role="status"
					className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs text-emerald-600"
				>
					{notice}
				</p>
			)}

			{!library.loaded ? (
				<p className="text-xs text-muted-foreground">
					{pt ? "Carregando estilos…" : "Loading styles…"}
				</p>
			) : styles.length === 0 ? (
				compactPicker ? (
					<p className="py-1 text-[10px] text-muted-foreground">
						{pt
							? "Modelos importados aparecerão aqui."
							: "Imported models will appear here."}
					</p>
				) : (
					<div className="rounded-xl border border-dashed p-4 text-center">
						<p className="text-xs font-medium">
							{pt ? "Nenhum pacote importado ainda" : "No imported packs yet"}
						</p>
						<p className="mt-1 text-[11px] text-muted-foreground">
							{pt
								? "Quando você importar, as prévias aparecerão aqui."
								: "Previews appear here after import."}
						</p>
					</div>
				)
			) : compactPicker ? (
				<div className="space-y-1.5">
					<p className="text-[10px] font-medium text-muted-foreground">
						{pt ? "Modelos importados" : "Imported models"}
					</p>
					<div className="grid grid-cols-4 gap-1.5">
						{styles.map(({ model }) => (
							<button
								key={model.id}
								type="button"
								title={model.name}
								aria-pressed={selectedId === model.id}
								className={
									"relative min-w-0 overflow-hidden rounded-md border bg-card p-1 text-left transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60 " +
									(selectedId === model.id
										? "border-primary ring-1 ring-primary"
										: "")
								}
								disabled={actionDisabled || busyId !== null}
								onClick={() => {
									setBusyId(model.id);
									setError("");
									setNotice("");
									void onUse(model)
										.then(setNotice)
										.catch((reason) =>
											setError(
												reason instanceof Error ? reason.message : "Failed",
											),
										)
										.finally(() => setBusyId(null));
								}}
							>
								<StylePackPreview
									model={model}
									capability={capability}
									compact
								/>
								<span className="mt-1 flex min-w-0 items-center justify-between gap-0.5 text-[9px] font-medium">
									<span className="truncate">{model.name}</span>
									{selectedId === model.id && (
										<Check className="size-3 shrink-0 text-primary" />
									)}
								</span>
							</button>
						))}
					</div>
				</div>
			) : (
				<div className="grid grid-cols-2 gap-2">
					{styles.map(({ model, packName }) => (
						<article
							key={model.id}
							className="min-w-0 overflow-hidden rounded-xl border bg-card p-2"
						>
							<StylePackPreview model={model} capability={capability} />
							<strong
								className="mt-2 block truncate text-xs"
								title={model.name}
							>
								{model.name}
							</strong>
							<span className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
								<BadgeCheck className="size-3 shrink-0 text-primary" />
								{packName}
							</span>
							<Button
								type="button"
								size="sm"
								variant="secondary"
								className="mt-2 w-full text-[11px]"
								disabled={actionDisabled || busyId !== null}
								onClick={() => {
									setBusyId(model.id);
									setError("");
									setNotice("");
									void onUse(model)
										.then(setNotice)
										.catch((reason) =>
											setError(
												reason instanceof Error ? reason.message : "Failed",
											),
										)
										.finally(() => setBusyId(null));
								}}
							>
								{busyId === model.id
									? pt
										? "Aplicando…"
										: "Applying…"
									: capability === "captions"
										? pt
											? "Aplicar"
											: "Apply"
										: pt
											? "Adicionar"
											: "Add"}
							</Button>
						</article>
					))}
				</div>
			)}
			{actionDisabled && actionHint && (
				<p className="text-[11px] text-muted-foreground">{actionHint}</p>
			)}
		</section>
	);
}
