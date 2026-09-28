/* eslint-disable opencut/prefer-object-params */
import React, { useMemo } from "react";
import {
	AbsoluteFill,
	Img,
	Sequence,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import type {
	RemotionAnimationChannel,
	RemotionAnimations,
	RemotionParamValue,
	RemotionProjectSnapshot,
	RemotionVisualElement,
} from "./types";
import { isGeneratedCaptionName } from "@/subtitles/caption-layout";
import {
	getActiveCaptionWordIndex,
	isSpotlightCaption,
} from "@/subtitles/word-highlight";

const numberParam = (
	params: Record<string, RemotionParamValue>,
	key: string,
	fallback: number,
) => (typeof params[key] === "number" ? params[key] : fallback);

const stringParam = (
	params: Record<string, RemotionParamValue>,
	key: string,
	fallback: string,
) => (typeof params[key] === "string" ? params[key] : fallback);

const booleanParam = (
	params: Record<string, RemotionParamValue>,
	key: string,
	fallback: boolean,
) => (typeof params[key] === "boolean" ? params[key] : fallback);

function isLeafChannel(value: unknown): value is RemotionAnimationChannel {
	return !!value && typeof value === "object" && "keys" in value;
}

function resolveChannel(
	animations: RemotionAnimations | undefined,
	path: string,
	localSeconds: number,
	fallback: RemotionParamValue,
): RemotionParamValue {
	const raw = animations?.[path];
	if (!isLeafChannel(raw) || raw.keys.length === 0) return fallback;
	const keys = [...raw.keys].sort((a, b) => a.time - b.time);
	if (localSeconds <= keys[0].time) return keys[0].value;
	const last = keys[keys.length - 1];
	if (localSeconds >= last.time) return last.value;
	for (let index = 0; index < keys.length - 1; index++) {
		const left = keys[index];
		const right = keys[index + 1];
		if (localSeconds < left.time || localSeconds > right.time) continue;
		if (
			left.segmentToNext === "step" ||
			typeof left.value !== "number" ||
			typeof right.value !== "number"
		) {
			return left.value;
		}
		const span = Math.max(0.000001, right.time - left.time);
		const progress = Math.max(
			0,
			Math.min(1, (localSeconds - left.time) / span),
		);
		return left.value + (right.value - left.value) * progress;
	}
	return last.value;
}

function animatedNumber(
	element: RemotionVisualElement,
	path: string,
	localSeconds: number,
	fallback: number,
) {
	const value = resolveChannel(
		element.animations,
		path,
		localSeconds,
		fallback,
	);
	return typeof value === "number" ? value : fallback;
}

function animatedString(
	element: RemotionVisualElement,
	path: string,
	localSeconds: number,
	fallback: string,
) {
	const value = resolveChannel(
		element.animations,
		path,
		localSeconds,
		fallback,
	);
	return typeof value === "string" ? value : fallback;
}

function decibelsToVolume(value: number) {
	if (!Number.isFinite(value) || value <= -60) return 0;
	return Math.max(0, Math.min(4, 10 ** (value / 20)));
}

function blendMode(value: string): React.CSSProperties["mixBlendMode"] {
	switch (value) {
		case "normal":
		case "multiply":
		case "screen":
		case "overlay":
		case "darken":
		case "lighten":
		case "color-dodge":
		case "color-burn":
		case "hard-light":
		case "soft-light":
		case "difference":
		case "exclusion":
		case "hue":
		case "saturation":
		case "color":
		case "luminosity":
			return value;
		default:
			return "normal";
	}
}

function textAlign(value: string): React.CSSProperties["textAlign"] {
	switch (value) {
		case "left":
		case "right":
		case "center":
		case "justify":
		case "start":
		case "end":
			return value;
		default:
			return "center";
	}
}

function clipTransform(
	element: RemotionVisualElement,
	localSeconds: number,
): React.CSSProperties {
	const positionX = animatedNumber(
		element,
		"transform.positionX",
		localSeconds,
		numberParam(element.params, "transform.positionX", 0),
	);
	const positionY = animatedNumber(
		element,
		"transform.positionY",
		localSeconds,
		numberParam(element.params, "transform.positionY", 0),
	);
	const scaleX = animatedNumber(
		element,
		"transform.scaleX",
		localSeconds,
		numberParam(element.params, "transform.scaleX", 1),
	);
	const scaleY = animatedNumber(
		element,
		"transform.scaleY",
		localSeconds,
		numberParam(element.params, "transform.scaleY", 1),
	);
	const rotate = animatedNumber(
		element,
		"transform.rotate",
		localSeconds,
		numberParam(element.params, "transform.rotate", 0),
	);
	const opacity = animatedNumber(
		element,
		"opacity",
		localSeconds,
		numberParam(element.params, "opacity", 1),
	);
	return {
		position: "absolute",
		inset: 0,
		opacity: Math.max(0, Math.min(1, opacity)),
		mixBlendMode: blendMode(stringParam(element.params, "blendMode", "normal")),
		transform: `translate(${positionX}px, ${positionY}px) scale(${scaleX}, ${scaleY}) rotate(${rotate}deg)`,
		transformOrigin: "50% 50%",
	};
}

const VisualClip: React.FC<{
	element: RemotionVisualElement;
	snapshot: RemotionProjectSnapshot;
}> = ({ element, snapshot }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const localSeconds = frame / fps;
	const style = clipTransform(element, localSeconds);
	if (element.type === "text") {
		const resolvedScaleX = animatedNumber(
			element,
			"transform.scaleX",
			localSeconds,
			numberParam(element.params, "transform.scaleX", 1),
		);
		const captionSafeMaxWidth = isGeneratedCaptionName({ name: element.name })
			? `${Math.min(100, 80 / Math.max(0.0001, Math.abs(resolvedScaleX)))}%`
			: "92%";
		const fontSize =
			animatedNumber(
				element,
				"fontSize",
				localSeconds,
				numberParam(element.params, "fontSize", 15),
			) *
			(snapshot.height / 90);
		const content = stringParam(element.params, "content", "");
		const reveal = Math.max(
			0,
			Math.min(
				1,
				animatedNumber(
					element,
					"revealProgress",
					localSeconds,
					numberParam(element.params, "revealProgress", 1),
				),
			),
		);
		const visibleLength = Math.floor(Array.from(content).length * reveal);
		const visibleContent = Array.from(content).slice(0, visibleLength).join("");
		const spotlight = isSpotlightCaption({
			name: element.name,
			params: element.params,
		});
		const activeWordIndex = spotlight
			? getActiveCaptionWordIndex({
					content,
					progress:
						element.timelineDurationSeconds > 0
							? localSeconds / element.timelineDurationSeconds
							: 0,
					wordTimings: element.params["caption.wordTimings"],
				})
			: -1;
		const activeColor = stringParam(
			element.params,
			"caption.highlightColor",
			"#b9f443",
		);
		const inactiveColor = stringParam(
			element.params,
			"caption.inactiveColor",
			"#ffffff",
		);
		const backgroundEnabled = booleanParam(
			element.params,
			"background.enabled",
			false,
		);
		const shadowOpacity = numberParam(element.params, "shadowOpacity", 0);
		const shadowColor = stringParam(element.params, "shadowColor", "#000000");
		const shadowBlur = numberParam(element.params, "shadowBlur", 0);
		const shadowX = numberParam(element.params, "shadowOffsetX", 0);
		const shadowY = numberParam(element.params, "shadowOffsetY", 0);
		const outlineWidth = numberParam(element.params, "outlineWidth", 0);
		const outlineColor = stringParam(element.params, "outlineColor", "#000000");
		return (
			<div
				style={{
					...style,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					style={{
						whiteSpace: "pre-wrap",
						maxWidth: captionSafeMaxWidth,
						boxSizing: "border-box",
						overflowWrap: "anywhere",
						fontFamily: stringParam(element.params, "fontFamily", "Arial"),
						fontSize,
						fontWeight: stringParam(element.params, "fontWeight", "normal"),
						fontStyle: stringParam(element.params, "fontStyle", "normal"),
						textDecoration: stringParam(
							element.params,
							"textDecoration",
							"none",
						),
						textAlign: textAlign(
							stringParam(element.params, "textAlign", "center"),
						),
						letterSpacing: numberParam(element.params, "letterSpacing", 0),
						lineHeight: numberParam(element.params, "lineHeight", 1.2),
						color: animatedString(
							element,
							"color",
							localSeconds,
							stringParam(element.params, "color", "#ffffff"),
						),
						background: backgroundEnabled
							? animatedString(
									element,
									"background.color",
									localSeconds,
									stringParam(element.params, "background.color", "#000000"),
								)
							: "transparent",
						borderRadius: `${numberParam(element.params, "background.cornerRadius", 0)}%`,
						padding: backgroundEnabled
							? `${numberParam(element.params, "background.paddingY", 0)}px ${numberParam(element.params, "background.paddingX", 0)}px`
							: 0,
						WebkitTextStroke:
							outlineWidth > 0
								? `${outlineWidth}px ${outlineColor}`
								: undefined,
						textShadow:
							shadowOpacity > 0
								? `${shadowX}px ${shadowY}px ${shadowBlur}px ${shadowColor}`
								: undefined,
					}}
				>
					{spotlight
						? visibleContent.split(/(\s+)/).map((part, index, parts) => {
								if (/^\s+$/.test(part)) return part;
								const wordIndex =
									parts
										.slice(0, index + 1)
										.filter((value) => value && !/^\s+$/.test(value)).length -
									1;
								return (
									<span
										key={index}
										style={{
											color:
												wordIndex === activeWordIndex
													? activeColor
													: inactiveColor,
										}}
									>
										{part}
									</span>
								);
							})
						: visibleContent}
				</div>
			</div>
		);
	}

	const source = snapshot.media.find((media) => media.id === element.mediaId);
	if (!source) return null;
	if (element.type === "image") {
		return (
			<div style={style}>
				<Img
					src={source.src}
					alt=""
					style={{ width: "100%", height: "100%", objectFit: "contain" }}
				/>
			</div>
		);
	}

	const volume = element.includeSourceAudio
		? decibelsToVolume(numberParam(element.params, "volume", 0))
		: 0;
	return (
		<div style={style}>
			<Video
				src={source.src}
				trimBefore={Math.max(0, Math.round(element.sourceStartSeconds * fps))}
				playbackRate={element.playbackRate}
				volume={volume}
				objectFit="contain"
				style={{ width: "100%", height: "100%" }}
			/>
		</div>
	);
};

export const AiEditaRemotionComposition: React.FC<RemotionProjectSnapshot> = (
	snapshot,
) => {
	const mediaById = useMemo(
		() => new Map(snapshot.media.map((media) => [media.id, media])),
		[snapshot.media],
	);
	const background =
		snapshot.background.type === "color"
			? snapshot.background.color
			: "#000000";
	return (
		<AbsoluteFill style={{ background, overflow: "hidden" }}>
			{snapshot.visual.map((element) => (
				<Sequence
					key={element.id}
					from={Math.max(
						0,
						Math.round(element.timelineStartSeconds * snapshot.fps),
					)}
					durationInFrames={Math.max(
						1,
						Math.round(element.timelineDurationSeconds * snapshot.fps),
					)}
					layout="none"
				>
					<VisualClip element={element} snapshot={snapshot} />
				</Sequence>
			))}
			{snapshot.includeAudio &&
				snapshot.audio.map((element) => {
					const source = element.mediaId
						? mediaById.get(element.mediaId)?.src
						: element.src;
					if (!source) return null;
					return (
						<Sequence
							key={element.id}
							from={Math.max(
								0,
								Math.round(element.timelineStartSeconds * snapshot.fps),
							)}
							durationInFrames={Math.max(
								1,
								Math.round(element.timelineDurationSeconds * snapshot.fps),
							)}
							layout="none"
						>
							<Audio
								src={source}
								trimBefore={Math.max(
									0,
									Math.round(element.sourceStartSeconds * snapshot.fps),
								)}
								playbackRate={element.playbackRate}
								volume={decibelsToVolume(
									numberParam(element.params, "volume", 0),
								)}
							/>
						</Sequence>
					);
				})}
		</AbsoluteFill>
	);
};
