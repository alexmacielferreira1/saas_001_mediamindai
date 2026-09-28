import type { EditorCore } from "@/core";
import { InsertElementCommand } from "@/commands/timeline/element/insert-element";
import { BatchCommand } from "@/commands/batch-command";
import {
	buildElementFromMedia,
	buildTextElement,
} from "@/timeline/element-utils";
import { buildLibraryAudioFromUrl } from "@/timeline/library-audio";
import { filterLibrary, loadSoundLibrary } from "@/sounds/library";
import type { CreateTimelineElement, TimelineElement } from "@/timeline";
import { mediaTimeFromSeconds, mediaTimeToSeconds } from "@/wasm";
import { schemas, type ToolName } from "./catalog";
import {
	analyzeTimeline,
	applyCleanup,
	transcribeTimeline,
	generateCaptions,
	generateStyledCaptions,
	duckMusic,
	getOperation,
	cancelOperation,
	exportVideo,
	importWorkspaceAsset,
	useOperationStore,
} from "./operations";
import { effectsRegistry } from "@/effects";
import {
	applyMotion,
	applyColorGrade,
	animateElement,
	setClipSpeed,
	setClipsSpeed,
	editGuard,
} from "./editorial-commands";
import { coerceParamValue } from "@/params";
import {
	applyModel,
	applyModelStyle,
	applyModelToCaptions,
} from "@/templates/commands";
import { getModels, getModel } from "@/templates/store";
import { modelWarningLabels } from "@/templates/contract";
import { captureTimelineFrames } from "./vision";
import { applyEditingTemplate, getEditingTemplateContext, listEditingTemplates } from "@/templates/editing-commands";
import { buildRemotionSnapshot } from "@/remotion/snapshot";
import { enqueueRemotionRender } from "@/remotion/client";
import { HttpFileStorageAdapter } from "@/services/storage/http-adapter";

export function editorSnapshot({
	editor,
	options = {},
}: {
	editor: EditorCore;
	options?: {
		offset?: number;
		limit?: number;
		trackId?: string;
		includeAnimations?: boolean;
	};
}) {
	const project = editor.project.getActive();
	const scene = editor.scenes.getActiveScene();
	const tracks = [
		scene.tracks.main,
		...scene.tracks.overlay,
		...scene.tracks.audio,
	];
	const candidates = tracks
		.filter((t) => !options.trackId || options.trackId === t.id)
		.flatMap<TimelineElement>((t) => t.elements);
	const offset = options.offset ?? 0,
		limit = options.limit ?? 30;
	const visible = new Set(
		candidates.slice(offset, offset + limit).map((e) => e.id),
	);
	return {
		totalElementCount: tracks.reduce((n, t) => n + t.elements.length, 0),
		matchingElementCount: candidates.length,
		nextOffset: offset + limit < candidates.length ? offset + limit : null,
		project: {
			id: project.metadata.id,
			name: project.metadata.name,
			canvas: project.settings.canvasSize,
		},
		scene: { id: scene.id, name: scene.name },
		durationSeconds: mediaTimeToSeconds({
			time: editor.timeline.getTotalDuration(),
		}),
		canUndo: editor.command.canUndo(),
		canRedo: editor.command.canRedo(),
		operations: useOperationStore
			.getState()
			.operations.map(({ id, status, kind, progress }) => ({
				operationId: id,
				status,
				kind,
				progress,
			})),
		cleanupPlans: useOperationStore
			.getState()
			.plans.map(({ id, applied, candidates }) => ({
				cleanupPlanId: id,
				applied,
				candidateCount: candidates.length,
			})),
		rippleEditing: editor.command.isRippleEnabled,
		tracks: tracks
			.filter((t) => !options.trackId || options.trackId === t.id)
			.map((track) => ({
				id: track.id,
				name: track.name,
				type: track.type,
				elementCount: track.elements.length,
				elements: track.elements
					.filter((element) => visible.has(element.id))
					.map((element) => ({
						id: element.id,
						type: element.type,
						name: element.name,
						startSeconds: mediaTimeToSeconds({ time: element.startTime }),
						durationSeconds: mediaTimeToSeconds({ time: element.duration }),
						trimStartSeconds: mediaTimeToSeconds({ time: element.trimStart }),
						trimEndSeconds: mediaTimeToSeconds({ time: element.trimEnd }),
						mediaId: "mediaId" in element ? element.mediaId : undefined,
						params: element.params,
						animations: options.includeAnimations
							? element.animations
							: undefined,
						animatedProperties: Object.keys(element.animations ?? {}),
						effects: "effects" in element ? element.effects : undefined,
						retime: "retime" in element ? element.retime : undefined,
					})),
			})),
	};
}

