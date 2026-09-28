"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
	ArrowLeft,
	Check,
	ChevronRight,
	Clapperboard,
	LayoutTemplate,
	ListChecks,
	LoaderCircle,
	MessageSquareText,
	Sparkles,
	Trash2,
	Upload,
	Wand2,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	BUILTIN_CAPTION_STYLES,
	type CaptionStyleId,
} from "@/subtitles/builtin-caption-styles";
import {
	editingOptionsSchema,
	type EditingOptions,
} from "@/templates/editing-contract";
import { buildEditingTemplatePrompt } from "@/templates/editing-template-prompt";
import {
	briefOf,
	loadTemplateGallery,
	type GalleryTemplate,
} from "@/templates/template-gallery";
import {
	loadEditingTemplatePresets,
	removeEditingTemplatePreset,
} from "@/templates/editing-template-library";
import { TemplatePreview } from "@/templates/template-preview";
import { uploadAsset, useWorkspace, workspaceRequest } from "./client";
import type { EditTask } from "./types";
import { readVideoFile } from "@/media/mediabunny";
import { unsupportedCodecMessage } from "@/media/codec-support";

type EditOption = "speed" | "silences" | "retakes" | "captions" | "quality";
type Mode = "template" | "presets" | "prompt";
type Step = 1 | 2 | 3;
type Picked = {
	key: string;
	file: File;
	url: string;
	duration?: number;
	unreadable?: boolean;
	codec?: string | null;
	canDecode?: boolean;
	templateKey?: string;
	direction?: string;
};

const MAX_FILES = 10;
const MAX_BYTES = 500 * 1024 * 1024;
const TEMPLATE_MAX_SECONDS = 15 * 60;

const editOptions: Array<{
	id: EditOption;
	label: string;
	detail: string;
}> = [
	{
		id: "speed",
		label: "Acelerar em 1,3x",
		detail: "Apenas quando não prejudicar a compreensão.",
	},
	{
		id: "silences",
		label: "Tirar respiros e silêncio",
		detail: "Remove pausas excessivas, preservando ritmo natural.",
	},
	{
		id: "retakes",
		label: "Retirar repetições e erros",
		detail: "Mantém a intenção e a fala correta no contexto.",
	},
	{
		id: "captions",
		label: "Legendar",
		detail: "Legenda editável, sincronizada e em área segura.",
	},
	{
		id: "quality",
		label: "Melhorar imagem",
		detail: "Correção leve de cor, contraste e definição conforme o vídeo.",
	},
];

const promptIdeas = [
	"Abra com o trecho mais forte, ritmo rápido e destaque os números.",
	"Corte só as pausas e repetições, mantendo o tom natural da conversa.",
	"Transforme em um corte curto de até 60 s com legenda e chamada final.",
];

