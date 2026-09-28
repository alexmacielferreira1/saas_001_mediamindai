"use client";

import { Check } from "lucide-react";
import { useI18n } from "@/i18n";
import {
	BUILTIN_CAPTION_STYLES,
	type CaptionStyleId,
} from "../builtin-caption-styles";

function BuiltinPreview({
	style,
	selected,
	onSelect,
	disabled,
	compact,
}: {
	style: (typeof BUILTIN_CAPTION_STYLES)[number];
	selected: boolean;
	onSelect: () => void;
	disabled: boolean;
	compact: boolean;
}) {
	const pt = useI18n().locale === "pt-BR";
	const name = style.name[pt ? 0 : 1];
	return (
		<button
			type="button"
			onClick={onSelect}
			disabled={disabled}
			aria-pressed={selected}
			title={name}
			className={
				"relative min-w-0 overflow-hidden border bg-card text-left transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60 " +
				(compact ? "rounded-md p-1" : "rounded-xl p-2") +
				(selected ? " border-primary ring-1 ring-primary" : "")
			}
		>
			<div
				className={
					"flex items-center justify-center overflow-hidden bg-[#0d130f] text-center " +
					(compact
						? "aspect-square rounded px-1"
						: "aspect-[4/3] rounded-lg px-2")
				}
			>
				<span
					className={
						"font-black tracking-tight text-white " +
						(compact ? "text-[7px] leading-tight" : "text-[10px]") +
						(style.id === "boxed"
							? compact
								? " rounded-sm bg-black px-1 py-0.5"
								: " rounded bg-black px-2 py-1"
							: "") +
						(style.id === "pulse" ? " scale-110 text-[#b9f443]" : "")
					}
				>
					{style.id === "spotlight" ? (
						<>
							PALAVRA <span className="text-[#b9f443]">FORTE</span>
						</>
					) : (
						style.preview
					)}
				</span>
			</div>
			<span
				className={
					"flex min-w-0 items-center justify-between font-medium " +
					(compact ? "mt-1 gap-0.5 text-[9px]" : "mt-2 text-[11px]")
				}
			>
				<span className="truncate">{name}</span>
				{selected && <Check className="size-3 shrink-0 text-primary" />}
			</span>
		</button>
	);
}

export function CaptionStyleGrid({
	value,
	onSelect,
	disabled = false,
	compact = false,
}: {
	value: CaptionStyleId | null;
	onSelect: (value: CaptionStyleId) => void;
	disabled?: boolean;
	compact?: boolean;
}) {
	return (
		<div
			className={
				compact ? "grid grid-cols-4 gap-1.5" : "grid grid-cols-2 gap-2"
			}
		>
			{BUILTIN_CAPTION_STYLES.map((style) => (
				<BuiltinPreview
					key={style.id}
					style={style}
					selected={value === style.id}
					onSelect={() => onSelect(style.id)}
					disabled={disabled}
					compact={compact}
				/>
			))}
		</div>
	);
}
