import { Button } from "@/components/ui/button";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useEffect, useReducer, useRef, useState } from "react";
import { z } from "zod";
import { useI18n } from "@/i18n";
import { useIntegrationStore } from "@/integrations/client";
import {
	cancelOperation,
	generateStyledCaptions,
	getOperation,
	transcribeTimeline,
	updateTranscriptSegment,
	useOperationStore,
	useTranscriptReviewStore,
} from "@/integrations/operations";
import { useAssetsPanelStore } from "@/components/editor/panels/assets/assets-panel-store";
import { useEditor } from "@/editor/use-editor";
import { TRANSCRIPTION_DIAGNOSTICS_SCOPE } from "@/transcription/diagnostics";
import { TRANSCRIPTION_LANGUAGES } from "@/transcription/supported-languages";
import type {
	CaptionChunk,
	TranscriptionLanguage,
	TranscriptionSegment,
} from "@/transcription/types";
import { insertCaptionChunksAsTextTrack } from "@/subtitles/insert";
import { parseSubtitleFile } from "@/subtitles/parse";
import { Spinner } from "@/components/ui/spinner";
import {
	Section,
	SectionContent,
	SectionField,
	SectionFields,
} from "@/components/section";
import { AlertCircleIcon, CloudUploadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DiagnosticSeverity } from "@/diagnostics/types";
import { AlertTriangle, Check, LayoutTemplate } from "lucide-react";
import { mediaTimeFromSeconds } from "@/wasm";
import {
	CaptionStylePanel,
	type CaptionStyleId,
} from "./caption-style-panel";

const DIAGNOSTIC_BUTTON_VARIANT: Record<
	DiagnosticSeverity,
	"caution" | "destructive-foreground"
> = {
	caution: "caution",
	error: "destructive-foreground",
};

type ProcessingState =
	| { status: "idle"; error: string | null; warnings: string[] }
	| { status: "processing"; step: string };

type ProcessingAction =
	| { type: "start"; step: string }
	| { type: "update_step"; step: string }
	| { type: "succeed"; warnings: string[] }
	| { type: "fail"; error: string };

const IDLE_STATE: ProcessingState = {
	status: "idle",
	error: null,
	warnings: [],
};

function likelyNeedsReview(segment: TranscriptionSegment) {
	const words = segment.text.trim().split(/\s+/);
	return (
		segment.needsReview === true ||
		words.some((word, index) => {
			const normalized = word
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "")
				.replace(/[^\p{L}\p{N}]/gu, "")
				.toLocaleLowerCase();
			const previous = words[index - 1]
				?.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "")
				.replace(/[^\p{L}\p{N}]/gu, "")
				.toLocaleLowerCase();
			return (
				(normalized.length > 28 && !normalized.includes("http")) ||
				(normalized.length > 2 && normalized === previous)
			);
		})
	);
}

function TranscriptSegmentEditor({
	segment,
	index,
	pt,
	disabled,
	onSeek,
	onSave,
}: {
	segment: TranscriptionSegment;
	index: number;
	pt: boolean;
	disabled: boolean;
	onSeek: () => void;
	onSave: (text: string) => Promise<number>;
}) {
	const [value, setValue] = useState(segment.text.trim());
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState("");
	const suspicious = likelyNeedsReview(segment);
	return (
		<div
			className={
				"space-y-2 rounded-lg border p-2 " +
				(suspicious ? "border-amber-500/50 bg-amber-500/5" : "")
			}
		>
			<div className="flex items-center justify-between gap-2 text-[11px]">
				<button
					type="button"
					className="text-muted-foreground hover:text-foreground"
					onClick={onSeek}
				>
					{segment.start.toFixed(1)}–{segment.end.toFixed(1)}s
				</button>
				{suspicious ? (
					<span className="flex items-center gap-1 text-amber-600">
						<AlertTriangle className="size-3" />
						{pt ? "Verificar palavra" : "Review wording"}
						{segment.confidence != null
							? " · " + Math.round(segment.confidence * 100) + "%"
							: ""}
					</span>
				) : (
					<span className="flex items-center gap-1 text-emerald-600">
						<Check className="size-3" />
						{segment.confidence == null
							? pt
								? "Sem alerta automático"
								: "No automatic warning"
							: pt
								? "Boa confiança"
								: "Good confidence"}
					</span>
				)}
			</div>
			<textarea
				value={value}
				lang={pt ? "pt-BR" : "en"}
				spellCheck
				disabled={disabled || busy}
				onChange={(event) => {
					setValue(event.target.value);
					setNotice("");
				}}
				className="min-h-16 w-full resize-y rounded-md border bg-input p-2 text-xs"
				aria-label={(pt ? "Trecho " : "Segment ") + (index + 1)}
			/>
			<div className="flex items-center justify-between gap-2">
				<span className="text-[10px] text-muted-foreground">
					{notice ||
						(pt
							? "O corretor do navegador também sublinha grafias suspeitas."
							: "Browser spellcheck also underlines suspicious spelling.")}
				</span>
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={
						disabled ||
						busy ||
						!value.trim() ||
						value.trim() === segment.text.trim()
					}
					onClick={() => {
						void (async () => {
							setBusy(true);
							try {
								const count = await onSave(value);
								setNotice(
									pt
										? count + " legenda(s) atualizada(s)."
										: count + " caption(s) updated.",
								);
							} catch (error) {
								setNotice(error instanceof Error ? error.message : "Failed");
							} finally {
								setBusy(false);
							}
						})();
					}}
				>
					{busy ? (pt ? "Salvando…" : "Saving…") : pt ? "Salvar" : "Save"}
				</Button>
			</div>
		</div>
	);
}

