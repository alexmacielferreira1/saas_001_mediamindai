"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditor } from "@/editor/use-editor";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useSoundSearch } from "@/sounds/use-sound-search";
import { useSoundsStore } from "@/sounds/sounds-store";
import {
	filterLibrary,
	formatDuration,
	toSoundEffect,
	type LibrarySound,
} from "@/sounds/library";
import type { SavedSound, SoundEffect } from "@/sounds/types";
import { cn } from "@/utils/ui";
import { useI18n } from "@/i18n";
import {
	FavouriteIcon,
	PauseIcon,
	PlayIcon,
	PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function SoundsView() {
	const pt = useI18n().locale === "pt-BR";
	const { onlineSearch, checkOnlineSearch } = useSoundsStore();

	useEffect(() => {
		void checkOnlineSearch();
	}, [checkOnlineSearch]);

	return (
		<div className="flex h-full flex-col">
			<Tabs defaultValue="library" className="flex h-full flex-col">
				<div className="px-3 pt-4 pb-0">
					<TabsList>
						<TabsTrigger value="library">
							{pt ? "Biblioteca" : "Library"}
						</TabsTrigger>
						<TabsTrigger value="saved">
							{pt ? "Favoritos" : "Favourites"}
						</TabsTrigger>
						{onlineSearch === "on" && (
							<TabsTrigger value="online">
								{pt ? "Internet" : "Online"}
							</TabsTrigger>
						)}
					</TabsList>
				</div>
				<Separator className="my-4" />
				<TabsContent
					value="library"
					className="mt-0 flex min-h-0 flex-1 flex-col p-5 pt-0"
				>
					<LibraryView />
				</TabsContent>
				<TabsContent
					value="saved"
					className="mt-0 flex min-h-0 flex-1 flex-col p-5 pt-0"
				>
					<SavedSoundsView />
				</TabsContent>
				{onlineSearch === "on" && (
					<TabsContent
						value="online"
						className="mt-0 flex min-h-0 flex-1 flex-col p-5 pt-0"
					>
						<OnlineSearchView />
					</TabsContent>
				)}
			</Tabs>
		</div>
	);
}

/** One preview player for the whole panel: starting a sound stops the previous one. */
function useSoundPreview() {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [playingId, setPlayingId] = useState<number | null>(null);
	const [progress, setProgress] = useState(0);

	const stop = useCallback(() => {
		audioRef.current?.pause();
		audioRef.current = null;
		setPlayingId(null);
		setProgress(0);
	}, []);

	useEffect(() => stop, [stop]);

	const toggle = useCallback(
		({ sound }: { sound: { id: number; previewUrl?: string } }) => {
			if (playingId === sound.id) {
				stop();
				return;
			}
			audioRef.current?.pause();
			if (!sound.previewUrl) return;
			const audio = new Audio(sound.previewUrl);
			audio.addEventListener("timeupdate", () =>
				setProgress(audio.duration ? audio.currentTime / audio.duration : 0),
			);
			audio.addEventListener("ended", stop);
			audio.addEventListener("error", stop);
			void audio.play().catch(stop);
			audioRef.current = audio;
			setPlayingId(sound.id);
			setProgress(0);
		},
		[playingId, stop],
	);

	return { playingId, progress, toggle };
}

function LibraryView() {
	const pt = useI18n().locale === "pt-BR";
	const {
		library,
		libraryCategories,
		libraryStatus,
		libraryError,
		loadLibrary,
		loadSavedSounds,
	} = useSoundsStore();
	const [category, setCategory] = useState("");
	const [query, setQuery] = useState("");
	const preview = useSoundPreview();

	useEffect(() => {
		void loadLibrary();
		void loadSavedSounds();
	}, [loadLibrary, loadSavedSounds]);

	const shown = useMemo(
		() => filterLibrary({ sounds: library, category, query }),
		[library, category, query],
	);
	const counts = useMemo(() => {
		const totals = new Map<string, number>();
		for (const sound of library)
			totals.set(sound.category, (totals.get(sound.category) ?? 0) + 1);
		return totals;
	}, [library]);
	const selected = libraryCategories.find((item) => item.id === category);

	if (libraryStatus === "error") {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-3 text-center">
				<p className="text-sm font-medium">
					{pt
						? "Não foi possível abrir a biblioteca de sons."
						: "Could not open the sound library."}
				</p>
				<p className="text-muted-foreground text-xs">{libraryError}</p>
				<Button size="sm" variant="outline" onClick={() => void loadLibrary()}>
					{pt ? "Tentar de novo" : "Try again"}
				</Button>
			</div>
		);
	}

	return (
		<div className="mt-1 flex h-full flex-col gap-4">
			<Input
				placeholder={
					pt ? "Buscar efeito, ex.: whoosh" : "Search effects, e.g. whoosh"
				}
				className="w-full"
				containerClassName="w-full"
				value={query}
				onChange={({ currentTarget }) => setQuery(currentTarget.value)}
				showClearIcon
				onClear={() => setQuery("")}
			/>
			{/* Wrapping keeps every category reachable: a horizontal strip in a narrow
			    panel hides half of them behind a scrollbar. */}
			<div className="flex flex-wrap gap-1.5">
				<CategoryChip
					label={pt ? "Todos" : "All"}
					count={library.length}
					isActive={category === ""}
					onClick={() => setCategory("")}
				/>
				{libraryCategories.map((item) => (
					<CategoryChip
						key={item.id}
						label={item.name}
						count={counts.get(item.id) ?? 0}
						isActive={category === item.id}
						onClick={() => setCategory(item.id)}
					/>
				))}
			</div>
			<p className="text-muted-foreground -mt-1 text-xs">
				{selected
					? selected.description
					: pt
						? "Efeitos próprios do AI Edita. Arraste para a linha do tempo ou use +."
						: "AI Edita's own effects. Drag them to the timeline or use +."}
			</p>

			<div className="relative h-full overflow-hidden">
				<ScrollArea className="h-full flex-1">
					<div className="flex flex-col gap-1 pr-2">
						{libraryStatus !== "ready" &&
							Array.from({ length: 6 }, (_, index) => (
								<div
									key={index}
									className="bg-accent/40 h-12 w-full animate-pulse rounded-md"
								/>
							))}
						{libraryStatus === "ready" && shown.length === 0 && (
							<p className="text-muted-foreground py-6 text-center text-sm">
								{pt
									? "Nenhum efeito com esse nome."
									: "No effect matches that search."}
							</p>
						)}
						{shown.map((sound) => (
							<LibraryRow
								key={sound.libraryId}
								sound={sound}
								isPlaying={preview.playingId === sound.id}
								progress={preview.playingId === sound.id ? preview.progress : 0}
								onToggle={preview.toggle}
							/>
						))}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}

function CategoryChip({
	label,
	count,
	isActive,
	onClick,
}: {
	label: string;
	count: number;
	isActive: boolean;
	onClick: () => void;
}) {
	return (
		<Button
			type="button"
			variant={isActive ? "default" : "outline"}
			size="sm"
			className="shrink-0"
			onClick={onClick}
		>
			{label}
			<span
				className={cn(
					"ml-1.5 text-[0.7rem]",
					isActive ? "opacity-70" : "text-muted-foreground",
				)}
			>
				{count}
			</span>
		</Button>
	);
}

function Waveform({
	peaks,
	progress,
	isPlaying,
}: {
	peaks: number[];
	progress: number;
	isPlaying: boolean;
}) {
	const bars = peaks.length > 0 ? peaks : Array.from({ length: 24 }, () => 0.2);
	return (
		<span className="flex h-7 flex-1 items-center gap-[2px] overflow-hidden">
			{bars.map((peak, index) => {
				const played = isPlaying && index / bars.length <= progress;
				return (
					<span
						key={index}
						className={cn(
							"w-full rounded-full transition-colors",
							played ? "bg-primary" : "bg-muted-foreground/40",
						)}
						// Square root, like a level meter: quiet parts stay visible instead of
						// collapsing into a flat line next to the loudest hit.
						style={{ height: `${Math.max(14, Math.sqrt(peak) * 100)}%` }}
					/>
				);
			})}
		</span>
	);
}

function LibraryRow({
	sound,
	isPlaying,
	progress,
	onToggle,
}: {
	sound: LibrarySound;
	isPlaying: boolean;
	progress: number;
	onToggle: ({ sound }: { sound: { id: number; previewUrl?: string } }) => void;
}) {
	const effect = useMemo(() => toSoundEffect(sound), [sound]);
	return (
		<SoundRow
			effect={effect}
			peaks={sound.peaks}
			isPlaying={isPlaying}
			progress={progress}
			onToggle={onToggle}
		/>
	);
}

function SoundRow({
	effect,
	peaks,
	isPlaying,
	progress,
	onToggle,
	subtitle,
}: {
	effect: SoundEffect;
	peaks: number[];
	isPlaying: boolean;
	progress: number;
	onToggle: ({ sound }: { sound: { id: number; previewUrl?: string } }) => void;
	subtitle?: string;
}) {
	const pt = useI18n().locale === "pt-BR";
	const editor = useEditor();
	const { addSoundToTimeline, isSoundSaved, toggleSavedSound } =
		useSoundsStore();
	const [isAdding, setIsAdding] = useState(false);
	const isSaved = isSoundSaved({ soundId: effect.id });

	const add = async () => {
		setIsAdding(true);
		const added = await addSoundToTimeline({ sound: effect });
		setIsAdding(false);
		if (added) {
			toast.success(
				pt
					? `"${effect.name}" na linha do tempo`
					: `"${effect.name}" added to the timeline`,
				{ id: `sound-added-${effect.id}` },
			);
		}
	};

	return (
		<div
			className="group hover:bg-accent/40 flex items-center gap-3 rounded-md p-1.5 transition-colors"
			draggable={Boolean(effect.previewUrl)}
			onDragStart={(event) => {
				if (!effect.previewUrl) return;
				editor.timeline.dragSource.begin({
					dataTransfer: event.dataTransfer,
					dragData: {
						type: "sound",
						id: String(effect.id),
						name: effect.name,
						sourceUrl: effect.previewUrl,
						duration: effect.duration,
					},
				});
			}}
			onDragEnd={() => editor.timeline.dragSource.end()}
		>
			<button
				type="button"
				className="bg-accent text-foreground flex size-9 shrink-0 items-center justify-center rounded-md"
				onClick={() => onToggle({ sound: effect })}
				aria-label={pt ? `Ouvir ${effect.name}` : `Preview ${effect.name}`}
			>
				<HugeiconsIcon
					icon={isPlaying ? PauseIcon : PlayIcon}
					className="size-4"
				/>
			</button>

			<button
				type="button"
				className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
				onClick={() => onToggle({ sound: effect })}
			>
				<span className="flex items-baseline gap-2">
					<span className="truncate text-sm font-medium">{effect.name}</span>
					<span className="text-muted-foreground shrink-0 text-[0.7rem]">
						{formatDuration(effect.duration)}
					</span>
				</span>
				<span className="flex items-center gap-2">
					<Waveform peaks={peaks} progress={progress} isPlaying={isPlaying} />
					{subtitle && (
						<span className="text-muted-foreground shrink-0 truncate text-[0.7rem]">
							{subtitle}
						</span>
					)}
				</span>
			</button>

			<div className="flex shrink-0 items-center">
				<Button
					variant="text"
					size="icon"
					className="text-muted-foreground hover:text-foreground w-auto !opacity-100"
					onClick={() => void add()}
					disabled={isAdding}
					title={pt ? "Adicionar no cursor" : "Add at the playhead"}
				>
					<HugeiconsIcon icon={PlusSignIcon} />
				</Button>
				<Button
					variant="text"
					size="icon"
					className={cn(
						"hover:text-foreground w-auto !opacity-100",
						isSaved
							? "text-red-500 hover:text-red-600"
							: "text-muted-foreground",
					)}
					onClick={() => void toggleSavedSound({ soundEffect: effect })}
					title={
						isSaved
							? pt
								? "Remover dos favoritos"
								: "Remove from favourites"
							: pt
								? "Salvar nos favoritos"
								: "Save to favourites"
					}
				>
					<HugeiconsIcon
						icon={FavouriteIcon}
						className={isSaved ? "fill-current" : ""}
					/>
				</Button>
			</div>
		</div>
	);
}

function savedToEffect({ saved }: { saved: SavedSound }): SoundEffect {
	return {
		id: saved.id,
		libraryId: saved.libraryId,
		category: saved.category,
		peaks: saved.peaks,
		name: saved.name,
		description: "",
		url: "",
		previewUrl: saved.previewUrl,
		downloadUrl: saved.downloadUrl,
		duration: saved.duration,
		filesize: 0,
		type: "audio",
		channels: 0,
		bitrate: 0,
		bitdepth: 0,
		samplerate: 0,
		username: saved.username,
		tags: saved.tags,
		license: saved.license,
		created: saved.savedAt,
		downloads: 0,
		rating: 0,
		ratingCount: 0,
	};
}

function SavedSoundsView() {
	const pt = useI18n().locale === "pt-BR";
	const {
		savedSounds,
		isLoadingSavedSounds,
		savedSoundsError,
		loadSavedSounds,
		clearSavedSounds,
	} = useSoundsStore();
	const preview = useSoundPreview();
	const [showClearDialog, setShowClearDialog] = useState(false);

	useEffect(() => {
		void loadSavedSounds();
	}, [loadSavedSounds]);

	if (isLoadingSavedSounds) {
		return (
			<p className="text-muted-foreground flex h-full items-center justify-center text-sm">
				{pt ? "Abrindo seus favoritos…" : "Opening your favourites…"}
			</p>
		);
	}

	if (savedSoundsError) {
		return (
			<p className="text-destructive flex h-full items-center justify-center text-sm">
				{savedSoundsError}
			</p>
		);
	}

	if (savedSounds.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
				<HugeiconsIcon
					icon={FavouriteIcon}
					className="text-muted-foreground size-10"
				/>
				<p className="text-lg font-medium">
					{pt ? "Nenhum favorito ainda" : "No favourites yet"}
				</p>
				<p className="text-muted-foreground text-sm text-balance">
					{pt
						? "Toque no coração de um efeito para guardá-lo aqui."
						: "Tap the heart on any effect to keep it here."}
				</p>
			</div>
		);
	}

	return (
		<div className="mt-1 flex h-full flex-col gap-4">
			<div className="flex items-center justify-between">
				<p className="text-muted-foreground text-sm">
					{savedSounds.length}{" "}
					{pt
						? savedSounds.length === 1
							? "favorito"
							: "favoritos"
						: savedSounds.length === 1
							? "favourite"
							: "favourites"}
				</p>
				<Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
					<DialogTrigger asChild>
						<Button
							variant="text"
							size="sm"
							className="text-muted-foreground hover:text-destructive h-auto !opacity-100"
						>
							{pt ? "Limpar" : "Clear all"}
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{pt ? "Limpar seus favoritos?" : "Clear all favourites?"}
							</DialogTitle>
							<DialogDescription>
								{pt
									? `Isso remove os ${savedSounds.length} sons salvos. Os efeitos continuam na biblioteca.`
									: `This removes all ${savedSounds.length} saved sounds. The effects stay in the library.`}
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button variant="text" onClick={() => setShowClearDialog(false)}>
								{pt ? "Cancelar" : "Cancel"}
							</Button>
							<Button
								variant="destructive"
								onClick={async () => {
									await clearSavedSounds();
									setShowClearDialog(false);
								}}
							>
								{pt ? "Limpar favoritos" : "Clear favourites"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			<div className="relative h-full overflow-hidden">
				<ScrollArea className="h-full flex-1">
					<div className="flex flex-col gap-1 pr-2">
						{savedSounds.map((saved) => (
							<SoundRow
								key={saved.id}
								effect={savedToEffect({ saved })}
								peaks={saved.peaks ?? []}
								isPlaying={preview.playingId === saved.id}
								progress={preview.playingId === saved.id ? preview.progress : 0}
								onToggle={preview.toggle}
								subtitle={saved.libraryId ? undefined : saved.username}
							/>
						))}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}

function OnlineSearchView() {
	const pt = useI18n().locale === "pt-BR";
	const { searchQuery, setSearchQuery, showCommercialOnly } = useSoundsStore();
	const { results, isLoading, error, loadMore, hasNextPage, isLoadingMore } =
		useSoundSearch({
			query: searchQuery,
			commercialOnly: showCommercialOnly,
		});
	const preview = useSoundPreview();
	const { scrollAreaRef, handleScroll } = useInfiniteScroll({
		onLoadMore: loadMore,
		hasMore: hasNextPage,
		isLoading: isLoadingMore || isLoading,
	});

	return (
		<div className="mt-1 flex h-full flex-col gap-4">
			<Input
				placeholder={pt ? "Buscar no Freesound" : "Search Freesound"}
				className="w-full"
				containerClassName="w-full"
				value={searchQuery}
				onChange={({ currentTarget }) =>
					setSearchQuery({ query: currentTarget.value })
				}
				showClearIcon
				onClear={() => setSearchQuery({ query: "" })}
			/>
			<p className="text-muted-foreground -mt-1 text-xs">
				{pt
					? "Sons de terceiros, com a licença de cada autor. Confira antes de publicar."
					: "Third-party sounds, each under its author's licence. Check before publishing."}
			</p>
			<div className="relative h-full overflow-hidden">
				<ScrollArea
					className="h-full flex-1"
					ref={scrollAreaRef}
					onScrollCapture={handleScroll}
				>
					<div className="flex flex-col gap-1 pr-2">
						{error && <p className="text-destructive text-sm">{error}</p>}
						{isLoading && (
							<p className="text-muted-foreground text-sm">
								{pt ? "Procurando…" : "Searching…"}
							</p>
						)}
						{!isLoading && !error && searchQuery && results.length === 0 && (
							<p className="text-muted-foreground text-sm">
								{pt ? "Nada encontrado." : "Nothing found."}
							</p>
						)}
						{results.map((sound) => (
							<SoundRow
								key={sound.id}
								effect={sound}
								peaks={[]}
								isPlaying={preview.playingId === sound.id}
								progress={preview.playingId === sound.id ? preview.progress : 0}
								onToggle={preview.toggle}
								subtitle={sound.username}
							/>
						))}
						{isLoadingMore && (
							<p className="text-muted-foreground py-4 text-center text-sm">
								{pt ? "Carregando mais…" : "Loading more…"}
							</p>
						)}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}
