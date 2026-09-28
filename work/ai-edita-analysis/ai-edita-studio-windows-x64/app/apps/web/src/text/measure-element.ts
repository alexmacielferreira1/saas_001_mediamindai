import { CORNER_RADIUS_MIN } from "@/text/background";
import { DEFAULTS } from "@/timeline/defaults";
import type { TextElement } from "@/timeline";
import type { TextBackground } from "@/text/background";
import { resolveNumberAtTime } from "@/animation/values";
import {
	CAPTION_SAFE_MARGIN_RATIO,
	fitCaptionText,
	isGeneratedCaptionName,
} from "@/subtitles/caption-layout";
import {
	buildCaptionWordHighlightRichText,
	isSpotlightCaption,
} from "@/subtitles/word-highlight";
import { getTextVisualRect, setCanvasLetterSpacing } from "./layout";
import {
	measureTextLayout,
	resolveTextLayout,
	type MeasuredTextLayout,
	type TextAlign,
	type TextDecoration,
	type TextFontStyle,
	type TextFontWeight,
	type TextLayoutParams,
} from "./primitives";

export interface ResolvedTextBackground extends TextBackground {
	paddingX: number;
	paddingY: number;
	offsetX: number;
	offsetY: number;
	cornerRadius: number;
}

export interface MeasuredTextElement extends MeasuredTextLayout {
	resolvedBackground: ResolvedTextBackground;
	visualRect: { left: number; top: number; width: number; height: number };
}

let textMeasurementContext:
	| CanvasRenderingContext2D
	| OffscreenCanvasRenderingContext2D
	| null = null;

export function getTextMeasurementContext():
	| CanvasRenderingContext2D
	| OffscreenCanvasRenderingContext2D {
	if (textMeasurementContext) {
		return textMeasurementContext;
	}

	if (typeof OffscreenCanvas !== "undefined") {
		const canvas = new OffscreenCanvas(1, 1);
		const context = canvas.getContext("2d");
		if (context) {
			textMeasurementContext = context;
			return context;
		}
	}

	if (typeof document !== "undefined") {
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		if (context) {
			textMeasurementContext = context;
			return context;
		}
	}

	throw new Error("Failed to create text measurement context");
}