function buildHannaPrompt({
	title,
	kind,
	enabled,
	captionStyle,
	details,
}: {
	title: string;
	kind: "raw" | "edited";
	enabled: Set<EditOption>;
	captionStyle: CaptionStyleId;
	details: string;
}) {
	const requested = [
		enabled.has("speed") &&
			"Acelere somente os trechos adequados em até 1,3x; nunca altere a compreensão ou o tom da fala.",
		enabled.has("silences") &&
			"Detecte e remova respiros, pausas e silêncios excessivos. Mantenha pausas intencionais e não deixe buracos entre clips.",
		enabled.has("retakes") &&
			"Remova repetições, tentativas, tropeços e erros evidentes somente depois de entender a transcrição e o contexto completo.",
		enabled.has("captions") &&
			`[AI_EDITA_CAPTION_STYLE:${captionStyle}] Gere legendas editáveis e sincronizadas usando o estilo nativo "${captionStyle}" (${BUILTIN_CAPTION_STYLES.find((style) => style.id === captionStyle)?.name[0]}). Primeiro use transcribe_timeline com wordTimestamps:true; depois use obrigatoriamente generate_styled_captions com este style e placement:"bottom". Não substitua por generate_captions. Para os estilos Pulso e Palavra em destaque, a animação da legenda é obrigatória e deve permanecer editável na linha do tempo. Corrija somente palavras de baixa confiança quando o áudio permitir.`,
		enabled.has("quality") &&
			"Analise o material antes de ajustar. Faça melhoria leve e reversível de exposição, balanço de cor, contraste, redução de ruído e nitidez apenas quando necessário; não deixe o vídeo preto, congelado ou com aparência artificial.",
	].filter(Boolean);

	return [
		"Edição iniciada pelo fluxo guiado do AI Edita.",
		title ? `Título do lote: ${title}.` : "",
		kind === "edited"
			? "O usuário enviou uma versão já editada. Preserve a estrutura e altere somente o que foi solicitado."
			: "O usuário enviou um vídeo bruto. Primeiro entenda a fala e a intenção antes de cortar.",
		"Regras obrigatórias:",
		...requested.map((item) => `- ${item}`),
		"- Trabalhe com uma edição contextual: não faça cortes periódicos, não invente títulos e não aplique efeitos sem propósito.",
		"- Verifique a prévia e a linha do tempo ao concluir. Não exporte nem publique se a edição não puder ser confirmada.",
		"- Ao finalizar, deixe uma sugestão curta de LEGENDA PARA PUBLICAÇÃO baseada no conteúdo real, com chamada para ação adequada. Ela será revisada pela pessoa antes de qualquer publicação.",
		details.trim() ? `Direção adicional da pessoa: ${details.trim()}` : "",
	]
		.filter(Boolean)
		.join("\n");
}

