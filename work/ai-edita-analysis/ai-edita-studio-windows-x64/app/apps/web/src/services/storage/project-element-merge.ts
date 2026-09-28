import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

// Node host ABI. The merge policy stays in Rust and executes synchronously
// inside SQLite's transaction, so another tab cannot interleave a stale write.
type Engine = WebAssembly.Exports & {
	memory: WebAssembly.Memory;
	templates_alloc: (size: number) => number;
	templates_run: (pointer: number, size: number) => bigint;
	templates_free: (pointer: number, size: number) => void;
};
function validExports(e: WebAssembly.Exports): e is Engine {
	return (
		e.memory instanceof WebAssembly.Memory &&
		["templates_alloc", "templates_run", "templates_free"].every(
			(k) => typeof e[k] === "function",
		)
	);
}
let engine: Engine | undefined;
const resultSchema = z.discriminatedUnion("ok", [
	z.object({ ok: z.literal(true), data: z.unknown() }),
	z.object({ ok: z.literal(false), error: z.string() }),
]);
export function mergeProjectElementLibraries(args: {
	current: unknown;
	incoming: unknown;
	knownMediaIds?: string[];
}) {
	return runElementLibraryEngine({ op: "element_library_merge", ...args });
}

export function runElementLibraryEngine(input: Record<string, unknown>) {
	if (!engine) {
		const exports = new WebAssembly.Instance(
			new WebAssembly.Module(
				readFileSync(path.join(process.cwd(), "public/wasm/templates.wasm")),
			),
		).exports;
		if (!validExports(exports)) throw new Error("Invalid element library ABI.");
		engine = exports;
	}
	const bytes = new TextEncoder().encode(JSON.stringify(input));
	if (bytes.length > 24 * 1024 * 1024)
		throw new Error("Biblioteca de elementos grande demais.");
	const ptr = engine.templates_alloc(bytes.length);
	let out = 0,
		size = 0;
	try {
		new Uint8Array(engine.memory.buffer, ptr, bytes.length).set(bytes);
		const result = engine.templates_run(ptr, bytes.length);
		out = Number(result & BigInt(0xffffffff));
		size = Number(result >> BigInt(32));
		const response = resultSchema.parse(
			JSON.parse(
				new TextDecoder().decode(
					new Uint8Array(engine.memory.buffer, out, size),
				),
			),
		);
		if (!response.ok) throw new Error(response.error);
		return response.data;
	} finally {
		engine.templates_free(ptr, bytes.length);
		if (size) engine.templates_free(out, size);
	}
}
