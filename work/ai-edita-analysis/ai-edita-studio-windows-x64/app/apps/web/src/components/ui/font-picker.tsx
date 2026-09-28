"use client";

import {
	useEffect,
	useState,
	useMemo,
	useRef,
	useCallback,
	type CSSProperties,
} from "react";
import { List, type RowComponentProps } from "react-window";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loadFullFont } from "@/fonts/google-fonts";
import { SYSTEM_FONTS } from "@/fonts/system-fonts";
import {
	ensurePresetFont,
	presetFontLabel,
	isPresetFont,
	usePresetFontFamilies,
} from "@/fonts/preset-fonts";
import type { FontAtlas, FontAtlasEntry } from "@/fonts/types";
import { useFontAtlas } from "@/fonts/use-font-atlas";
import { cssFontFamily } from "@/fonts/css";
import { cn } from "@/utils/ui";
import { ChevronDown, Search } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { TextIcon } from "@hugeicons/core-free-icons";
import { useI18n } from "@/i18n";

const FONT_TABS = ["all", "my-fonts", "favorites"] as const;

type FontTab = (typeof FONT_TABS)[number];

const ROW_HEIGHT = 52;
const PREVIEW_SCALE = 0.68;
const LIST_WIDTH = 352;
const MAX_LIST_HEIGHT = 288;
const OVERSCAN = 15;

interface FontPickerProps {
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	className?: string;
}

export function FontPicker({
	defaultValue,
	onValueChange,
	className,
}: FontPickerProps) {
	const pt = useI18n().locale === "pt-BR";
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [activeTab, setActiveTab] = useState<FontTab>("all");
	const presetFontFamilies = usePresetFontFamilies();
	const searchInputRef = useRef<HTMLInputElement>(null);
	const {
		atlas,
		status,
		fontNames,
		retry: handleRetry,
	} = useFontAtlas({ open });

	const filteredFonts = useMemo(() => {
		const families =
			activeTab === "my-fonts"
				? presetFontFamilies
				: activeTab === "favorites"
					? []
					: [
							...new Set([
								...presetFontFamilies,
								...SYSTEM_FONTS,
								...fontNames,
							]),
						];
		if (!search) return families;
		const query = search.toLowerCase();
		return families.filter((name) =>
			presetFontLabel({ family: name }).toLowerCase().includes(query),
		);
	}, [activeTab, fontNames, presetFontFamilies, search]);

	const listHeight = Math.min(
		MAX_LIST_HEIGHT,
		filteredFonts.length * ROW_HEIGHT,
	);
	const handleOpenChange = useCallback((next: boolean) => {
		setOpen(next);
		if (!next) {
			setSearch("");
			setActiveTab("all");
		}
	}, []);

	const handleSelect = useCallback(
		async ({ family }: { family: string }) => {
			if (isPresetFont(family)) {
				try {
					await ensurePresetFont({ family });
				} catch {
					// Keep the picker responsive; the renderer reports missing font data.
				}
			} else if (!SYSTEM_FONTS.has(family)) {
				try {
					await loadFullFont({ family });
				} catch {
					// ignore load failure, font will fall back to system default
				}
			}
			onValueChange?.(family);
			handleOpenChange(false);
		},
		[onValueChange, handleOpenChange],
	);

	const activeTabLabel =
		activeTab === "all"
			? pt
				? "todas as fontes"
				: "all fonts"
			: activeTab === "my-fonts"
				? pt
					? "minhas fontes"
					: "my fonts"
				: pt
					? "favoritas"
					: "favorites";
	const tabLabels: Record<FontTab, string> = {
		all: pt ? "Todas" : "All fonts",
		"my-fonts": pt ? "Minhas fontes" : "My fonts",
		favorites: pt ? "Favoritas" : "Favorites",
	};
	const previewText = pt ? "Aa Título" : "Aa Title";

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger
				className={cn(
					"border-border bg-accent flex h-7 w-full cursor-pointer items-center justify-between gap-1 rounded-md border px-2.5 text-sm whitespace-nowrap focus-visible:border-primary focus-visible:ring-0 focus:outline-hidden",
					className,
				)}
			>
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="text-muted-foreground [&_svg]:size-3.5 shrink-0">
						<HugeiconsIcon icon={TextIcon} />
					</span>
					<span
						className="truncate"
						style={{ fontFamily: cssFontFamily({ family: defaultValue }) }}
					>
						{defaultValue
							? presetFontLabel({ family: defaultValue })
							: pt
								? "Selecione uma fonte"
								: "Select a font"}
					</span>
				</div>
				<ChevronDown className="size-3 shrink-0 opacity-50" />
			</PopoverTrigger>
			<PopoverContent
				className="w-[22rem] p-0 overflow-hidden"
				align="start"
				side="left"
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					searchInputRef.current?.focus();
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					event.stopPropagation();
				}}
			>
				<div className="relative px-3 py-1.5">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 shrink-0 opacity-50" />
					<Input
						ref={searchInputRef}
						placeholder={`${pt ? "Pesquisar em" : "Search"} ${activeTabLabel}...`}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						size="xs"
						className="w-full pl-5 bg-transparent border-none! shadow-none!"
					/>
				</div>
				<div className="flex border-b px-3">
					{FONT_TABS.map((tab) => (
						<button
							key={tab}
							type="button"
							className={cn(
								"px-3 py-1.5 text-xs border-b-2 -mb-px",
								activeTab === tab
									? "border-foreground text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)}
							onClick={() => setActiveTab(tab)}
						>
							{tabLabels[tab]}
						</button>
					))}
				</div>
				{status === "loading" && presetFontFamilies.length === 0 && (
					<div className="py-8 text-center text-sm text-muted-foreground">
						{pt ? "Carregando fontes..." : "Loading fonts..."}
					</div>
				)}
				{status === "error" && presetFontFamilies.length === 0 && (
					<div className="flex flex-col items-center gap-3 py-8 px-4">
						<p className="text-sm text-muted-foreground text-center">
							{pt
								? "Não foi possível carregar as prévias."
								: "Failed to load font previews."}
						</p>
						<Button variant="outline" size="sm" onClick={handleRetry}>
							{pt ? "Tentar novamente" : "Retry"}
						</Button>
					</div>
				)}
				{status !== "loading" && filteredFonts.length === 0 && (
					<div className="py-6 text-center text-sm text-muted-foreground">
						{pt ? "Nenhuma fonte encontrada." : "No fonts found."}
					</div>
				)}
				{filteredFonts.length > 0 && (
					<List
						rowCount={filteredFonts.length}
						rowHeight={ROW_HEIGHT}
						overscanCount={OVERSCAN}
						rowComponent={FontRow}
						rowProps={{
							atlas,
							filteredFonts,
							selectedFont: defaultValue,
							onFontSelect: handleSelect,
							previewText,
						}}
						style={{ height: listHeight, width: LIST_WIDTH }}
					/>
				)}
			</PopoverContent>
		</Popover>
	);
}

