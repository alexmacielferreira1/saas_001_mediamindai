"use client";

import { useEffect, useRef, useState } from "react";
import {
	Copy,
	Download,
	LoaderCircle,
	Package,
	Pencil,
	Plus,
	Save,
	Sparkles,
	Trash2,
	Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/editor/use-editor";
import { useI18n } from "@/i18n";
import { useSettingsDialog } from "@/operations/settings";
import {
	connectionSchema,
	integrationRequest,
	useIntegrationStore,
} from "@/integrations/client";
import { useWorkspace, useWorkspacePolling } from "@/operations/client";
import { agentRunSchema } from "@/integrations/agent-run-contract";
import { useStudioStore } from "@/integrations/studio-store";
import { editingSource, listBuiltinEditingTemplates } from "./editing-commands";
import { editingOptionsSchema, type EditingOptions } from "./editing-contract";
import { buildEditingTemplatePrompt } from "./editing-template-prompt";
import { TemplatePreview } from "./template-preview";
import {
	BUILTIN_EDITING_TEMPLATE,
	BUILTIN_EDITING_TEMPLATES,
	createEditingTemplatePreset,
	isBuiltinEditingTemplate,
	isThemeEditingTemplate,
	editingTemplatePresetSchema,
	exportEditingTemplatePreset,
	loadEditingTemplatePresets,
	applyPresetImport,
	findDuplicatePresets,
	parseEditingTemplatePresetFile,
	planPresetImport,
	removeEditingTemplatePreset,
	saveEditingTemplatePresets,
	upsertEditingTemplatePreset,
	type EditingTemplatePreset,
	type PresetImportChoice,
	type PresetImportConflict,
} from "./editing-template-library";
import {
	commitEditingTemplatePacks,
	installedTemplateCard,
	planEditingTemplatePackFile,
	type PlannedPack,
	isEditingTemplatePackFile,
	loadInstalledEditingTemplatePacks,
	removeInstalledEditingTemplatePack,
	type InstalledEditingTemplatePack,
} from "./editing-template-packs";

function TemplateOptionsFields({
	options,
	setOptions,
	disabled,
	pt,
	themed,
}: {
	options: EditingOptions;
	setOptions: (options: EditingOptions) => void;
	disabled: boolean;
	pt: boolean;
	themed: boolean;
}) {
	return (
		<div className="space-y-3 text-xs">
			<label className="block space-y-1">
				<span>
					{pt
						? "Marca no encerramento (opcional)"
						: "End-card brand (optional)"}
				</span>
				<input
					className="w-full rounded border bg-background px-2 py-1.5"
					maxLength={48}
					value={options.brandName}
					disabled={disabled}
					onChange={(event) =>
						setOptions({ ...options, brandName: event.target.value })
					}
					placeholder={pt ? "Nome da sua marca" : "Your brand name"}
				/>
				{themed && !options.brandName.trim() && (
					<span className="block text-[11px] text-amber-500">
						{pt
							? "Sem a marca, o vídeo termina sem o cartão final com CTA."
							: "Without a brand the video ends without the CTA end card."}
					</span>
				)}
			</label>
			{themed && (
				<label className="block space-y-1">
					<span>
						{pt ? "Frase da marca (opcional)" : "Brand tagline (optional)"}
					</span>
					<input
						className="w-full rounded border bg-background px-2 py-1.5"
						maxLength={60}
						value={options.tagline}
						disabled={disabled}
						onChange={(event) =>
							setOptions({ ...options, tagline: event.target.value })
						}
						placeholder={
							pt ? "Você grava. O resto entra no fluxo." : "Your tagline"
						}
					/>
				</label>
			)}
			<div className="flex gap-3">
				<label className="flex-1 space-y-1">
					<span className="block">{pt ? "Ritmo" : "Pacing"}</span>
					<select
						className="w-full rounded border bg-background p-1.5"
						value={options.pacing}
						disabled={disabled}
						onChange={(event) =>
							setOptions({
								...options,
								pacing: event.target.value === "steady" ? "steady" : "natural",
							})
						}
					>
						<option value="natural">Natural</option>
						<option value="steady">
							{pt ? "Mais tranquilo" : "More relaxed"}
						</option>
					</select>
				</label>
				{!themed && (
					<label className="space-y-1">
						<span className="block">{pt ? "Destaque" : "Accent"}</span>
						<input
							type="color"
							className="h-8 w-12"
							value={options.accent}
							disabled={disabled}
							onChange={(event) =>
								setOptions({ ...options, accent: event.target.value })
							}
						/>
					</label>
				)}
			</div>
			<label className="block space-y-1">
				<span>
					{pt ? "Altura das legendas" : "Caption position"} ·{" "}
					{Math.round((options.captionPosition ?? (themed ? 0.75 : 0.64)) * 100)}%
				</span>
				<input
					aria-label={pt ? "Altura das legendas" : "Caption position"}
					type="range"
					className="w-full"
					min={52}
					max={themed ? 80 : 78}
					step={1}
					value={Math.round((options.captionPosition ?? (themed ? 0.75 : 0.64)) * 100)}
					disabled={disabled}
					onChange={(event) =>
						setOptions({
							...options,
							captionPosition: Number(event.target.value) / 100,
						})
					}
				/>
			</label>
			{(
				[
					[
						"soundEffects",
						pt ? "Sons discretos nas inserções" : "Subtle sound effects",
					],
					[
						"enhanceVoice",
						pt ? "Melhorar clareza da voz" : "Enhance voice clarity",
					],
					[
						"enhanceImage",
						pt
							? "Ajustar cor e contraste suavemente"
							: "Subtle color and contrast",
					],
					...(themed
						? ([
								[
									"music",
									pt ? "Trilha instrumental do tema" : "Theme music bed",
								],
							] as const)
						: []),
				] as const
			).map(([key, label]) => (
				<label key={key} className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={options[key]}
						disabled={disabled}
						onChange={(event) =>
							setOptions({ ...options, [key]: event.target.checked })
						}
					/>
					{label}
				</label>
			))}
		</div>
	);
}

export function EditingTemplatesView() {
	const editor = useEditor();
	const pt = useI18n().locale === "pt-BR";
	const integration = useIntegrationStore();
	useWorkspacePolling();
	const shared = useWorkspace((state) => state.data?.settings);
	const scene = useEditor((instance) => instance.scenes.getActiveScene());
	const settings = useEditor(
		(instance) => instance.project.getActive().settings,
	);
	const exporting = useEditor(
		(instance) => instance.project.getExportState().isExporting,
	);
	const report = settings.editingTemplates?.[scene.id];
	const [catalog, setCatalog] = useState<Map<string, string>>(new Map());
	const [recipes, setRecipes] = useState<
		Map<string, Record<string, unknown>>
	>(new Map());
	const [notice, setNotice] = useState("");
	// Imports that found templates already installed wait here for the person's choice.
	const [pendingImport, setPendingImport] = useState<
		| {
				kind: "presets";
				fresh: EditingTemplatePreset[];
				conflicts: PresetImportConflict[];
		  }
		| { kind: "packs"; planned: PlannedPack[] }
		| null
	>(null);
	const [starting, setStarting] = useState(false);
	const [personal, setPersonal] = useState<EditingTemplatePreset[]>([]);
	const [packs, setPacks] = useState<InstalledEditingTemplatePack[]>([]);
	const [libraryWarning, setLibraryWarning] = useState("");
	const [selectedId, setSelectedId] = useState(BUILTIN_EDITING_TEMPLATE.id);
	const [options, setOptions] = useState<EditingOptions>(() =>
		editingOptionsSchema.parse(BUILTIN_EDITING_TEMPLATE.options),
	);
	const [draft, setDraft] = useState<EditingTemplatePreset | null>(null);
	const [hoverId, setHoverId] = useState("");
	const importRef = useRef<HTMLInputElement>(null);
	const packTemplates = packs.flatMap((pack) =>
		pack.templates.map((template) => ({ pack, template })),
	);
	const templates = [
		...BUILTIN_EDITING_TEMPLATES,
		...packTemplates.map(({ template }) => installedTemplateCard(template)),
		...personal,
	];
	const duplicateIds = findDuplicatePresets(personal);
	const packOf = (id: string) =>
		packTemplates.find(({ template }) => template.id === id)?.pack;
	const isLocked = (id: string) =>
		isBuiltinEditingTemplate(id) || !!packOf(id);
	const briefs = new Map(catalog);
	const recipeByKey = new Map(recipes);
	for (const { template } of packTemplates)
		recipeByKey.set(`${template.id}@${template.version}`, template.recipe);
	for (const { template } of packTemplates)
		briefs.set(
			`${template.id}@${template.version}`,
			typeof template.recipe.brief === "string" ? template.recipe.brief : "",
		);
	const selected =
		templates.find((template) => template.id === selectedId) ??
		BUILTIN_EDITING_TEMPLATE;

	useEffect(() => {
		const restored = loadEditingTemplatePresets();
		setPersonal(restored.templates);
		setPacks(loadInstalledEditingTemplatePacks());
		setLibraryWarning(restored.warning);
		let active = true;
		void listBuiltinEditingTemplates()
			.then((result) => {
				if (active)
					setRecipes(
						new Map(
							result.templates.map((template) => [
								`${template.id}@${template.version}`,
								template.recipe,
							]),
						),
					);
				if (active)
					setCatalog(
						new Map(
							result.templates.map((template) => [
								`${template.id}@${template.version}`,
								typeof template.recipe.brief === "string"
									? template.recipe.brief
									: "",
							]),
						),
					);
			})
			.catch((error) => {
				if (active)
					setNotice(error instanceof Error ? error.message : "Failed");
			});
		return () => {
			active = false;
		};
	}, []);

	const ready =
		integration.connection &&
		integration.settings.hasKey &&
		integration.settings.shareWithOpenAI &&
		integration.settings.shareAudioWithOpenAI &&
		integration.settings.allowEdits &&
		!integration.health;
	const busy = starting || integration.chatBusy || exporting;
	const themed = isThemeEditingTemplate(selected);
	const available = briefs.has(
		`${selected.baseTemplateId}@${selected.baseVersion}`,
	);
	const missing: string[] = [];
	if (shared) {
		if (!shared.hasOpenAIKey)
			missing.push(
				pt ? "Configure a chave da OpenAI." : "Configure your OpenAI key.",
			);
		if (!shared.shareWithOpenAI)
			missing.push(
				pt ? "Autorize a Hanna a usar a OpenAI." : "Allow Hanna to use OpenAI.",
			);
		if (!shared.shareAudioWithOpenAI)
			missing.push(
				pt
					? "Autorize o envio de áudio para transcrição."
					: "Allow audio transcription.",
			);
		if (!shared.allowEdits)
			missing.push(
				pt
					? "Autorize a Hanna a editar a timeline."
					: "Allow Hanna to edit the timeline.",
			);
	}
	let sourceNotice = "";
	if (!report) {
		try {
			editingSource(editor);
		} catch (error) {
			sourceNotice = error instanceof Error ? error.message : "";
		}
	}

	function selectTemplate(template: EditingTemplatePreset) {
		setSelectedId(template.id);
		setOptions(editingOptionsSchema.parse(template.options));
		setDraft(null);
		setNotice("");
	}

	function startNewTemplate(source = selected) {
		setDraft(
			createEditingTemplatePreset({
				name: `${source.name} personalizado`,
				description: source.description,
				options: editingOptionsSchema.parse(options),
				baseTemplateId: source.baseTemplateId,
				baseVersion: source.baseVersion,
			}),
		);
	}

	function saveDraft() {
		if (!draft) return;
		try {
			const normalized = editingTemplatePresetSchema.parse(draft);
			const next = upsertEditingTemplatePreset({
				templates: personal,
				preset: normalized,
			});
			setPersonal(next);
			setSelectedId(normalized.id);
			setOptions(normalized.options);
			setDraft(null);
			setLibraryWarning("");
			setNotice(
				pt
					? `Template salvo: ${normalized.name}.`
					: `Template saved: ${normalized.name}.`,
			);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Failed");
		}
	}

	function saveCurrentOptions() {
		if (isLocked(selected.id)) {
			startNewTemplate();
			return;
		}
		try {
			const updated = {
				...selected,
				options: editingOptionsSchema.parse(options),
			};
			setPersonal(
				upsertEditingTemplatePreset({ templates: personal, preset: updated }),
			);
			setNotice(
				pt ? "Ajustes salvos no template." : "Template settings saved.",
			);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Failed");
		}
	}

	function installPacks(planned: PlannedPack[]) {
		const changed = planned.filter((item) => item.status !== "same");
		if (changed.length) setPacks(commitEditingTemplatePacks(changed));
		const names = changed.flatMap((item) => item.pack.manifest.name);
		setPendingImport(null);
		setNotice(
			changed.length
				? pt
					? `Pacote ${changed.some((item) => item.status === "update") ? "atualizado" : "instalado"}: ${names.join(", ")}.`
					: `Pack installed: ${names.join(", ")}.`
				: pt
					? "Este pacote já está instalado, igual ao arquivo. Nada foi alterado."
					: "This pack is already installed. Nothing changed.",
		);
	}

	function finishPresetImport(
		plan: { fresh: EditingTemplatePreset[]; conflicts: PresetImportConflict[] },
		choice: PresetImportChoice,
	) {
		try {
			const result = applyPresetImport({ existing: personal, ...plan, choice });
			setPersonal(saveEditingTemplatePresets(result.templates));
			setLibraryWarning("");
			setPendingImport(null);
			const skipped = plan.conflicts.length - result.replaced - result.copied;
			const parts = [
				result.added && `${result.added} novo(s)`,
				result.replaced && `${result.replaced} substituído(s)`,
				result.copied && `${result.copied} cópia(s) criada(s)`,
				skipped && `${skipped} já existia(m) e ficou(aram) como estava(m)`,
			].filter(Boolean);
			setNotice(
				pt
					? `Importação concluída: ${parts.join(", ") || "nada mudou"}.`
					: `Import finished: ${result.added} new, ${result.replaced} replaced, ${result.copied} copied, ${skipped} skipped.`,
			);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Failed");
		}
	}

	async function importTemplates(file: File) {
		setPendingImport(null);
		try {
			if (await isEditingTemplatePackFile(file)) {
				const planned = await planEditingTemplatePackFile(file);
				if (planned.some((item) => item.status === "update"))
					setPendingImport({ kind: "packs", planned });
				else installPacks(planned);
				return;
			}
			const imported = parseEditingTemplatePresetFile(await file.text());
			const plan = planPresetImport({ existing: personal, imported });
			if (plan.conflicts.some((conflict) => !conflict.identical))
				setPendingImport({ kind: "presets", ...plan });
			else finishPresetImport(plan, "skip");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Failed");
		}
	}

	async function reconnect() {
		if (busy) return;
		setStarting(true);
		setNotice("");
		try {
			const projectId = editor.project.getActive().metadata.id;
			const sceneId = editor.scenes.getActiveScene().id;
			const next = connectionSchema.parse(
				await integrationRequest({ action: "connect", projectId, sceneId }),
			);
			if (
				editor.project.getActiveOrNull()?.metadata.id !== projectId ||
				editor.scenes.getActiveSceneOrNull()?.id !== sceneId
			) {
				void integrationRequest({ action: "disconnect", ...next }).catch(
					() => {},
				);
				return;
			}
			useIntegrationStore.setState({
				connection: next,
				settings: next,
				health: "",
			});
			await useWorkspace.getState().refresh();
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Falha ao conectar.");
		} finally {
			setStarting(false);
		}
	}

	async function apply() {
		if (!ready || !integration.connection || busy) return;
		setStarting(true);
		setNotice("");
		try {
			editingSource(editor);
			const projectId = editor.project.getActive().metadata.id;
			const sceneId = editor.scenes.getActiveScene().id;
			const input = editingOptionsSchema.parse(options);
			const prompt = buildEditingTemplatePrompt({
				presetId: selected.id,
				presetName: selected.name,
				templateId: selected.baseTemplateId,
				version: selected.baseVersion,
				options: input,
				themed,
				themeDirection:
					briefs.get(`${selected.baseTemplateId}@${selected.baseVersion}`) ?? "",
			});
			useStudioStore.getState().append({
				key: projectId + ":" + sceneId,
				role: "user",
				content: pt
					? `Aplicar o template ${selected.name} ao meu vídeo.`
					: `Apply the ${selected.name} template to my video.`,
			});
			useIntegrationStore.setState({ chatBusy: true, answer: "" });
			const run = agentRunSchema.parse(
				await integrationRequest({
					action: "start_agent_run",
					...integration.connection,
					prompt,
					history: [],
					maxCalls: themed ? 20 : 16,
				}),
			);
			useIntegrationStore.setState({
				agentRun: run,
				chatBusy: run.status === "running",
			});
			setNotice(
				pt
					? "A Hanna está preparando a edição. Você pode acompanhar pelo chat."
					: "Hanna is preparing the edit. Follow progress in chat.",
			);
		} catch (error) {
			useIntegrationStore.setState({ chatBusy: false });
			setNotice(error instanceof Error ? error.message : "Failed");
		} finally {
			setStarting(false);
		}
	}

	return (
		<section
			aria-label={
				pt ? "Templates de edição completa" : "Complete editing templates"
			}
			className="space-y-3"
		>
			<header className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 text-sm font-semibold">
					<Sparkles className="size-4 text-primary" />
					Templates
				</div>
				<div className="flex gap-1">
					<Button
						size="icon"
						variant="outline"
						title={pt ? "Importar template" : "Import template"}
						onClick={() => importRef.current?.click()}
					>
						<Upload className="size-4" />
					</Button>
					<Button size="sm" onClick={() => startNewTemplate()}>
						<Plus className="size-4" />
						{pt ? "Novo" : "New"}
					</Button>
				</div>
			</header>
			<input
				ref={importRef}
				type="file"
				accept=".aiedita-template,.aiedita-pack,.json,.zip,application/json,application/zip"
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void importTemplates(file);
				}}
			/>
			<p className="text-xs text-muted-foreground">
				{pt
					? "Templates mudam a edição completa. Títulos animados ficam na aba Títulos."
					: "Templates change the complete edit. Animated lettering lives under Titles."}
			</p>
			{libraryWarning && (
				<p role="alert" className="text-xs text-destructive">
					{libraryWarning}
				</p>
			)}
			{pendingImport?.kind === "presets" && (
				<div
					role="alertdialog"
					aria-label={pt ? "Templates repetidos" : "Duplicate templates"}
					className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs"
				>
					<strong className="block text-sm">
						{pt ? "Alguns templates já existem" : "Some templates already exist"}
					</strong>
					<ul className="list-disc space-y-0.5 pl-4">
						{pendingImport.conflicts.map((conflict) => (
							<li key={conflict.imported.id}>
								{conflict.imported.name}
								<span className="text-muted-foreground">
									{" "}
									—{" "}
									{conflict.identical
										? pt
											? "igual ao que você já tem"
											: "identical"
										: pt
											? "configurações diferentes"
											: "different settings"}
								</span>
							</li>
						))}
					</ul>
					{pendingImport.fresh.length > 0 && (
						<p className="text-muted-foreground">
							{pt
								? `${pendingImport.fresh.length} template(s) novo(s) também serão importados.`
								: `${pendingImport.fresh.length} new template(s) will also be imported.`}
						</p>
					)}
					<div className="flex flex-wrap gap-1.5">
						<Button size="sm" onClick={() => finishPresetImport(pendingImport, "replace")}>
							{pt ? "Substituir" : "Replace"}
						</Button>
						<Button size="sm" variant="outline" onClick={() => finishPresetImport(pendingImport, "keep")}>
							{pt ? "Manter os dois" : "Keep both"}
						</Button>
						<Button size="sm" variant="outline" onClick={() => finishPresetImport(pendingImport, "skip")}>
							{pt ? "Pular repetidos" : "Skip duplicates"}
						</Button>
						<Button size="sm" variant="ghost" onClick={() => setPendingImport(null)}>
							{pt ? "Cancelar" : "Cancel"}
						</Button>
					</div>
				</div>
			)}
			{pendingImport?.kind === "packs" && (
				<div
					role="alertdialog"
					aria-label={pt ? "Pacote já instalado" : "Pack already installed"}
					className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs"
				>
					<strong className="block text-sm">
						{pt ? "Este pacote já está instalado" : "This pack is already installed"}
					</strong>
					{pendingImport.planned
						.filter((item) => item.status === "update")
						.map((item) => (
							<p key={item.pack.manifest.id}>
								{item.pack.manifest.name}:{" "}
								{item.previousRelease === item.pack.manifest.release
									? pt
										? `versão ${item.pack.manifest.release}, com conteúdo diferente.`
										: `version ${item.pack.manifest.release}, different content.`
									: pt
										? `instalado ${item.previousRelease}, arquivo ${item.pack.manifest.release}.`
										: `installed ${item.previousRelease}, file ${item.pack.manifest.release}.`}
							</p>
						))}
					<p className="text-muted-foreground">
						{pt
							? "Substituir não duplica: os templates do pacote são atualizados no lugar. Seus templates personalizados continuam."
							: "Replacing updates the pack in place. Your own templates stay."}
					</p>
					<div className="flex flex-wrap gap-1.5">
						<Button size="sm" onClick={() => installPacks(pendingImport.planned)}>
							{pt ? "Substituir pacote" : "Replace pack"}
						</Button>
						<Button size="sm" variant="ghost" onClick={() => setPendingImport(null)}>
							{pt ? "Cancelar" : "Cancel"}
						</Button>
					</div>
				</div>
			)}
			{duplicateIds.length > 0 && !pendingImport && (
				<div className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs">
					<span>
						{pt
							? `${duplicateIds.length} template(s) repetido(s) na sua lista.`
							: `${duplicateIds.length} duplicate template(s).`}
					</span>
					<Button
						size="sm"
						variant="outline"
						onClick={() => {
							const next = personal.filter((item) => !duplicateIds.includes(item.id));
							setPersonal(saveEditingTemplatePresets(next));
							if (duplicateIds.includes(selectedId)) selectTemplate(BUILTIN_EDITING_TEMPLATE);
							setNotice(
								pt
									? `${duplicateIds.length} repetido(s) removido(s).`
									: `${duplicateIds.length} duplicate(s) removed.`,
							);
						}}
					>
						<Trash2 className="size-3.5" />
						{pt ? "Remover repetidos" : "Remove duplicates"}
					</Button>
				</div>
			)}
			<div className="grid grid-cols-2 gap-2">
				{templates.map((template) => {
					const recipe = recipeByKey.get(
						`${template.baseTemplateId}@${template.baseVersion}`,
					);
					const pack = packOf(template.id);
					const personalPreset = !isLocked(template.id);
					const baseName = templates.find(
						(item) => isLocked(item.id) && item.baseTemplateId === template.baseTemplateId,
					)?.name;
					const isSelected = selected.id === template.id;
					return (
						<div
							key={template.id}
							className={`group relative rounded-lg border p-1.5 ${
								isSelected ? "border-primary bg-primary/10" : "bg-card"
							}`}
							onMouseEnter={() => setHoverId(template.id)}
							onMouseLeave={() => setHoverId("")}
						>
							<button
								type="button"
								className="w-full text-left"
								onClick={() => selectTemplate(template)}
								aria-pressed={isSelected}
							>
								{recipe ? (
									<TemplatePreview
										recipe={recipe}
										accent={template.options.accent}
										brand={template.options.brandName}
										playing={hoverId === template.id}
										posterTime={4.9}
										label={template.name}
									/>
								) : (
									<div className="grid aspect-[9/16] place-items-center rounded-[14px] border border-dashed p-2 text-center text-[10px] text-muted-foreground">
										<span>
											<Package className="mx-auto mb-1 size-5" />
											{pt ? "Pacote não instalado" : "Pack not installed"}
										</span>
									</div>
								)}
								<strong className="mt-1.5 block text-xs leading-tight">
									{template.name}
								</strong>
								<span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
									{pack
										? pack.manifest.name
										: personalPreset
											? `${pt ? "Meu" : "Mine"} · ${baseName ?? (pt ? "instale o pacote" : "install the pack")}`
											: pt
												? "Incluído"
												: "Built in"}
								</span>
							</button>
							{personalPreset && (
								<button
									type="button"
									className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full bg-black/70 text-white opacity-80 hover:opacity-100"
									title={pt ? "Excluir template" : "Delete template"}
									aria-label={`${pt ? "Excluir" : "Delete"} ${template.name}`}
									onClick={() => {
										if (!window.confirm(pt ? `Excluir ${template.name}?` : `Delete ${template.name}?`))
											return;
										setPersonal(
											removeEditingTemplatePreset({ templates: personal, id: template.id }),
										);
										if (isSelected) selectTemplate(BUILTIN_EDITING_TEMPLATE);
									}}
								>
									<Trash2 className="size-3.5" />
								</button>
							)}
							{pack && (
								<button
									type="button"
									className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full bg-black/70 text-white opacity-80 hover:opacity-100"
									title={pt ? `Remover pacote ${pack.manifest.name}` : `Remove pack ${pack.manifest.name}`}
									aria-label={pt ? `Remover pacote ${pack.manifest.name}` : `Remove pack ${pack.manifest.name}`}
									onClick={() => {
										if (
											!window.confirm(
												pt
													? `Remover o pacote ${pack.manifest.name} (${pack.templates.length} templates)?`
													: `Remove pack ${pack.manifest.name}?`,
											)
										)
											return;
										setPacks(removeInstalledEditingTemplatePack(pack.manifest.id));
										if (isSelected) selectTemplate(BUILTIN_EDITING_TEMPLATE);
									}}
								>
									<Package className="size-3.5" />
								</button>
							)}
						</div>
					);
				})}
			</div>
			<div className="flex flex-wrap gap-1 rounded-lg border p-2">
				<span className="w-full text-[11px] text-muted-foreground">
					{selected.name}
				</span>
				<Button
					size="sm"
					variant="ghost"
					onClick={() =>
						isLocked(selected.id)
							? startNewTemplate(selected)
							: setDraft({ ...selected, options: { ...options } })
					}
				>
					<Pencil className="size-3.5" />
					{isLocked(selected.id) ? (pt ? "Personalizar" : "Customize") : pt ? "Editar" : "Edit"}
				</Button>
				<Button size="sm" variant="ghost" onClick={() => startNewTemplate(selected)}>
					<Copy className="size-3.5" />
					{pt ? "Duplicar" : "Duplicate"}
				</Button>
				{!isLocked(selected.id) && (
					<Button size="sm" variant="ghost" onClick={() => exportEditingTemplatePreset(selected)}>
						<Download className="size-3.5" />
						{pt ? "Exportar" : "Export"}
					</Button>
				)}
				{!available && (
					<Button size="sm" variant="outline" onClick={() => importRef.current?.click()}>
						<Upload className="size-3.5" />
						{pt ? "Instalar pacote" : "Install pack"}
					</Button>
				)}
			</div>
			{!available && (
				<p className="text-xs text-amber-500">
					{pt
						? "Este template usa um tema que não está instalado neste navegador. Importe o pacote (ZIP) em Instalar pacote para editar com trilha, efeitos e visual completos."
						: "This template uses a theme that is not installed in this browser. Import the pack (ZIP) to use it."}
				</p>
			)}

			{draft && (
				<div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
					<strong className="block text-sm">
						{personal.some((template) => template.id === draft.id)
							? pt
								? "Editar template"
								: "Edit template"
							: pt
								? "Criar template"
								: "Create template"}
					</strong>
					<label className="block text-xs">
						{pt ? "Nome" : "Name"}
						<input
							className="mt-1 w-full rounded border bg-background p-2"
							maxLength={80}
							value={draft.name}
							onChange={(event) =>
								setDraft({ ...draft, name: event.target.value })
							}
						/>
					</label>
					<label className="block text-xs">
						{pt ? "Descrição" : "Description"}
						<textarea
							className="mt-1 min-h-16 w-full rounded border bg-background p-2"
							maxLength={240}
							value={draft.description}
							onChange={(event) =>
								setDraft({ ...draft, description: event.target.value })
							}
						/>
					</label>
					<TemplateOptionsFields
						options={draft.options}
						setOptions={(next) => setDraft({ ...draft, options: next })}
						disabled={busy}
						pt={pt}
						themed={isThemeEditingTemplate(draft)}
					/>
					<div className="flex gap-2">
						<Button size="sm" onClick={saveDraft} disabled={busy}>
							<Save className="size-4" />
							{pt ? "Salvar template" : "Save template"}
						</Button>
						<Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
							{pt ? "Cancelar" : "Cancel"}
						</Button>
					</div>
				</div>
			)}

			{report ? (
				<div className="rounded-lg border p-3 text-xs">
					<strong className="block">
						{pt ? "Aplicado" : "Applied"}: {report.presetName ?? selected.name}
					</strong>
					<p className="mt-1 text-muted-foreground">
						{report.duration.toFixed(1)} s · {report.cutCount}{" "}
						{pt ? "cortes" : "cuts"} · {report.captionCount}{" "}
						{pt ? "legendas" : "captions"}.{" "}
						{pt
							? "As camadas estão na timeline e continuam editáveis. Ctrl+Z restaura o estado anterior."
							: "Layers are on the timeline and remain editable. Ctrl+Z restores the previous state."}
					</p>
					{!!report.warnings.length && (
						<ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
							{report.warnings.map((warning) => (
								<li key={warning}>{warning}</li>
							))}
						</ul>
					)}
				</div>
			) : (
				<div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
					<strong className="block text-sm">{selected.name}</strong>
					{recipeByKey.has(`${selected.baseTemplateId}@${selected.baseVersion}`) && (
						<div className="mx-auto w-full max-w-[190px]">
							<TemplatePreview
								recipe={
									recipeByKey.get(
										`${selected.baseTemplateId}@${selected.baseVersion}`,
									) ?? {}
								}
								accent={options.accent}
								brand={options.brandName}
								label={selected.name}
							/>
							<p className="mt-1 text-center text-[10px] text-muted-foreground">
								{pt
									? "Prévia ilustrativa do estilo"
									: "Illustrative style preview"}
							</p>
						</div>
					)}
					<p className="text-xs text-muted-foreground">
						{pt
							? "A Hanna seleciona os trechos e adapta as inserções ao conteúdo. Depois, você pode editar cada camada e adicionar Títulos ou Elementos."
							: "Hanna selects takes and adapts inserts to the content. Afterwards, every layer is editable and you can add Titles or Elements."}
					</p>
					<TemplateOptionsFields
						options={options}
						setOptions={setOptions}
						disabled={busy}
						pt={pt}
						themed={themed}
					/>
					<Button
						size="sm"
						variant="outline"
						disabled={busy}
						onClick={saveCurrentOptions}
					>
						<Save className="size-4" />
						{isLocked(selected.id)
							? pt
								? "Salvar como novo template"
								: "Save as new template"
							: pt
								? "Salvar ajustes"
								: "Save settings"}
					</Button>
					{sourceNotice && (
						<p role="status" className="text-xs text-muted-foreground">
							{sourceNotice}
						</p>
					)}
					{!ready && (
						<>
							<p className="text-xs text-muted-foreground">
								{!shared
									? pt
										? "Verificando a conexão da Hanna…"
										: "Checking Hanna's connection…"
									: missing.length
										? missing.join(" ")
										: pt
											? "Sua chave e permissões estão configuradas. Reconecte a Hanna a este editor para continuar."
											: "Your key and permissions are configured. Reconnect Hanna to this editor to continue."}
							</p>
							<Button
								variant="outline"
								size="sm"
								disabled={busy || !shared}
								onClick={() =>
									missing.length
										? useSettingsDialog.getState().show()
										: void reconnect()
								}
							>
								{missing.length
									? pt
										? "Configurar Hanna"
										: "Configure Hanna"
									: pt
										? "Reconectar Hanna"
										: "Reconnect Hanna"}
							</Button>
						</>
					)}
					<Button
						className="w-full"
						disabled={busy || !available || !ready || !!sourceNotice}
						onClick={() => void apply()}
					>
						{busy ? (
							<LoaderCircle className="size-4 animate-spin" />
						) : (
							<Sparkles className="size-4" />
						)}
						{pt ? `Editar com ${selected.name}` : `Edit with ${selected.name}`}
					</Button>
				</div>
			)}
			{notice && (
				<p role="status" className="text-xs leading-relaxed">
					{notice}
				</p>
			)}
		</section>
	);
}
