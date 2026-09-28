import { Suspense } from "react";
import { HannaPage } from "@/operations/pages";

export default function Page() {
	return (
		<Suspense fallback={null}>
			<HannaPage />
		</Suspense>
	);
}
