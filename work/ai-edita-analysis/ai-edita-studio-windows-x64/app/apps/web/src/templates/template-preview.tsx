"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

// Animated 9:16 preview drawn from a template recipe. Works for built-in and installed
// packs alike (packs are data-only, so the preview can never depend on shipped media).
// Scenes: hook keyword → captions → motion → panel → end card, with the recipe transition.

type Recipe = Record<string, unknown>;
type Look = {
	background: string;
	grade: string;
	captions: {
		font: string;
		weight: number;
		italic: boolean;
		px: number;
		case: string;
		style: string;
		color: string;
		highlight: string;
		outline: number;
		pill: string;
		position: number;
	};
	keywords: {
		style: string;
		font: string;
		px: number;
		color: string;
		labelBg: string;
		chip: string;
		top: number;
	};
	motion: {
		kind: string;
		bg: string;
		ink: string;
		muted: string;
		accent: string;
		accent2: string;
		font: string;
		display: string;
	};
	panel: {
		style: string;
		bg: string;
		ink: string;
		muted: string;
		accent: string;
		font: string;
		display: string;
		bullet: string;
		price: string;
		priceStyle: string;
		upper: boolean;
	} | null;
	endCard: {
		style: string;
		bg: string;
		ink: string;
		accent: string;
		accent2: string;
		font: string;
		display: string;
	};
	transition: string;
	speed: number;
};

const LOOP = 8;
const obj = (v: unknown) =>
	v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const str = (v: unknown, fallback: string) =>
	typeof v === "string" && v ? v : fallback;
const num = (v: unknown, fallback: number) =>
	typeof v === "number" && Number.isFinite(v) ? v : fallback;
const bool = (v: unknown, fallback: boolean) =>
	typeof v === "boolean" ? v : fallback;

