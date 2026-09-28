import { OperationsShell } from "@/operations/shell";
import { SettingsPanel } from "@/operations/settings";
export default function Page() {
	return (
		<OperationsShell>
			<SettingsPanel />
		</OperationsShell>
	);
}
