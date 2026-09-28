import type { RemotionProjectSnapshot, RemotionRenderJob } from "./types";
import { z } from "zod";

const renderJobSchema = z.object({
	id: z.string(),
	projectId: z.string(),
	status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
	progress: z.number(),
	step: z.string(),
	error: z.string().nullable(),
	warnings: z.array(z.string()),
	createdAt: z.string(),
	updatedAt: z.string(),
	startedAt: z.string().nullable(),
	finishedAt: z.string().nullable(),
	downloadUrl: z.string().nullable(),
});

const headers = {
	"content-type": "application/json",
	"x-opencut-client": "integrations",
};

async function readJob(response: Response): Promise<RemotionRenderJob> {
	const body: unknown = await response.json();
	if (!response.ok) {
		const message =
			body && typeof body === "object" && "error" in body && typeof body.error === "string"
				? body.error
				: `Falha no Remotion (HTTP ${response.status}).`;
		throw new Error(message);
	}
	return renderJobSchema.parse(body);
}

export async function enqueueRemotionRender({
	snapshot,
}: {
	snapshot: RemotionProjectSnapshot;
}) {
	return readJob(
		await fetch("/api/remotion/jobs", {
			method: "POST",
			headers,
			body: JSON.stringify(snapshot),
		}),
	);
}

export async function getRemotionRender({ jobId }: { jobId: string }) {
	return readJob(
		await fetch(`/api/remotion/jobs/${encodeURIComponent(jobId)}`, {
			headers: { "x-opencut-client": "integrations" },
			cache: "no-store",
		}),
	);
}

export async function cancelRemotionRender({ jobId }: { jobId: string }) {
	return readJob(
		await fetch(`/api/remotion/jobs/${encodeURIComponent(jobId)}`, {
			method: "DELETE",
			headers: { "x-opencut-client": "integrations" },
		}),
	);
}

export async function downloadRemotionRender({
	job,
}: {
	job: RemotionRenderJob;
}): Promise<ArrayBuffer> {
	if (!job.downloadUrl) throw new Error("A exportação não possui arquivo para baixar.");
	const response = await fetch(job.downloadUrl, {
		headers: { "x-opencut-client": "integrations" },
	});
	if (!response.ok) throw new Error(`Falha ao baixar o MP4 (HTTP ${response.status}).`);
	return response.arrayBuffer();
}
