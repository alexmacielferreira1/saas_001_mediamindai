import type { EditorSelectionPatch } from "@/selection/editor-selection";
import type { ElementRef } from "@/timeline/types";

export interface CommandResult {
	selection?: EditorSelectionPatch;
}

export function createElementSelectionResult(
	selectedElements: ElementRef[],
): CommandResult {
	return {
		selection: {
			selectedElements,
			selectedKeyframes: [],
			keyframeSelectionAnchor: null,
			selectedMaskPoints: null,
		},
	};
}

export abstract class Command {
	// Commands that already perform synchronized ripple must not be rippled twice.
	public readonly handlesRipple: boolean = false;
	abstract execute(): CommandResult | undefined;

	undo(): void {
		throw new Error("Undo not implemented for this command");
	}

	redo(): CommandResult | undefined {
		return this.execute();
	}
}
