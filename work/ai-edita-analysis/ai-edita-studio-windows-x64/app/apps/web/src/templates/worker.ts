// Dedicated worker: imported JSON and WASM conversion never block the editor.
type TemplateExports = WebAssembly.Exports & {
	memory: WebAssembly.Memory;
	templates_alloc: (n: number) => number;
	templates_run: (p: number, n: number) => bigint;
	templates_free: (p: number, n: number) => void;
};
function validExports(e: WebAssembly.Exports): e is TemplateExports {
	return (
		e.memory instanceof WebAssembly.Memory &&
		["templates_alloc", "templates_run", "templates_free"].every(
			(k) => typeof e[k] === "function",
		)
	);
}
let engine: Promise<TemplateExports> | undefined;
self.onmessage = async (
	event: MessageEvent<{ wasmUrl: string; input: unknown }>,
) => {
	let p = 0,
		out = 0,
		size = 0,
		n = 0;
	let e: TemplateExports | undefined;
	try {
		engine ??= fetch(event.data.wasmUrl).then(async (r) => {
			if (!r.ok)
				throw new Error(
					"Motor de modelos indisponível / Template engine unavailable.",
				);
			const exports = (await WebAssembly.instantiate(await r.arrayBuffer()))
				.instance.exports;
			if (!validExports(exports))
				throw new Error("Invalid template engine ABI.");
			return exports;
		});
		e = await engine;
		const memory = e.memory;
		const alloc = e.templates_alloc;
		const run = e.templates_run;
		const bytes = new TextEncoder().encode(JSON.stringify(event.data.input));
		if (bytes.length > 24 * 1024 * 1024)
			throw new Error("Limite: 24 MB / Limit: 24 MB.");
		n = bytes.length;
		p = alloc(n);
		new Uint8Array(memory.buffer, p, n).set(bytes);
		const packed = run(p, n);
		out = Number(packed & BigInt(0xffffffff));
		size = Number(packed >> BigInt(32));
		const result: unknown = JSON.parse(
			new TextDecoder().decode(new Uint8Array(memory.buffer, out, size)),
		);
		self.postMessage(result);
	} catch (error) {
		self.postMessage({
			ok: false,
			error:
				error instanceof Error ? error.message : "Template conversion failed.",
		});
	} finally {
		const free = e?.templates_free;
		if (n) free?.(p, n);
		if (size) free?.(out, size);
	}
};
