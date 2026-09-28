import type { ElementAnimations } from "@/animation/types";
import { motionChannels } from "@/integrations/editorial-commands";
import { editorialPlan } from "@/integrations/editorial-engine";
import type { TextElement, TimelineElement } from "@/timeline";
import { mediaTimeToSeconds } from "@/wasm";
import {
	builtinCaptionStyleUsesMotion,
	getBuiltinCaptionStyle,
	type CaptionStyleId,
} from "./builtin-caption-styles";
import { buildSubtitleStyleParams } from "./build-subtitle-text-element";

const BUILTIN_MOTION_CHANNELS = [
	"transform.scaleX",
	"transform.scaleY",
	"opacity",
] as const;

type CaptionStyleEditor = {
	project: {
		getExportState: () => { isExporting: boolean };
	};
	timeline: {
		updateElements: (input: {
			updates: Array<{
				trackId: string;
				elementId: string;
				patch: Partial<TimelineElement>;
			}>;
		}) => void;
	};
};

export function removeBuiltinCaptionMotion({
	animations,
}: {
	animations: ElementAnimations | undefined;
}): ElementAnimations | undefined {
	if (!animations) return undefined;
	const remaining = { ...animations };
	for (const channel of BUILTIN_MOTION_CHANNELS) delete remaining[channel];
	return Object.keys(remaining).length > 0 ? remaining : undefined;
}

export async function applyBuiltinCaptionStyle({
	editor,
	targets,
	style,
}: {
	editor: CaptionStyleEditor;
	targets: Array<{ trackId: string; element: TextElement }>;
	style: CaptionStyleId;
}): Promise<void> {
	if (targets.length === 0) return;
	if (editor.project.getExportState().isExporting) {
		throw new Error("Aguarde a exportação terminar.");
	}

	const styleParams = buildSubtitleStyleParams({
		style: getBuiltinCaptionStyle({ style }),
	});
	styleParams["caption.style"] = style;
	styleParams["caption.highlightColor"] = "#b9f443";
	styleParams["caption.inactiveColor"] = "#ffffff";
	const useMotion = builtinCaptionStyleUsesMotion({ style });
	const updates = [];

	for (const { trackId, element } of targets) {
		const params = { ...element.params, ...styleParams };
		const remainingAnimations = removeBuiltinCaptionMotion({
			animations: element.animations,
		});
		let animations = remainingAnimations;
		if (useMotion) {
			const plan = await editorialPlan({
				kind: "motion",
				args: [mediaTimeToSeconds({ time: element.duration }), 4, 0.14],
			});
			animations = {
				...remainingAnimations,
				...motionChannels({ plan, params }),
			};
		}
		updates.push({
			trackId,
			elementId: element.id,
			patch: { params: styleParams, animations },
		});
	}

	editor.timeline.updateElements({ updates });
}