export function lookFromRecipe(recipe: Recipe, accent = "#B9F443"): Look {
	if (recipe.engine !== "theme") {
		// Explicativo Clean: light explanation card, discreet captions.
		const bg = str(recipe.background, "#F4F2ED");
		const ink = str(recipe.ink, "#18191B");
		const font = str(recipe.fontFamily, "Montserrat");
		return {
			background: bg,
			grade: "contrast(1.03) saturate(1.04)",
			captions: {
				font,
				weight: 700,
				italic: false,
				px: num(recipe.captionPixels, 44),
				case: "sentence",
				style: "shadow",
				color: "#FFFFFF",
				highlight: accent,
				outline: 0,
				pill: "#000000AA",
				position: 0.64,
			},
			keywords: { style: "plain", font, px: 84, color: accent, labelBg: ink, chip: accent, top: 0.3 },
			motion: { kind: "list", bg, ink, muted: "#6B6B6B", accent, accent2: accent, font, display: font },
			panel: null,
			endCard: { style: "spaced", bg: ink, ink: "#FFFFFF", accent, accent2: accent, font, display: font },
			transition: "transition-crossfade",
			speed: 1,
		};
	}
	const c = obj(recipe.captions);
	const k = obj(recipe.keywords);
	const m = obj(recipe.motion);
	const p = obj(recipe.panel);
	const e = obj(recipe.endCard);
	const g = obj(recipe.colorGrade);
	const bg = str(recipe.background, "#0A0A0A");
	const grade = [
		`contrast(${num(g.contrast, 1)})`,
		`saturate(${num(g.saturation, 1)})`,
		`brightness(${1 + num(g.brightness, 0)})`,
		num(g.warmth, 0) > 0 ? `sepia(${Math.min(0.4, num(g.warmth, 0) * 2)})` : "",
	].join(" ");
	return {
		background: bg,
		grade,
		captions: {
			font: str(c.font, "Montserrat"),
			weight: bool(c.bold, true) ? 800 : 500,
			italic: bool(c.italic, false),
			px: num(c.px, 48),
			case: str(c.case, "sentence"),
			style: str(c.style, "shadow"),
			color: str(c.color, "#FFFFFF"),
			highlight: str(c.highlight, accent),
			outline: num(c.outline, 0),
			pill: str(c.pill, "#000000B3"),
			position: num(c.position, 0.74),
		},
		keywords: {
			style: str(k.style, "glow"),
			font: str(k.font, "Montserrat"),
			px: num(k.px, 96),
			color: str(k.color, "#FFFFFF"),
			labelBg: str(k.labelBg, "#141414"),
			chip: str(k.chip, accent),
			top: num(k.top, 0.7),
		},
		motion: {
			kind: str(m.kind, "list"),
			bg: str(m.bg, bg),
			ink: str(m.ink, "#FFFFFF"),
			muted: str(m.muted, "#777777"),
			accent: str(m.accent, accent),
			accent2: str(m.accent2, str(m.accent, accent)),
			font: str(m.font, "Montserrat"),
			display: str(m.display, "Montserrat"),
		},
		panel: recipe.panel
			? {
					style: str(p.style, "dark"),
					bg: str(p.bg, "#111111"),
					ink: str(p.ink, "#FFFFFF"),
					muted: str(p.muted, "#999999"),
					accent: str(p.accent, accent),
					font: str(p.font, "Montserrat"),
					display: str(p.display, "Montserrat"),
					bullet: str(p.bullet, "—"),
					price: str(p.price, accent),
					priceStyle: str(p.priceStyle, "plain"),
					upper: bool(p.upper, false),
				}
			: null,
		endCard: {
			style: str(e.style, "spaced"),
			bg: str(e.bg, bg),
			ink: str(e.ink, "#FFFFFF"),
			accent: str(e.accent, accent),
			accent2: str(e.accent2, str(e.accent, accent)),
			font: str(e.font, "Montserrat"),
			display: str(e.display, str(e.font, "Montserrat")),
		},
		transition: str(obj(recipe.transition).type, "transition-crossfade"),
		speed: num(recipe.speed, 1),
	};
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => 1 - (1 - clamp(x)) ** 3;
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
// Recipe pixels are relative to a 1080 px wide frame; the preview uses container units.
const cq = (px: number) => `${((px / 1080) * 100).toFixed(2)}cqw`;
const fontStack = (family: string) =>
	`"${family}", "Montserrat", Arial, sans-serif`;
const applyCase = (text: string, mode: string) =>
	mode === "upper"
		? text.toUpperCase()
		: mode === "lower"
			? text.toLowerCase()
			: text.charAt(0).toUpperCase() + text.slice(1);

const SCENES = { hook: [0, 2], captions: [2, 4], motion: [4, 5.6], panel: [5.6, 7], end: [7, 8] } as const;

function Backdrop({ videoUrl, look, t }: { videoUrl?: string; look: Look; t: number }) {
	const punch = t < 2 ? 1 + 0.08 * ease(seg(t, 0.2, 0.5)) : t < 4 ? 1.03 + 0.02 * seg(t, 2, 4) : 1.05;
	const style: CSSProperties = {
		position: "absolute",
		inset: 0,
		width: "100%",
		height: "100%",
		objectFit: "cover",
		transform: `scale(${punch})`,
		filter: look.grade,
	};
	if (videoUrl)
		// eslint-disable-next-line jsx-a11y/media-has-caption -- decorative muted preview of the user's own upload.
		return <video src={videoUrl} muted loop autoPlay playsInline style={style} />;
	return (
		<div style={{ ...style, background: `radial-gradient(120% 80% at 50% 30%, #3a4a52 0%, #1a2226 55%, #0c1012 100%)` }}>
			<svg viewBox="0 0 100 178" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
				<circle cx="50" cy="70" r="17" fill="#c9a58a" opacity="0.9" />
				<path d="M18 178 C18 120 32 100 50 100 C68 100 82 120 82 178 Z" fill="#26343b" />
				<rect x="0" y="0" width="100" height="178" fill="url(#shade)" />
				<defs>
					<linearGradient id="shade" x1="0" x2="0" y1="0" y2="1">
						<stop offset="0.5" stopColor="#000" stopOpacity="0" />
						<stop offset="1" stopColor="#000" stopOpacity="0.45" />
					</linearGradient>
				</defs>
			</svg>
		</div>
	);
}

function Keyword({ look, t, text }: { look: Look; t: number; text: string }) {
	const k = look.keywords;
	const p = seg(t, 0.35, 0.75);
	if (p <= 0) return null;
	const base: CSSProperties = {
		position: "absolute",
		left: "6%",
		right: "6%",
		top: `${k.top * 100 - 12}%`,
		textAlign: "center",
		fontFamily: fontStack(k.font),
		fontSize: cq(Math.min(k.px, 120) * 0.9),
		fontWeight: 900,
		lineHeight: 1,
		color: k.color,
	};
	if (k.style === "slam") {
		const scale = 1 + 1.4 * (1 - ease(p));
		const shake = p < 1 ? Math.sin(t * 90) * 2 * (1 - p) : 0;
		return (
			<div style={{ ...base, transform: `translateX(${shake}px) scale(${scale})`, opacity: ease(p * 2), textTransform: "uppercase", textShadow: "0 0.8cqw 0 #000, 0 0 3cqw rgba(0,0,0,0.6)" }}>
				{text}
			</div>
		);
	}
	if (k.style === "label")
		return (
			<div style={{ ...base, opacity: ease(p) }}>
				<span style={{ display: "inline-block", background: k.labelBg, color: k.color === k.labelBg ? "#fff" : k.color, padding: "1.2cqw 3cqw", transform: `rotate(-2.2deg) translateY(${(1 - ease(p)) * 6}cqw)`, textTransform: "uppercase" }}>
					{text}
				</span>
			</div>
		);
	if (k.style === "chip")
		return (
			<div style={{ ...base, opacity: ease(p), transform: `translateY(${(1 - ease(p)) * 8}cqw)` }}>
				<span style={{ display: "inline-block", background: k.chip, color: "#fff", borderRadius: "999px", padding: "1.6cqw 4cqw", boxShadow: `0 0 4cqw ${k.chip}88`, fontSize: cq(Math.min(k.px, 80)) }}>
					{text}
				</span>
			</div>
		);
	if (k.style === "plain")
		return (
			<div style={{ ...base, opacity: ease(p), letterSpacing: `${(1 - ease(p)) * 3 + 0.6}cqw`, textTransform: "uppercase", fontSize: cq(Math.min(k.px, 80)) }}>
				{text}
			</div>
		);
	return (
		<div style={{ ...base, opacity: ease(p), transform: `scale(${0.85 + 0.15 * ease(p)})`, textShadow: `0 0 3cqw ${k.color}, 0 0 8cqw ${k.color}88` }}>
			{text}
		</div>
	);
}

function Captions({ look, t, words }: { look: Look; t: number; words: string[] }) {
	const c = look.captions;
	const local = t - SCENES.captions[0];
	const perBlock = Math.max(1, Math.min(c.style === "spotlight" ? 3 : 4, words.length));
	const wordTime = 2 / words.length;
	const active = Math.min(words.length - 1, Math.floor(local / wordTime));
	const blockStart = Math.floor(active / perBlock) * perBlock;
	const block = words.slice(blockStart, blockStart + perBlock);
	const size = cq(Math.min(c.px, 70) * 1.05);
	const box: CSSProperties = {
		position: "absolute",
		left: "7%",
		right: "7%",
		top: `${c.position * 100 - 4}%`,
		textAlign: "center",
		fontFamily: fontStack(c.font),
		fontStyle: c.italic ? "italic" : "normal",
		fontWeight: c.weight,
		fontSize: size,
		lineHeight: 1.15,
		color: c.color,
	};
	const stroke = c.outline ? { WebkitTextStroke: `${c.outline * 0.12}cqw #000`, paintOrder: "stroke fill" } : {};
	const inner = block.map((word, i) => {
		const index = blockStart + i;
		const spoken = index <= active;
		const color = c.style === "spotlight" ? (index === active ? c.highlight : spoken ? c.color : `${c.color}88`) : index === 1 ? c.highlight : c.color;
		const pop = c.style === "spotlight" && index === active ? 1 + 0.12 * (1 - seg(local, index * wordTime, index * wordTime + 0.15)) : 1;
		return (
			<span key={index} style={{ color, display: "inline-block", transform: `scale(${pop})`, margin: "0 0.8cqw", opacity: c.style === "spotlight" || spoken ? 1 : 0.35 }}>
				{applyCase(word, c.case)}
			</span>
		);
	});
	if (c.style === "pill")
		return (
			<div style={box}>
				<span style={{ display: "inline-block", background: c.pill, borderRadius: "3cqw", padding: "1.4cqw 3.4cqw", border: `0.3cqw solid ${c.highlight}55` }}>{inner}</span>
			</div>
		);
	return <div style={{ ...box, ...stroke, textShadow: c.style === "shadow" ? "0 0.6cqw 2cqw rgba(0,0,0,0.75)" : undefined }}>{inner}</div>;
}

function Motion({ look, t }: { look: Look; t: number }) {
	const m = look.motion;
	const local = seg(t, SCENES.motion[0], SCENES.motion[1]);
	const wrap: CSSProperties = {
		position: "absolute",
		inset: 0,
		background: m.bg,
		color: m.ink,
		fontFamily: fontStack(m.font),
		display: "grid",
		placeContent: "center",
		gap: "3cqw",
		padding: "0 9%",
		textAlign: "center",
	};
	const title = (text: string) => (
		<div style={{ fontFamily: fontStack(m.display), fontSize: "4.2cqw", letterSpacing: "0.5cqw", color: m.muted, textTransform: "uppercase" }}>{text}</div>
	);
	const reveal = (i: number) => ease(seg(local, 0.1 + i * 0.18, 0.3 + i * 0.18));
	if (m.kind === "kinetic") {
		const p = ease(seg(local, 0.15, 0.45));
		return (
			<div style={wrap}>
				{title("de 12:00 para")}
				<div style={{ fontFamily: fontStack(m.display), fontSize: "26cqw", lineHeight: 0.9, color: m.accent, transform: `scale(${1 + 1.2 * (1 - p)})`, opacity: p }}>07:39</div>
				<div style={{ fontSize: "5cqw", fontWeight: 800, opacity: reveal(3) }}>−36%</div>
			</div>
		);
	}
	if (m.kind === "contrast")
		return (
			<div style={wrap}>
				{title("antes × depois")}
				<div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: "4cqw" }}>
					<span style={{ fontSize: "10cqw", color: m.muted, textDecoration: "line-through", opacity: reveal(0) }}>12:00</span>
					<span style={{ fontFamily: fontStack(m.display), fontSize: "15cqw", color: m.accent, opacity: reveal(2), textShadow: `0 0 4cqw ${m.accent}66` }}>07:39</span>
				</div>
			</div>
		);
	if (m.kind === "flow" || m.kind === "pictograms") {
		const steps = ["Grava", "Corta", "Publica"];
		return (
			<div style={wrap}>
				{title(m.kind === "flow" ? "como funciona" : "o processo")}
				<div style={{ display: "grid", gap: "4cqw" }}>
					{steps.map((step, i) => (
						<div key={step} style={{ display: "flex", alignItems: "center", gap: "4cqw", opacity: reveal(i), transform: `translateX(${(1 - reveal(i)) * -10}cqw)` }}>
							<span style={{ width: "11cqw", height: "11cqw", flex: "0 0 11cqw", borderRadius: m.kind === "flow" ? "50%" : "2cqw", border: `0.6cqw solid ${m.accent}`, display: "grid", placeItems: "center", color: m.accent, fontWeight: 800, fontSize: "5cqw" }}>{i + 1}</span>
							<span style={{ fontFamily: fontStack(m.display), fontSize: "8cqw", color: m.ink }}>{step}</span>
						</div>
					))}
				</div>
			</div>
		);
	}
	const items = ["Cortes nas pausas", "Legenda sincronizada", "Pronto para postar"];
	return (
		<div style={wrap}>
			{title(m.kind === "checklist" ? "processando" : "em resumo")}
			<div style={{ display: "grid", gap: "3.4cqw", textAlign: "left" }}>
				{items.map((item, i) => (
					<div key={item} style={{ display: "flex", alignItems: "center", gap: "3cqw", opacity: reveal(i) }}>
						<span style={{ width: "7cqw", height: "7cqw", flex: "0 0 7cqw", borderRadius: "1.6cqw", background: reveal(i) > 0.9 ? m.accent : "transparent", border: `0.5cqw solid ${m.accent}`, color: m.bg, display: "grid", placeItems: "center", fontSize: "4.6cqw", fontWeight: 900 }}>✓</span>
						<span style={{ fontSize: "6cqw", fontWeight: 700 }}>{item}</span>
					</div>
				))}
			</div>
		</div>
	);
}

