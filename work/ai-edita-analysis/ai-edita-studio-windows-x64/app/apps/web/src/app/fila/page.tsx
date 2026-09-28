import { Suspense } from "react";
import { QueuePage } from "@/operations/queue-page";

export default function Page() {
	return (
		<Suspense fallback={null}>
			<QueuePage />
		</Suspense>
	);
}
