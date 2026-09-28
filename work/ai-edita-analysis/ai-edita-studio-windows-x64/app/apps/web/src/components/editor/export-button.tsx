"use client";

import { useState } from "react";
import { TransitionTopIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/utils/ui";
import {
	getExportMimeType,
	getExportFileExtension,
	downloadBuffer,
} from "@/export";
import { Check, Copy, Download, RotateCcw } from "lucide-react";
import {
	EXPORT_FORMAT_VALUES,
	EXPORT_QUALITY_VALUES,
	type ExportFormat,
	type ExportQuality,
} from "@/export";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/section";
import { useEditor } from "@/editor/use-editor";
import { DEFAULT_EXPORT_OPTIONS } from "@/export/defaults";
import { validateExportTimeline } from "@/export/validation";
import { uploadAsset } from "@/operations/client";
import { toast } from "sonner";

/** In-app popup always; a system notification too when the person is elsewhere. */
function notifyExportFinished({
	name,
	success,
	detail,
}: {
	name: string;
	success: boolean;
	detail: string;
}) {
	const title = success
		? `Exportação concluída: ${name}`
		: `A exportação de ${name} não terminou`;
	if (success) toast.success(title, { description: detail, duration: 20_000 });
	else toast.error(title, { description: detail, duration: 20_000 });
	if (
		typeof Notification !== "undefined" &&
		Notification.permission === "granted" &&
		(document.visibilityState !== "visible" || !document.hasFocus())
	) {
		try {
			new Notification(title, { body: detail, tag: "ai-edita-export" });
		} catch {
			// Some browsers only allow notifications from a service worker.
		}
	}
	const previousTitle = document.title;
	document.title = success ? "✓ Exportação pronta" : "⚠ Exportação falhou";
	window.setTimeout(() => {
		document.title = previousTitle;
	}, 8000);
}

function isExportFormat(value: string): value is ExportFormat {
	return EXPORT_FORMAT_VALUES.some((formatValue) => formatValue === value);
}

function isExportQuality(value: string): value is ExportQuality {
	return EXPORT_QUALITY_VALUES.some((qualityValue) => qualityValue === value);
}

export function ExportButton() {
	const [isExportPopoverOpen, setIsExportPopoverOpen] = useState(false);
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActiveOrNull());
	const hasProject = !!activeProject;

	const exportState = useEditor((e) => e.project.getExportState());

	const handlePopoverOpenChange = ({ open }: { open: boolean }) => {
		if (!open) {
			if (editor.project.getExportState().isExporting) {
				// Closing the panel no longer cancels: the export keeps running.
				toast.info("A exportação continua em segundo plano.", {
					description:
						"Pode continuar usando o AI Edita. Avisaremos quando o arquivo estiver pronto.",
				});
				setIsExportPopoverOpen(false);
				return;
			}
			editor.project.clearExportState();
		}
		setIsExportPopoverOpen(open);
	};

	return (
		<Popover
			open={isExportPopoverOpen}
			onOpenChange={(open) => handlePopoverOpenChange({ open })}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex items-center gap-1.5 rounded-md border border-primary bg-primary px-[0.12rem] py-[0.12rem] text-primary-foreground hover:bg-primary/90",
						hasProject ? "cursor-pointer" : "cursor-not-allowed opacity-50",
					)}
					onClick={hasProject ? () => setIsExportPopoverOpen(true) : undefined}
					disabled={!hasProject}
					onKeyDown={(event) => {
						if (hasProject && (event.key === "Enter" || event.key === " ")) {
							event.preventDefault();
							setIsExportPopoverOpen(true);
						}
					}}
				>
					<div className="relative flex items-center gap-1.5 px-4 py-1">
						<HugeiconsIcon icon={TransitionTopIcon} className="z-50 size-3.5" />
						<span className="z-50 text-[0.875rem]">
							{exportState.isExporting
								? `Exportando ${Math.round(exportState.progress * 100)}%`
								: "Export"}
						</span>
					</div>
				</button>
			</PopoverTrigger>
			{hasProject && <ExportPopover onOpenChange={setIsExportPopoverOpen} />}
		</Popover>
	);
}

