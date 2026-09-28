"use client";

import { useEffect, useRef, useState } from "react";
import { PackageOpen, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import {
	ensurePackagedFont,
	fontPackSchema,
	installFontPack,
	MAX_FONT_PACK_BYTES,
	packagedFontLabel,
	useFontPackCatalog,
} from "./font-packs";
import { cssFontFamily } from "@/fonts/css";

function FontPreview({
	family,
	selected,
	onSelect,
}: {
	family: string;
	selected: boolean;
	onSelect: () => void;
}) {
	useEffect(() => {
		void ensurePackagedFont({ family });
	}, [family]);
	return (
		<button
			type="button"
			onClick={onSelect}
			className={
				"rounded-xl border p-3 text-left transition-colors hover:border-primary " +
				(selected ? "border-primary bg-primary/5" : "bg-card")
			}
		>
			<span className="block truncate text-[10px] text-muted-foreground">
				{packagedFontLabel({ family })}
			</span>
			<span
				className="mt-2 block truncate text-xl"
				style={{ fontFamily: cssFontFamily({ family }) }}
			>
				Aa Título
			</span>
		</button>
	);
}

export function FontPackLibrary({
	selectedFamily,
	onSelectFamily,
}: {
	selectedFamily: string;
	onSelectFamily: (family: string) => void;
}) {
	const pt = useI18n().locale === "pt-BR";
	const catalog = useFontPackCatalog();
	const inputRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState("");
	const [error, setError] = useState("");
	const families = [...new Set(catalog.fonts.map((font) => font.family))];

	const importPack = async (file: File) => {
		setBusy(true);
		setNotice("");
		setError("");
		try {
			if (file.size > MAX_FONT_PACK_BYTES)
				throw new Error(pt ? "O pacote excede 128 MB." : "Pack exceeds 128 MB.");
			const document: unknown = JSON.parse(
				(await file.text()).replace(/^\uFEFF/, ""),
			);
			if (
				typeof document !== "object" ||
				document === null ||
				!("format" in document) ||
				document.format !== "ai-edita-font-pack"
			)
				throw new Error(
					pt
						? "Escolha um pacote de fontes .aiedita."
						: "Choose an .aiedita font pack.",
				);
			const pack = fontPackSchema.parse(document);
			const result = await installFontPack(pack);
			setNotice(
				pt
					? `${result.installed} fonte(s) ${result.updated ? "atualizadas" : "instaladas"} em ${result.families} família(s).`
					: `${result.installed} font(s) ${result.updated ? "updated" : "installed"} across ${result.families} families.`,
			);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Failed");
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className="space-y-3" data-i18n-skip="true">
			<input
				ref={inputRef}
				type="file"
				accept=".aiedita,application/json"
				aria-label={pt ? "Arquivo de pacote de fontes" : "Font pack file"}
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void importPack(file);
				}}
			/>
			<div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
				<div className="flex items-start gap-2">
					<PackageOpen className="mt-0.5 size-5 shrink-0 text-primary" />
					<div>
						<strong className="text-sm">
							{pt ? "Suas fontes" : "Your fonts"}
						</strong>
						<p className="mt-0.5 text-[11px] text-muted-foreground">
							{pt
								? "As famílias importadas aparecem abaixo com a própria tipografia."
								: "Imported families appear below in their own typeface."}
						</p>
					</div>
				</div>
				<Button
					type="button"
					size="sm"
					className="mt-3 w-full"
					disabled={busy}
					onClick={() => inputRef.current?.click()}
				>
					<Upload className="size-4" />
					{busy
						? pt
							? "Importando…"
							: "Importing…"
						: pt
							? "Importar pacote de fontes"
							: "Import font pack"}
				</Button>
			</div>
			{error && (
				<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
					{error}
				</p>
			)}
			{notice && (
				<p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs text-emerald-600">
					{notice}
				</p>
			)}
			{catalog.packs.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{catalog.packs.map((pack) => (
						<span key={pack.id} className="rounded-full border px-2 py-1 text-[10px] text-muted-foreground">
							{pack.name} · {pack.familyCount}
						</span>
					))}
				</div>
			)}
			{families.length > 0 ? (
				<div className="grid grid-cols-2 gap-2">
					{families.map((family) => (
						<FontPreview
							key={family}
							family={family}
							selected={family === selectedFamily}
							onSelect={() => onSelectFamily(family)}
						/>
					))}
				</div>
			) : (
				<div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
					{pt
						? "Importe um pacote para ver as prévias das fontes aqui."
						: "Import a pack to preview fonts here."}
				</div>
			)}
		</section>
	);
}