function Panel({ look, t }: { look: Look; t: number }) {
	const p = look.panel;
	if (!p) return null;
	const local = seg(t, SCENES.panel[0], SCENES.panel[1]);
	const rise = ease(seg(local, 0, 0.25));
	const items = ["6 videoaulas", "Sistema em 5 min", "Editor com IA"];
	const radius = p.style === "soft" || p.style === "interface" ? "5cqw 5cqw 0 0" : "0";
	const price = (() => {
		const text = "R$ 47";
		const common: CSSProperties = { fontFamily: fontStack(p.display), fontSize: "13cqw", lineHeight: 1, color: p.price };
		if (p.priceStyle === "outline")
			return <span style={{ ...common, border: `0.5cqw solid ${p.price}`, padding: "1cqw 3cqw" }}>{text}</span>;
		if (p.priceStyle === "tape")
			return <span style={{ ...common, background: p.ink, padding: "1cqw 3cqw", transform: "rotate(-3deg)", display: "inline-block" }}>{text}</span>;
		if (p.priceStyle === "underline")
			return <span style={{ ...common, fontStyle: "italic", borderBottom: `1cqw solid ${p.accent}` }}>{text}</span>;
		if (p.priceStyle === "glow") return <span style={{ ...common, textShadow: `0 0 4cqw ${p.price}` }}>{text}</span>;
		return <span style={common}>{text}</span>;
	})();
	return (
		<div
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				bottom: 0,
				height: "52%",
				background: p.style === "tape" ? `repeating-linear-gradient(-45deg, ${p.bg} 0 6cqw, ${p.bg}ee 6cqw 12cqw)` : p.bg,
				borderRadius: radius,
				borderTop: p.style === "interface" ? `0.5cqw solid ${p.accent}` : undefined,
				transform: `translateY(${(1 - rise) * 100}%)`,
				color: p.ink,
				fontFamily: fontStack(p.font),
				padding: "6cqw 8cqw",
				display: "grid",
				alignContent: "start",
				gap: "2.6cqw",
			}}
		>
			<div style={{ fontSize: "3.6cqw", letterSpacing: "0.6cqw", color: p.muted, fontWeight: 700 }}>O QUE VOCÊ LEVA</div>
			{items.map((item, i) => {
				const r = ease(seg(local, 0.2 + i * 0.12, 0.35 + i * 0.12));
				return (
					<div key={item} style={{ display: "flex", gap: "2.6cqw", fontSize: "5.4cqw", fontWeight: 650, opacity: r, transform: `translateX(${(1 - r) * 8}cqw)` }}>
						<span style={{ color: p.accent }}>{p.bullet === "numbered-badge" || p.bullet === "number" ? i + 1 : p.bullet}</span>
						<span>{p.upper ? item.toUpperCase() : item}</span>
					</div>
				);
			})}
			<div style={{ marginTop: "2cqw", opacity: ease(seg(local, 0.62, 0.8)) }}>
				<div style={{ fontSize: "3.6cqw", color: p.muted }}>por apenas</div>
				{price}
			</div>
		</div>
	);
}

