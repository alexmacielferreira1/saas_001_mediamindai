"use client";

import { create } from "zustand";
import { z } from "zod";
import { isToolName, type ToolName } from "./catalog";
import type { BridgeJob, ToolReply } from "./server";
import { agentRunSchema, type AgentRunSummary } from "./agent-run-contract";

export type Connection = {
	sessionId: string;
	controlToken: string;
	mcpToken: string;
	nodePath: string;
	scriptPath: string;
};
export type Settings = {
	allowEdits: boolean;
	shareWithOpenAI: boolean;
	shareAudioWithOpenAI: boolean;
	shareFramesWithAgents: boolean;
	hasKey: boolean;
	keySource: string;
	model: string;
};
type Activity = {
	id: string;
	time: string;
	source: string;
	tool: string;
	ok: boolean;
	error?: string;
};

export const settingsSchema = z.object({
	allowEdits: z.boolean(),
	shareWithOpenAI: z.boolean(),
	shareAudioWithOpenAI: z.boolean(),
	shareFramesWithAgents: z.boolean().default(false),
	hasKey: z.boolean(),
	keySource: z.string(),
	model: z.string(),
});
export const connectionSchema = settingsSchema.extend({
	sessionId: z.string().uuid(),
	controlToken: z.string(),
	mcpToken: z.string(),
	nodePath: z.string(),
	scriptPath: z.string(),
});
export const chatResponseSchema = z.object({ text: z.string() });
export const pollResponseSchema = z.object({
	...settingsSchema.shape,
	agentRun: agentRunSchema.nullable().optional(),
	job: z
		.object({
			id: z.string().uuid(),
			name: z.custom<ToolName>(
				(value) => typeof value === "string" && isToolName(value),
			),
			args: z.unknown(),
			projectId: z.string(),
			sceneId: z.string(),
			expiresAt: z.number(),
			source: z.enum(["MCP", "OpenAI"]),
		})
		.nullable(),
});

export class IntegrationApiError extends Error {
	// eslint-disable-next-line opencut/prefer-object-params -- Preserve the native Error(message) constructor convention.
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}

export async function integrationRequest(
	request: Record<string, unknown> & { signal?: AbortSignal },
): Promise<unknown> {
	const { signal, ...body } = request;
	const response = await fetch("/api/integrations", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-opencut-client": "integrations",
		},
		body: JSON.stringify(body),
		signal,
		cache: "no-store",
	});
	const data: unknown = await response.json();
	if (!response.ok)
		throw new IntegrationApiError(
			z.object({ error: z.string().optional() }).parse(data).error ||
				`HTTP ${response.status}`,
			response.status,
		);
	return data;
}

export const useIntegrationStore = create<{
	connection: Connection | null;
	settings: Settings;
	health: string;
	activity: Activity[];
	chatBusy: boolean;
	answer: string;
	agentRun: AgentRunSummary | null;
	reportedRunId: string;
	/** Time of the last successful bridge poll; proves this tab can execute tools. */
	lastPollAt: number;
	addActivity: (args: { job: BridgeJob; reply: ToolReply }) => void;
}>()((set) => ({
	connection: null,
	settings: {
		allowEdits: false,
		shareWithOpenAI: false,
		shareAudioWithOpenAI: false,
		shareFramesWithAgents: false,
		hasKey: false,
		keySource: "none",
		model: "gpt-5.4",
	},
	health: "",
	activity: [],
	chatBusy: false,
	answer: "",
	agentRun: null,
	reportedRunId: "",
	lastPollAt: 0,
	addActivity: ({ job, reply }) =>
		set((state) => ({
			activity: [
				{
					id: job.id,
					time: new Date().toLocaleTimeString(),
					source: job.source,
					tool: job.name,
					ok: reply.ok,
					error: reply.ok ? undefined : reply.error,
				},
				...state.activity,
			].slice(0, 100),
		})),
}));

export async function updateIntegrationSettings(
	config: Record<string, unknown>,
) {
	const { connection } = useIntegrationStore.getState();
	if (!connection) throw new Error("Connect the editor first.");
	if (
		config.allowEdits === false ||
		config.shareWithOpenAI === false ||
		config.shareAudioWithOpenAI === false ||
		config.shareFramesWithAgents === false
	) {
		useIntegrationStore.setState((state) => ({
			settings: {
				...state.settings,
				...(config.shareFramesWithAgents === false
					? { shareFramesWithAgents: false }
					: {}),
				...(config.allowEdits === false ? { allowEdits: false } : {}),
				...(config.shareWithOpenAI === false ? { shareWithOpenAI: false } : {}),
				...(config.shareAudioWithOpenAI === false
					? { shareAudioWithOpenAI: false }
					: {}),
			},
		}));
	}
	const settings = settingsSchema.parse(
		await integrationRequest({
			action: "configure",
			...connection,
			config,
		}),
	);
	if (
		useIntegrationStore.getState().connection?.sessionId ===
		connection.sessionId
	)
		useIntegrationStore.setState({ settings });
}
