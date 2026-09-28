import { requireLocalRequest, IntegrationError } from "@/integrations/server";
import { workspaceError } from "@/operations/http";
import {
	cancelRemotionJob,
	getRemotionJob,
} from "@/operations/remotion-jobs.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request) {
	if (process.env.AI_EDITA_LOCAL_MODE !== "1") {
		throw new IntegrationError("Renderização Remotion local indisponível.", 404);
	}
	requireLocalRequest({ request, browser: false });
	if (request.headers.get("x-opencut-client") !== "integrations") {
		throw new IntegrationError("Cliente local inválido.", 403);
	}
}

// Next route handlers require positional request/context parameters.
// eslint-disable-next-line opencut/prefer-object-params
export async function GET(
	request: Request,
	context: { params: Promise<{ job_id: string }> },
) {
	try {
		authorize(request);
		const { job_id: jobId } = await context.params;
		const job = getRemotionJob(jobId);
		if (!job) throw new IntegrationError("Renderização Remotion não encontrada.", 404);
		return Response.json(job, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		return workspaceError(error);
	}
}

// Next route handlers require positional request/context parameters.
// eslint-disable-next-line opencut/prefer-object-params
export async function DELETE(
	request: Request,
	context: { params: Promise<{ job_id: string }> },
) {
	try {
		authorize(request);
		const { job_id: jobId } = await context.params;
		return Response.json(cancelRemotionJob(jobId), {
			headers: { "Cache-Control": "no-store" },
		});
	} catch (error) {
		return workspaceError(error);
	}
}