function EndCard({ look, t, brand }: { look: Look; t: number; brand: string }) {
	const e = look.endCard;
	const local = ease(seg(t, SCENES.end[0], SCENES.end[0] + 0.4));
	const name = (
		<div style={{ fontFamily: fontStack(e.display), fontSize: "9cqw", lineHeight: 1.05, color: e.ink, letterSpacing: e.style === "spaced" ? `${(1 - local) * 3 + 0.8}cqw` : undefined, textTransform: e.style === "spaced" || e.style === "cta" ? "uppercase" : undefined }}>
			{brand}
		</div>
	);
	let decoration = null;
	if (e.style === "circle")
		decoration = <div style={{ width: "34cqw", height: "34cqw", borderRadius: "50%", background: e.accent, opacity: 0.25, margin: "0 auto 4cqw", transform: `scale(${local})` }} />;
	if (e.style === "badge")
		decoration = <div style={{ display: "inline-block", margin: "0 auto 4cqw", borderRadius: "999px", padding: "1.4cqw 4cqw", background: `linear-gradient(90deg, ${e.accent}, ${e.accent2})`, color: "#fff", fontSize: "3.6cqw", fontWeight: 700 }}>● EDITOR IA</div>;
	if (e.style === "cover")
		decoration = <div style={{ fontSize: "3.4cqw", letterSpacing: "0.8cqw", color: e.accent, marginBottom: "3cqw" }}>EDIÇÃO Nº 01</div>;
	return (
		<div style={{ position: "absolute", inset: 0, background: e.bg, display: "grid", placeContent: "center", textAlign: "center", padding: "0 8%", opacity: local, fontFamily: fontStack(e.font) }}>
			{decoration}
			{name}
			{e.style === "cta" ? (
				<div style={{ marginTop: "5cqw", display: "inline-block", background: e.ink, color: e.bg, padding: "2cqw 5cqw", fontWeight: 900, fontSize: "4.6cqw" }}>TOCA NO LINK ↓</div>
			) : (
				<div style={{ marginTop: "3cqw", color: e.accent, fontSize: "4cqw" }}>Você grava. O resto entra no fluxo.</div>
			)}
		</div>
	);
}