function ExportPopover({
	onOpenChange,
}: {
	onOpenChange: (open: boolean) => void;
}) {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const exportState = useEditor((e) => e.project.getExportState());
	const {
		isExporting: isRendering,
		progress,
		result: exportResult,
	} = exportState;
	const [isUploading, setIsUploading] = useState(false);
	const [saveToAgenda, setSaveToAgenda] = useState(false);
	const isExporting = isRendering || isUploading;
	const [format, setFormat] = useState<ExportFormat>(
		DEFAULT_EXPORT_OPTIONS.format,
	);
	const [quality, setQuality] = useState<ExportQuality>(
		DEFAULT_EXPORT_OPTIONS.quality,
	);
	const [shouldIncludeAudio, setShouldIncludeAudio] = useState<boolean>(
		DEFAULT_EXPORT_OPTIONS.includeAudio ?? true,
	);
	const tracks = useEditor((e) => e.scenes.getActiveScene().tracks);
	const mediaAssets = useEditor((e) => e.media.getAssets());
	const diagnostics = validateExportTimeline({
		tracks,
		mediaAssets,
		includeAudio: shouldIncludeAudio,
	});
	const exportErrors = diagnostics.filter(
		(diagnostic) => diagnostic.severity === "error",
	);
	const exportWarnings = diagnostics.filter(
		(diagnostic) => diagnostic.severity === "warning",
	);

	const handleExport = async () => {
		if (!activeProject) return;
		if (exportErrors.length > 0) {
			toast.error(exportErrors[0].message);
			return;
		}
		// Ask once, from this click, so the end of the export can reach the person even
		// when they are in another tab or app.
		if (
			typeof Notification !== "undefined" &&
			Notification.permission === "default"
		)
			void Notification.requestPermission().catch(() => "default");
		const projectName = activeProject.metadata.name;

		const result = await editor.project.export({
			options: {
				format,
				quality,
				fps: activeProject.settings.fps,
				includeAudio: shouldIncludeAudio,
			},
		});

		if (result.cancelled) {
			editor.project.clearExportState();
			return;
		}
		if (!result.success) {
			notifyExportFinished({
				name: projectName,
				success: false,
				detail: result.error || "A exportação falhou.",
			});
		}

		if (result.success && result.buffer) {
			downloadBuffer({
				buffer: result.buffer,
				filename: `${activeProject.metadata.name}${getExportFileExtension({ format })}`,
				mimeType: getExportMimeType({ format }),
			});

			if (saveToAgenda && format === "mp4") {
				setIsUploading(true);
				try {
					await uploadAsset({
						file: new File(
							[result.buffer],
							activeProject.metadata.name + ".mp4",
							{ type: "video/mp4" },
						),
						kind: "export",
						projectId: activeProject.metadata.id,
					});
					toast.success(
						"MP4 guardado na Agenda. Nenhuma publicação foi feita.",
					);
				} catch (error) {
					toast.error(
						error instanceof Error
							? error.message
							: "Não foi possível guardar na Agenda. O download foi mantido.",
					);
				} finally {
					setIsUploading(false);
				}
			}
			notifyExportFinished({
				name: projectName,
				success: true,
				detail:
					saveToAgenda && format === "mp4"
						? "O arquivo foi baixado e guardado em Conteúdos."
						: "O arquivo foi baixado para o seu computador.",
			});
			editor.project.clearExportState();
			onOpenChange(false);
		}
	};

	const handleCancel = () => {
		editor.project.cancelExport();
	};

	return (
		<PopoverContent className="bg-background mr-4 flex w-80 flex-col p-0">
			{exportResult && !exportResult.success ? (
				<ExportError
					error={exportResult.error || "Unknown error occurred"}
					onRetry={handleExport}
				/>
			) : (
				<>
					<div className="flex items-center justify-between p-3 border-b">
						<div>
							<h3 className="font-medium text-sm">
								{isExporting ? "Exporting project" : "Export project"}
							</h3>
							<p className="mt-0.5 text-[11px] text-muted-foreground">
								Exportação com Canvas
							</p>
						</div>
					</div>

					<div className="flex flex-col gap-4">
						{!isExporting && (
							<>
								{diagnostics.length > 0 && (
									<div
										className={cn(
											"mx-3 mt-3 rounded-md border p-2.5 text-xs",
											exportErrors.length > 0
												? "border-destructive/40 bg-destructive/10 text-destructive"
												: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
										)}
										role={exportErrors.length > 0 ? "alert" : "status"}
									>
										<p className="mb-1 font-medium">
											{exportErrors.length > 0
												? "Corrija antes de exportar"
												: "Confira antes de exportar"}
										</p>
										<ul className="list-disc space-y-1 pl-4">
											{[...exportErrors, ...exportWarnings]
												.slice(0, 3)
												.map((diagnostic) => (
													<li
														key={`${diagnostic.code}-${diagnostic.elementId ?? diagnostic.message}`}
													>
														{diagnostic.message}
													</li>
												))}
										</ul>
										{diagnostics.length > 3 && (
											<p className="mt-1 opacity-80">
												+{diagnostics.length - 3} aviso(s)
											</p>
										)}
									</div>
								)}
								<div className="flex flex-col">
									<Section
										collapsible
										defaultOpen={false}
										showTopBorder={false}
									>
										<SectionHeader>
											<SectionTitle>Format</SectionTitle>
										</SectionHeader>
										<SectionContent>
											<RadioGroup
												value={format}
												onValueChange={(value) => {
													if (isExportFormat(value)) {
														setFormat(value);
													}
												}}
											>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="mp4" id="mp4" />
													<Label htmlFor="mp4">
														MP4 (H.264) - Better compatibility
													</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="webm" id="webm" />
													<Label htmlFor="webm">
														WebM (VP9) - Smaller file size
													</Label>
												</div>
											</RadioGroup>
										</SectionContent>
									</Section>

									<Section collapsible defaultOpen={false}>
										<SectionHeader>
											<SectionTitle>Quality</SectionTitle>
										</SectionHeader>
										<SectionContent>
											<RadioGroup
												value={quality}
												onValueChange={(value) => {
													if (isExportQuality(value)) {
														setQuality(value);
													}
												}}
											>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="low" id="low" />
													<Label htmlFor="low">Low - Smallest file size</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="medium" id="medium" />
													<Label htmlFor="medium">Medium - Balanced</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="high" id="high" />
													<Label htmlFor="high">High - Recommended</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="very_high" id="very_high" />
													<Label htmlFor="very_high">
														Very high - Largest file size
													</Label>
												</div>
											</RadioGroup>
										</SectionContent>
									</Section>

									<Section collapsible defaultOpen={false}>
										<SectionHeader>
											<SectionTitle>Audio</SectionTitle>
										</SectionHeader>
										<SectionContent>
											<div className="flex items-center space-x-2">
												<Checkbox
													id="include-audio"
													checked={shouldIncludeAudio}
													onCheckedChange={(checked) =>
														setShouldIncludeAudio(!!checked)
													}
												/>
												<Label htmlFor="include-audio">
													Include audio in export
												</Label>
											</div>
										</SectionContent>
									</Section>
								</div>

								<div className="p-3 pt-0">
									<label className="mb-3 flex gap-2 text-xs">
										<input
											type="checkbox"
											checked={saveToAgenda && format === "mp4"}
											disabled={format !== "mp4"}
											onChange={(e) => setSaveToAgenda(e.target.checked)}
										/>
										Guardar uma cópia na agenda (MP4)
									</label>
									<Button
										onClick={handleExport}
										className="w-full gap-2"
										disabled={exportErrors.length > 0}
									>
										<Download className="size-4" />
										Export
									</Button>
								</div>
							</>
						)}

						{isExporting && (
							<div className="space-y-4 p-3">
								<div className="flex flex-col gap-2">
									<div className="flex items-center justify-between text-center">
										<p className="text-muted-foreground text-sm">
											{Math.round(progress * 100)}%
										</p>
										<p className="text-muted-foreground text-sm">100%</p>
									</div>
									<Progress value={progress * 100} className="w-full" />
									<p className="text-xs text-muted-foreground" role="status">
										{isUploading
											? "Guardando MP4 na Agenda…"
											: progress <= 0.05
												? "Preparing and encoding audio…"
												: progress >= 0.99
													? "Finalizing file…"
													: "Rendering video frames…"}
									</p>
									<p className="text-xs text-muted-foreground">
										The preview stays still during export. Keep this tab open.
									</p>
								</div>

								<Button
									variant="outline"
									className="w-full rounded-md"
									onClick={handleCancel}
								>
									Cancel
								</Button>
							</div>
						)}
					</div>
				</>
			)}
		</PopoverContent>
	);
}

function ExportError({
	error,
	onRetry,
}: {
	error: string;
	onRetry: () => void;
}) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(error);
		setCopied(true);
		setTimeout(() => setCopied(false), 1000);
	};

	return (
		<div className="space-y-4 p-3">
			<div className="flex flex-col gap-1.5">
				<p className="text-destructive text-sm font-medium">Export failed</p>
				<p className="text-muted-foreground text-xs">{error}</p>
			</div>

			<div className="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					className="h-8 flex-1 text-xs"
					onClick={handleCopy}
				>
					{copied ? <Check className="text-constructive" /> : <Copy />}
					Copy
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="h-8 flex-1 text-xs"
					onClick={onRetry}
				>
					<RotateCcw />
					Retry
				</Button>
			</div>
		</div>
	);
}
