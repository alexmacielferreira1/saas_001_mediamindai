import type { TextCanvasContext, TextBlockMeasurement } from "@/text/layout";
import { DEFAULTS } from "@/timeline/defaults";
import { clamp } from "@/utils/math";
import { CORNER_RADIUS_MAX, CORNER_RADIUS_MIN } from "./background";
import {
	drawTextDecoration,
	getTextBackgroundRect,
	measureTextBlock,
	setCanvasLetterSpacing,
} from "./layout";
import { FONT_SIZE_SCALE_REFERENCE } from "./typography";
import { readRichRuns, type RichPaintRun } from "./rich-text";
import { quoteFamily } from "@/fonts/css";

export type TextAlign = "left" | "center" | "right";
export type TextFontWeight = "normal" | "bold";
export type TextFontStyle = "normal" | "italic";
export type TextDecoration = "none" | "underline" | "line-through";

export interface TextLayoutParams {
	revealProgress?: number;
	richText?: string;
	outlineColor?: string;
	outlineWidth?: number;
	shadowColor?: string;
	shadowBlur?: number;
	shadowOffsetX?: number;
	shadowOffsetY?: number;
	shadowOpacity?: number;
	content: string;
	fontSize: number;
	fontFamily: string;
	fontWeight: TextFontWeight;
	fontStyle: TextFontStyle;
	textAlign: TextAlign;
	textDecoration?: TextDecoration;
	letterSpacing?: number;
	lineHeight?: number;
}

export interface ResolvedTextLayout {
	revealProgress: number;
	outlineColor: string;
	outlineWidth: number;
	shadowColor: string;
	shadowBlur: number;
	shadowOffsetX: number;
	shadowOffsetY: number;
	shadowOpacity: number;
	scaledFontSize: number;
	fontString: string;
	letterSpacing: number;
	lineHeightPx: number;
	fontSizeRatio: number;
	textAlign: TextAlign;
	textDecoration: TextDecoration;
}

export interface MeasuredTextLayout extends ResolvedTextLayout {
	richLines?: RichPaintRun[][];
	lineWidths?: number[];
	lines: string[];
	lineMetrics: TextMetrics[];
	block: TextBlockMeasurement;
}

export interface ResolvedTextBackgroundLike {
	enabled: boolean;
	color: string;
	paddingX: number;
	paddingY: number;
	offsetX: number;
	offsetY: number;
	cornerRadius: number;
}

export function quoteFontFamily({
	fontFamily,
}: {
	fontFamily: string;
}): string {
	return quoteFamily(fontFamily);
}

export function buildTextFontString({
	fontFamily,
	fontWeight,
	fontStyle,
	scaledFontSize,
}: {
	fontFamily: string;
	fontWeight: TextFontWeight;
	fontStyle: TextFontStyle;
	scaledFontSize: number;
}): string {
	return `${fontStyle} ${fontWeight} ${scaledFontSize}px ${quoteFontFamily({ fontFamily })}, sans-serif`;
}

export function resolveTextLayout({
	text,
	canvasHeight,
}: {
	text: TextLayoutParams;
	canvasHeight: number;
}): ResolvedTextLayout {
	const scaledFontSize =
		text.fontSize * (canvasHeight / FONT_SIZE_SCALE_REFERENCE);
	const fontWeight = text.fontWeight === "bold" ? "bold" : "normal";
	const fontStyle = text.fontStyle === "italic" ? "italic" : "normal";
	const letterSpacing = text.letterSpacing ?? DEFAULTS.text.letterSpacing;
	const lineHeightPx =
		scaledFontSize * (text.lineHeight ?? DEFAULTS.text.lineHeight);
	const fontSizeRatio = text.fontSize / 15;

	return {
		scaledFontSize,
		revealProgress: Math.max(0, Math.min(1, text.revealProgress ?? 1)),
		outlineColor: text.outlineColor ?? "#000000",
		outlineWidth:
			(Math.max(0, text.outlineWidth ?? 0) * canvasHeight) /
			FONT_SIZE_SCALE_REFERENCE,
		shadowColor: text.shadowColor ?? "#000000",
		shadowBlur:
			(Math.max(0, text.shadowBlur ?? 0) * canvasHeight) /
			FONT_SIZE_SCALE_REFERENCE,
		shadowOffsetX:
			((text.shadowOffsetX ?? 0) * canvasHeight) / FONT_SIZE_SCALE_REFERENCE,
		shadowOffsetY:
			((text.shadowOffsetY ?? 0) * canvasHeight) / FONT_SIZE_SCALE_REFERENCE,
		shadowOpacity: Math.max(0, Math.min(1, text.shadowOpacity ?? 0)),
		fontString: buildTextFontString({
			fontFamily: text.fontFamily,
			fontWeight,
			fontStyle,
			scaledFontSize,
		}),
		letterSpacing,
		lineHeightPx,
		fontSizeRatio,
		textAlign: text.textAlign,
		textDecoration: text.textDecoration ?? "none",
	};
}