function Transition({ look, t }: { look: Look; t: number }) {
	const cuts = [SCENES.motion[0], SCENES.panel[0], SCENES.motion[1] - 0.001];
	const near = cuts.map((cut) => Math.abs(t - cut)).reduce((a, b) => Math.min(a, b), 9);
	if (near > 0.18) return null;
	const k = 1 - near / 0.18;
	const type = look.transition;
	const base: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };
	if (type === "transition-flash") return <div style={{ ...base, background: "#fff", opacity: k * 0.9 }} />;
	if (type === "transition-dip-black") return <div style={{ ...base, background: "#000", opacity: k }} />;
	if (type === "transition-dip-white") return <div style={{ ...base, background: "#fff", opacity: k }} />;
	if (type === "transition-light-leak")
		return <div style={{ ...base, background: "radial-gradient(80% 60% at 20% 30%, #ffb35c, #ff4fb000 70%)", mixBlendMode: "screen", opacity: k }} />;
	if (type === "transition-glitch")
		return (
			<div style={{ ...base, opacity: k }}>
				{[0.2, 0.45, 0.7].map((y, i) => (
					<div key={y} style={{ position: "absolute", left: 0, right: 0, top: `${y * 100}%`, height: "5%", background: i === 1 ? "#ff0040" : "#00e5ff", mixBlendMode: "screen", transform: `translateX(${Math.sin(t * 120 + i) * 12}%)` }} />
				))}
			</div>
		);
	if (type === "transition-whip")
		return <div style={{ ...base, backdropFilter: `blur(${k * 6}px)`, background: `linear-gradient(90deg, transparent, rgba(255,255,255,${k * 0.25}), transparent)` }} />;
	return <div style={{ ...base, backdropFilter: `blur(${k * 5}px)`, background: `rgba(0,0,0,${k * 0.25})` }} />;
}

