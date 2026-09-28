"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
	LayoutTemplate,
	Upload,
	Download,
	ArrowLeft,
	Save,
	Heart,
	Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/editor/use-editor";
import { useI18n } from "@/i18n";
import { mediaTimeToSeconds } from "@/wasm";
import { useIntegrationStore } from "@/integrations/client";
import {
	fontPackSchema,
	installFontPack,
	MAX_FONT_PACK_BYTES,
	type FontPack,
	useFontPackCatalog,
} from "@/fonts/font-packs";
import {
	useModelStore,
	loadModels,
	saveModels,
	installModelPack,
	exportModelFile,
} from "./store";
import { packSchema, type EditModel } from "./contract";
import { templateEngine } from "./engine";
import {
	addModelText,
	applyModel,
	applyModelStyle,
	saveSelectionAsModel,
} from "./commands";
import { ModelPreview } from "./model-preview";
import { useModelFavorites } from "./favorites";
import { CaptionComposer } from "./caption-composer";
import { ProjectImportPanel } from "./project-import-panel";
import {
	MAX_TEMPLATE_ARCHIVE_BYTES,
	readCapCutTemplateArchive,
} from "./archive-import";

export function ModelsView() {
	const editor = useEditor();
	const { locale } = useI18n(),
		pt = locale === "pt-BR";
	const library = useModelStore();
	const fontCatalog = useFontPackCatalog();
	const chatBusy = useIntegrationStore((s) => s.chatBusy);
	const selectedElements = useEditor((e) => e.selection.getSelectedElements());
	const exporting = useEditor((e) => e.project.getExportState().isExporting);
	const [query, setQuery] = useState(""),
		[category, setCategory] = useState("");
	const [page, setPage] = useState(0),
		[slotPage, setSlotPage] = useState(0);
	const [onlyFavorites, setOnlyFavorites] = useState(false);
	const favorites = useModelFavorites();
	useEffect(() => {
		useModelFavorites.getState().load();
	}, []);
	const [selected, setSelected] = useState<EditModel | null>(null);
	const [texts, setTexts] = useState<string[]>([]);
	const [duration, setDuration] = useState(5),
		[start, setStart] = useState(0);
	const [accent, setAccent] = useState("");
	const [motion, setMotion] = useState(false),
		[textLayerIndex, setTextLayerIndex] = useState(0);
	const [busy, setBusy] = useState(false),
		[notice, setNotice] = useState("");
	const [pendingPack, setPendingPack] = useState<z.infer<
		typeof packSchema
	> | null>(null);
	const [pendingFontPack, setPendingFontPack] = useState<FontPack | null>(null);
	const [modelName, setModelName] = useState("");
	const fileInput = useRef<HTMLInputElement>(null);
	const panel = useRef<HTMLDivElement>(null);
	const disabled = busy || chatBusy || exporting;
	useEffect(() => {
		void loadModels().catch((e) =>
			setNotice(e instanceof Error ? e.message : "Failed"),
		);
	}, []);
	const models = [
		...library.bundled,
		...library.installed,
		...library.personal,
	];
	const installedIds = new Set(library.installed.map((model) => model.id));
	const nativeIds = new Set(
		[...library.bundled, ...library.installed].map((model) => model.id),
	);
	const categories = [...new Set(models.map((m) => m.category))];
	const matches = models
		.filter(
			(m) =>
				(!category || m.category === category) &&
				(!onlyFavorites || favorites.ids.includes(m.id)) &&
				(m.name + " " + m.source)
					.toLocaleLowerCase()
					.includes(query.toLocaleLowerCase()),
		)
		// Starred titles first: they are the ones the user reaches for every week.
		.sort(
			(a, b) =>
				Number(favorites.ids.includes(b.id)) -
				Number(favorites.ids.includes(a.id)),
		);
	/** Drops the title on the timeline at the playhead, with its own texts. */
	async function insert(model: EditModel) {
		if (model.warnings.length && !nativeIds.has(model.id)) {
			choose(model);
			setNotice(
				pt
					? "Este modelo foi adaptado de outro editor. Revise as adaptações abaixo e aplique."
					: "This model was adapted from another editor. Review the adaptations below, then apply.",
			);
			return;
		}
		await work(async () => {
			const result = await applyModel({
				editor,
				input: {
					templateId: model.id,
					startSeconds: mediaTimeToSeconds({
						time: editor.playback.getCurrentTime(),
					}),
					durationSeconds: model.duration,
					acknowledgeAdaptations: model.warnings.length > 0,
				},
			});
			return (
				model.name +
				": " +
				result.insertedElements.length +
				(pt
					? " camadas adicionadas. Ctrl+Z desfaz."
					: " layers added. Ctrl+Z undoes it.")
			);
		});
	}
	function choose(model: EditModel) {
		panel.current?.scrollTo({ top: 0 });
		setSelected(model);
		setTexts(
			model.layers
				.filter((l) => l.type === "text")
				.map((l) => String(l.params.content)),
		);
		setDuration(model.duration);
		setStart(mediaTimeToSeconds({ time: editor.playback.getCurrentTime() }));
		setAccent("");
		setMotion(false);
		setSlotPage(0);
		setTextLayerIndex(0);
		setNotice("");
	}
	async function work(action: () => Promise<string>) {
		if (disabled) return;
		setBusy(true);
		setNotice("");
		try {
			setNotice(await action());
		} catch (e) {
			setNotice(e instanceof Error ? e.message : "Failed");
		} finally {
			setBusy(false);
		}
	}
	async function importFile(file: File) {
		const zip = /\.zip$/i.test(file.name) || file.type === "application/zip";
		if (file.size > (zip ? MAX_TEMPLATE_ARCHIVE_BYTES : MAX_FONT_PACK_BYTES))
			throw new Error(
				pt ? "Limite de arquivo: 128 MB." : "File limit: 128 MB.",
			);
		if (zip) {
			const documents = await readCapCutTemplateArchive(file);
			const pack = packSchema.parse(
				await templateEngine({ op: "import_many", documents }),
			);
			if (!pack.templates.length)
				throw new Error(
					pt
						? "O ZIP não contém textos animados compatíveis."
						: "The ZIP has no compatible animated text.",
				);
			setPendingFontPack(null);
			setPendingPack(pack);
			return pt
				? `${pack.templates.length} títulos encontrados em ${documents.length} projeto(s) CapCut. Revise as adaptações antes de salvar.`
				: `${pack.templates.length} titles found in ${documents.length} CapCut project(s). Review adaptations before saving.`;
		}
		const document: unknown = JSON.parse(
			(await file.text()).replace(/^\uFEFF/, ""),
		);
		if (
			typeof document === "object" &&
			document !== null &&
			"format" in document &&
			document.format === "ai-edita-font-pack"
		) {
			const pack = fontPackSchema.parse(document);
			setPendingPack(null);
			setPendingFontPack(pack);
			return pt
				? `${pack.fonts.length} arquivos de fonte encontrados. Revise os direitos de uso antes de instalar.`
				: `${pack.fonts.length} font files found. Review the usage rights before installing.`;
		}
		if (file.size > 23 * 1024 * 1024)
			throw new Error(pt ? "Limite de títulos: 23 MB." : "Title limit: 23 MB.");
		const pack = packSchema.parse(
			await templateEngine({
				op: "import",
				document,
				label: file.name.replace(/\.(json|aiedita)$/i, ""),
			}),
		);
		if (!pack.templates.length)
			throw new Error(
				pt
					? "Não há textos compatíveis neste arquivo."
					: "No compatible text found in this file.",
			);
		setPendingFontPack(null);
		setPendingPack(pack);
		return pt
			? "Analise o resultado abaixo antes de salvar."
			: "Review the result below before saving.";
	}
	return (
		<div
			ref={panel}
			className="h-full overflow-y-auto p-4 space-y-4 text-sm"
			data-i18n-skip="true"
		>
			<header className="flex items-center justify-between gap-2">
				<h2 className="flex items-center gap-2 text-lg font-semibold">
					<LayoutTemplate className="size-5 text-primary" />
					{pt ? "Títulos" : "Titles"}
				</h2>
				{selected ? (
					<Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
						<ArrowLeft />
						{pt ? "Biblioteca" : "Library"}
					</Button>
				) : (
					<Button
						size="sm"
						variant="outline"
						disabled={disabled}
						onClick={() => fileInput.current?.click()}
					>
						<Upload />
						{pt ? "Importar" : "Import"}
					</Button>
				)}
			</header>
			<p className="text-xs text-muted-foreground">
				{pt
					? "Títulos animados, editáveis e locais. Passe o mouse sobre um cartão para visualizar o movimento em loop."
					: "Animated, editable, local titles. Hover a card to preview its motion in a loop."}
			</p>
			{library.storageWarning && (
				<p role="alert" className="text-xs text-destructive">
					{library.storageWarning}
				</p>
			)}
			{notice && (
				<p
					role="status"
					className="rounded-lg border border-primary/40 p-3 text-xs break-words"
				>
					{notice}
				</p>
			)}
			{!selected ? (
				<>
					<ProjectImportPanel />
					<p className="text-xs text-primary">
						{models.length} {pt ? "títulos disponíveis" : "available titles"}
					</p>
					<details
						open={Boolean(pendingPack || pendingFontPack)}
						className="space-y-3 rounded-lg border p-2"
					>
						<summary className="cursor-pointer text-xs">
							{pt ? "Gerenciar biblioteca" : "Manage library"}
						</summary>
						<div className="flex gap-2">
							<Button
								size="sm"
								variant="outline"
								disabled={!library.personal.length || disabled}
								onClick={() => exportModelFile(library.personal)}
							>
								<Download />
								{pt ? "Exportar meus títulos" : "Export my titles"}
							</Button>
						</div>
						<input
							ref={fileInput}
							type="file"
							accept=".aiedita,.json,.zip,application/json,application/zip"
							className="hidden"
							aria-label={pt ? "Pacote de títulos" : "Title package"}
							onChange={(e) => {
								const file = e.target.files?.[0];
								e.target.value = "";
								if (file) void work(() => importFile(file));
							}}
						/>
						<details className="text-xs text-muted-foreground">
							<summary className="cursor-pointer">
								{pt ? "O que é compatível?" : "What is compatible?"}
							</summary>
							<p className="mt-2">
								{pt
									? "Pacotes .aiedita de títulos ou fontes ficam neste computador e funcionam em todos os projetos. Fontes instaladas aparecem em Todas as fontes e Minhas fontes. Pacotes comerciais instalados não são reexportados pela interface."
									: ".aiedita title or font packs stay on this computer and work in every project. Installed fonts appear under All fonts and My fonts. Installed commercial packs are not re-exported by the UI."}
							</p>
							<p className="mt-2">
								{pt
									? "CapCut: importe o ZIP do projeto ou um draft_content.json. O AI Edita extrai apenas projetos declarativos, converte textos, posições e keyframes compatíveis e ignora instruções, caminhos e executáveis anexos. Efeitos proprietários, vídeos, máscaras e fontes externas não são executados."
									: "CapCut: import a project ZIP or draft_content.json. AI Edita extracts declarative projects only, converts compatible text, positions and keyframes, and ignores attached instructions, paths, and executables. Proprietary effects, video, masks, and external fonts are not executed."}
							</p>
						</details>
						{fontCatalog.packs.length > 0 && (
							<div className="rounded-lg border p-3 space-y-1">
								<strong className="block text-xs">
									{pt ? "Pacotes de fontes instalados" : "Installed font packs"}
								</strong>
								{fontCatalog.packs.map((pack) => (
									<p key={pack.id} className="text-xs text-muted-foreground">
										{pack.name} · v{pack.release} · {pack.familyCount}{" "}
										{pt ? "famílias" : "families"} · {pack.fontCount}{" "}
										{pt ? "arquivos" : "files"}
									</p>
								))}
							</div>
						)}
						{pendingFontPack && (
							<div className="rounded-lg border border-primary/40 p-3 space-y-2">
								<strong className="block">
									{pendingFontPack.manifest.name}
								</strong>
								<p className="text-xs text-muted-foreground">
									{pendingFontPack.manifest.publisher} · v
									{pendingFontPack.manifest.release}
								</p>
								<p className="text-xs">
									{pendingFontPack.manifest.description}
								</p>
								<strong>
									{pendingFontPack.fonts.length} {pt ? "fontes" : "fonts"} ·{" "}
									{
										new Set(pendingFontPack.fonts.map((font) => font.family))
											.size
									}{" "}
									{pt ? "famílias" : "families"}
								</strong>
								<p className="rounded-md bg-muted p-2 text-xs">
									{pendingFontPack.manifest.rightsNotice}
								</p>
								<Button
									size="sm"
									disabled={disabled}
									onClick={() =>
										void work(async () => {
											const result = await installFontPack(pendingFontPack);
											setPendingFontPack(null);
											return pt
												? `${result.installed} fontes ${result.updated ? "atualizadas" : "instaladas"} em ${result.families} famílias. Já estão disponíveis para textos e legendas.`
												: `${result.installed} fonts ${result.updated ? "updated" : "installed"} in ${result.families} families. They are ready for text and captions.`;
										})
									}
								>
									{pt ? "Instalar fontes" : "Install fonts"}
								</Button>
								<Button
									size="sm"
									variant="ghost"
									disabled={disabled}
									onClick={() => setPendingFontPack(null)}
								>
									{pt ? "Descartar importação" : "Dismiss import"}
								</Button>
							</div>
						)}
						{pendingPack && (
							<div className="rounded-lg border border-primary/40 p-3 space-y-2">
								{pendingPack.manifest && (
									<>
										<strong className="block">
											{pendingPack.manifest.name}
										</strong>
										<p className="text-xs text-muted-foreground">
											{pendingPack.manifest.publisher} · v
											{pendingPack.manifest.release}
										</p>
										<p className="text-xs">
											{pendingPack.manifest.description}
										</p>
									</>
								)}
								<strong>
									{pendingPack.templates.length}{" "}
									{pt ? "títulos encontrados" : "titles found"}
								</strong>
								{!pendingPack.manifest && (
									<p className="text-xs">
										{
											pendingPack.templates.filter((t) => t.warnings.length)
												.length
										}{" "}
										{pt
											? "com adaptações. Revise cada título antes de aplicar."
											: "with adaptations. Review each model before applying."}
									</p>
								)}
								{!pendingPack.manifest && pendingPack.report && (
									<p className="text-xs">
										{pt
											? "Camadas não textuais omitidas: "
											: "Omitted non-text layers: "}
										{pendingPack.report.omittedNonTextLayers} ·{" "}
										{pt ? "Textos inválidos: " : "Invalid text: "}
										{pendingPack.report.rejectedTextLayers}
									</p>
								)}
								<Button
									size="sm"
									disabled={disabled}
									onClick={() =>
										void work(async () => {
											if (pendingPack.manifest) {
												const result = await installModelPack({
													manifest: pendingPack.manifest,
													templates: pendingPack.templates,
												});
												setPendingPack(null);
												return pt
													? `${result.installed} estilos ${result.updated ? "atualizados" : "instalados"}. Já estão disponíveis para legendas e textos.`
													: `${result.installed} styles ${result.updated ? "updated" : "installed"}. They are ready for captions and text.`;
											}
											const n = await saveModels(pendingPack.templates);
											setPendingPack(null);
											return pt
												? n +
														" títulos salvos. Duplicados preservados sem sobrescrever."
												: n +
														" titles saved. Duplicates preserved without overwriting.";
										})
									}
								>
									{pendingPack.manifest
										? pt
											? "Instalar pacote"
											: "Install package"
										: pt
											? "Salvar na biblioteca"
											: "Save to library"}
								</Button>
								<Button
									size="sm"
									variant="ghost"
									disabled={disabled}
									onClick={() => setPendingPack(null)}
								>
									{pt ? "Descartar importação" : "Dismiss import"}
								</Button>
							</div>
						)}
						<details className="space-y-2 rounded-lg border p-2">
							<summary className="cursor-pointer text-xs">
								{pt
									? "Salvar seleção como título"
									: "Save selection as a title"}
							</summary>
							<label className="block text-xs">
								{pt ? "Nome do título" : "Title name"}
								<input
									aria-label={pt ? "Nome do título" : "Title name"}
									value={modelName}
									maxLength={100}
									onChange={(e) => setModelName(e.target.value)}
									placeholder={pt ? "Nome do meu título" : "My title name"}
									className="mt-1 w-full rounded border bg-input p-2"
								/>
							</label>
							<Button
								size="sm"
								variant="secondary"
								disabled={
									disabled || !selectedElements.length || !modelName.trim()
								}
								onClick={() =>
									void work(async () => {
										const saved = await saveSelectionAsModel({
											editor,
											name: modelName.trim(),
										});
										setModelName("");
										return (
											(pt ? "Título salvo: " : "Saved title: ") + saved.name
										);
									})
								}
							>
								<Save />
								{pt
									? "Salvar textos/formas selecionados"
									: "Save selected text/shapes"}
							</Button>
						</details>
						{!!library.installedPacks.length && (
							<div className="rounded-lg border p-3 text-xs space-y-2">
								<strong>{pt ? "Pacotes instalados" : "Installed packs"}</strong>
								{library.installedPacks.map((pack) => (
									<p key={pack.manifest.id} className="text-muted-foreground">
										{pack.manifest.name} · v{pack.manifest.release} ·{" "}
										{pack.templates.length} {pt ? "estilos" : "styles"}
									</p>
								))}
							</div>
						)}
					</details>
					<input
						aria-label={pt ? "Buscar títulos" : "Search titles"}
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setPage(0);
						}}
						placeholder={pt ? "Buscar títulos…" : "Search titles…"}
						className="w-full rounded-lg border bg-input p-2"
					/>
					<select
						aria-label={pt ? "Coleção de títulos" : "Title collection"}
						value={category}
						onChange={(e) => {
							setCategory(e.target.value);
							setPage(0);
						}}
						className="w-full rounded-lg border bg-input p-2"
					>
						<option value="">
							{pt ? "Todas as coleções" : "All collections"}
						</option>
						{categories.map((c) => (
							<option key={c}>{c}</option>
						))}
					</select>
					<div className="flex items-center justify-between gap-2">
						<Button
							size="sm"
							variant={onlyFavorites ? "default" : "outline"}
							onClick={() => {
								setOnlyFavorites(!onlyFavorites);
								setPage(0);
							}}
						>
							<Heart
								className={"size-3.5 " + (onlyFavorites ? "fill-current" : "")}
							/>
							{pt ? "Favoritos" : "Favourites"}
							<span className="opacity-70">{favorites.ids.length}</span>
						</Button>
						<span className="text-[10px] text-muted-foreground">
							{matches.length} {pt ? "títulos" : "titles"}
						</span>
					</div>
					<div className="flex flex-col gap-2">
						{matches.slice(page * 12, (page + 1) * 12).map((model) => {
							const starred = favorites.ids.includes(model.id);
							return (
								<div
									key={model.id}
									className="group bg-card flex items-center gap-3 overflow-hidden rounded-xl border p-2 transition-colors hover:border-primary"
									data-template-id={model.id}
								>
									<button
										type="button"
										onClick={() => choose(model)}
										className="flex min-w-0 flex-1 items-center gap-3 text-left"
										title={pt ? "Abrir e editar os textos" : "Open and edit texts"}
									>
										<span className="w-20 shrink-0 overflow-hidden rounded-lg bg-black p-1">
											<ModelPreview model={model} compact />
										</span>
										<span className="min-w-0 flex-1">
											<span className="block text-xs font-semibold break-words">
												{model.name}
											</span>
											<span className="mt-0.5 block text-[10px] text-muted-foreground">
												{model.layers.length} {pt ? "camadas" : "layers"} ·{" "}
												{model.warnings.length && !nativeIds.has(model.id)
													? pt
														? "Adaptado"
														: "Adapted"
													: pt
														? "Nativo"
														: "Native"}
											</span>
										</span>
									</button>
									<div className="flex shrink-0 items-center gap-0.5">
										<Button
											size="icon"
											variant="ghost"
											disabled={disabled}
											onClick={() => void insert(model)}
											aria-label={
												pt
													? `Adicionar ${model.name} no cursor`
													: `Add ${model.name} at the playhead`
											}
											title={pt ? "Adicionar no cursor" : "Add at the playhead"}
										>
											<Plus className="size-4" />
										</Button>
										<Button
											size="icon"
											variant="ghost"
											onClick={() => favorites.toggle(model.id)}
											aria-label={
												starred
													? pt
														? `Remover ${model.name} dos favoritos`
														: `Remove ${model.name} from favourites`
													: pt
														? `Favoritar ${model.name}`
														: `Favourite ${model.name}`
											}
											title={
												starred
													? pt
														? "Remover dos favoritos"
														: "Remove from favourites"
													: pt
														? "Favoritar"
														: "Favourite"
											}
										>
											<Heart
												className={
													"size-4 " +
													(starred
														? "fill-current text-red-500"
														: "text-muted-foreground")
												}
											/>
										</Button>
									</div>
								</div>
							);
						})}
					</div>
					{!library.loaded && (
						<p role="status">
							{pt ? "Carregando biblioteca…" : "Loading library…"}
						</p>
					)}
					{library.loaded && !matches.length && (
						<p>{pt ? "Nenhum título encontrado." : "No titles found."}</p>
					)}
					{matches.length > 12 && (
						<div className="flex items-center justify-between">
							<Button
								size="sm"
								variant="ghost"
								disabled={page === 0}
								onClick={() => setPage(page - 1)}
							>
								{pt ? "Anterior" : "Previous"}
							</Button>
							<span className="text-xs">
								{page + 1} / {Math.ceil(matches.length / 12)}
							</span>
							<Button
								size="sm"
								variant="ghost"
								disabled={(page + 1) * 12 >= matches.length}
								onClick={() => setPage(page + 1)}
							>
								{pt ? "Próxima" : "Next"}
							</Button>
						</div>
					)}
				</>
			) : (
				<>
					<h3 className="font-medium break-words">{selected.name}</h3>
					{texts.length ? (
						<CaptionComposer
							key={selected.id}
							templateId={selected.id}
							acknowledged={selected.warnings.length > 0}
							disabled={disabled}
							onResult={setNotice}
							onBusyChange={setBusy}
						/>
					) : (
						<p className="rounded-lg border border-amber-500/40 p-3 text-xs text-amber-700">
							{pt
								? "Este título não tem camada de texto; por isso não pode ser usado como estilo de legenda."
								: "This title has no text layer, so it cannot be used as a caption style."}
						</p>
					)}
					<ModelPreview model={selected} texts={texts} accent={accent} />
					<p className="text-[11px] text-muted-foreground">
						{nativeIds.has(selected.id)
							? pt
								? "Prévia animada com fontes, textos e formas nativas. Confira a composição sobre seu vídeo na timeline."
								: "Animated preview using native fonts, text and shapes. Check the composition over your footage on the timeline."
							: pt
								? "Prévia animada com fontes, textos e formas nativas. Confira a composição sobre seu vídeo na timeline. Efeitos proprietários do CapCut não são executados."
								: "Animated preview using native fonts, text and shapes. Check the composition over your footage on the timeline. Proprietary CapCut effects are not executed."}
					</p>
					<div className="grid grid-cols-2 gap-2">
						<label className="text-xs">
							{pt ? "Início (s)" : "Start (s)"}
							<input
								type="number"
								min={0}
								max={86400}
								step={0.1}
								value={start}
								onChange={(e) => setStart(Number(e.target.value))}
								className="mt-1 w-full rounded border bg-input p-2"
							/>
						</label>
						<label className="text-xs">
							{pt ? "Duração (s)" : "Duration (s)"}
							<input
								type="number"
								min={0.05}
								max={3600}
								step={0.1}
								value={duration}
								onChange={(e) => setDuration(Number(e.target.value))}
								className="mt-1 w-full rounded border bg-input p-2"
							/>
						</label>
					</div>
					<label className="flex items-center justify-between text-xs">
						{pt ? "Cor dos textos (opcional)" : "Text color (optional)"}
						<input
							type="color"
							value={accent || "#B9F443"}
							onChange={(e) => setAccent(e.target.value)}
						/>
					</label>
					{accent && (
						<Button size="sm" variant="ghost" onClick={() => setAccent("")}>
							{pt ? "Restaurar cores originais" : "Restore original colors"}
						</Button>
					)}
					{texts.slice(slotPage * 8, (slotPage + 1) * 8).map((text, i) => (
						<label key={slotPage * 8 + i} className="block text-xs">
							{pt ? "Texto " : "Text "}
							{slotPage * 8 + i + 1}
							<textarea
								aria-label={(pt ? "Texto " : "Text ") + (slotPage * 8 + i + 1)}
								value={text}
								maxLength={2000}
								onChange={(e) =>
									setTexts((prev) =>
										prev.map((v, j) =>
											j === slotPage * 8 + i ? e.target.value : v,
										),
									)
								}
								className="mt-1 min-h-16 w-full rounded border bg-input p-2"
							/>
						</label>
					))}
					{texts.length > 8 && (
						<div className="flex items-center justify-between">
							<Button
								size="sm"
								variant="ghost"
								disabled={!slotPage}
								onClick={() => setSlotPage(slotPage - 1)}
							>
								{pt ? "Textos anteriores" : "Previous texts"}
							</Button>
							<Button
								size="sm"
								variant="ghost"
								disabled={(slotPage + 1) * 8 >= texts.length}
								onClick={() => setSlotPage(slotPage + 1)}
							>
								{pt ? "Próximos textos" : "Next texts"}
							</Button>
						</div>
					)}
					<Button
						className="w-full"
						disabled={disabled}
						onClick={() =>
							void work(async () => {
								const result = await applyModel({
									editor,
									input: {
										templateId: selected.id,
										startSeconds: start,
										durationSeconds: duration,
										texts,
										accent: accent || undefined,
										acknowledgeAdaptations: selected.warnings.length > 0,
									},
								});
								return (
									result.insertedElements.length +
									(pt
										? " camadas adicionadas. Ctrl+Z desfaz tudo."
										: " layers added. Ctrl+Z undoes the whole insertion.")
								);
							})
						}
					>
						{pt ? "Adicionar título à timeline" : "Add title to timeline"}
					</Button>
					{!!texts.length && (
						<section className="space-y-2 rounded-lg border border-primary/30 p-3">
							<h4 className="font-medium">
								{pt ? "Adicionar texto individual" : "Add individual text"}
							</h4>
							<p className="text-xs text-muted-foreground">
								{pt
									? "Insere somente a camada escolhida, já com tipografia, cores, contorno, sombra e movimento do estilo."
									: "Inserts only the chosen layer with the style's typography, colors, outline, shadow and motion."}
							</p>
							<select
								aria-label={
									pt ? "Estilo do texto individual" : "Individual text style"
								}
								value={textLayerIndex}
								onChange={(e) => setTextLayerIndex(Number(e.target.value))}
								className="w-full rounded border bg-input p-2"
							>
								{texts.map((text, index) => (
									<option value={index} key={index}>
										{index + 1} · {text.slice(0, 45)}
									</option>
								))}
							</select>
							<Button
								variant="secondary"
								className="w-full"
								disabled={disabled}
								onClick={() =>
									void work(async () => {
										await addModelText({
											editor,
											input: {
												templateId: selected.id,
												textLayerIndex,
												startSeconds: start,
												durationSeconds: duration,
												texts: [texts[textLayerIndex]],
												accent: accent || undefined,
												acknowledgeAdaptations: selected.warnings.length > 0,
											},
										});
										return pt
											? "Texto estilizado adicionado. Ctrl+Z desfaz."
											: "Styled text added. Ctrl+Z undoes it.";
									})
								}
							>
								{pt
									? "Adicionar este estilo como texto"
									: "Add this style as text"}
							</Button>
						</section>
					)}
					{!!texts.length && (
						<section className="space-y-2 border-t pt-3">
							<h4 className="font-medium">
								{pt
									? "Aplicar estilo às legendas existentes"
									: "Style existing captions"}
							</h4>
							<p className="text-xs text-muted-foreground">
								{pt
									? "Selecione textos na timeline. Palavras, tempos e posições são preservados. Os campos de texto e cor acima são apenas para inserir o título."
									: "Select timeline text. Words, timing and positions are preserved. Text/color fields above apply only to new insertions."}
							</p>
							<select
								aria-label={pt ? "Camada de referência" : "Reference layer"}
								value={textLayerIndex}
								onChange={(e) => setTextLayerIndex(Number(e.target.value))}
								className="w-full rounded border bg-input p-2"
							>
								{texts.map((t, i) => (
									<option value={i} key={i}>
										{i + 1} · {t.slice(0, 45)}
									</option>
								))}
							</select>
							<label className="flex gap-2 text-xs">
								<input
									type="checkbox"
									checked={motion}
									onChange={(e) => setMotion(e.target.checked)}
								/>
								{pt
									? "Incluir movimento (sem substituir animações existentes)"
									: "Include motion (preserve existing animation)"}
							</label>
							<Button
								variant="secondary"
								className="w-full"
								disabled={disabled || !selectedElements.length}
								onClick={() =>
									void work(async () => {
										await applyModelStyle({
											editor,
											input: {
												templateId: selected.id,
												textLayerIndex,
												elements: selectedElements,
												includeMotion: motion,
												acknowledgeAdaptations: selected.warnings.length > 0,
											},
										});
										return pt
											? "Estilo aplicado. Ctrl+Z desfaz."
											: "Style applied. Ctrl+Z undoes it.";
									})
								}
							>
								{pt ? "Estilizar textos selecionados" : "Style selected text"}
							</Button>
						</section>
					)}
					{installedIds.has(selected.id) ? (
						<p className="rounded-lg border p-2 text-xs text-muted-foreground">
							{pt
								? "Estilo instalado por pacote comercial. O arquivo original continua separado do código do aplicativo."
								: "Style installed from a commercial pack. The original file remains separate from the app source."}
						</p>
					) : (
						<Button
							size="sm"
							variant="outline"
							onClick={() => exportModelFile([selected])}
						>
							<Download />
							{pt ? "Exportar este título" : "Export this title"}
						</Button>
					)}
				</>
			)}
		</div>
	);
}
