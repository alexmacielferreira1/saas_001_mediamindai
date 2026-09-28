"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { FolderPlus, Upload, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogBody,
	DialogFooter,
} from "@/components/ui/dialog";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { useEditor } from "@/editor/use-editor";
import { buildElementFromMedia } from "@/timeline/element-utils";
import { DEFAULT_NEW_ELEMENT_DURATION } from "@/timeline/creation";
import {
	createElementFolder,
	importLocalElements,
	attachLibraryElement,
	useLocalElementLibrary,
} from "@/stickers/local-library";
import type { ElementFolder } from "@/stickers/element-library-contract";

export function ElementImportButton({
	folders,
	selectedFolderId,
	onFolderSelected,
}: {
	folders: ElementFolder[];
	selectedFolderId?: string;
	onFolderSelected: (id: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState("new");
	const [name, setName] = useState("");
	const [files, setFiles] = useState<File[]>([]);
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState("");
	const [error, setError] = useState("");
	const [report, setReport] = useState<string[]>([]);
	const cancelRef = useRef(false);
	const lockRef = useRef(false);
	const fileRef = useRef<HTMLInputElement>(null);
	const directoryRef = useRef<HTMLInputElement>(null);
	const openDialog = (createOnly: boolean) => {
		setMode(createOnly ? "new" : (selectedFolderId ?? folders[0]?.id ?? "new"));
		setName("");
		setFiles([]);
		setError("");
		setReport([]);
		setProgress("");
		setOpen(true);
	};
	const chooseFiles = (selected: FileList | null) => {
		setFiles(Array.from(selected ?? []));
		setError("");
		setReport([]);
	};
	const submit = async () => {
		if (lockRef.current) return;
		lockRef.current = true;
		cancelRef.current = false;
		setBusy(true);
		setError("");
		setReport([]);
		try {
			const existing = folders.find((f) => f.id === mode);
			const id = await createElementFolder({
				folderId: existing?.id,
				name: existing?.name ?? name,
			});
			onFolderSelected(id);
			if (!files.length) {
				toast.success("Atalho disponível em todos os projetos.");
				setOpen(false);
				return;
			}
			const result = await importLocalElements({
				folderId: id,
				files,
				onProgress: setProgress,
				cancelled: () => cancelRef.current,
			});
			const summary = `${result.imported} importados · ${result.duplicates} repetidos · ${result.failed.length} não importados${result.stopped ? " · interrompido" : ""}`;
			setProgress(summary);
			setReport(result.failed);
			setFiles([]);
			toast[result.failed.length ? "warning" : "success"](summary);
			if (!result.failed.length && !result.stopped) setOpen(false);
		} catch (e) {
			setError(
				e instanceof Error
					? e.message
					: "Não foi possível importar os elementos.",
			);
		} finally {
			setBusy(false);
			lockRef.current = false;
		}
	};
	return (
		<>
			<div className="flex gap-1">
				<Button
					size="sm"
					variant="outline"
					className="flex-1"
					onClick={() => openDialog(false)}
				>
					<Upload className="size-3.5" />
					Importar elementos
				</Button>
				<Button
					size="icon"
					variant="ghost"
					aria-label="Criar atalho de elementos"
					title="Criar atalho"
					onClick={() => openDialog(true)}
				>
					<FolderPlus className="size-4" />
				</Button>
			</div>
			<Dialog
				open={open}
				onOpenChange={(value) => {
					if (!busy) setOpen(value);
				}}
			>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Biblioteca do computador</DialogTitle>
						<DialogDescription>
							Escolha uma pasta ou crie um atalho para organizar suas imagens.
							Os arquivos ficam salvos neste computador e disponíveis em todos
							os projetos.
						</DialogDescription>
					</DialogHeader>
					<DialogBody>
						<label className="flex flex-col gap-2 text-sm">
							Salvar na pasta
							<select
								aria-label="Salvar na pasta"
								className="h-9 w-full rounded-md border bg-background px-3"
								value={mode}
								disabled={busy}
								onChange={(e) => setMode(e.target.value)}
							>
								{folders.map((f) => (
									<option key={f.id} value={f.id}>
										{f.name}
									</option>
								))}
								<option value="new">+ Criar novo atalho</option>
							</select>
						</label>
						{mode === "new" && (
							<label
								htmlFor="element-folder-name"
								className="flex flex-col gap-2 text-sm"
							>
								Nome do atalho
								<Input
									id="element-folder-name"
									aria-label="Nome do atalho"
									placeholder="Ex.: Emojis, PNG, Ícones"
									maxLength={48}
									value={name}
									disabled={busy}
									onChange={(e) => setName(e.target.value)}
								/>
							</label>
						)}
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={busy}
								onClick={() => fileRef.current?.click()}
							>
								<Upload />
								Selecionar arquivos
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={busy}
								onClick={() => directoryRef.current?.click()}
							>
								<FolderOpen />
								Selecionar pasta
							</Button>
						</div>
						<input
							ref={fileRef}
							type="file"
							aria-label="Arquivos de elementos"
							className="hidden"
							multiple
							accept=".png,.jpg,.jpeg,.webp,.svg"
							onChange={(e) => {
								chooseFiles(e.target.files);
								e.target.value = "";
							}}
						/>
						<input
							ref={directoryRef}
							type="file"
							aria-label="Pasta de elementos"
							className="hidden"
							multiple
							{...{ webkitdirectory: "" }}
							onChange={(e) => {
								chooseFiles(e.target.files);
								e.target.value = "";
							}}
						/>
						<p className="text-xs text-muted-foreground">
							PNG, JPG, WebP e SVG · até 30 MB por imagem e 500 arquivos por
							vez. Imagens repetidas na mesma pasta são ignoradas.
						</p>
						{files.length > 0 && (
							<p className="text-sm">
								{files.length} arquivo(s) selecionado(s)
							</p>
						)}
						{progress && (
							<p role="status" className="text-sm break-all">
								{progress}
							</p>
						)}
						{error && (
							<p role="alert" className="text-sm text-destructive">
								{error}
							</p>
						)}
						{report.length > 0 && (
							<ul className="max-h-32 overflow-auto text-xs text-muted-foreground">
								{report.map((line, i) => (
									<li key={`${i}-${line}`}>{line}</li>
								))}
							</ul>
						)}
					</DialogBody>
					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => {
								if (busy) cancelRef.current = true;
								else setOpen(false);
							}}
						>
							{busy ? "Interromper" : "Fechar"}
						</Button>
						<Button
							disabled={
								busy ||
								(mode === "new" && !name.trim()) ||
								(mode !== "new" && !files.length)
							}
							onClick={() => void submit()}
						>
							{busy
								? "Importando…"
								: files.length
									? "Importar na biblioteca"
									: "Criar atalho"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

export function LocalElementSection({
	folder,
	query,
	onSeeAll,
	previewOnly = false,
}: {
	folder: ElementFolder;
	query: string;
	onSeeAll?: () => void;
	previewOnly?: boolean;
}) {
	const editor = useEditor();
	const media = useLocalElementLibrary((s) => s.assets);
	const [limit, setLimit] = useState(60);
	const ids = new Set(folder.items.map((i) => i.mediaId));
	const images = media.filter(
		(a) =>
			a.type === "image" &&
			ids.has(a.id) &&
			a.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
	);
	if (query && images.length === 0) return null;
	return (
		<section
			className="flex flex-col gap-2 pb-4"
			aria-label={`Pasta ${folder.name}`}
		>
			<div className="flex items-center justify-between gap-2">
				<p
					className="min-w-0 truncate text-xs text-muted-foreground"
					title={folder.name}
				>
					{folder.name} <span className="opacity-70">· {images.length}</span>
				</p>
				{onSeeAll && (
					<Button
						variant="text"
						size="sm"
						className="text-xs text-primary"
						onClick={onSeeAll}
					>
						Ver tudo
					</Button>
				)}
			</div>
			{!images.length && (
				<p className="py-4 text-xs text-muted-foreground">
					Esta pasta está vazia. Use Importar elementos para adicionar imagens.
				</p>
			)}
			<div className="grid grid-cols-[repeat(auto-fill,minmax(75px,1fr))] gap-2">
				{images.slice(0, previewOnly ? 3 : limit).map((asset) => (
					<DraggableItem
						key={asset.id}
						name={asset.name}
						containerClassName="min-w-0 w-full"
						aspectRatio={1}
						shouldShowLabel
						preview={
							<div
								className="flex size-full items-center justify-center p-2"
								style={{
									backgroundImage:
										"conic-gradient(#ffffff12 25%, transparent 0 50%, #ffffff12 0 75%, transparent 0)",
									backgroundSize: "16px 16px",
								}}
							>
								<Image
									src={asset.thumbnailUrl ?? ""}
									alt={asset.name}
									width={100}
									height={100}
									unoptimized
									loading="lazy"
									className="size-full object-contain"
								/>
							</div>
						}
						dragData={{
							id: asset.id,
							libraryId: asset.id,
							type: "media",
							mediaType: "image",
							name: asset.name,
						}}
						onAddToTimeline={({ currentTime }) => {
							const sceneId = editor.scenes.getActiveScene().id;
							void attachLibraryElement({ editor, id: asset.id })
								.then((media) => {
									if (editor.scenes.getActiveScene().id !== sceneId) return;
									editor.timeline.insertElement({
										placement: { mode: "auto" },
										element: buildElementFromMedia({
											mediaId: media.id,
											mediaType: "image",
											name: media.name,
											duration: DEFAULT_NEW_ELEMENT_DURATION,
											startTime: currentTime,
										}),
									});
								})
								.catch((error: unknown) =>
									toast.error(
										error instanceof Error
											? error.message
											: "Falha ao adicionar o elemento.",
									),
								);
						}}
					/>
				))}
			</div>
			{!previewOnly && images.length > limit && (
				<Button
					variant="outline"
					size="sm"
					onClick={() => setLimit((v) => v + 60)}
				>
					Mostrar mais
				</Button>
			)}
		</section>
	);
}