function formatDuration(seconds?: number) {
	if (seconds === undefined) return "…";
	const m = Math.floor(seconds / 60);
	const s = Math.round(seconds % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
}

async function inspectVideo({ file, url }: { file: File; url: string }) {
	try {
		const data = await readVideoFile({ file });
		return {
			duration: Number.isFinite(data.duration) ? data.duration : undefined,
			unreadable: !Number.isFinite(data.duration),
			codec: data.codec,
			canDecode: data.canDecode,
		};
	} catch {
		const duration = await readDuration(url);
		return { duration, unreadable: duration === undefined };
	}
}

function readDuration(url: string) {
	return new Promise<number | undefined>((resolve) => {
		const video = document.createElement("video");
		const done = (value?: number) => {
			video.removeAttribute("src");
			video.load();
			resolve(value);
		};
		const timer = setTimeout(() => done(undefined), 15000);
		video.preload = "metadata";
		video.onloadedmetadata = () => {
			clearTimeout(timer);
			done(Number.isFinite(video.duration) ? video.duration : undefined);
		};
		video.onerror = () => {
			clearTimeout(timer);
			done(undefined);
		};
		video.src = url;
	});
}

function Stepper({ step }: { step: Step }) {
	const steps = ["Vídeos", "Estilo da edição", "Fila e revisão"];
	return (
		<ol className="ops-wizard-steps" aria-label="Etapas">
			{steps.map((label, index) => {
				const n = (index + 1) as Step;
				return (
					<li
						key={label}
						className={n === step ? "active" : n < step ? "done" : ""}
						aria-current={n === step ? "step" : undefined}
					>
						<span>{n < step ? <Check size={12} /> : n}</span>
						{label}
					</li>
				);
			})}
		</ol>
	);
}

export function ContentIntakeButton({
	className = "ops-button primary",
	label = "Novo conteúdo",
}: {
	className?: string;
	label?: string;
}) {
	const router = useRouter();
	const input = useRef<HTMLInputElement>(null);
	const { data } = useWorkspace();
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState<Step>(1);
	const [files, setFiles] = useState<Picked[]>([]);
	const [kind, setKind] = useState<"raw" | "edited">("raw");
	const [title, setTitle] = useState("");
	const [mode, setMode] = useState<Mode>("template");
	const [gallery, setGallery] = useState<GalleryTemplate[]>([]);
	const [galleryError, setGalleryError] = useState("");
	const [templateKey, setTemplateKey] = useState("energia-maxima");
	const [hoverKey, setHoverKey] = useState("");
	const [brand, setBrand] = useState<
		Pick<EditingOptions, "brandName" | "tagline" | "ctaLabel">
	>({ brandName: "", tagline: "", ctaLabel: "" });
	const [direction, setDirection] = useState("");
	const [captionStyle, setCaptionStyle] = useState<CaptionStyleId>("pulse");
	const [enabled, setEnabled] = useState<Set<EditOption>>(
		() => new Set(editOptions.map((option) => option.id)),
	);
	const [autoRender, setAutoRender] = useState(true);
	const [expanded, setExpanded] = useState("");
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		if (!open) return;
		let active = true;
		void loadTemplateGallery()
			.then((cards) => {
				if (!active) return;
				setGallery(cards);
				setGalleryError("");
				setTemplateKey((current) =>
					cards.some((card) => card.key === current && card.available)
						? current
						: (cards.find((card) => card.available)?.key ?? ""),
				);
			})
			.catch((reason: unknown) => {
				if (active)
					setGalleryError(
						reason instanceof Error
							? reason.message
							: "Templates indisponíveis.",
					);
			});
		return () => {
			active = false;
		};
	}, [open]);

	// Object URLs are released when files leave the batch or the modal unmounts.
	const urls = useRef(new Set<string>());
	useEffect(() => {
		const current = urls.current;
		return () => {
			for (const url of current) URL.revokeObjectURL(url);
			current.clear();
		};
	}, []);

	const selectedTemplate = gallery.find((card) => card.key === templateKey);
	const previewTemplate =
		gallery.find((card) => card.key === hoverKey) ?? selectedTemplate;
	const previewVideo = files[0]?.url;
	const templatesAllowed = kind === "raw";
	const effectiveMode: Mode =
		!templatesAllowed && mode === "template" ? "presets" : mode;
	const templateFor = (item: Picked) =>
		gallery.find((card) => card.key === (item.templateKey || templateKey)) ??
		selectedTemplate;

	function reset() {
		for (const url of urls.current) URL.revokeObjectURL(url);
		urls.current.clear();
		setStep(1);
		setFiles([]);
		setTitle("");
		setDirection("");
		setExpanded("");
		setError("");
		setProgress("");
	}

	function addFiles(next: File[]) {
		setError("");
		const videos = next.filter((file) => file.type.startsWith("video/"));
		if (videos.length !== next.length) {
			setError("Escolha somente arquivos de vídeo (MP4, MOV ou WEBM).");
			return;
		}
		const large = videos.find((file) => file.size > MAX_BYTES);
		if (large) {
			setError(`${large.name} passa de 500 MB.`);
			return;
		}
		const known = new Set(files.map((item) => item.key));
		const fresh = videos
			.map((file) => ({
				file,
				key: `${file.name}:${file.size}:${file.lastModified}`,
			}))
			.filter((item) => !known.has(item.key));
		if (files.length + fresh.length > MAX_FILES) {
			setError(`Envie no máximo ${MAX_FILES} vídeos por lote.`);
			return;
		}
		const picked = fresh.map(({ file, key }) => {
			const url = URL.createObjectURL(file);
			urls.current.add(url);
			return { key, file, url };
		});
		setFiles((current) => [...current, ...picked]);
		for (const item of picked)
			// The container is read directly: a browser that cannot decode the codec also
			// fails to report the duration, and the person deserves to know which of the
			// two happened before the edit runs, not after it.
			void inspectVideo(item).then((change) =>
				setFiles((current) =>
					current.map((entry) =>
						entry.key === item.key ? { ...entry, ...change } : entry,
					),
				),
			);
	}

	function removeFile(key: string) {
		setFiles((current) => {
			const item = current.find((entry) => entry.key === key);
			if (item) {
				URL.revokeObjectURL(item.url);
				urls.current.delete(item.url);
			}
			return current.filter((entry) => entry.key !== key);
		});
	}

	function updateFile(key: string, change: Partial<Picked>) {
		setFiles((current) =>
			current.map((entry) =>
				entry.key === key ? { ...entry, ...change } : entry,
			),
		);
	}

	function toggle(option: EditOption) {
		setEnabled((current) => {
			const next = new Set(current);
			if (next.has(option)) next.delete(option);
			else next.add(option);
			return next;
		});
	}

	const tooLong =
		effectiveMode === "template"
			? files.filter((item) => (item.duration ?? 0) > TEMPLATE_MAX_SECONDS)
			: [];
	const undecodable = files.filter((item) => item.canDecode === false);
	const step1Problem = !files.length
		? "Adicione pelo menos um vídeo."
		: files.some((item) => item.duration === undefined && !item.unreadable)
			? "Lendo a duração dos vídeos…"
			: undecodable.length
				? `${undecodable.map((item) => item.file.name).join(", ")}: ${unsupportedCodecMessage({ codec: undecodable[0].codec })}`
				: "";
	const step2Problem =
		effectiveMode === "template"
			? !selectedTemplate
				? "Escolha um template."
				: tooLong.length
					? `Templates aceitam vídeos de até 15 min: ${tooLong.map((item) => item.file.name).join(", ")}.`
					: ""
			: effectiveMode === "prompt" && direction.trim().length < 10
				? "Descreva a edição com pelo menos algumas palavras."
				: effectiveMode === "presets" && !enabled.size
					? "Selecione pelo menos uma pré-definição."
					: "";
	const liveInEditor = files.length === 1 && !autoRender;
	const summary =
		effectiveMode === "template"
			? [...new Set(files.map((item) => templateFor(item)?.name))]
					.filter(Boolean)
					.join(" + ") || "Template"
			: effectiveMode === "presets"
				? "Pré-definições"
				: "Direção por prompt";

	function taskFor(item: Picked) {
		const itemDirection = (item.direction ?? "").trim() || direction.trim();
		const extra = itemDirection
			? { direction: itemDirection.slice(0, 4000) }
			: {};
		if (effectiveMode === "template") {
			const template = templateFor(item);
			if (!template) throw new Error("Escolha um template.");
			// Saved personal presets keep their own brand texts.
			const options = editingOptionsSchema.parse(
				template.origin === "personal"
					? template.options
					: {
							...template.options,
							brandName: brand.brandName.trim(),
							tagline: brand.tagline.trim(),
							ctaLabel: brand.ctaLabel.trim(),
						},
			);
			return {
				mode: "template" as const,
				templateId: template.templateId,
				templateName: template.name,
				prompt: buildEditingTemplatePrompt({
					presetId: template.presetId,
					presetName: template.name,
					templateId: template.templateId,
					version: template.version,
					options,
					themed: template.themed,
					themeDirection: briefOf(template),
					direction: itemDirection,
				}),
				...extra,
			};
		}
		return {
			mode: effectiveMode,
			prompt: buildHannaPrompt({
				title,
				kind,
				enabled: effectiveMode === "presets" ? enabled : new Set<EditOption>(),
				captionStyle,
				details: itemDirection,
			}),
			...extra,
		};
	}

	async function startEditing() {
		if (!files.length || busy) return;
		if (!data?.settings.allowEdits || !data.settings.hasOpenAIKey) {
			setError(
				"Configure a OpenAI e ative a permissão de edição em Configurações antes de iniciar a Hanna.",
			);
			return;
		}
		setBusy(true);
		setError("");
		try {
			const planned = files.map(taskFor);
			const items = [];
			for (const [index, item] of files.entries()) {
				setProgress(
					`Enviando ${index + 1} de ${files.length}: ${item.file.name}`,
				);
				const asset = await uploadAsset({ file: item.file, kind: "source" });
				items.push({ assetId: asset.id, ...planned[index] });
			}
			setProgress("Colocando na fila…");
			const tasks = await workspaceRequest<EditTask[]>({
				action: "edit",
				input: {
					items,
					autoRender,
					batchTitle: title.trim(),
					openInEditor: liveInEditor,
				},
			});
			setOpen(false);
			reset();
			// One video without auto-render: watch Hanna edit it live in the Editor.
			// Auto-render or several videos: follow the queue.
			router.push(
				liveInEditor && tasks[0]
					? "/editor/guided?task=" + encodeURIComponent(tasks[0].id)
					: "/fila?lote=" + encodeURIComponent(tasks[0]?.batchId || ""),
			);
		} catch (reason) {
			setError(
				reason instanceof Error
					? reason.message
					: "Não foi possível iniciar a edição.",
			);
		} finally {
			setBusy(false);
			setProgress("");
		}
	}

	const modeCards: Array<{
		id: Mode;
		icon: typeof LayoutTemplate;
		title: string;
		text: string;
		badge?: string;
	}> = [
		{
			id: "template",
			icon: LayoutTemplate,
			title: "Template",
			text: "Visual completo pronto: cortes, legenda, destaques, trilha e final.",
			badge: "Mais rápido",
		},
		{
			id: "presets",
			icon: ListChecks,
			title: "Pré-definições",
			text: "Escolha só o que a Hanna deve fazer: cortes, legenda, cor.",
		},
		{
			id: "prompt",
			icon: MessageSquareText,
			title: "Do meu jeito",
			text: "Descreva a edição com suas palavras.",
		},
	];

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (busy) return;
				setOpen(next);
				if (!next) reset();
			}}
		>
			<DialogTrigger asChild>
				<button className={className}>
					<Sparkles size={16} /> {label}
				</button>
			</DialogTrigger>
			<DialogContent className="operations ops-intake-modal ops-wizard">
				<DialogHeader>
					<div className="ops-overline">NOVO CONTEÚDO</div>
					<DialogTitle>
						{step === 1
							? "Quais vídeos vamos editar?"
							: step === 2
								? "Como a Hanna deve editar?"
								: "Tudo pronto para a fila"}
					</DialogTitle>
					<DialogDescription>
						{step === 1
							? "Arraste até 10 vídeos. Eles entram numa fila e são editados um por vez."
							: step === 2
								? "Escolha um estilo. A prévia mostra como o vídeo vai ficar."
								: "Confira cada vídeo, ajuste se quiser e coloque na fila."}
					</DialogDescription>
					<Stepper step={step} />
				</DialogHeader>

				<div className="ops-intake-body">
					<input
						ref={input}
						hidden
						type="file"
						accept="video/mp4,video/webm,video/quicktime"
						multiple
						onChange={(event) => {
							addFiles(Array.from(event.target.files || []));
							event.target.value = "";
						}}
					/>

					{step === 1 && (
						<>
							<button
								className={
									"ops-intake-drop" + (files.length ? " compact" : "")
								}
								onClick={() => input.current?.click()}
								onDragOver={(event) => event.preventDefault()}
								onDrop={(event) => {
									event.preventDefault();
									addFiles(Array.from(event.dataTransfer.files));
								}}
							>
								<Upload size={files.length ? 18 : 28} />
								<strong>
									{files.length
										? "Adicionar mais vídeos"
										: "Arraste seus vídeos aqui ou clique para escolher"}
								</strong>
								<span>
									MP4, MOV ou WEBM · até 500 MB cada · até {MAX_FILES} por vez
								</span>
							</button>
							{files.length > 0 && (
								<div
									className="ops-wizard-thumbs"
									aria-label="Vídeos selecionados"
								>
									{files.map((item) => (
										<figure key={item.key}>
											{/* eslint-disable-next-line jsx-a11y/media-has-caption -- local preview of the user's own upload */}
											<video
												src={item.url + "#t=0.5"}
												preload="metadata"
												muted
											/>
											<span className="duration">
												{item.unreadable ? "?" : formatDuration(item.duration)}
											</span>
											<button
												className="remove"
												aria-label={`Remover ${item.file.name}`}
												onClick={() => removeFile(item.key)}
											>
												<Trash2 size={13} />
											</button>
											<figcaption title={item.file.name}>
												{item.file.name}
											</figcaption>
										</figure>
									))}
								</div>
							)}
							<div className="ops-wizard-row">
								<div
									className="ops-intake-switch"
									role="group"
									aria-label="Tipo de vídeo"
								>
									<button
										className={kind === "raw" ? "active" : ""}
										onClick={() => setKind("raw")}
									>
										<Clapperboard size={14} /> Vídeo bruto
									</button>
									<button
										className={kind === "edited" ? "active" : ""}
										onClick={() => setKind("edited")}
									>
										<Wand2 size={14} /> Já editado
									</button>
								</div>
								<label className="ops-field">
									Nome do lote <small>opcional</small>
									<input
										value={title}
										onChange={(event) => setTitle(event.target.value)}
										maxLength={120}
										placeholder="Ex.: Cortes da aula de segunda"
									/>
								</label>
							</div>
						</>
					)}

					{step === 2 && (
						<>
							<div
								className="ops-wizard-modes"
								role="radiogroup"
								aria-label="Modo de edição"
							>
								{modeCards.map(
									({ id, icon: Icon, title: cardTitle, text, badge }) => {
										const disabled = id === "template" && !templatesAllowed;
										return (
											<button
												key={id}
												role="radio"
												aria-checked={effectiveMode === id}
												disabled={disabled}
												className={effectiveMode === id ? "active" : ""}
												onClick={() => setMode(id)}
											>
												<Icon size={20} />
												<strong>
													{cardTitle}
													{badge && <em>{badge}</em>}
												</strong>
												<small>
													{disabled ? "Disponível só para vídeo bruto." : text}
												</small>
											</button>
										);
									},
								)}
							</div>

							{effectiveMode === "template" && (
								<div className="ops-wizard-template">
									<div
										className="ops-wizard-gallery"
										role="radiogroup"
										aria-label="Templates"
									>
										{galleryError && (
											<div className="ops-alert">{galleryError}</div>
										)}
										{!gallery.length && !galleryError && (
											<p className="ops-muted">Carregando templates…</p>
										)}
										{gallery.map((card) => (
											<div key={card.key} className="ops-wizard-card">
											<button
												role="radio"
												aria-checked={templateKey === card.key}
												disabled={!card.available}
												title={
													card.available
														? undefined
														: "Instale o pacote deste tema na aba Templates do Editor."
												}
												className={templateKey === card.key ? "active" : ""}
												onClick={() => setTemplateKey(card.key)}
												onMouseEnter={() => setHoverKey(card.key)}
												onMouseLeave={() => setHoverKey("")}
												onFocus={() => setHoverKey(card.key)}
												onBlur={() => setHoverKey("")}
											>
												{card.available ? (
													<TemplatePreview
														recipe={card.recipe}
														accent={card.options.accent}
														brand={brand.brandName}
														playing={hoverKey === card.key}
														posterTime={4.9}
														label={card.name}
													/>
												) : (
													<div className="ops-wizard-missing">Pacote não instalado</div>
												)}
												<strong>{card.name}</strong>
												<small>
													{card.origin === "pack"
														? card.packName
														: card.origin === "personal"
															? `Meu · base ${card.baseName ?? "tema não instalado"}`
															: "Incluído"}
												</small>
												{templateKey === card.key && (
													<span className="check">
														<Check size={12} />
													</span>
												)}
											</button>
											{card.origin === "personal" && (
												<button
													type="button"
													className="ops-wizard-delete"
													aria-label={`Excluir ${card.name}`}
													title="Excluir template"
													onClick={() => {
														if (!window.confirm(`Excluir ${card.name}?`)) return;
														removeEditingTemplatePreset({
															templates: loadEditingTemplatePresets().templates,
															id: card.key,
														});
														setGallery((current) => current.filter((item) => item.key !== card.key));
														if (templateKey === card.key)
															setTemplateKey(gallery.find((item) => item.available && item.key !== card.key)?.key ?? "");
													}}
												>
													<Trash2 size={12} />
												</button>
											)}
											</div>
										))}
									</div>
									<aside className="ops-wizard-stage">
										{previewTemplate && (
											<>
												<TemplatePreview
													recipe={previewTemplate.recipe}
													accent={previewTemplate.options.accent}
													brand={
														brand.brandName || previewTemplate.options.brandName
													}
													videoUrl={previewVideo}
													label={previewTemplate.name}
													className="ops-wizard-hero"
												/>
												<div className="ops-wizard-stage-copy">
													<strong>{previewTemplate.name}</strong>
													<p>{previewTemplate.description}</p>
													<small>
														Prévia ilustrativa com{" "}
														{previewVideo
															? "o seu primeiro vídeo"
															: "um vídeo de exemplo"}
														. Textos, destaques e preços reais vêm da sua fala.
													</small>
												</div>
											</>
										)}
										{selectedTemplate &&
											selectedTemplate.origin !== "personal" && (
												<div className="ops-wizard-brand">
													{selectedTemplate.themed && !brand.brandName.trim() && (
														<small className="ops-wizard-warn">
															Sem a marca, o vídeo termina sem o cartão final com CTA.
														</small>
													)}
													<label className="ops-field">
														Marca no final
														<input
															value={brand.brandName}
															maxLength={48}
															onChange={(event) =>
																setBrand({
																	...brand,
																	brandName: event.target.value,
																})
															}
															placeholder="Ex.: Vendus Studio"
														/>
													</label>
													{selectedTemplate.themed && (
														<>
															<label className="ops-field">
																Frase da marca
																<input
																	value={brand.tagline}
																	maxLength={60}
																	onChange={(event) =>
																		setBrand({
																			...brand,
																			tagline: event.target.value,
																		})
																	}
																	placeholder="Ex.: Você grava. O resto entra no fluxo."
																/>
															</label>
															<label className="ops-field">
																Chamada (CTA)
																<input
																	value={brand.ctaLabel}
																	maxLength={28}
																	onChange={(event) =>
																		setBrand({
																			...brand,
																			ctaLabel: event.target.value,
																		})
																	}
																	placeholder="Ex.: TOCA NO LINK ↓"
																/>
															</label>
														</>
													)}
												</div>
											)}
									</aside>
								</div>
							)}

							{effectiveMode === "presets" && (
								<>
									<div className="ops-intake-options">
										{editOptions.map((option) => (
											<button
												key={option.id}
												className={enabled.has(option.id) ? "active" : ""}
												onClick={() => toggle(option.id)}
											>
												<span>
													{enabled.has(option.id) && <Check size={14} />}
												</span>
												<div>
													<strong>{option.label}</strong>
													<small>{option.detail}</small>
												</div>
											</button>
										))}
									</div>
									{enabled.has("captions") && (
										<div
											className="ops-intake-caption-styles"
											aria-label="Estilo de legenda"
										>
											{BUILTIN_CAPTION_STYLES.map((style) => (
												<button
													key={style.id}
													className={captionStyle === style.id ? "active" : ""}
													onClick={() => setCaptionStyle(style.id)}
												>
													<strong>{style.name[0]}</strong>
													<span>{style.preview}</span>
												</button>
											))}
										</div>
									)}
								</>
							)}

							<label className="ops-field">
								{effectiveMode === "prompt"
									? "Como você quer a edição?"
									: "Direção extra"}{" "}
								<small>
									{effectiveMode === "prompt"
										? "A Hanna segue o que você escrever."
										: "Opcional. Ex.: foque na oferta, deixe o gancho mais curto."}
								</small>
								<textarea
									value={direction}
									onChange={(event) => setDirection(event.target.value)}
									maxLength={4000}
									placeholder={
										effectiveMode === "prompt"
											? "Ex.: abra com o trecho mais forte, mantenha um ritmo rápido e destaque os números."
											: "Opcional"
									}
									style={
										effectiveMode === "prompt" ? undefined : { minHeight: 64 }
									}
								/>
							</label>
							{effectiveMode === "prompt" && (
								<div className="ops-wizard-chips">
									{promptIdeas.map((idea) => (
										<button key={idea} onClick={() => setDirection(idea)}>
											{idea}
										</button>
									))}
								</div>
							)}
						</>
					)}

					{step === 3 && (
						<>
							<div className="ops-wizard-queue">
								{files.map((item, index) => {
									const template =
										effectiveMode === "template"
											? templateFor(item)
											: undefined;
									return (
										<div key={item.key} className="ops-wizard-queue-row">
											<span className="order">{index + 1}</span>
											<div className="thumb">
												{template ? (
													<TemplatePreview
														recipe={template.recipe}
														accent={template.options.accent}
														videoUrl={item.url}
														playing={false}
														label={template.name}
													/>
												) : (
													// eslint-disable-next-line jsx-a11y/media-has-caption -- local preview of the user's own upload
													<video
														src={item.url + "#t=0.5"}
														preload="metadata"
														muted
													/>
												)}
											</div>
											<div className="copy">
												<strong title={item.file.name}>{item.file.name}</strong>
												<small>
													{formatDuration(item.duration)} ·{" "}
													{(item.file.size / 1024 / 1024).toFixed(0)} MB
												</small>
												{effectiveMode === "template" ? (
													<select
														aria-label={`Template de ${item.file.name}`}
														value={item.templateKey || ""}
														onChange={(event) =>
															updateFile(item.key, {
																templateKey: event.target.value || undefined,
															})
														}
													>
														<option value="">
															Igual ao lote · {selectedTemplate?.name}
														</option>
														{gallery
															.filter((card) => card.key !== templateKey && card.available)
															.map((card) => (
																<option key={card.key} value={card.key}>
																	{card.name}
																</option>
															))}
													</select>
												) : (
													<small className="mode">{summary}</small>
												)}
												{expanded === item.key ? (
													<textarea
														aria-label={`Direção própria para ${item.file.name}`}
														value={item.direction ?? ""}
														maxLength={4000}
														placeholder="Direção só para este vídeo (substitui a do lote)"
														onChange={(event) =>
															updateFile(item.key, {
																direction: event.target.value,
															})
														}
														style={{ minHeight: 60 }}
													/>
												) : (
													<button
														className="link"
														onClick={() => setExpanded(item.key)}
													>
														{item.direction?.trim()
															? "Editar direção própria"
															: "+ Direção só para este vídeo"}
													</button>
												)}
											</div>
										</div>
									);
								})}
							</div>
							<label
								className={"ops-wizard-toggle" + (autoRender ? " active" : "")}
							>
								<input
									type="checkbox"
									checked={autoRender}
									onChange={(event) => setAutoRender(event.target.checked)}
								/>
								<span>
									<strong>Renderizar automaticamente</strong>
									<small>
										{autoRender
											? "Assim que cada edição terminar, o MP4 final é gerado e fica pronto em Conteúdos."
											: "A edição fica na timeline para você revisar e exportar quando quiser."}
									</small>
								</span>
							</label>
							<div className="ops-intake-flow">
								<Sparkles size={18} />
								<div>
									<strong>
										{files.length} vídeo{files.length === 1 ? "" : "s"} ·{" "}
										{summary}
									</strong>
									<p>
										{liveInEditor
											? "Você vai para o Editor e acompanha a Hanna editando ao vivo na linha do tempo. No fim, revise e exporte quando quiser."
											: "Você vai para a Fila, que edita um vídeo por vez. Mantenha a aba do AI Edita aberta e o computador ligado até terminar."}{" "}
										Cada vídeo usa sua chave da OpenAI (transcrição + Hanna).
										Nada é publicado sem sua confirmação.
									</p>
								</div>
							</div>
						</>
					)}

					{error && (
						<div className="ops-alert" role="alert">
							{error}
						</div>
					)}
					<div className="ops-intake-actions">
						{step > 1 ? (
							<button
								className="ops-button"
								disabled={busy}
								onClick={() => {
									setError("");
									setStep((step - 1) as Step);
								}}
							>
								<ArrowLeft size={15} /> Voltar
							</button>
						) : (
							<button
								className="ops-button"
								onClick={() => setOpen(false)}
								disabled={busy}
							>
								Cancelar
							</button>
						)}
						<span className="ops-wizard-hint" role="status">
							{busy
								? progress
								: step === 1
									? step1Problem
									: step === 2
										? step2Problem
										: ""}
						</span>
						{step < 3 ? (
							<button
								className="ops-button primary"
								disabled={Boolean(step === 1 ? step1Problem : step2Problem)}
								onClick={() => {
									setError("");
									setStep((step + 1) as Step);
								}}
							>
								Continuar <ChevronRight size={15} />
							</button>
						) : (
							<button
								className="ops-button primary"
								disabled={busy || Boolean(step2Problem)}
								onClick={() => void startEditing()}
							>
								{busy ? (
									<LoaderCircle className="animate-spin" size={16} />
								) : (
									<Sparkles size={16} />
								)}
								{busy
									? "Enviando…"
									: liveInEditor
										? "Editar ao vivo"
										: `Colocar ${files.length} na fila`}
								{!busy && <ChevronRight size={15} />}
							</button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