export function measureTextLayout({
	text,
	canvasHeight,
	ctx,
}: {
	text: TextLayoutParams;
	canvasHeight: number;
	ctx: TextCanvasContext;
}): MeasuredTextLayout {
	const resolvedLayout = resolveTextLayout({ text, canvasHeight });
	const lines = text.content.split("\n");

	ctx.save();
	ctx.font = resolvedLayout.fontString;
	ctx.textBaseline = "middle";
	setCanvasLetterSpacing({
		ctx,
		letterSpacingPx: resolvedLayout.letterSpacing,
	});
	const lineMetrics = lines.map((line) => ctx.measureText(line));
	const runs = readRichRuns({ raw: text.richText, content: text.content });
	let offset = 0;
	const richLines = runs.length
		? lines.map((line) => {
				const end = offset + line.length;
				const pieces: RichPaintRun[] = [];
				let cursor = offset;
				// eslint-disable-next-line opencut/prefer-object-params -- Local UTF-16 slice painter.
				const add = (a: number, b: number, size: number, color?: string) => {
					if (b <= a) return;
					const font = buildTextFontString({
						fontFamily: text.fontFamily,
						fontWeight: text.fontWeight,
						fontStyle: text.fontStyle,
						scaledFontSize: size,
					});
					ctx.font = font;
					const value = text.content.slice(a, b);
					pieces.push({
						text: value,
						size,
						color,
						font,
						width: ctx.measureText(value).width,
					});
				};
				for (const r of runs) {
					const a = Math.max(offset, r.start),
						b = Math.min(end, r.end);
					if (b <= a) continue;
					add(cursor, a, resolvedLayout.scaledFontSize);
					add(
						a,
						b,
						(r.fontSize * canvasHeight) / FONT_SIZE_SCALE_REFERENCE,
						r.color,
					);
					cursor = b;
				}
				add(cursor, end, resolvedLayout.scaledFontSize);
				offset = end + 1;
				return pieces;
			})
		: undefined;
	const lineWidths = richLines?.map((line) =>
		line.reduce((sum, r) => sum + r.width, 0),
	);
	if (richLines)
		resolvedLayout.lineHeightPx = Math.max(
			resolvedLayout.lineHeightPx,
			...richLines.flatMap((line) =>
				line.map((r) => r.size * (text.lineHeight ?? DEFAULTS.text.lineHeight)),
			),
		);
	ctx.restore();

	const block = measureTextBlock({
		lineMetrics,
		lineHeightPx: resolvedLayout.lineHeightPx,
	});
	if (lineWidths?.length) block.maxWidth = Math.max(...lineWidths);

	return {
		...resolvedLayout,
		lines,
		lineMetrics,
		richLines,
		lineWidths,
		block,
	};
}