export function TemplatePreview({
	recipe,
	accent,
	brand,
	videoUrl,
	playing = true,
	posterTime = 2.9,
	className,
	label,
}: {
	recipe: Recipe;
	accent?: string;
	brand?: string;
	videoUrl?: string;
	playing?: boolean;
	/** Frame shown when not playing (seconds into the 8 s loop). */
	posterTime?: number;
	className?: string;
	label?: string;
}) {
	const look = lookFromRecipe(recipe, accent);
	const [t, setT] = useState(posterTime);
	const frame = useRef(0);
	useEffect(() => {
		const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		if (!playing || reduced) {
			const timer = setTimeout(() => setT(posterTime), 0);
			return () => clearTimeout(timer);
		}
		const start = performance.now() - 900;
		const tick = (now: number) => {
			setT((((now - start) / 1000) * Math.min(1.1, look.speed)) % LOOP);
			frame.current = requestAnimationFrame(tick);
		};
		frame.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame.current);
	}, [playing, posterTime, look.speed]);
	const words = ["seu", "vídeo", "editado", "no", "estilo", "certo"];
	const inScene = (scene: keyof typeof SCENES) => t >= SCENES[scene][0] && t < SCENES[scene][1];
	const showVideo = !inScene("motion") && !inScene("end");
	return (
		<div
			className={className}
			role="img"
			aria-label={label ? `Prévia animada do template ${label}` : "Prévia animada do template"}
			style={{ position: "relative", aspectRatio: "9 / 16", maxWidth: "100%", overflow: "hidden", borderRadius: 14, background: look.background, containerType: "inline-size", isolation: "isolate" }}
		>
			{/* Always mounted so the user's video never reloads (black flash) when the loop restarts. */}
			<div style={{ position: "absolute", inset: 0, height: inScene("panel") && look.panel ? "58%" : "100%", overflow: "hidden", visibility: showVideo ? "visible" : "hidden" }}>
				<Backdrop videoUrl={videoUrl} look={look} t={t} />
			</div>
			{inScene("hook") && <Keyword look={look} t={t} text="Edição com IA" />}
			{inScene("captions") && <Captions look={look} t={t} words={words} />}
			{inScene("motion") && <Motion look={look} t={t} />}
			{inScene("panel") && (look.panel ? <Panel look={look} t={t} /> : <Captions look={look} t={t - 3.6} words={["pronto", "para", "publicar"]} />)}
			{inScene("end") && <EndCard look={look} t={t} brand={brand?.trim() || "Sua Marca"} />}
			<Transition look={look} t={t} />
			<div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "1.2cqw", background: "rgba(255,255,255,0.15)" }}>
				<div style={{ width: `${(t / LOOP) * 100}%`, height: "100%", background: look.keywords.color }} />
			</div>
		</div>
	);
}
