import type { MaskableElement, VisualElement } from "./types";
import type { ParamValues } from "@/params";

interface BaseDragData {
	id: string;
	name: string;
}

export interface MediaDragData extends BaseDragData {
	type: "media";
	/** Shared local-library item, resolved on drop into native project media. */
	libraryId?: string;
	mediaType: "image" | "video" | "audio";
	targetElementTypes?: MaskableElement["type"][];
}

export interface TextDragData extends BaseDragData {
	type: "text";
	content: string;
}

export interface StickerDragData extends BaseDragData {
	type: "sticker";
	stickerId: string;
}

export interface GraphicDragData extends BaseDragData {
	type: "graphic";
	definitionId: string;
	params: Partial<ParamValues>;
}

export interface SoundDragData extends BaseDragData {
	type: "sound";
	/** URL served by the app: a built-in library effect or an online preview. */
	sourceUrl: string;
	/** Length in seconds, known before the file is fetched. */
	duration: number;
}

export interface EffectDragData extends BaseDragData {
	type: "effect";
	effectType: string;
	targetElementTypes: VisualElement["type"][];
}

export type TimelineDragData =
	| MediaDragData
	| TextDragData
	| StickerDragData
	| GraphicDragData
	| SoundDragData
	| EffectDragData;