function FontSpritePreview({ entry }: { entry: FontAtlasEntry }) {
	return (
		<div
			className="shrink-0"
			style={{
				width: entry.w,
				height: ROW_HEIGHT,
				backgroundColor: "currentColor",
				WebkitMaskImage: `url(/fonts/font-chunk-${entry.ch}.avif)`,
				WebkitMaskPosition: `-${entry.x}px -${entry.y}px`,
				WebkitMaskRepeat: "no-repeat",
				maskImage: `url(/fonts/font-chunk-${entry.ch}.avif)`,
				maskPosition: `-${entry.x}px -${entry.y}px`,
				maskRepeat: "no-repeat",
				transform: `scale(${PREVIEW_SCALE})`,
				transformOrigin: "left center",
			}}
		/>
	);
}

type FontRowProps = {
	atlas: FontAtlas | null;
	filteredFonts: string[];
	selectedFont: string | undefined;
	onFontSelect: (params: { family: string }) => void;
	previewText: string;
};

function FontRow({
	index,
	style,
	atlas,
	filteredFonts,
	selectedFont,
	onFontSelect,
	previewText,
}: RowComponentProps<FontRowProps>) {
	const fontName = filteredFonts[index];
	const entry = atlas?.fonts[fontName];
	const isSelected = fontName === selectedFont;
	const isLocalFont =
		SYSTEM_FONTS.has(fontName) || isPresetFont(fontName) || !entry;
	const label = presetFontLabel({ family: fontName });

	useEffect(() => {
		if (isPresetFont(fontName)) {
			void ensurePresetFont({ family: fontName }).catch(() => undefined);
		}
	}, [fontName]);

	return (
		<button
			type="button"
			style={style as CSSProperties}
			className={cn(
				"flex w-full cursor-pointer items-center gap-2 px-3 outline-hidden hover:bg-popover-hover",
				isSelected && "bg-popover-hover",
			)}
			onClick={() => onFontSelect({ family: fontName })}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onFontSelect({ family: fontName });
				}
			}}
			aria-label={label}
		>
			<span className="w-32 shrink-0 truncate text-left text-xs text-muted-foreground">
				{label}
			</span>
			<div className="min-w-0 flex-1 overflow-hidden text-left">
				{isLocalFont ? (
					<span
						className="block truncate text-xl text-foreground/85"
						style={{ fontFamily: cssFontFamily({ family: fontName }) }}
					>
						{previewText}
					</span>
				) : (
					<FontSpritePreview entry={entry} />
				)}
			</div>
		</button>
	);
}
