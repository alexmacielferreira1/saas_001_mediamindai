import { z } from "zod";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { requireLocalRequest, readBody } from "@/integrations/server";
import { workspaceError } from "@/operations/http";
import {
	safeWorkspace,
	importLegacySettings,
	vault,
	saveVault,
	repoRoot,
	openAIKey,
	readSettings,
} from "@/operations/store.mjs";
import {
	configureShared,
	saveAccount,
	createEditTasks,
	retryEdit,
	preparePublication,
	preflightPublications,
	preflightPublicationProposal,
	confirmPublication,
	cancelPublication,
	expirePublicationProposals,
	newThread,
	runHanna,
	claimEdit,
	adoptEdit,
	updateEdit,
} from "@/operations/service.mjs";
import { verifyAccount, instagramInsights } from "@/operations/instagram.mjs";
import { startScheduler, schedulerStatus } from "@/operations/scheduler.mjs";
import { cancelEdit, continueWorkflow } from "@/operations/service.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const openAIModelInput = z.string().trim().min(1).max(120);
const supportedModel = /^(gpt-|o[1-9])/i;
function record(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}
function safeOpenAIText(value: unknown, limit = 500) {
	if (typeof value !== "string") return "";
	return value
		.replace(/(?:sk|rk|sess)-[A-Za-z0-9_-]+/gi, "[credencial redigida]")
		.replace(/\bBearer\s+\S+/gi, "Bearer [redigido]")
		.replace(/[\r\n	]+/g, " ")
		.trim()
		.slice(0, limit);
}
async function describeOpenAIFailure(response: Response) {
	let payload: unknown = null;
	try {
		payload = await response.json();
	} catch {}
	const providerError = record(payload)?.error;
	const details = record(providerError) ?? record(payload);
	const message = safeOpenAIText(details?.message);
	const code = safeOpenAIText(details?.code, 80);
	const requestId = safeOpenAIText(response.headers.get("x-request-id"), 160);
	return (
		"OpenAI respondeu HTTP " +
		response.status +
		(code ? " (" + code + ")" : "") +
		(message ? ": " + message : ".") +
		(requestId ? " ID da solicitação: " + requestId + "." : "")
	);
}
async function listOpenAIModels(apiKey: string) {
	const response = await fetch("https://api.openai.com/v1/models", {
		headers: { Authorization: "Bearer " + apiKey },
		signal: AbortSignal.timeout(20000),
	});
	if (!response.ok) throw new Error(await describeOpenAIFailure(response));
	const payload: unknown = await response.json().catch(() => null);
	const data = record(payload)?.data;
	const models = Array.isArray(data)
		? data
				.map((item) => safeOpenAIText(record(item)?.id, 120))
				.filter((id) => id && supportedModel.test(id))
		: [];
	return [...new Set(models)].sort((left, right) => left.localeCompare(right));
}
export async function POST(request: Request) {
	try {
		requireLocalRequest({ request, browser: true });
		const body = z
			.object({ action: z.string() })
			.passthrough()
			.parse(await readBody(request));
		let result: unknown;
		switch (body.action) {
			case "snapshot":
				expirePublicationProposals();
				startScheduler();
				result = { ...safeWorkspace(), scheduler: schedulerStatus() };
				break;
			case "settings":
				result = configureShared(body.settings);
				break;
			case "import_legacy":
				result = importLegacySettings();
				break;
			case "account":
				result = await saveAccount(body.account);
				break;
			case "verify_account":
				result = await verifyAccount(
					z
						.string()
						.regex(/^ig-\d+$/)
						.parse(body.accountId),
				);
				break;
			case "insights":
				result = await instagramInsights(
					z
						.string()
						.regex(/^ig-\d+$/)
						.parse(body.accountId),
					body.force === true,
				);
				break;
			case "edit":
				result = createEditTasks(body.input);
				break;
			case "claim_edit":
				result = claimEdit(z.string().uuid().parse(body.taskId));
				break;
			case "adopt_edit":
				result = adoptEdit(body.input);
				break;
			case "update_edit": {
				result = updateEdit(body.input);
				const taskId = z
					.object({ taskId: z.string().uuid() })
					.parse(body.input).taskId;
				void continueWorkflow({ taskId }).catch(() => {});
				break;
			}
			case "retry_edit":
				result = retryEdit(z.string().uuid().parse(body.taskId));
				break;
			case "cancel_edit": {
				const taskId = z.string().uuid().parse(body.taskId);
				result = cancelEdit(taskId);
				void continueWorkflow({ taskId }).catch(() => {});
				break;
			}
			case "preflight_publication":
				result = await preflightPublications(body.items);
				break;
			case "prepare_publication": {
				const preflight = await preflightPublications(body.items);
				result = preparePublication(body.items, preflight);
				break;
			}
			case "confirm_publication": {
				if (body.confirmMediaTransfer !== true)
					throw new Error(
						"Confirme o envio do vídeo à Meta no horário programado.",
					);
				const proposalId = z.string().uuid().parse(body.proposalId);
				const preflight = await preflightPublicationProposal(proposalId);
				result = confirmPublication(proposalId, preflight);
				break;
			}
			case "cancel_publication":
				result = cancelPublication(z.string().uuid().parse(body.jobId));
				break;
			case "new_thread":
				result = newThread();
				break;
			case "hanna":
				result = await runHanna({
					threadId: z.string().uuid().parse(body.threadId),
					prompt: z.string().min(1).max(12000).parse(body.prompt),
				});
				break;
			case "mcp_config": {
				const secrets = vault();
				secrets.mcpToken ||= randomBytes(32).toString("hex");
				saveVault(secrets);
				result = {
					token: secrets.mcpToken,
					nodePath: process.execPath,
					scriptPath: path.join(repoRoot(), "scripts/opencut-mcp.mjs"),
				};
				break;
			}
			case "test_openai": {
				const apiKey = openAIKey();
				if (!apiKey) throw new Error("Configure uma chave da OpenAI.");
				const model = openAIModelInput.parse(
					body.model ?? readSettings().model,
				);
				const models = await listOpenAIModels(apiKey);
				const response = await fetch(
					"https://api.openai.com/v1/models/" + encodeURIComponent(model),
					{
						headers: { Authorization: "Bearer " + apiKey },
						signal: AbortSignal.timeout(20000),
					},
				);
				result = response.ok
					? { ok: true, keyValid: true, model, models, modelAvailable: true }
					: {
							ok: true,
							keyValid: true,
							model,
							models,
							modelAvailable: false,
							modelError: await describeOpenAIFailure(response),
						};
				break;
			}
			default:
				throw new Error("Ação desconhecida.");
		}
		return Response.json(result, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		return workspaceError(error);
	}
}
