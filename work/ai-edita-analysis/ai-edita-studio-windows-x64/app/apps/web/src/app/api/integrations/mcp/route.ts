import { z } from "zod";
import { toolDefinitions } from "@/integrations/catalog";
import {
	assertMcpToken,
	dispatch,
	dispatchServerTool,
	errorResponse,
	getMcpSession,
	readBody,
	requireLocalRequest,
} from "@/integrations/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	try {
		requireLocalRequest({ request, browser: false });
		const body = z
			.discriminatedUnion("action", [
				z.strictObject({ action: z.literal("list") }),
				z.strictObject({
					action: z.literal("call"),
					name: z.string(),
					arguments: z.unknown(),
					requestId: z.string().min(1).max(200),
				}),
			])
			.parse(await readBody(request));
		// The tool catalog is static: clients must see it even before an editor is picked,
		// otherwise they register zero tools for the whole session.
		if (body.action === "list") {
			assertMcpToken(request);
			return Response.json(
				{ tools: toolDefinitions() },
				{ headers: { "Cache-Control": "no-store" } },
			);
		}
		const serverReply = (() => {
			assertMcpToken(request);
			return dispatchServerTool({ name: body.name, args: body.arguments });
		})();
		if (serverReply)
			return Response.json(await serverReply, {
				headers: { "Cache-Control": "no-store" },
			});
		const session = getMcpSession(request);
		const result = await dispatch({
						session,
						name: body.name,
						args: body.arguments,
						requestId: `mcp:${body.requestId}`,
						source: "MCP",
					});
		// Lets the MCP client notice when the targeted editor tab changes.
		return Response.json(
			{ ...result, projectId: session.projectId },
			{ headers: { "Cache-Control": "no-store" } },
		);
	} catch (error) {
		return errorResponse(error);
	}
}
