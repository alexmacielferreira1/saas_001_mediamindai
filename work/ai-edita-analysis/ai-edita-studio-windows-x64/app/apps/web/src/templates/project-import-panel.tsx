"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import {
	inspectLegacyProject,
	saveLegacyProjectCopy,
	type LegacyProjectPlan,
} from "./project-import";

export function ProjectImportPanel() {
	const pt = useI18n().locale === "pt-BR";
	const [plan, setPlan] = useState<LegacyProjectPlan | null>(null);
	const [files, setFiles] = useState<Record<string, File>>({});
	const [busy, setBusy] = useState(false),
		[message, setMessage] = useState("");
	const [ack, setAck] = useState(false),
		[created, setCreated] = useState("");
	return (
		<details className="rounded-lg border p-3 space-y-3" data-i18n-skip="true">
			<summary className="cursor-pointer text-xs font-medium">
				{pt
					? "Importar projeto do AI Edita antigo"
					: "Import a legacy AI Edita project"}
			</summary>
			<p className="text-xs text-muted-foreground">
				{pt
					? "Cria uma cópia nova com mídias, cortes, posições, velocidade e keyframes suportados. Religue os arquivos abaixo. O original e a timeline aberta não são alterados. Não executa receitas, não abre caminhos do JSON nem reproduz efeitos FFmpeg proprietários."
					: "Creates a new copy with relinked media, cuts, positions, speed and supported keyframes. Original and open timeline stay unchanged. Never executes recipes or opens JSON paths; proprietary FFmpeg effects are not reproduced."}
			</p>
			<input
				aria-label={pt ? "Projeto AI Edita JSON" : "AI Edita project JSON"}
				type="file"
				accept=".json,application/json"
				disabled={busy}
				className="w-full text-xs"
				onChange={(e) => {
					const file = e.target.files?.[0];
					e.target.value = "";
					if (!file) return;
					setBusy(true);
					setPlan(null);
					setFiles({});
					setAck(false);
					setCreated("");
					setMessage("");
					void inspectLegacyProject(file)
						.then(setPlan)
						.catch((e) => setMessage(e instanceof Error ? e.message : "Failed"))
						.finally(() => setBusy(false));
				}}
			/>
			{plan && (
				<>
					<p className="text-xs">
						{plan.name} · {plan.tracks.reduce((n, t) => n + t.clips.length, 0)}{" "}
						{pt ? "clipes" : "clips"} · {plan.assets.length}{" "}
						{pt ? "mídias para religar" : "assets to relink"} · {plan.skipped}{" "}
						{pt ? "desativados omitidos" : "disabled clips omitted"}
					</p>
					<ul className="list-disc pl-4 text-xs text-muted-foreground">
						{plan.warnings.map((w) => (
							<li key={w}>{w}</li>
						))}
					</ul>
					{plan.assets.map((a) => (
						<label key={a.id} className="block text-xs break-words">
							{a.name} · {a.hint || a.type}
							<input
								aria-label={(pt ? "Religar " : "Relink ") + a.name}
								type="file"
								accept={
									a.type === "image"
										? "image/*"
										: a.type === "audio"
											? "audio/*,video/*"
											: "video/*"
								}
								disabled={busy}
								className="mt-1 w-full"
								onChange={(e) => {
									const file = e.target.files?.[0];
									setFiles((prev) => {
										const next = { ...prev };
										if (file) next[a.id] = file;
										else delete next[a.id];
										return next;
									});
								}}
							/>
						</label>
					))}
					<label className="flex gap-2 text-xs">
						<input
							type="checkbox"
							checked={ack}
							disabled={busy}
							onChange={(e) => setAck(e.target.checked)}
						/>
						{pt
							? "Revisei as adaptações e quero criar uma cópia"
							: "I reviewed adaptations and want to create a copy"}
					</label>
					<Button
						size="sm"
						disabled={
							busy || !ack || !!created || plan.assets.some((a) => !files[a.id])
						}
						onClick={() => {
							setBusy(true);
							setMessage("");
							void saveLegacyProjectCopy({
								plan,
								files,
								onProgress: setMessage,
							})
								.then((id) => {
									setCreated(id);
									setMessage(
										pt
											? "Cópia salva com sucesso. Abra abaixo para conferir."
											: "Copy saved. Open it below to review.",
									);
								})
								.catch((e) =>
									setMessage(e instanceof Error ? e.message : "Failed"),
								)
								.finally(() => setBusy(false));
						}}
					>
						{busy
							? pt
								? "Importando…"
								: "Importing…"
							: pt
								? "Criar projeto importado"
								: "Create imported project"}
					</Button>
				</>
			)}
			{message && (
				<p role="status" className="text-xs break-words">
					{message}
				</p>
			)}
			{created && (
				<Link
					className="block text-sm text-primary underline"
					href={"/editor/" + created}
				>
					{pt ? "Abrir projeto importado" : "Open imported project"}
				</Link>
			)}
		</details>
	);
}
