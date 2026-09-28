import { z } from "zod";
export const agentRunSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string(),
	sceneId: z.string(),
	status: z.enum(["running", "complete", "paused", "failed", "cancelled"]),
	startedAt: z.number(),
	text: z.string().max(20000),
	steps: z.array(z.string().max(2200)).max(100),
	operationIds: z.array(z.string()).max(100),
	maxCalls: z.number().int().min(1).max(48),
});
export type AgentRunSummary = z.infer<typeof agentRunSchema>;
