import { z } from "zod";
import { requireLocalRequest, IntegrationError } from "@/integrations/server";
import { workspaceError } from "@/operations/http";
import {
	enqueueRemotionJob,
	listRemotionJobs,
} from "@/operations/remotion-jobs.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const snapshotSchema = z
	.object({
		schema: z.literal("ai-edita.remotion-snapshot"),
		version: z.literal(1),
		projectId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
		sceneId: z.string().min(1).max(128),
		projectVersion: z.number().int().positive(),
		name: z.string().min(1).max(240),
		createdAt: z.string(),
		width: z.number().int().min(16).max(7680),
		height: z.number().int().min(16).max(7680),
		fps: z.number().min(1).max(120),
		durationInFrames: z.number().int().min(1).max(1_296_000),
		includeAudio: z.boolean(),
		background: z.union([
			z.object({ type: z.literal("color"), color: z.string() }),
			z.object({ type: z.literal("blur"), blurIntensity: z.number() }),
		]),
		media: z.array(z.record(z.string(), z.unknown())).max(5000),
		visual: z.array(z.record(z.string(), z.unknown())).max(20_000),
		audio: z.array(z.record(z.string(), z.unknown())).max(5000),
		warnings: z.array(z.string()).max(1000),
	})
	.passthrough();

function authorize(request: Request) {
	if (process.env.AI_EDITA_LOCAL_MODE !== "1") {
		throw new IntegrationError("Renderização Remotion local indisponível.", 404);
	}
	requireLocalRequest({ request, browser: false });
	if (request.headers.get("x-opencut-client") !== "integrations") {
		throw new IntegrationError("Cliente local inválido.", 403);
	}
}

export async function GET(request: Request) {
	try {
		authorize(request);
		return Response.json(listRemotionJobs(), {
			headers: { "Cache-Control": "no-store" },
		});
	} catch (error) {
		return workspaceError(error);
	}
}

export async function POST(request: Request) {
	try {
		authorize(request);
		if (Number(request.headers.get("content-length") || 0) > 16 * 1024 * 1024) {
			throw new IntegrationError("Snapshot Remotion muito grande.", 413);
		}
		const snapshot = snapshotSchema.parse(await request.json());
		return Response.json(enqueueRemotionJob(snapshot), {
			status: 202,
			headers: { "Cache-Control": "no-store" },
		});
	} catch (error) {
		return workspaceError(error);
	}
}
