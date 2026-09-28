import { HannaWorker } from "@/operations/worker";
import { notFound } from "next/navigation";

export default async function GuidedEditorPage({
	searchParams,
}: {
	searchParams: Promise<{ task?: string }>;
}) {
	const { task } = await searchParams;
	if (!task || !/^[a-f0-9-]{36}$/.test(task)) notFound();
	return <HannaWorker taskId={task} surface="editor" />;
}
