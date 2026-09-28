import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./store.mjs";
let engine;
export const publicationStates = [
	"scheduled",
	"uploading",
	"processing",
	"publishing",
	"published",
	"failed",
	"needs_review",
	"cancelled",
];
export const proposalStates = [
	"pending",
	"confirmed",
	"expired",
	"superseded",
];
export function rules() {
	engine ??= new WebAssembly.Instance(
		new WebAssembly.Module(
			fs.readFileSync(
				path.join(repoRoot(), "apps/web/public/wasm/operations.wasm"),
			),
		),
	).exports;
	return engine;
}
export function transition(job, to) {
	if (
		!rules().publication_transition(
			publicationStates.indexOf(job.status),
			publicationStates.indexOf(to),
		)
	)
		throw new Error("Transição inválida: " + job.status + " → " + to);
	job.status = to;
}
