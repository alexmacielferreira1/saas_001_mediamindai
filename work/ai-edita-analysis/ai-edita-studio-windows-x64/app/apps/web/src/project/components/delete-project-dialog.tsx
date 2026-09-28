"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";

export function DeleteProjectDialog({
	isOpen,
	onOpenChange,
	onConfirm,
	projectNames,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	projectNames: string[];
}) {
	const { locale, t } = useI18n();
	const count = projectNames.length;
	const isSingle = count === 1;
	const singleName = isSingle ? projectNames[0] : null;

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					event.stopPropagation();
				}}
			>
				<DialogHeader>
					<DialogTitle>
						{singleName ? (
							<>
								{t("Delete")} “
								<span
									data-i18n-skip="true"
									className="inline-block max-w-[300px] truncate align-bottom"
								>
									{singleName}
								</span>
								”?
							</>
						) : locale === "pt-BR" ? (
							`Excluir ${count} projetos?`
						) : (
							`Delete ${count} projects?`
						)}
					</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<Alert variant="destructive">
						<AlertTitle>{t("Warning")}</AlertTitle>
						<AlertDescription>
							{locale === "pt-BR" ? (
								<>
									Isso excluirá permanentemente{" "}
									<span data-i18n-skip="true">
										{singleName ? `“${singleName}”` : `${count} projetos`}
									</span>{" "}
									e todos os arquivos associados.
								</>
							) : (
								<>
									This will permanently delete{" "}
									<span data-i18n-skip="true">
										{singleName ? `“${singleName}”` : `${count} projects`}
									</span>{" "}
									and all associated files.
								</>
							)}
						</AlertDescription>
					</Alert>
					<div className="flex flex-col gap-3">
						<Label className="text-xs font-semibold text-slate-500">
							{t('Type "DELETE" to confirm')}
						</Label>
						<Input
							type="text"
							placeholder="DELETE"
							size="lg"
							variant="destructive"
						/>
					</div>
				</DialogBody>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t("Cancel")}
					</Button>
					<Button variant="destructive" onClick={onConfirm}>
						{t("Delete project")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
