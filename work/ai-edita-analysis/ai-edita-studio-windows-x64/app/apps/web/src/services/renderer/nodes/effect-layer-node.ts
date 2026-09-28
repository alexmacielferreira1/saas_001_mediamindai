import type { EffectPass } from "@/effects/types";
import type { ParamValues } from "@/params";
import type { ElementAnimations } from "@/animation/types";
import type { RetimeConfig } from "@/timeline";
import type { Transform } from "@/rendering";
import { BaseNode } from "./base-node";

export type TransitionVisualSource = {
	kind: "video" | "image";
	mediaId: string;
	url: string;
	file: File;
	duration: number;
	timeOffset: number;
	trimStart: number;
	retime?: RetimeConfig;
	transform: Transform;
	animations?: ElementAnimations;
	opacity: number;
};

export type TransitionBinding = {
	cutTime: number;
	outgoing: TransitionVisualSource;
	incoming: TransitionVisualSource;
};

export type EffectLayerNodeParams = {
	effectType: string;
	effectParams: ParamValues;
	timeOffset: number;
	duration: number;
	transition?: TransitionBinding;
};

export type ResolvedEffectLayerNodeState = {
	passes: EffectPass[];
	transitionCanvas?: OffscreenCanvas;
};

export class EffectLayerNode extends BaseNode<
	EffectLayerNodeParams,
	ResolvedEffectLayerNodeState
> {}
