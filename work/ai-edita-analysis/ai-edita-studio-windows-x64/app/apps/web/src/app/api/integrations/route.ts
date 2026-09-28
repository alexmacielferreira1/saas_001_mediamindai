import { z } from "zod";
import {
	chat,
	complete,
	configure,
	connect,
	disconnect,
	errorResponse,
	getSession,
	IntegrationError,
	poll,
	readBody,
	requireLocalRequest,
	testOpenAI,
	startAgentRun,
	cancelAgentRun,
	resumeAgentRun,
	agentRunStatus,
	heartbeat,
} from "@/integrations/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
	try {
		requireLocalRequest({ request, browser: true });
		const body = z
			.object({ action: z.string() })
			.passthrough()
			.parse(await readBody(request));
		if (body.action === "connect") {
			const args = z
				.object({
					projectId: z.string().min(1).max(200),
					sceneId: z.string().min(1).max(200),
					automated: z.boolean().optional(),
				})
				.parse(body);
			return Response.json(connect(args), {
				headers: { "Cache-Control": "no-store" },
			});
		}
		const session = getSession(body);
		if (
			["cancel_agent_run", "resume_agent_run"].includes(body.action) &&
			z.string().uuid().parse(body.runId) !== agentRunStatus(session)?.id
		)
			throw new IntegrationError(
				"Run changed. Refresh the current status.",
				409,
			);
		let result: unknown;
		switch (body.action) {
			case "heartbeat":
				result = heartbeat(session);
				break;
			case "start_agent_run":
				result = startAgentRun({
					session,
					prompt: z.string().trim().min(1).max(12000).parse(body.prompt),
					history: z
						.array(
							z.object({
								role: z.enum(["user", "assistant"]),
								content: z.string().max(4000),
							}),
						)
						.max(12)
						.default([])
						.parse(body.history),
					maxCalls: z
						.number()
						.int()
						.min(1)
						.max(48)
						.default(24)
						.parse(body.maxCalls),
				});
				break;
			case "cancel_agent_run":
				result = cancelAgentRun(session);
				break;
			case "resume_agent_run":
				result = resumeAgentRun(session);
				break;
			case "configure":
				result = configure({ session, input: body.config });
				break;
			case "disconnect":
				disconnect(session);
				result = { ok: true };
				break;
			case "poll": {
				const args = z
					.object({
						projectId: z.string(),
						sceneId: z.string(),
						focused: z.boolean().optional(),
					})
					.parse(body);
				result = poll({ session, ...args });
				break;
			}
			case "result": {
				const args = z
					.object({
						id: z.string().uuid(),
						reply: z.discriminatedUnion("ok", [
							z.object({ ok: z.literal(true), data: z.unknown() }),
							z.object({ ok: z.literal(false), error: z.string().max(2000) }),
						]),
					})
					.parse(body);
				result = complete({ session, ...args });
				break;
			}
			case "test":
				result = await testOpenAI(session);
				break;
			case "chat":
				result = await chat({
					session,
					prompt: z.string().trim().min(1).max(12000).parse(body.prompt),
					history: z
						.array(
							z.object({
								role: z.enum(["user", "assistant"]),
								content: z.string().max(4000),
							}),
						)
						.max(12)
						.default([])
						.parse(body.history),
				});
				break;
			default:
				throw new IntegrationError("Unknown integration action.");
		}
		return Response.json(result, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		return errorResponse(error);
	}
}