export function measureTextElement({
	element,
	canvasHeight,
	canvasWidth,
	transform,
	localTime,
	ctx,
}: {
	element: TextElement;
	canvasHeight: number;
	canvasWidth?: number;
	transform?: {
		position: { x: number; y: number };
		scaleX: number;
		scaleY: number;
		rotate: number;
	};
	localTime: number;
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}): MeasuredTextElement {
	let text = buildTextLayoutParamsFromElement({ element });
	text.revealProgress = resolveNumberAtTime({
		baseValue: Number(element.params.revealProgress ?? 1),
		animations: element.animations,
		propertyPath: "revealProgress",
		localTime,
	});
	if (canvasWidth && isGeneratedCaptionName({ name: element.name })) {
		const resolvedLayout = resolveTextLayout({ text, canvasHeight });
		const scaleX = Math.max(
			0.0001,
			Math.abs(
				transform?.scaleX ??
					(typeof element.params["transform.scaleX"] === "number"
						? element.params["transform.scaleX"]
						: 1),
			),
		);
		const positionX =
			transform?.position.x ??
			(typeof element.params["transform.positionX"] === "number"
				? element.params["transform.positionX"]
				: 0);
		const safeMargin = canvasWidth * CAPTION_SAFE_MARGIN_RATIO;
		const centerX = canvasWidth / 2 + positionX;
		const availableVisualWidth = Math.max(
			1,
			2 * Math.min(centerX - safeMargin, canvasWidth - safeMargin - centerX),
		);
		const background = buildTextBackgroundFromElement({ element });
		const horizontalPadding = background.enabled
			? 2 *
				(background.paddingX ?? DEFAULTS.text.background.paddingX) *
				resolvedLayout.fontSizeRatio
			: 0;
		const maxTextWidth = Math.max(
			1,
			availableVisualWidth / scaleX -
				horizontalPadding -
				resolvedLayout.outlineWidth * 2,
		);

		ctx.save();
		ctx.font = resolvedLayout.fontString;
		setCanvasLetterSpacing({
			ctx,
			letterSpacingPx: resolvedLayout.letterSpacing,
		});
		const fitted = fitCaptionText({
			content: text.content,
			maxWidth: maxTextWidth,
			measureLine: ({ text: line }) => ctx.measureText(line).width,
		});
		ctx.restore();

		text = {
			...text,
			content: fitted.content,
			fontSize: text.fontSize * fitted.fontScale,
			...(fitted.content !== text.content && { richText: undefined }),
		};
	}
	if (isSpotlightCaption({ name: element.name, params: element.params })) {
		const activeColor =
			typeof element.params["caption.highlightColor"] === "string"
				? element.params["caption.highlightColor"]
				: typeof element.params.color === "string"
					? element.params.color
					: "#b9f443";
		const inactiveColor =
			typeof element.params["caption.inactiveColor"] === "string"
				? element.params["caption.inactiveColor"]
				: "#ffffff";
		text.richText = buildCaptionWordHighlightRichText({
			content: text.content,
			fontSize: text.fontSize,
			progress:
				element.duration > 0
					? Math.max(0, Math.min(1, localTime / element.duration))
					: 0,
			wordTimings: element.params["caption.wordTimings"],
			activeColor,
			inactiveColor,
		});
	}
	const measuredLayout = measureTextLayout({
		text,
		canvasHeight,
		ctx,
	});

	const bg = buildTextBackgroundFromElement({ element });
	const resolvedBackground: ResolvedTextBackground = {
		...bg,
		paddingX: resolveNumberAtTime({
			baseValue: bg.paddingX ?? DEFAULTS.text.background.paddingX,
			animations: element.animations,
			propertyPath: "background.paddingX",
			localTime,
		}),
		paddingY: resolveNumberAtTime({
			baseValue: bg.paddingY ?? DEFAULTS.text.background.paddingY,
			animations: element.animations,
			propertyPath: "background.paddingY",
			localTime,
		}),
		offsetX: resolveNumberAtTime({
			baseValue: bg.offsetX ?? DEFAULTS.text.background.offsetX,
			animations: element.animations,
			propertyPath: "background.offsetX",
			localTime,
		}),
		offsetY: resolveNumberAtTime({
			baseValue: bg.offsetY ?? DEFAULTS.text.background.offsetY,
			animations: element.animations,
			propertyPath: "background.offsetY",
			localTime,
		}),
		cornerRadius: resolveNumberAtTime({
			baseValue: bg.cornerRadius ?? CORNER_RADIUS_MIN,
			animations: element.animations,
			propertyPath: "background.cornerRadius",
			localTime,
		}),
	};

	const visualRect = getTextVisualRect({
		textAlign: text.textAlign,
		block: measuredLayout.block,
		background: resolvedBackground,
		fontSizeRatio: measuredLayout.fontSizeRatio,
	});

	return {
		...measuredLayout,
		resolvedBackground,
		visualRect,
	};
}

