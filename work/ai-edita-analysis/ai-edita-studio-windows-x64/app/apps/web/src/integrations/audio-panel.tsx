"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditor } from "@/editor/use-editor";
import { useI18n } from "@/i18n";
import { mediaTimeFromSeconds } from "@/wasm";
import { useIntegrationStore } from "./client";
import {
	analyzeTimeline,
	applyCleanup,
	cancelOperation,
	generateCaptions,
	transcribeTimeline,
	useOperationStore,
} from "./operations";
import { z } from "zod";

export function AudioPanel() {
	const editor = useEditor();
	const { locale } = useI18n();
	// eslint-disable-next-line opencut/prefer-object-params -- Adjacent bilingual labels.
	const l = (pt: string, en: string) => (locale === "pt-BR" ? pt : en);
	const { connection, settings } = useIntegrationStore();
	const { operations, plans } = useOperationStore();
	const [trackId, setTrackId] = useState("");
	const [minPauseMs, setMinPauseMs] = useState(300);
	const [includeBreaths, setIncludeBreaths] = useState(false);
	const [excluded, setExcluded] = useState<string[]>([]);
	const [message, setMessage] = useState("");
	const [applying, setApplying] = useState(false);
	const active = operations.some((operation) => operation.status === "running");
	const plan = plans[0];
	const tracks = editor.scenes.getActiveScene().tracks;
	const audioTracks = [tracks.main, ...tracks.overlay, ...tracks.audio].filter(
		(track) =>
			track.elements.some(
				(element) => element.type === "audio" || element.type === "video",
			),
	);
	const transcriptResult = operations
		.map((op) => z.object({ transcriptId: z.string() }).safeParse(op.result))
		.find((result) => result.success);
	const transcriptId = transcriptResult?.success
		? transcriptResult.data.transcriptId
		: undefined;
	async function run(action: () => unknown | Promise<unknown>) {
		setMessage("");
		setApplying(true);
		try {
			await action();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Failed");
		} finally {
			setApplying(false);
		}
	}
	return (
		<section
			id="integration-audio"
			className="scroll-mt-24 space-y-3 rounded-lg border p-3"
		>
			<h3 className="font-medium">
				{l("Análise e limpeza de áudio", "Audio analysis and cleanup")}
			</h3>
			<p className="text-xs text-muted-foreground">
				{l(
					"Transcrição: OpenAI API · whisper-1 na nuvem. Configure a chave e autorize o envio de áudio em Configurações → Integrações. A detecção de pausas é local e funciona sem chave. Limite atual: cenas de 15 minutos; áudios longos são divididos em partes. Escolha a faixa da voz, não a música.",
					"Transcription: OpenAI API · cloud whisper-1. Configure your key and allow audio uploads in Settings → Integrations. Pause detection runs locally without a key. Current limit: 15-minute scenes; long audio is uploaded in chunks. Choose the voice track, not music.",
				)}
			</p>
			<label className="block space-y-1">
				<span>{l("Faixa de voz", "Voice track")}</span>
				<select
					aria-label={l("Faixa de voz", "Voice track")}
					className="w-full rounded border bg-background p-2"
					value={trackId}
					onChange={(event) => setTrackId(event.target.value)}
				>
					<option value="">
						{l(
							"Automático (se houver uma única faixa)",
							"Automatic (single audio track only)",
						)}
					</option>
					{audioTracks.map((track) => (
						<option key={track.id} value={track.id}>
							{track.name} · {track.type}
						</option>
					))}
				</select>
			</label>
			<label className="block space-y-1">
				<span>
					{l("Pausa mínima a remover (ms)", "Minimum pause to remove (ms)")}
				</span>
				<Input
					type="number"
					min={150}
					max={5000}
					step={50}
					value={minPauseMs}
					onChange={(event) => setMinPauseMs(Number(event.target.value))}
				/>
			</label>
			<div className="flex flex-wrap gap-2">
				{[false, true].map((breaths) => (
					<Button
						key={String(breaths)}
						size="sm"
						variant="outline"
						disabled={!connection || active || applying}
						onClick={() =>
							void run(() => {
								setExcluded([]);
								setIncludeBreaths(false);
								return analyzeTimeline({
									editor,
									input: {
										trackId: trackId || undefined,
										mode: breaths ? "pauses_and_breaths" : "pauses",
										minPauseMs,
									},
								});
							})
						}
					>
						{breaths
							? l("Pausas e possíveis respiros", "Pauses and possible breaths")
							: l("Analisar pausas", "Analyze pauses")}
					</Button>
				))}
				<Button
					size="sm"
					variant="outline"
					disabled={
						!connection ||
						!settings.hasKey ||
						!settings.shareAudioWithOpenAI ||
						active ||
						applying
					}
					onClick={() =>
						void run(() =>
							transcribeTimeline({
								editor,
								input: {
									trackId: trackId || undefined,
									language: locale === "pt-BR" ? "pt" : "en",
								},
							}),
						)
					}
				>
					{l("Transcrever com OpenAI", "Transcribe with OpenAI")}
				</Button>
				{transcriptId && (
					<Button
						size="sm"
						variant="outline"
						disabled={!connection || !settings.allowEdits || active || applying}
						onClick={() =>
							void run(() =>
								generateCaptions({ editor, input: { transcriptId } }),
							)
						}
					>
						{l("Criar legendas", "Create captions")}
					</Button>
				)}
			</div>
			{operations.slice(0, 4).map((operation) => (
				<div
					key={operation.id}
					className="rounded border p-2 text-xs"
					role="status"
				>
					<div className="flex items-center justify-between gap-2">
						<span>
							{operation.kind.split(" / ")[locale === "pt-BR" ? 0 : 1] ??
								operation.kind}
						</span>
						{operation.status === "running" && (
							<Button
								size="sm"
								variant="ghost"
								onClick={() => cancelOperation(operation.id)}
							>
								{l("Cancelar", "Cancel")}
							</Button>
						)}
					</div>
					<p>
						{operation.stage.split(" / ")[locale === "pt-BR" ? 0 : 1] ??
							operation.stage}{" "}
						· {Math.round(operation.progress)}%
					</p>
					{operation.status === "running" && (
						<progress className="w-full" max={100} value={operation.progress} />
					)}
					{operation.error && (
						<p className="text-destructive break-words">{operation.error}</p>
					)}
				</div>
			))}
			{plan && (
				<div className="space-y-2 rounded bg-muted/50 p-2">
					<p className="font-medium">
						{plan.candidates.length}{" "}
						{l("trechos encontrados", "candidates found")}
						{plan.applied ? l(" · aplicado", " · applied") : ""}
					</p>
					<p className="text-xs text-muted-foreground">
						{l(
							"Possíveis respiros são estimativas: podem ser fala baixa, consoantes ou ruído. Revise. Aplicar corta esses intervalos em TODAS as faixas e fecha as lacunas, preservando o sincronismo. Desfazer restaura tudo em uma ação.",
							"Possible breaths are estimates: they may be quiet speech, consonants or noise. Review them. Applying cuts these intervals from ALL tracks and closes gaps, preserving sync. One undo restores the entire cleanup.",
						)}
					</p>
					<label className="flex gap-2 text-xs">
						<input
							type="checkbox"
							checked={includeBreaths}
							disabled={plan.applied}
							onChange={(event) => setIncludeBreaths(event.target.checked)}
						/>
						{l(
							"Incluir possíveis respiros nos cortes",
							"Include possible breaths in cuts",
						)}
					</label>
					<ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
						{plan.candidates.slice(0, 500).map((candidate) => (
							<li
								key={`${plan.id}:${candidate.id}`}
								className="flex items-center gap-2"
							>
								<input
									type="checkbox"
									aria-label={`${l("Cortar", "Cut")} ${candidate.startSeconds.toFixed(2)}`}
									disabled={
										plan.applied ||
										(candidate.kind === "possible_breath" && !includeBreaths)
									}
									checked={
										!excluded.includes(`${plan.id}:${candidate.id}`) &&
										(candidate.kind === "pause" || includeBreaths)
									}
									onChange={(event) =>
										setExcluded(
											event.target.checked
												? excluded.filter(
														(id) => id !== `${plan.id}:${candidate.id}`,
													)
												: [...excluded, `${plan.id}:${candidate.id}`],
										)
									}
								/>
								<span className="flex-1">
									{candidate.startSeconds.toFixed(2)}–
									{candidate.endSeconds.toFixed(2)}s ·{" "}
									{candidate.kind === "pause"
										? l("pausa", "pause")
										: l("possível respiro", "possible breath")}
								</span>
								<Button
									size="sm"
									variant="ghost"
									disabled={plan.applied}
									onClick={() =>
										editor.playback.seek({
											time: mediaTimeFromSeconds({
												seconds: Math.max(0, candidate.startSeconds - 0.3),
											}),
										})
									}
								>
									{l("Ir ao trecho", "Preview")}
								</Button>
							</li>
						))}
					</ul>
					{plan.candidates.length > 500 && (
						<p className="text-xs">
							{l(
								"Exibindo os primeiros 500. Reanalise após aplicar.",
								"Showing the first 500. Analyze again after applying.",
							)}
						</p>
					)}
					<Button
						size="sm"
						disabled={
							!connection ||
							!settings.allowEdits ||
							plan.applied ||
							!plan.candidates.length ||
							applying ||
							active
						}
						onClick={() =>
							void run(() =>
								applyCleanup({
									editor,
									input: {
										cleanupPlanId: plan.id,
										includePossibleBreaths: includeBreaths,
										candidateIds: plan.candidates
											.slice(0, 500)
											.filter(
												(candidate) =>
													!excluded.includes(`${plan.id}:${candidate.id}`) &&
													(candidate.kind === "pause" || includeBreaths),
											)
											.map((candidate) => candidate.id),
									},
								}),
							)
						}
					>
						{l("Aplicar cortes selecionados", "Apply selected cuts")}
					</Button>
				</div>
			)}
			{message && (
				<p role="alert" className="text-xs text-destructive break-words">
					{message}
				</p>
			)}
		</section>
	);
}
