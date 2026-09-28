// Browser ABI only. Editorial calculations live in rust/crates/editorial.
type Engine = {
	memory: WebAssembly.Memory;
	editorial_alloc: (n: number) => number;
	editorial_free: (p: number, n: number) => void;
	editorial_captions: (...args: number[]) => number;
	editorial_motion: (...args: number[]) => number;
	editorial_text_case: (...args: number[]) => number;
	editorial_ducking: (...args: number[]) => number;
};
let pending: Promise<Engine> | undefined;
function hasEditorialExports(
	e: WebAssembly.Exports,
): e is WebAssembly.Exports & Engine {
	return (
		e.memory instanceof WebAssembly.Memory &&
		[
			"editorial_alloc",
			"editorial_free",
			"editorial_captions",
			"editorial_motion",
			"editorial_text_case",
			"editorial_ducking",
		].every((key) => typeof e[key] === "function")
	);
}
async function load() {
	pending ??= (async () => {
		const response = await fetch("/wasm/editorial.wasm?v=1");
		if (!response.ok)
			throw new Error(
				"Motor editorial indisponível / Editorial engine unavailable.",
			);
		const { instance } = await WebAssembly.instantiate(
			await response.arrayBuffer(),
		);
		const e = instance.exports;
		if (!hasEditorialExports(e)) throw new Error("Invalid editorial ABI.");
		return e;
	})().catch((error) => {
		pending = undefined;
		throw error;
	});
	return pending;
}
export async function editorialPlan({
	kind,
	input = [],
	args,
}: {
	kind: "captions" | "motion" | "text_case" | "ducking";
	input?: number[];
	args: number[];
}) {
	const e = await load();
	const capacity = Math.max(100, input.length * 4 + 16);
	const p = e.editorial_alloc(Math.max(1, input.length));
	const out = e.editorial_alloc(capacity);
	try {
		new Float64Array(e.memory.buffer, p, input.length).set(input);
		const count =
			kind === "motion"
				? e.editorial_motion(...args, out, capacity)
				: kind === "text_case"
					? e.editorial_text_case(p, input.length, ...args, out, capacity)
					: e[kind === "captions" ? "editorial_captions" : "editorial_ducking"](
							p,
							input.length,
							...args,
							out,
							capacity,
						);
		if (count < 0) throw new Error("Editorial plan exceeds capacity.");
		return Array.from(new Float64Array(e.memory.buffer, out, count));
	} finally {
		e.editorial_free(p, Math.max(1, input.length));
		e.editorial_free(out, capacity);
	}
}

export type EditorialTextCase = "uppercase" | "lowercase" | "sentence";

export async function transformEditorialTextCase({
	text,
	mode,
}: {
	text: string;
	mode: EditorialTextCase;
}): Promise<string> {
	if (!text) return text;
	const plan = await editorialPlan({
		kind: "text_case",
		input: Array.from(text, (character) => character.codePointAt(0) ?? 0),
		args: [["uppercase", "lowercase", "sentence"].indexOf(mode)],
	});
	return plan.map((codepoint) => String.fromCodePoint(codepoint)).join("");
}
