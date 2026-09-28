import fs from "node:fs";
import path from "node:path";
import { requireLocalRequest, IntegrationError } from "@/integrations/server";
import { workspaceError } from "@/operations/http";
import { remotionOutputPath } from "@/operations/remotion-jobs.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Next route handlers require positional request/context parameters.
// eslint-disable-next-line opencut/prefer-object-params
export async function GET(
	request: Request,
	context: { params: Promise<{ job_id: string }> },
) {
	try {
		if (process.env.AI_EDITA_LOCAL_MODE !== "1") {
			throw new IntegrationError("Renderização Remotion local indisponível.", 404);
		}
		requireLocalRequest({ request, browser: false });
		if (request.headers.get("x-opencut-client") !== "integrations") {
			throw new IntegrationError("Cliente local inválido.", 403);
		}
		const { job_id: jobId } = await context.params;
		const file = remotionOutputPath(jobId);
		if (!file) throw new IntegrationError("MP4 Remotion não encontrado.", 404);
		const stat = fs.statSync(file);
		const iterator = fs.createReadStream(file)[Symbol.asyncIterator]();
		const stream = new ReadableStream<Uint8Array>({
			async pull(controller) {
				const next = await iterator.next();
				if (next.done) controller.close();
				else if (Buffer.isBuffer(next.value)) controller.enqueue(next.value);
				else controller.error(new Error("Falha ao ler o MP4 Remotion."));
			},
			async cancel() {
				await iterator.return?.();
			},
		});
		return new Response(stream, {
			headers: {
				"Cache-Control": "private, no-store",
				"Content-Length": String(stat.size),
				"Content-Type": "video/mp4",
				"Content-Disposition": `attachment; filename="${path.basename(file)}"`,
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		return workspaceError(error);
	}
}
