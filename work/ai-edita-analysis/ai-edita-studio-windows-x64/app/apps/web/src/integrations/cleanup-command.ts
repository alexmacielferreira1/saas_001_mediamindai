import type { EditorCore } from "@/core";
import { Command, createElementSelectionResult } from "@/commands/base-command";
import { SplitElementsCommand } from "@/commands/timeline/element/split-elements";
import { DeleteElementsCommand } from "@/commands/timeline/element/delete-elements";
import { UpdateElementsCommand } from "@/commands/timeline/element/update-elements";
import { mediaTimeFromSeconds, mediaTimeToSeconds } from "@/wasm";
import type { createCutMapper } from "./audio-engine";

// One history entry composing existing editor commands. Source trims/retiming stay in the native engine.
export class AudioCleanupCommand extends Command {
	public readonly handlesRipple = true;
	private before: ReturnType<EditorCore["scenes"]["getActiveScene"]>;
	private after: typeof this.before | null = null;
	private editor: EditorCore;
	private mapper: Awaited<ReturnType<typeof createCutMapper>>;
	constructor({
		editor,
		mapper,
	}: {
		editor: EditorCore;
		mapper: Awaited<ReturnType<typeof createCutMapper>>;
	}) {
		super();
		this.editor = editor;
		this.mapper = mapper;
		this.before = editor.scenes.getActiveScene();
	}
	private restore(scene: typeof this.before) {
		this.editor.scenes.setScenes({
			scenes: this.editor.scenes
				.getScenes()
				.map((current) => (current.id === scene.id ? scene : current)),
			activeSceneId: scene.id,
		});
	}
	private elements() {
		const { main, overlay, audio } = this.editor.scenes.getActiveScene().tracks;
		return [main, ...overlay, ...audio].flatMap((track) =>
			track.elements.map((element) => ({
				trackId: track.id,
				elementId: element.id,
				element,
			})),
		);
	}
	execute() {
		try {
			for (const seconds of [...new Set(this.mapper.cuts)].sort(
				(a, b) => b - a,
			)) {
				new SplitElementsCommand({
					elements: this.elements(),
					splitTime: mediaTimeFromSeconds({ seconds }),
				}).execute();
			}
			new DeleteElementsCommand({
				elements: this.elements().filter(({ element }) =>
					this.mapper.removed(
						mediaTimeToSeconds({ time: element.startTime }) +
							mediaTimeToSeconds({ time: element.duration }) / 2,
					),
				),
			}).execute();
			new UpdateElementsCommand({
				updates: this.elements().map(({ trackId, elementId, element }) => ({
					trackId,
					elementId,
					patch: {
						startTime: mediaTimeFromSeconds({
							seconds: this.mapper.map(
								mediaTimeToSeconds({ time: element.startTime }),
							),
						}),
					},
				})),
			}).execute();
			const bookmarks = this.before.bookmarks.map((bookmark) => {
				const start = mediaTimeToSeconds({ time: bookmark.time });
				return {
					...bookmark,
					time: mediaTimeFromSeconds({ seconds: this.mapper.map(start) }),
					...(bookmark.duration === undefined
						? {}
						: {
								duration: mediaTimeFromSeconds({
									seconds:
										this.mapper.map(
											start + mediaTimeToSeconds({ time: bookmark.duration }),
										) - this.mapper.map(start),
								}),
							}),
				};
			});
			this.after = { ...this.editor.scenes.getActiveScene(), bookmarks };
			this.restore(this.after);
			return createElementSelectionResult([]);
		} catch (error) {
			this.restore(this.before);
			throw error;
		}
	}
	undo() {
		this.restore(this.before);
	}
	redo() {
		if (this.after) this.restore(this.after);
		return createElementSelectionResult([]);
	}
}