export function drawMeasuredTextLayout({
	ctx,
	layout,
	textColor,
	background,
	backgroundColor,
	textBaseline = "middle",
}: {
	ctx: TextCanvasContext;
	layout: MeasuredTextLayout;
	textColor: string;
	background?: ResolvedTextBackgroundLike | null;
	backgroundColor?: string;
	textBaseline?: CanvasTextBaseline;
}): void {
	ctx.font = layout.fontString;
	ctx.textAlign = layout.textAlign;
	ctx.textBaseline = textBaseline;
	ctx.fillStyle = textColor;
	setCanvasLetterSpacing({ ctx, letterSpacingPx: layout.letterSpacing });

	if (
		background?.enabled &&
		backgroundColor &&
		backgroundColor !== "transparent" &&
		layout.lines.length > 0
	) {
		const backgroundRect = getTextBackgroundRect({
			textAlign: layout.textAlign,
			block: layout.block,
			background: {
				...background,
				color: backgroundColor,
			},
			fontSizeRatio: layout.fontSizeRatio,
		});
		if (backgroundRect) {
			const p =
				clamp({
					value: background.cornerRadius,
					min: CORNER_RADIUS_MIN,
					max: CORNER_RADIUS_MAX,
				}) / 100;
			const radius =
				(Math.min(backgroundRect.width, backgroundRect.height) / 2) * p;
			ctx.fillStyle = backgroundColor;
			ctx.beginPath();
			ctx.roundRect(
				backgroundRect.left,
				backgroundRect.top,
				backgroundRect.width,
				backgroundRect.height,
				radius,
			);
			ctx.fill();
			ctx.fillStyle = textColor;
		}
	}

	let remaining = Math.floor(
		layout.lines.reduce((n, line) => n + Array.from(line).length, 0) *
			layout.revealProgress,
	);
	for (let index = 0; index < layout.lines.length; index++) {
		const lineY = index * layout.lineHeightPx - layout.block.visualCenterOffset;
		ctx.save();
		if (layout.shadowOpacity > 0) {
			ctx.shadowColor = /^#[0-9a-f]{6}$/i.test(layout.shadowColor)
				? layout.shadowColor +
					Math.round(layout.shadowOpacity * 255)
						.toString(16)
						.padStart(2, "0")
				: layout.shadowColor;
			ctx.shadowBlur = layout.shadowBlur;
			ctx.shadowOffsetX = layout.shadowOffsetX;
			ctx.shadowOffsetY = layout.shadowOffsetY;
		}
		ctx.strokeStyle = layout.outlineColor;
		ctx.lineWidth = layout.outlineWidth * 2;
		ctx.lineJoin = "round";
		// eslint-disable-next-line opencut/prefer-object-params -- Mirrors Canvas fillText(text, x, y).
		const paint = (text: string, x: number) => {
			const chars = Array.from(text),
				visible = chars.slice(0, Math.max(0, remaining)).join("");
			remaining -= chars.length;
			if (layout.outlineWidth > 0) ctx.strokeText(visible, x, lineY);
			ctx.fillText(visible, x, lineY);
		};
		const rich = layout.richLines?.[index];
		if (rich) {
			const width = layout.lineWidths?.[index] ?? 0;
			let x =
				layout.textAlign === "center"
					? -width / 2
					: layout.textAlign === "right"
						? -width
						: 0;
			ctx.textAlign = "left";
			for (const run of rich) {
				ctx.font = run.font;
				ctx.fillStyle = run.color ?? textColor;
				paint(run.text, x);
				x += run.width;
			}
		} else {
			const width = layout.lineMetrics[index].width;
			const x =
				layout.textAlign === "center"
					? -width / 2
					: layout.textAlign === "right"
						? -width
						: 0;
			ctx.textAlign = "left";
			paint(layout.lines[index], x);
		}
		ctx.restore();
		drawTextDecoration({
			ctx,
			textDecoration:
				layout.revealProgress < 1 ? "none" : layout.textDecoration,
			lineWidth: layout.lineWidths?.[index] ?? layout.lineMetrics[index].width,
			lineY,
			metrics: layout.lineMetrics[index],
			scaledFontSize: layout.scaledFontSize,
			textAlign: layout.textAlign,
		});
	}
}

export function strokeMeasuredTextLayout({
	ctx,
	layout,
	strokeColor,
	strokeWidth,
	textBaseline = "middle",
}: {
	ctx: TextCanvasContext;
	layout: MeasuredTextLayout;
	strokeColor: string;
	strokeWidth: number;
	textBaseline?: CanvasTextBaseline;
}): void {
	ctx.font = layout.fontString;
	ctx.textAlign = layout.textAlign;
	ctx.textBaseline = textBaseline;
	ctx.strokeStyle = strokeColor;
	ctx.lineWidth = strokeWidth;
	ctx.lineJoin = "round";
	ctx.lineCap = "round";
	setCanvasLetterSpacing({ ctx, letterSpacingPx: layout.letterSpacing });

	for (let index = 0; index < layout.lines.length; index++) {
		const lineY = index * layout.lineHeightPx - layout.block.visualCenterOffset;
		ctx.strokeText(layout.lines[index], 0, lineY);
	}
}
