import { HannaWorker } from "@/operations/worker";
import { notFound } from "next/navigation";
export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ task?: string; surface?: string }>;
}) {
	const { task, surface } = await searchParams;
	if (!task || !/^[a-f0-9-]{36}$/.test(task)) notFound();
	return (
		<HannaWorker
			taskId={task}
			surface={surface === "editor" ? "editor" : "worker"}
		/>
	);
}
