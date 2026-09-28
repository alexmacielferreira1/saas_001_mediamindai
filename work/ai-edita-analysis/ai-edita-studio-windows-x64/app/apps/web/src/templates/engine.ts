import { z } from "zod";
const resultSchema = z.discriminatedUnion("ok", [
	z.object({ ok: z.literal(true), data: z.unknown() }),
	z.object({ ok: z.literal(false), error: z.string() }),
]);
export function templateEngine(input: unknown): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL("./worker.ts", import.meta.url));
		const finish = () => {
			clearTimeout(timer);
			worker.terminate();
		};
		const timer = setTimeout(() => {
			finish();
			reject(new Error("Conversão excedeu o tempo / Conversion timed out."));
		}, 30000);
		worker.onmessage = (event: MessageEvent<unknown>) => {
			finish();
			try {
				const r = resultSchema.parse(event.data);
				if (!r.ok) reject(new Error(r.error));
				else resolve(r.data);
			} catch (e) {
				reject(e);
			}
		};
		worker.onerror = () => {
			finish();
			reject(new Error("Falha no motor de modelos / Template engine failed."));
		};
		worker.postMessage({
			input,
			wasmUrl: new URL("/wasm/templates.wasm?v=9", window.location.origin).href,
		});
	});
}