export function buildTextLayoutParamsFromElement({
	element,
}: {
	element: TextElement;
}): TextLayoutParams {
	return {
		richText:
			typeof element.params.richText === "string"
				? element.params.richText
				: undefined,
		outlineColor: String(element.params.outlineColor ?? "#000000"),
		outlineWidth: Number(element.params.outlineWidth ?? 0),
		shadowColor: String(element.params.shadowColor ?? "#000000"),
		shadowBlur: Number(element.params.shadowBlur ?? 0),
		shadowOffsetX: Number(element.params.shadowOffsetX ?? 0),
		shadowOffsetY: Number(element.params.shadowOffsetY ?? 0),
		shadowOpacity: Number(element.params.shadowOpacity ?? 0),
		content: readStringParam({
			params: element.params,
			key: "content",
			fallback: "Default text",
		}),
		fontSize: readNumberParam({
			params: element.params,
			key: "fontSize",
			fallback: 15,
		}),
		fontFamily: readStringParam({
			params: element.params,
			key: "fontFamily",
			fallback: "Arial",
		}),
		fontWeight: readFontWeight({
			value: element.params.fontWeight,
			fallback: "normal",
		}),
		fontStyle: readFontStyle({
			value: element.params.fontStyle,
			fallback: "normal",
		}),
		textAlign: readTextAlign({
			value: element.params.textAlign,
			fallback: "center",
		}),
		textDecoration: readTextDecoration({
			value: element.params.textDecoration,
			fallback: "none",
		}),
		letterSpacing: readNumberParam({
			params: element.params,
			key: "letterSpacing",
			fallback: DEFAULTS.text.letterSpacing,
		}),
		lineHeight: readNumberParam({
			params: element.params,
			key: "lineHeight",
			fallback: DEFAULTS.text.lineHeight,
		}),
	};
}

export function buildTextBackgroundFromElement({
	element,
}: {
	element: TextElement;
}): TextBackground {
	return {
		enabled: readBooleanParam({
			params: element.params,
			key: "background.enabled",
			fallback: DEFAULTS.text.background.enabled,
		}),
		color: readStringParam({
			params: element.params,
			key: "background.color",
			fallback: DEFAULTS.text.background.color,
		}),
		cornerRadius: readNumberParam({
			params: element.params,
			key: "background.cornerRadius",
			fallback: DEFAULTS.text.background.cornerRadius,
		}),
		paddingX: readNumberParam({
			params: element.params,
			key: "background.paddingX",
			fallback: DEFAULTS.text.background.paddingX,
		}),
		paddingY: readNumberParam({
			params: element.params,
			key: "background.paddingY",
			fallback: DEFAULTS.text.background.paddingY,
		}),
		offsetX: readNumberParam({
			params: element.params,
			key: "background.offsetX",
			fallback: DEFAULTS.text.background.offsetX,
		}),
		offsetY: readNumberParam({
			params: element.params,
			key: "background.offsetY",
			fallback: DEFAULTS.text.background.offsetY,
		}),
	};
}

function readStringParam({
	params,
	key,
	fallback,
}: {
	params: TextElement["params"];
	key: string;
	fallback: string;
}): string {
	const value = params[key];
	return typeof value === "string" ? value : fallback;
}

function readNumberParam({
	params,
	key,
	fallback,
}: {
	params: TextElement["params"];
	key: string;
	fallback: number;
}): number {
	const value = params[key];
	return typeof value === "number" ? value : fallback;
}

function readBooleanParam({
	params,
	key,
	fallback,
}: {
	params: TextElement["params"];
	key: string;
	fallback: boolean;
}): boolean {
	const value = params[key];
	return typeof value === "boolean" ? value : fallback;
}

function readTextAlign({
	value,
	fallback,
}: {
	value: unknown;
	fallback: TextAlign;
}): TextAlign {
	return value === "left" || value === "center" || value === "right"
		? value
		: fallback;
}

function readFontWeight({
	value,
	fallback,
}: {
	value: unknown;
	fallback: TextFontWeight;
}): TextFontWeight {
	return value === "bold" || value === "normal" ? value : fallback;
}

function readFontStyle({
	value,
	fallback,
}: {
	value: unknown;
	fallback: TextFontStyle;
}): TextFontStyle {
	return value === "italic" || value === "normal" ? value : fallback;
}

function readTextDecoration({
	value,
	fallback,
}: {
	value: unknown;
	fallback: TextDecoration;
}): TextDecoration {
	return value === "none" || value === "underline" || value === "line-through"
		? value
		: fallback;
}
