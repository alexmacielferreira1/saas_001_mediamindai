import { Suspense } from "react";
import { AgendaPage } from "@/operations/pages";

export default function Page() {
	return (
		<Suspense fallback={null}>
			<AgendaPage />
		</Suspense>
	);
}