// This adapter delegates all edits/time conversion to existing EditorCore commands.
export async function executeEditorTool({
	editor,
	name,
	input,
	source = "local",
}: {
	editor: EditorCore;
	name: ToolName;
	input: unknown;
	source?: "MCP" | "OpenAI" | "local";
}) {
	if (name === "inspect_frames")
		return captureTimelineFrames({ editor, input });
	function find(ref: { trackId: string; elementId: string }) {
		const match = editor.timeline.getElementsWithTracks({ elements: [ref] })[0];
		if (!match)
			throw new Error(
				"Clip not found in the active scene. Read the editor state again.",
			);
		return match;
	}
	function insert(element: CreateTimelineElement) {
		const command = new InsertElementCommand({
			element,
			placement: { mode: "auto" },
		});
		editor.command.execute({ command });
		const trackId = command.getTrackId();
		if (!trackId) throw new Error("The editor rejected this insertion.");
		return {
			trackId,
			elementId: command.getElementId(),
			state: editorSnapshot({ editor }),
		};
	}
	switch (name) {
		case "list_editing_templates":
			return listEditingTemplates();
		case "get_editing_template_context":
			return getEditingTemplateContext({ editor, ...schemas.get_editing_template_context.parse(input) });
		case "apply_editing_template":
			return { ...(await applyEditingTemplate({ editor, input, source })), state: editorSnapshot({ editor }) };
		case "apply_template_to_captions":
			return {
				...(await applyModelToCaptions({ editor, input, source })),
				state: editorSnapshot({ editor }),
			};
		case "list_templates": {
			const args = schemas.list_templates.parse(input);
			const query = (args.query ?? "").toLocaleLowerCase();
			const all = (await getModels()).filter((t) =>
				(t.name + " " + t.category + " " + t.source)
					.toLocaleLowerCase()
					.includes(query),
			);
			const offset = args.offset ?? 0,
				limit = args.limit ?? 20;
			return {
				total: all.length,
				nextOffset: offset + limit < all.length ? offset + limit : null,
				templates: all.slice(offset, offset + limit).map((t) => ({
					id: t.id,
					name: t.name,
					category: t.category,
					source: t.source,
					duration: t.duration,
					layers: t.layers.length,
					adaptations: t.warnings.length,
				})),
			};
		}
		case "get_template": {
			const args = schemas.get_template.parse(input);
			const t = await getModel(args.templateId);
			const slots = t.layers.filter((l) => l.type === "text");
			const offset = args.offset ?? 0,
				limit = args.limit ?? 20;
			return {
				id: t.id,
				name: t.name,
				duration: t.duration,
				canvas: t.canvas,
				warnings: t.warnings,
				adaptations: t.warnings.map((w) => modelWarningLabels[w]?.[1] ?? w),
				totalTextSlots: slots.length,
				nextOffset: offset + limit < slots.length ? offset + limit : null,
				textSlots: slots.slice(offset, offset + limit).map((l, index) => ({
					index: offset + index,
					text: l.params.content,
					start: l.start,
					duration: l.duration,
					font: l.params.fontFamily,
					color: l.params.color,
				})),
				layerCount: t.layers.length,
				source: t.source,
			};
		}
		case "apply_template":
			return {
				...(await applyModel({ editor, input, source })),
				state: editorSnapshot({ editor }),
			};
		case "apply_template_style":
			return {
				...(await applyModelStyle({ editor, input, source })),
				state: editorSnapshot({ editor }),
			};
		case "generate_styled_captions":
			return {
				...(await generateStyledCaptions({ editor, input, source })),
				state: editorSnapshot({ editor }),
			};
		case "duck_music":
			return {
				...(await duckMusic({ editor, input, source })),
				state: editorSnapshot({ editor }),
			};
		case "apply_motion":
			return {
				...(await applyMotion({ editor, input, source })),
				state: editorSnapshot({ editor }),
			};
		case "animate_element":
			return {
				...animateElement({ editor, input, source }),
				state: editorSnapshot({ editor }),
			};
		case "set_clip_speed":
			return {
				...setClipSpeed({ editor, input, source }),
				state: editorSnapshot({ editor }),
			};
		case "set_clips_speed":
			return {
				...setClipsSpeed({ editor, input, source }),
				state: editorSnapshot({ editor }),
			};
		case "apply_color_grade":
			return {
				...applyColorGrade({ editor, input, source }),
				state: editorSnapshot({ editor }),
			};
		case "configure_effect": {
			const args = schemas[name].parse(input);
			editGuard({ editor, source })();
			const { element } = find(args);
			if (!("effects" in element))
				throw new Error("This clip does not support effects.");
			const effect = element.effects?.find((item) => item.id === args.effectId);
			if (!effect) throw new Error("Read current effect IDs first.");
			const definition = effectsRegistry.get(effect.type);
			const params = { ...effect.params };
			if (
				!Object.keys(args.params).length ||
				Object.keys(args.params).length > 40
			)
				throw new Error("Supply 1–40 effect parameters.");
			for (const [key, value] of Object.entries(args.params)) {
				const param = definition.params.find((p) => p.key === key);
				if (!param) throw new Error("Unknown effect parameter: " + key);
				const normalized = coerceParamValue({ param, value });
				if (
					normalized === null ||
					(param.type === "color" &&
						!/^#[\da-f]{6}([\da-f]{2})?$/i.test(String(value)))
				)
					throw new Error("Invalid effect parameter: " + key);
				params[key] = normalized;
			}
			editor.timeline.updateElements({
				updates: [
					{
						trackId: args.trackId,
						elementId: args.elementId,
						patch: {
							effects: element.effects?.map((e) =>
								e.id === effect.id ? { ...e, params } : e,
							),
						},
					},
				],
			});
			return { effectId: effect.id, params, state: editorSnapshot({ editor }) };
		}
		case "analyze_audio":
			return analyzeTimeline({ editor, input, source });
		case "transcribe_timeline":
			return transcribeTimeline({ editor, input, source });
		case "get_operation":
			return getOperation(schemas[name].parse(input));
		case "cancel_operation":
			return cancelOperation(schemas[name].parse(input).operationId);
		case "apply_audio_cleanup":
			return {
				...(await applyCleanup({ editor, input, source })),
				state: editorSnapshot({ editor }),
			};
		case "generate_captions":
			return {
				...generateCaptions({ editor, input }),
				state: editorSnapshot({ editor }),
			};
		case "export_video":
			return exportVideo({ editor, input, source });
		case "render_remotion": {
			const args = schemas[name].parse(input);
			editGuard({ editor, source })();
			const snapshot = buildRemotionSnapshot({
				project: editor.project.getActive(),
				tracks: editor.scenes.getActiveScene().tracks,
				mediaAssets: editor.media.getAssets(),
				duration: editor.timeline.getTotalDuration(),
				includeAudio: args.includeAudio ?? true,
			});
			// The renderer reads media from the local data folder. Projects kept only in
			// this browser (IndexedDB/OPFS) would fail there, so copy what is missing.
			const serverFiles = new HttpFileStorageAdapter(snapshot.projectId);
			const stored = new Set(await serverFiles.list());
			const assets = new Map(editor.media.getAssets().map((asset) => [asset.id, asset]));
			let uploadedMedia = 0;
			for (const { id } of snapshot.media) {
				const file = assets.get(id)?.file;
				if (stored.has(id) || !file) continue;
				await serverFiles.set({ key: id, value: file });
				uploadedMedia++;
			}
			const job = await enqueueRemotionRender({ snapshot });
			return {
				jobId: job.id,
				status: job.status,
				step: job.step,
				durationSeconds: snapshot.durationInFrames / snapshot.fps,
				canvas: { width: snapshot.width, height: snapshot.height, fps: snapshot.fps },
				warnings: job.warnings,
				uploadedMedia,
				next: "Poll get_remotion_render with this jobId until status is succeeded.",
			};
		}
		case "import_workspace_asset":
			return importWorkspaceAsset({ editor, input, source });
		case "get_remotion_render":
		case "cancel_remotion_render":
		case "list_workspace_assets":
			throw new Error("This tool is handled by the local server.");
		case "list_effects":
			schemas[name].parse(input);
			return effectsRegistry.getAll().map(({ type, name, params }) => ({
				type,
				name,
				params: params.map(({ channels: _channels, ...param }) => param),
			}));
		case "add_effect": {
			const args = schemas[name].parse(input);
			const { element } = find(args);
			if (
				element.type === "audio" ||
				!effectsRegistry
					.getAll()
					.some((effect) => effect.type === args.effectType)
			)
				throw new Error(
					"Choose a visual clip and a valid built-in effect from list_effects.",
				);
			const effectId = editor.timeline.addClipEffect(args);
			if (!effectId) throw new Error("Effect could not be applied.");
			return { effectId, state: editorSnapshot({ editor }) };
		}
		case "get_editor_state":
			return editorSnapshot({ editor, options: schemas[name].parse(input) });
		case "list_media":
			schemas[name].parse(input);
			return editor.media
				.getAssets()
				.map(({ id, name, type, duration, width, height, hasAudio }) => ({
					id,
					name,
					type,
					durationSeconds: duration,
					width,
					height,
					hasAudio,
				}));
		case "list_sound_effects": {
			const args = schemas[name].parse(input);
			const library = await loadSoundLibrary();
			const sounds = filterLibrary({
				sounds: library.sounds,
				category: args.category ?? "",
				query: args.query ?? "",
			});
			return {
				categories: library.categories,
				sounds: sounds.map(({ libraryId, name: label, category, tags, duration }) => ({
					soundId: libraryId,
					name: label,
					category,
					tags,
					durationSeconds: duration,
				})),
			};
		}
		case "add_sound_effect": {
			const args = schemas[name].parse(input);
			const { sounds } = await loadSoundLibrary();
			const sound = sounds.find(({ libraryId }) => libraryId === args.soundId);
			if (!sound)
				throw new Error(
					"Unknown soundId. Read list_sound_effects and use one of its ids.",
				);
			const element = await buildLibraryAudioFromUrl({
				sourceUrl: sound.previewUrl,
				name: sound.name,
				duration: sound.duration,
				startTime: mediaTimeFromSeconds({ seconds: args.startSeconds }),
			});
			if (args.volumeDb !== undefined)
				element.params = { ...element.params, volume: args.volumeDb };
			return insert(element);
		}
		case "add_text": {
			const args = schemas[name].parse(input);
			return insert(
				buildTextElement({
					startTime: mediaTimeFromSeconds({ seconds: args.startSeconds }),
					raw: {
						name: args.text.slice(0, 80),
						duration: mediaTimeFromSeconds({ seconds: args.durationSeconds }),
						params: { content: args.text },
					},
				}),
			);
		}
		case "insert_media": {
			const args = schemas[name].parse(input);
			const asset = editor.media
				.getAssets()
				.find(({ id }) => id === args.mediaId);
			if (!asset) throw new Error("Import this media into the editor first.");
			const duration =
				asset.type === "image"
					? (args.imageDurationSeconds ?? 5)
					: asset.duration;
			if (!duration || duration <= 0)
				throw new Error("Media duration is unavailable.");
			return insert(
				buildElementFromMedia({
					mediaId: asset.id,
					mediaType: asset.type,
					name: asset.name,
					duration: mediaTimeFromSeconds({ seconds: duration }),
					startTime: mediaTimeFromSeconds({ seconds: args.startSeconds }),
				}),
			);
		}
		case "insert_media_batch": {
			const args = schemas[name].parse(input);
			editGuard({ editor, source })();
			const assets = editor.media.getAssets();
			const commands = args.items.map((item) => {
				const asset = assets.find(({ id }) => id === item.mediaId);
				if (!asset) throw new Error("Import every media item first.");
				const duration =
					asset.type === "image"
						? (item.imageDurationSeconds ?? 5)
						: asset.duration;
				if (!duration || duration <= 0)
					throw new Error("Media duration is unavailable.");
				return new InsertElementCommand({
					element: buildElementFromMedia({
						mediaId: asset.id,
						mediaType: asset.type,
						name: asset.name,
						duration: mediaTimeFromSeconds({ seconds: duration }),
						startTime: mediaTimeFromSeconds({
							seconds: item.startSeconds,
						}),
					}),
					placement: { mode: "auto" },
				});
			});
			editor.command.execute({ command: new BatchCommand(commands) });
			const placements = commands.map((command) => {
				const trackId = command.getTrackId();
				if (!trackId) throw new Error("The editor rejected a batch insertion.");
				return { trackId, elementId: command.getElementId() };
			});
			return {
				insertedCount: placements.length,
				placements,
				undoSteps: 1,
				state: editorSnapshot({ editor }),
			};
		}
		case "split_element": {
			const args = schemas[name].parse(input);
			const { element } = find(args);
			const splitTime = mediaTimeFromSeconds({ seconds: args.atSeconds });
			if (
				splitTime <= element.startTime ||
				splitTime >= element.startTime + element.duration
			)
				throw new Error("Split time must be strictly inside the clip.");
			editor.timeline.splitElements({ elements: [args], splitTime });
			break;
		}
		case "delete_element": {
			const args = schemas[name].parse(input);
			find(args);
			editor.timeline.deleteElements({ elements: [args] });
			break;
		}
		case "move_element": {
			const args = schemas[name].parse(input);
			const { track, element } = find(args);
			const startTime = mediaTimeFromSeconds({ seconds: args.startSeconds });
			if (
				track.elements.some(
					(other) =>
						other.id !== element.id &&
						startTime < other.startTime + other.duration &&
						startTime + element.duration > other.startTime,
				)
			)
				throw new Error("The destination overlaps another clip on this track.");
			editor.timeline.updateElements({
				updates: [
					{
						trackId: args.trackId,
						elementId: args.elementId,
						patch: { startTime },
					},
				],
			});
			break;
		}
		case "update_element": {
			const args = schemas[name].parse(input);
			const { element } = find(args);
			const params = { ...element.params };
			const textFields = [args.text, args.fontSize, args.color];
			if (
				textFields.some((value) => value !== undefined) &&
				element.type !== "text"
			)
				throw new Error("Text properties require a text clip.");
			if (
				[args.volumeDb, args.muted].some((value) => value !== undefined) &&
				element.type !== "audio" &&
				element.type !== "video"
			)
				throw new Error("Audio properties require an audio/video clip.");
			if (
				[args.positionX, args.positionY, args.scale, args.opacity].some(
					(value) => value !== undefined,
				) &&
				element.type === "audio"
			)
				throw new Error("Audio clips have no visual transform.");
			const entries = {
				content: args.text,
				fontSize: args.fontSize,
				color: args.color,
				"transform.positionX": args.positionX,
				"transform.positionY": args.positionY,
				"transform.scaleX": args.scale,
				"transform.scaleY": args.scale,
				opacity: args.opacity,
				volume: args.volumeDb,
				muted: args.muted,
			};
			if (!Object.values(entries).some((value) => value !== undefined))
				throw new Error("Supply at least one property to change.");
			for (const [key, value] of Object.entries(entries))
				if (value !== undefined) params[key] = value;
			editor.timeline.updateElements({
				updates: [
					{
						trackId: args.trackId,
						elementId: args.elementId,
						patch: { params },
					},
				],
			});
			break;
		}
		case "set_canvas": {
			const args = schemas[name].parse(input);
			await editor.project.updateSettings({
				settings: { canvasSize: args, canvasSizeMode: "custom" },
			});
			break;
		}
		case "seek": {
			const args = schemas[name].parse(input);
			editor.playback.seek({
				time: mediaTimeFromSeconds({ seconds: args.seconds }),
			});
			return {
				currentSeconds: mediaTimeToSeconds({
					time: editor.playback.getCurrentTime(),
				}),
			};
		}
		case "undo":
			schemas[name].parse(input);
			if (!editor.command.canUndo()) throw new Error("Nothing to undo.");
			editor.command.undo();
			break;
		case "redo":
			schemas[name].parse(input);
			if (!editor.command.canRedo()) throw new Error("Nothing to redo.");
			editor.command.redo();
			break;
	}
	return editorSnapshot({ editor });
}