/* eslint-disable opencut/prefer-object-params -- React reducers must accept (state, action). */
function processingReducer(
	state: ProcessingState,
	action: ProcessingAction,
): ProcessingState {
	switch (action.type) {
		case "start":
			return { status: "processing", step: action.step };
		case "update_step":
			if (state.status !== "processing") return state;
			return { status: "processing", step: action.step };
		case "succeed":
			return { status: "idle", error: null, warnings: action.warnings };
		case "fail":
			return { status: "idle", error: action.error, warnings: [] };
	}
}
/* eslint-enable opencut/prefer-object-params */

export function Captions() {
	const [selectedLanguage, setSelectedLanguage] =
		useState<TranscriptionLanguage>("pt");
	const [workflowTab, setWorkflowTab] = useState<"create" | "review" | "style">(
		"create",
	);
	const [processing, dispatch] = useReducer(processingReducer, IDLE_STATE);
	const containerRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const editor = useEditor();
	const { locale } = useI18n();
	// eslint-disable-next-line opencut/prefer-object-params -- Adjacent bilingual labels.
	const l = (pt: string, en: string) => (locale === "pt-BR" ? pt : en);
	const { connection, settings } = useIntegrationStore();
	const setActiveTab = useAssetsPanelStore((state) => state.setActiveTab);
	const currentJob = useRef<string | null>(null);
	const [isTranscribing, setIsTranscribing] = useState(false);
	const [trackId, setTrackId] = useState("");
	const [captionStyle, setCaptionStyle] = useState<CaptionStyleId>("clean");
	const transcriptDocuments = useTranscriptReviewStore(
		(state) => state.documents,
	);
	const activeProjectId = editor.project.getActive().metadata.id;
	const activeSceneId = editor.scenes.getActiveScene().id;
	const transcriptDocument = transcriptDocuments.find(
		(document) =>
			document.projectId === activeProjectId &&
			document.sceneId === activeSceneId,
	);
	const selectedElements = useEditor((instance) =>
		instance.selection.getSelectedElements(),
	);
	const requestedCaptionTargets = selectedElements.length
		? selectedElements
		: (transcriptDocument?.captionBindings ?? []).map(({ trackId, elementId }) => ({
			trackId,
			elementId,
		}));
	const captionTargets = editor.timeline
		.getElementsWithTracks({ elements: requestedCaptionTargets })
		.filter(({ element }) => element.type === "text")
		.map(({ element, track }) => ({
			trackId: track.id,
			elementId: element.id,
		}));
	const tracks = editor.scenes.getActiveScene().tracks;
	const audioTracks = [tracks.main, ...tracks.overlay, ...tracks.audio].filter(
		(track) =>
			track.elements.some(
				(element) => element.type === "audio" || element.type === "video",
			),
	);
	const canTranscribe =
		connection &&
		settings.hasKey &&
		settings.shareAudioWithOpenAI &&
		settings.allowEdits;
	useEffect(
		() => () => {
			const id = currentJob.current;
			currentJob.current = null;
			if (
				id &&
				useOperationStore.getState().operations.some((op) => op.id === id)
			)
				cancelOperation(id);
		},
		[],
	);

	const isProcessing = processing.status === "processing";

	const activeDiagnostics = useEditor((e) =>
		e.diagnostics.getActive({ scope: TRANSCRIPTION_DIAGNOSTICS_SCOPE }),
	);

	const insertCaptions = ({
		captions,
	}: {
		captions: CaptionChunk[];
	}): boolean => {
		const trackId = insertCaptionChunksAsTextTrack({ editor, captions });
		return trackId !== null;
	};

	const handleGenerateTranscript = async () => {
		dispatch({
			type: "start",
			step: l("Preparando áudio...", "Preparing audio..."),
		});
		try {
			if (!canTranscribe)
				throw new Error(
					l(
						"Configure a chave, o envio de áudio e a permissão de edição em Integrações.",
						"Configure the key, audio sharing and editing permission in Integrations.",
					),
				);
			const job = transcribeTimeline({
				editor,
				input: {
					trackId: trackId || undefined,
					language: selectedLanguage,
					wordTimestamps: true,
				},
			});
			currentJob.current = job.operationId;
			setIsTranscribing(true);
			while (currentJob.current === job.operationId) {
				const operation = await getOperation({
					operationId: job.operationId,
					waitSeconds: 1,
				});
				if (currentJob.current !== job.operationId) return;
				if (operation.status === "running") {
					dispatch({
						type: "update_step",
						step: `${operation.stage.split(" / ")[locale === "pt-BR" ? 0 : 1] ?? operation.stage} · ${Math.round(operation.progress)}%`,
					});
					continue;
				}
				if (operation.status !== "complete")
					throw new Error(
						operation.error ??
							l("Transcrição cancelada.", "Transcription cancelled."),
					);
				const { transcriptId } = z
					.object({ transcriptId: z.string() })
					.parse(operation.result);
				await generateStyledCaptions({
					editor,
					input: {
						transcriptId,
						style: captionStyle,
						wordsPerCaption: captionStyle === "spotlight" ? 1 : 4,
					},
				});
				break;
			}
			currentJob.current = null;
			const latest = useTranscriptReviewStore
				.getState()
				.documents.find(
					(document) =>
						document.projectId === activeProjectId &&
						document.sceneId === activeSceneId,
				);
			const reviewCount =
				latest?.result.segments.filter(likelyNeedsReview).length ?? 0;
			dispatch({
				type: "succeed",
				warnings: reviewCount
					? [
							l(
								`${reviewCount} trecho(s) foram marcados para conferência. Corrija abaixo; as legendas mudam junto.`,
								`${reviewCount} segment(s) need review. Correct them below; captions update with them.`,
							),
						]
					: [],
			});
		} catch (error) {
			currentJob.current = null;
			console.error("Transcription failed:", error);
			dispatch({
				type: "fail",
				error:
					error instanceof Error
						? error.message
						: "An unexpected error occurred",
			});
		} finally {
			setIsTranscribing(false);
		}
	};

	const handleImportClick = () => {
		fileInputRef.current?.click();
	};

	const handleImportFile = async ({ file }: { file: File }) => {
		dispatch({ type: "start", step: "Reading subtitle file..." });
		try {
			const input = await file.text();
			const result = parseSubtitleFile({
				fileName: file.name,
				input,
			});

			if (result.captions.length === 0) {
				dispatch({
					type: "fail",
					error: "No valid subtitle cues were found in the subtitle file",
				});
				return;
			}

			dispatch({ type: "update_step", step: "Importing subtitles..." });

			if (!insertCaptions({ captions: result.captions })) {
				dispatch({ type: "fail", error: "No captions were generated" });
				return;
			}

			const nextWarnings = [...result.warnings];
			if (result.skippedCueCount > 0) {
				nextWarnings.unshift(
					`Imported ${result.captions.length} subtitle cue(s) and skipped ${result.skippedCueCount} malformed cue(s).`,
				);
			}

			dispatch({ type: "succeed", warnings: nextWarnings });
		} catch (error) {
			console.error("Subtitle import failed:", error);
			dispatch({
				type: "fail",
				error:
					error instanceof Error
						? error.message
						: "An unexpected error occurred",
			});
		}
	};

	const handleFileChange = async ({
		event,
	}: {
		event: React.ChangeEvent<HTMLInputElement>;
	}) => {
		const file = event.target.files?.[0];
		if (event.target) {
			event.target.value = "";
		}
		if (!file) return;

		await handleImportFile({ file });
	};

	const handleLanguageChange = ({ value }: { value: string }) => {
		if (value === "auto") {
			setSelectedLanguage("auto");
			return;
		}

		const matchedLanguage = TRANSCRIPTION_LANGUAGES.find(
			(language) => language.code === value,
		);
		if (!matchedLanguage) return;
		setSelectedLanguage(matchedLanguage.code);
	};

	const error = processing.status === "idle" ? processing.error : null;
	const warnings = processing.status === "idle" ? processing.warnings : [];

	return (
		<PanelView
			title={l("Transcrição e legendas", "Transcription and captions")}
			contentClassName="px-0 flex flex-col h-full"
			actions={
				<TooltipProvider>
					<div className="flex items-center gap-1.5">
						{!isProcessing &&
							activeDiagnostics.map((diagnostic) => (
								<Tooltip key={diagnostic.id}>
									<TooltipTrigger asChild>
										<Button
											variant={DIAGNOSTIC_BUTTON_VARIANT[diagnostic.severity]}
											size="icon"
											aria-label={diagnostic.message}
										>
											<HugeiconsIcon icon={AlertCircleIcon} size={16} />
										</Button>
									</TooltipTrigger>
									<TooltipContent>{diagnostic.message}</TooltipContent>
								</Tooltip>
							))}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleImportClick}
							disabled={isProcessing}
							className="items-center justify-center gap-1.5"
						>
							<HugeiconsIcon icon={CloudUploadIcon} />
							Subir SRT/ASS
						</Button>
					</div>
				</TooltipProvider>
			}
			ref={containerRef}
		>
			<input
				ref={fileInputRef}
				type="file"
				accept=".srt,.ass"
				className="hidden"
				onChange={(event) => void handleFileChange({ event })}
			/>
			<Section
				showTopBorder={false}
				showBottomBorder={false}
				className="flex-1"
			>
				<SectionContent className="flex flex-col gap-4 h-full pt-1">
					<div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
						{(
							[
								["create", l("1 · Criar", "1 · Create")],
								["review", l("2 · Revisar", "2 · Review")],
								["style", l("3 · Estilo", "3 · Style")],
							] as const
						).map(([id, label]) => (
							<button
								type="button"
								key={id}
								disabled={id === "review" && !transcriptDocument}
								onClick={() => setWorkflowTab(id)}
								className={
									"rounded-md px-1 py-2 text-[11px] transition-colors disabled:opacity-40 " +
									(workflowTab === id
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground")
								}
							>
								{label}
							</button>
						))}
					</div>
					{workflowTab === "create" && (
						<>
							{" "}
							<SectionFields>
								<SectionField label="Language">
									<Select
										value={selectedLanguage}
										onValueChange={(value) => handleLanguageChange({ value })}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select a language" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="auto">Auto detect</SelectItem>
											{TRANSCRIPTION_LANGUAGES.map((language) => (
												<SelectItem key={language.code} value={language.code}>
													{language.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</SectionField>
							</SectionFields>
							<label className="space-y-1 text-xs">
								<span>{l("Faixa de voz", "Voice track")}</span>
								<select
									aria-label={l("Faixa de voz", "Voice track")}
									className="w-full rounded border bg-background p-2"
									value={trackId}
									onChange={(event) => setTrackId(event.target.value)}
									disabled={isProcessing}
								>
									<option value="">
										{l("Automático (faixa única)", "Automatic (single track)")}
									</option>
									{audioTracks.map((track) => (
										<option key={track.id} value={track.id}>
											{track.name}
										</option>
									))}
								</select>
							</label>
							<SectionFields>
								<SectionField label={l("Estilo inicial", "Initial style")}>
									<Select
										value={captionStyle}
										onValueChange={(value) => {
											if (
												value === "clean" ||
												value === "boxed" ||
												value === "pulse" ||
												value === "spotlight"
											)
												setCaptionStyle(value);
										}}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="clean">
												{l("Limpa", "Clean")}
											</SelectItem>
											<SelectItem value="boxed">
												{l("Caixa", "Boxed")}
											</SelectItem>
											<SelectItem value="pulse">
												{l("Pulso", "Pulse")}
											</SelectItem>
											<SelectItem value="spotlight">
												{l("Palavra em destaque", "Word spotlight")}
											</SelectItem>
										</SelectContent>
									</Select>
								</SectionField>
							</SectionFields>
							<p className="text-xs text-muted-foreground">
								{l(
									"Transcrição pela API OpenAI (whisper-1 na nuvem). Envia o áudio e pode gerar cobrança. Sem transcrição local. Configure chave, envio de áudio e edição em Integrações. Sair desta aba cancela a operação.",
									"OpenAI API transcription (cloud whisper-1). Uploads audio and may incur charges. No local transcription. Configure the key, audio sharing and editing in Integrations. Leaving this tab cancels the operation.",
								)}
							</p>
							<Button
								variant="outline"
								size="sm"
								disabled={isProcessing}
								onClick={() => setActiveTab("integrations")}
							>
								{l("Configurar OpenAI", "Configure OpenAI")}
							</Button>
						</>
					)}

					{workflowTab === "style" && (
						<CaptionStylePanel
							editor={editor}
							value={captionStyle}
							onChange={setCaptionStyle}
							targets={captionTargets}
						/>
					)}

					{workflowTab === "review" && transcriptDocument && (
						<div className="min-h-0 flex-1 space-y-2 overflow-y-auto border-y py-3">
							<div className="space-y-1">
								<div className="flex items-center justify-between gap-2">
									<strong className="text-sm">
										{l("Texto reconhecido", "Recognized text")}
									</strong>
									<span className="text-[10px] uppercase text-muted-foreground">
										{transcriptDocument.result.language}
									</span>
								</div>
								<p className="text-[11px] text-muted-foreground">
									{l(
										"Edite qualquer trecho e salve. A legenda correspondente é atualizada na timeline, com um único Ctrl+Z.",
										"Edit any segment and save. Its timeline caption updates with one undo step.",
									)}
								</p>
							</div>
							{transcriptDocument.stale && (
								<p
									role="alert"
									className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700"
								>
									{l(
										"A voz mudou depois desta transcrição. Transcreva novamente antes de corrigir ou criar legendas.",
										"The voice changed after this transcript. Transcribe again before correcting or creating captions.",
									)}
								</p>
							)}
							<Button
								type="button"
								size="sm"
								variant="secondary"
								className="w-full"
								disabled={!transcriptDocument.captionBindings.length}
								onClick={() => {
									const requested = transcriptDocument.captionBindings.map(
										({ trackId, elementId }) => ({ trackId, elementId }),
									);
									const found = editor.timeline
										.getElementsWithTracks({ elements: requested })
										.filter(({ element }) => element.type === "text")
										.map(({ element, track }) => ({
											trackId: track.id,
											elementId: element.id,
										}));
									editor.selection.setSelectedElements({ elements: found });
									setWorkflowTab("style");
								}}
							>
								<LayoutTemplate className="size-4" />
								{l(
									"Ver estilos destas legendas",
									"See styles for these captions",
								)}
							</Button>
							<p className="text-[10px] text-muted-foreground">
								{l(
									"Os estilos importados preservam as palavras e os tempos. Você escolhe pela prévia e aplica somente às legendas selecionadas.",
									"Imported styles preserve words and timing. Choose from the preview and apply only to selected captions.",
								)}
							</p>
							{transcriptDocument.result.segments.map((segment, index) => (
								<TranscriptSegmentEditor
									key={
										transcriptDocument.id +
										":" +
										index +
										":" +
										segment.start +
										":" +
										segment.text
									}
									segment={segment}
									index={index}
									pt={locale === "pt-BR"}
									disabled={
										transcriptDocument.stale ||
										!connection ||
										!settings.allowEdits ||
										isProcessing
									}
									onSeek={() =>
										editor.playback.seek({
											time: mediaTimeFromSeconds({
												seconds: Math.max(0, segment.start - 0.2),
											}),
										})
									}
									onSave={async (text) => {
										const result = updateTranscriptSegment({
											editor,
											transcriptId: transcriptDocument.id,
											segmentIndex: index,
											text,
										});
										return result.captionsUpdated;
									}}
								/>
							))}
						</div>
					)}

					{workflowTab === "create" && (
						<Button
							type="button"
							className={transcriptDocument ? "w-full" : "mt-auto w-full"}
							onClick={handleGenerateTranscript}
							disabled={
								isProcessing || !canTranscribe || activeDiagnostics.length > 0
							}
						>
							{isProcessing && <Spinner className="mr-1" />}
							{isProcessing
								? processing.step
								: l(
										transcriptDocument
											? "Transcrever novamente com OpenAI"
											: "Transcrever e legendar com OpenAI",
										transcriptDocument
											? "Transcribe again with OpenAI"
											: "Transcribe and caption with OpenAI",
									)}
						</Button>
					)}
					{isProcessing && isTranscribing && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								if (currentJob.current) cancelOperation(currentJob.current);
							}}
						>
							{l("Cancelar", "Cancel")}
						</Button>
					)}
					{error && (
						<div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
							<p className="text-destructive text-sm">{error}</p>
						</div>
					)}
					{warnings.length > 0 && (
						<div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3">
							<ul className="space-y-1 text-sm text-amber-700">
								{warnings.map((warning) => (
									<li key={warning}>{warning}</li>
								))}
							</ul>
						</div>
					)}
				</SectionContent>
			</Section>
		</PanelView>
	);
}
