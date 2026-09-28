"use client";

import { useEffect, useRef, useState } from "react";
import {
	ArrowUp,
	CheckCircle2,
	Plus,
	SlidersHorizontal,
	Sparkles,
	Square,
	Trash2,
	WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useAssetsPanelStore } from "@/components/editor/panels/assets/assets-panel-store";
import { useEditor } from "@/editor/use-editor";
import { useI18n } from "@/i18n";
import { useSettingsDialog } from "@/operations/settings";
import { agentRunSchema } from "./agent-run-contract";
import { integrationRequest, useIntegrationStore } from "./client";
import { useStudioStore } from "./studio-store";

export function AgentStudio({ compact = false }: { compact?: boolean }) {
	const { locale } = useI18n();
	const pt = locale === "pt-BR";
	const { connection, settings, chatBusy, health, agentRun } =
		useIntegrationStore();
	const projectId = useEditor(
		(editor) => editor.project.getActive().metadata.id,
	);
	const sceneId = useEditor((editor) => editor.scenes.getActiveScene().id);
	const historyKey = projectId + ":" + sceneId;
	const messages = useStudioStore((store) => store.threads[historyKey]);
	const [draft, setDraft] = useState("");
	const [maxCalls, setMaxCalls] = useState(24);
	const [menuOpen, setMenuOpen] = useState(false);
	const [notice, setNotice] = useState("");
	const composer = useRef<HTMLTextAreaElement>(null);
	const messagesEnd = useRef<HTMLDivElement>(null);
	const ready = Boolean(
		connection && settings.hasKey && settings.shareWithOpenAI && !health,
	);
	const canEdit = ready && settings.allowEdits;

	useEffect(() => {
		void useStudioStore.persist.rehydrate();
	}, []);
	useEffect(() => {
		messagesEnd.current?.scrollIntoView({ block: "end", behavior: "smooth" });
	}, [agentRun?.status, chatBusy, messages?.length]);

	const recipes = pt
		? [
				{
					title: "Reels dinâmico",
					detail: "Fala limpa, legendas e zooms contextuais",
					prompt:
						"Edite o vídeo da timeline para um reels dinâmico. Leia o estado primeiro. Identifique a voz; transcreva pela OpenAI com tempos por palavra e remova pausas protegendo a fala. Após os cortes, transcreva a nova timeline e gere legendas no estilo pulse. Aplique zooms punch moderados apenas em momentos importantes. Preserve o contexto, não adicione frases genéricas, não exporte e verifique o resultado.",
				},
				{
					title: "Legenda em destaque",
					detail: "Palavra por palavra, verde-lima",
					prompt:
						"Transcreva a voz da timeline pela OpenAI com wordTimestamps:true e crie legendas editáveis no estilo spotlight, na parte inferior. Confira se já existem legendas para não duplicar. Preserve todos os cortes, mídias e o formato. Verifique o resultado.",
				},
				{
					title: "Ritmo natural",
					detail: "Reduz pausas e preserva a fala",
					prompt:
						"Deixe a fala mais direta, removendo pausas longas e respiros evidentes com margem conservadora. Transcreva pela OpenAI para proteger as palavras, analise e aplique os cortes sincronizados em todas as trilhas. Preserve o contexto e verifique o resultado.",
				},
				{
					title: "Música equilibrada",
					detail: "A música acompanha a voz",
					prompt:
						"Identifique a trilha de voz e a música já importada na timeline. Se não for possível distinguir, pergunte. Transcreva a voz pela OpenAI e aplique duck_music somente na música, com base -16 dB e redução de 10 dB durante a fala. Preserve animações e a voz.",
				},
				{
					title: "Revisar e concluir",
					detail: "Confere a timeline e finaliza o que realmente falta",
					prompt:
						"Revise o pedido anterior e o estado atual da timeline. Não repita ações já concluídas. Verifique objetivamente cortes, velocidade, mídias, tratamento de cor e legendas; conclua somente as pendências autorizadas e faça uma verificação final. Não exporte.",
				},
			]
		: [
				{
					title: "Dynamic reels",
					detail: "Clean speech, captions and contextual zooms",
					prompt:
						"Edit the timeline into a dynamic reel. Inspect it first, transcribe via OpenAI with word timestamps, clean long pauses while protecting speech, re-transcribe, create pulse captions and add moderate punch zooms only at important moments. Preserve context, do not export and verify the result.",
				},
				{
					title: "Word spotlight",
					detail: "Lime word-by-word captions",
					prompt:
						"Transcribe timeline voice via OpenAI with wordTimestamps:true and create editable spotlight captions at the bottom. Inspect existing captions to avoid duplication. Preserve edits and canvas; verify afterward.",
				},
				{
					title: "Natural pacing",
					detail: "Shorter pauses, protected speech",
					prompt:
						"Make the delivery more direct. Transcribe via OpenAI, conservatively remove long pauses and clear breaths with speech protection, synchronize cuts across tracks and verify afterward.",
				},
				{
					title: "Balanced music",
					detail: "Music follows the voice",
					prompt:
						"Identify voice and existing music tracks; ask if ambiguous. Transcribe voice via OpenAI, then duck only the music with a -16 dB base and 10 dB reduction during speech. Preserve voice and animation.",
				},
				{
					title: "Review and finish",
					detail: "Audit the timeline and finish actual pending work",
					prompt:
						"Review the previous request and current timeline. Do not repeat completed actions. Objectively verify cuts, speed, media, color grade and captions; complete only authorized pending work and run a final verification. Do not export.",
				},
			];

	function chooseSuggestion(prompt: string) {
		setDraft(prompt);
		setMenuOpen(false);
		setTimeout(() => composer.current?.focus(), 0);
	}

	async function send() {
		if (!ready || !connection || chatBusy || !draft.trim()) return;
		const prompt = draft.trim();
		const history = (messages ?? [])
			.slice(-12)
			.map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
		useStudioStore
			.getState()
			.append({ key: historyKey, role: "user", content: prompt });
		setDraft("");
		setNotice("");
		useIntegrationStore.setState({ chatBusy: true, answer: "" });
		try {
			const response = agentRunSchema.parse(
				await integrationRequest({
					action: "start_agent_run",
					...connection,
					prompt,
					history,
					maxCalls,
				}),
			);
			useIntegrationStore.setState({
				agentRun: response,
				chatBusy: response.status === "running",
			});
		} catch (error) {
			useIntegrationStore.setState({ chatBusy: false });
			useStudioStore.getState().append({
				key: historyKey,
				role: "assistant",
				content:
					(error instanceof Error ? error.message : "Request failed.") +
					(pt
						? "\nConfira a atividade antes de repetir: algumas ações podem ter terminado."
						: "\nCheck activity before retrying: some actions may have completed."),
			});
		}
	}

	async function controlRun() {
		if (
			!connection ||
			!agentRun ||
			!["running", "paused"].includes(agentRun.status)
		)
			return;
		try {
			const run = agentRunSchema.parse(
				await integrationRequest({
					action:
						agentRun.status === "running"
							? "cancel_agent_run"
							: "resume_agent_run",
					runId: agentRun.id,
					...connection,
				}),
			);
			useIntegrationStore.setState({
				agentRun: run,
				chatBusy: run.status === "running",
			});
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Failed");
		}
	}

	return (
		<div
			className={
				"flex h-full min-h-0 flex-col bg-background text-sm " +
				(compact ? "" : "mx-auto max-w-3xl")
			}
			data-i18n-skip="true"
		>
			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
				{!messages?.length && !chatBusy && (
					<div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
						<span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
							<Sparkles className="size-5" />
						</span>
						<h2 className="mt-4 text-lg font-semibold">
							{pt ? "O que vamos editar?" : "What shall we edit?"}
						</h2>
						<p className="mt-2 max-w-72 text-xs leading-relaxed text-muted-foreground">
							{pt
								? "Converse normalmente com a Hanna. Use o + para ideias, modelos e configurações."
								: "Talk naturally with Hanna. Use + for ideas, templates and settings."}
						</p>
					</div>
				)}
				<div className="space-y-3" aria-live="polite">
					{messages?.map((message) => (
						<div
							key={message.id}
							className={
								"max-w-[92%] rounded-2xl px-3.5 py-3 text-xs leading-relaxed whitespace-pre-wrap break-words " +
								(message.role === "user"
									? "ml-auto bg-primary text-primary-foreground"
									: "mr-auto border bg-card text-card-foreground")
							}
						>
							{message.content}
						</div>
					))}
					{chatBusy && (
						<div
							role="status"
							className="mr-auto max-w-[92%] rounded-2xl border bg-card px-3.5 py-3 text-xs"
						>
							<div className="flex items-center gap-2 text-primary">
								<span className="size-2 animate-pulse rounded-full bg-primary" />
								{pt
									? "Hanna está trabalhando na timeline…"
									: "Hanna is working on the timeline…"}
							</div>
							{agentRun && (
								<p className="mt-2 text-muted-foreground">
									{pt ? "Etapa " : "Step "}
									{agentRun.steps.length}
									{agentRun.steps.at(-1) ? " · " + agentRun.steps.at(-1) : ""}
								</p>
							)}
							<Button
								size="sm"
								variant="ghost"
								className="mt-2 h-7 px-2 text-xs"
								onClick={() => void controlRun()}
							>
								<Square className="size-3" />
								{pt ? "Parar" : "Stop"}
							</Button>
						</div>
					)}
					{agentRun?.status === "paused" && (
						<div className="mr-auto max-w-[92%] rounded-2xl border bg-card px-3.5 py-3 text-xs">
							<p>
								{pt
									? "A execução pausou no limite escolhido."
									: "The run paused at the selected limit."}
							</p>
							<Button
								size="sm"
								variant="outline"
								className="mt-2"
								onClick={() => void controlRun()}
							>
								{pt ? "Continuar" : "Continue"}
							</Button>
						</div>
					)}
					<div ref={messagesEnd} />
				</div>
			</div>

			<div className="shrink-0 border-t bg-background/95 p-3 backdrop-blur">
				{notice && (
					<p role="status" className="mb-2 text-xs text-destructive">
						{notice}
					</p>
				)}
				<div className="rounded-2xl border bg-card p-2 shadow-sm focus-within:border-primary/60">
					<textarea
						ref={composer}
						aria-label={pt ? "Pedido para o assistente" : "Assistant request"}
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								void send();
							}
						}}
						disabled={chatBusy}
						maxLength={12000}
						placeholder={
							pt ? "Peça uma edição para a Hanna…" : "Ask Hanna for an edit…"
						}
						className="min-h-20 max-h-36 w-full resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
					/>
					<div className="flex items-center gap-2">
						<Popover open={menuOpen} onOpenChange={setMenuOpen}>
							<PopoverTrigger asChild>
								<Button
									size="icon"
									variant="ghost"
									className="size-8 rounded-full"
									aria-label={
										pt
											? "Abrir ações e sugestões"
											: "Open actions and suggestions"
									}
								>
									<Plus className="size-4" />
								</Button>
							</PopoverTrigger>
							<PopoverContent
								side="top"
								align="start"
								sideOffset={10}
								className="w-[min(350px,calc(100vw-6rem))] space-y-2 rounded-2xl p-2"
							>
								<p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
									{pt
										? "Sugestões para este vídeo"
										: "Suggestions for this video"}
								</p>
								{recipes.map((recipe) => (
									<button
										type="button"
										key={recipe.title}
										onClick={() => chooseSuggestion(recipe.prompt)}
										className="block w-full rounded-xl px-2.5 py-2 text-left hover:bg-accent"
									>
										<strong className="block text-xs">{recipe.title}</strong>
										<span className="mt-0.5 block text-[11px] text-muted-foreground">
											{recipe.detail}
										</span>
									</button>
								))}
								<div className="grid grid-cols-2 gap-1 border-t pt-2">
									<Button
										size="sm"
										variant="ghost"
										className="justify-start"
										onClick={() => {
											setMenuOpen(false);
											useAssetsPanelStore.getState().setActiveTab("text");
										}}
									>
										<WandSparkles />
										{pt ? "Textos e estilos" : "Text and styles"}
									</Button>
									<Button
										size="sm"
										variant="ghost"
										className="justify-start"
										onClick={() => {
											setMenuOpen(false);
											useSettingsDialog.getState().show();
										}}
									>
										<SlidersHorizontal />
										{pt ? "Integrações" : "Integrations"}
									</Button>
									{Boolean(messages?.length) && (
										<Button
											size="sm"
											variant="ghost"
											className="justify-start"
											disabled={chatBusy}
											onClick={() => {
												useStudioStore.getState().clear(historyKey);
												setMenuOpen(false);
											}}
										>
											<Trash2 />
											{pt ? "Limpar chat" : "Clear chat"}
										</Button>
									)}
									<label className="flex items-center gap-2 rounded-lg px-2 text-[11px]">
										{pt ? "Limite" : "Limit"}
										<select
											aria-label={pt ? "Limite de ações" : "Action limit"}
											className="ml-auto rounded border bg-input px-1 py-1"
											disabled={chatBusy}
											value={maxCalls}
											onChange={(event) =>
												setMaxCalls(Number(event.target.value))
											}
										>
											{[16, 24, 32].map((count) => (
												<option key={count} value={count}>
													{count}
												</option>
											))}
										</select>
									</label>
								</div>
							</PopoverContent>
						</Popover>
						<span
							className={
								"flex min-w-0 flex-1 items-center gap-1.5 truncate text-[11px] " +
								(canEdit ? "text-primary" : "text-muted-foreground")
							}
						>
							{canEdit && <CheckCircle2 className="size-3 shrink-0" />}
							{canEdit
								? pt
									? "Pronta para editar"
									: "Ready to edit"
								: ready
									? pt
										? "Somente leitura"
										: "Read-only"
									: pt
										? "Configure a integração"
										: "Set up integration"}
						</span>
						<Button
							size="icon"
							className="size-9 rounded-full"
							aria-label={pt ? "Enviar para Hanna" : "Send to Hanna"}
							onClick={() => void send()}
							disabled={!ready || chatBusy || !draft.trim()}
						>
							<ArrowUp className="size-4" />
						</Button>
					</div>
				</div>
				<p className="mt-2 px-1 text-center text-[10px] text-muted-foreground">
					{pt
						? "Mantenha o editor aberto enquanto a Hanna trabalha."
						: "Keep the editor open while Hanna works."}
				</p>
			</div>
		</div>
	);
}
