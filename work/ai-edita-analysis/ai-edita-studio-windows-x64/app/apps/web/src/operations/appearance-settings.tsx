"use client";

import { useRef, useState } from "react";
import {
	ImageIcon,
	Palette,
	RotateCcw,
	Save,
	Type,
	Upload,
	X,
} from "lucide-react";
import { DEFAULT_APP_ICON_URL } from "./appearance";
import type { AppearanceSettings } from "./types";

type BrandAssetKind = "logoLight" | "logoDark" | "appIcon";
type BrandAssetChange = { kind: BrandAssetKind; file: File | null };
const appearanceTabs = [
	{ id: "brand", label: "Marca", Icon: ImageIcon },
	{ id: "colors", label: "Cores", Icon: Palette },
	{ id: "type", label: "Tipografia", Icon: Type },
] satisfies Array<{
	id: "brand" | "colors" | "type";
	label: string;
	Icon: typeof ImageIcon;
}>;

export function AppearanceSettingsPanel({
	value,
	busy,
	onChange,
	onSave,
	onAsset,
}: {
	value: AppearanceSettings;
	busy: boolean;
	onChange: (value: AppearanceSettings) => void;
	onSave: () => void;
	onAsset: (change: BrandAssetChange) => void;
}) {
	const [tab, setTab] = useState<"brand" | "colors" | "type">("brand");
	const update = <K extends keyof AppearanceSettings>({
		key,
		fieldValue,
	}: {
		key: K;
		fieldValue: AppearanceSettings[K];
	}) => onChange({ ...value, [key]: fieldValue });

	return (
		<div className="ops-appearance">
			<div className="ops-appearance-heading">
				<div>
					<h2>Aparência</h2>
					<p>Personalize a identidade visual usada em todo o AI Edita.</p>
				</div>
				<button className="ops-button primary" disabled={busy} onClick={onSave}>
					<Save size={16} /> Salvar aparência
				</button>
			</div>

			<div
				className="ops-appearance-tabs"
				role="tablist"
				aria-label="Aparência"
			>
				{appearanceTabs.map(({ id, label, Icon }) => (
					<button
						type="button"
						role="tab"
						aria-selected={tab === id}
						className={tab === id ? "active" : ""}
						key={id}
						onClick={() => setTab(id)}
					>
						<Icon size={16} /> {label}
					</button>
				))}
			</div>

			{tab === "brand" && (
				<div className="ops-grid two">
					<section className="ops-card ops-appearance-span">
						<h2>Identidade da marca</h2>
						<p>Nome, logos e ícone exibidos para quem usa este estúdio.</p>
						<label className="ops-field">
							Nome do produto
							<input
								value={value.productName}
								maxLength={60}
								onChange={(event) =>
									update({ key: "productName", fieldValue: event.target.value })
								}
							/>
						</label>
					</section>
					<BrandUploader
						title="Logo principal (tema claro)"
						note="Horizontal · PNG, JPG, WEBP ou SVG · até 2 MB"
						value={value.logoLight}
						kind="logoLight"
						busy={busy}
						onAsset={onAsset}
					/>
					<BrandUploader
						title="Logo para tema escuro"
						note="Use uma versão com contraste para fundos escuros."
						value={value.logoDark}
						kind="logoDark"
						busy={busy}
						onAsset={onAsset}
					/>
					<BrandUploader
						title="Ícone do aplicativo"
						note="Quadrado · recomendado 512 × 512 px."
						value={value.appIcon}
						fallback={DEFAULT_APP_ICON_URL}
						kind="appIcon"
						busy={busy}
						onAsset={onAsset}
					/>
					<section className="ops-card ops-brand-preview">
						<span>Pré-visualização</span>
						<div>
							{value.logoLight ? (
								<img src={value.logoLight} alt={value.productName} />
							) : (
								<>
									<img src={value.appIcon || DEFAULT_APP_ICON_URL} alt="" />
									<strong>{value.productName}</strong>
								</>
							)}
						</div>
					</section>
				</div>
			)}

			{tab === "colors" && (
				<div className="ops-grid two">
					<section className="ops-card">
						<h2>Paleta da plataforma</h2>
						<p>Botões, foco, destaques e cartões acompanham esses tokens.</p>
						<div className="ops-grid two">
							<ColorField
								label="Cor primária"
								value={value.primaryColor}
								onChange={(color) =>
									update({ key: "primaryColor", fieldValue: color })
								}
							/>
							<ColorField
								label="Cor de destaque"
								value={value.accentColor}
								onChange={(color) =>
									update({ key: "accentColor", fieldValue: color })
								}
							/>
						</div>
						<div className="ops-field">Estilo do gradiente</div>
						<div className="ops-gradient-options">
							{(["solid", "soft", "rich", "custom"] as const).map((style) => (
								<button
									type="button"
									key={style}
									className={value.gradientStyle === style ? "active" : ""}
									onClick={() =>
										update({ key: "gradientStyle", fieldValue: style })
									}
								>
									<span style={{ background: gradient({ value, style }) }} />
									<strong>{gradientLabels[style]}</strong>
									<small>{gradientNotes[style]}</small>
								</button>
							))}
						</div>
						{value.gradientStyle === "custom" && (
							<div className="ops-grid three ops-custom-colors">
								{value.customGradientColors.map((color, index) => (
									<ColorField
										key={index}
										label={`Cor ${index + 1}`}
										value={color}
										onChange={(next) => {
											const [first, second, third] = value.customGradientColors;
											const colors: [string, string, string] = [
												first,
												second,
												third,
											];
											colors[index] = next;
											update({
												key: "customGradientColors",
												fieldValue: colors,
											});
										}}
									/>
								))}
							</div>
						)}
						<label className="ops-field ops-range">
							<span>
								Raio de borda padrão <b>{value.borderRadius}px</b>
							</span>
							<input
								type="range"
								min="0"
								max="24"
								value={value.borderRadius}
								onChange={(event) =>
									update({
										key: "borderRadius",
										fieldValue: Number(event.target.value),
									})
								}
							/>
							<small>0 = quadrado · 12 = padrão · 24 = bem arredondado</small>
						</label>
						<label className="ops-field">
							Tema padrão para novos usuários
							<select
								value={value.defaultTheme}
								onChange={(event) =>
									update({
										key: "defaultTheme",
										fieldValue:
											event.target.value === "light"
												? "light"
												: event.target.value === "system"
													? "system"
													: "dark",
									})
								}
							>
								<option value="light">Claro</option>
								<option value="dark">Escuro</option>
								<option value="system">Seguir o sistema</option>
							</select>
						</label>
					</section>
					<LivePreview value={value} />
				</div>
			)}

			{tab === "type" && (
				<div className="ops-grid two">
					<section className="ops-card">
						<h2>Fontes</h2>
						<p>A família e o tamanho base são aplicados globalmente.</p>
						<label className="ops-field">
							Família da fonte
							<input
								list="ai-edita-font-families"
								value={value.fontFamily}
								onChange={(event) =>
									update({ key: "fontFamily", fieldValue: event.target.value })
								}
							/>
							<datalist id="ai-edita-font-families">
								{[
									"DM Sans",
									"Inter",
									"Manrope",
									"Creato Display",
									"Arial",
									"Georgia",
								].map((font) => (
									<option key={font} value={font} />
								))}
							</datalist>
						</label>
						<label className="ops-field">
							URL CSS do Google Fonts (opcional)
							<input
								placeholder="https://fonts.googleapis.com/css2?family=..."
								value={value.customFontUrl}
								onChange={(event) =>
									update({
										key: "customFontUrl",
										fieldValue: event.target.value,
									})
								}
							/>
							<small>
								Informe também o nome exato da família no seletor ou use uma das
								fontes disponíveis.
							</small>
						</label>
						<label className="ops-field ops-range">
							<span>
								Tamanho base <b>{value.baseFontSize}px</b>
							</span>
							<input
								type="range"
								min="13"
								max="20"
								value={value.baseFontSize}
								onChange={(event) =>
									update({
										key: "baseFontSize",
										fieldValue: Number(event.target.value),
									})
								}
							/>
						</label>
						<button
							type="button"
							className="ops-button"
							onClick={() => {
								onChange({
									...value,
									fontFamily: "DM Sans",
									customFontUrl: "",
									baseFontSize: 16,
								});
							}}
						>
							<RotateCcw size={15} /> Restaurar tipografia
						</button>
					</section>
					<section
						className="ops-card ops-type-preview"
						style={{
							fontFamily: value.fontFamily,
							fontSize: value.baseFontSize,
						}}
					>
						<h2>Pré-visualização</h2>
						<div>
							<h1>Heading 1</h1>
							<h2>Heading 2</h2>
							<p>
								O rato roeu a roupa do rei de Roma. Esta é a aparência do corpo
								do texto.
							</p>
							<small>Texto secundário com estilo menor.</small>
						</div>
					</section>
				</div>
			)}
		</div>
	);
}

function BrandUploader({
	title,
	note,
	value,
	fallback,
	kind,
	busy,
	onAsset,
}: {
	title: string;
	note: string;
	value: string;
	fallback?: string;
	kind: BrandAssetKind;
	busy: boolean;
	onAsset: (change: BrandAssetChange) => void;
}) {
	const input = useRef<HTMLInputElement>(null);
	return (
		<section className="ops-card ops-brand-upload">
			<h3>{title}</h3>
			<div className="ops-brand-drop">
				{value || fallback ? (
					<img src={value || fallback} alt="" />
				) : (
					<ImageIcon size={34} />
				)}
				<div>
					<button
						type="button"
						className="ops-button small"
						disabled={busy}
						onClick={() => input.current?.click()}
					>
						<Upload size={14} /> Escolher arquivo
					</button>
					{value && (
						<button
							type="button"
							className="ops-button small"
							disabled={busy}
							onClick={() => onAsset({ kind, file: null })}
						>
							<X size={14} /> Remover
						</button>
					)}
				</div>
				<input
					ref={input}
					hidden
					type="file"
					accept="image/png,image/jpeg,image/webp,image/svg+xml"
					onChange={(event) => {
						const file = event.target.files?.[0];
						if (file) onAsset({ kind, file });
						event.target.value = "";
					}}
				/>
			</div>
			<p>{note}</p>
		</section>
	);
}

function ColorField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className="ops-field ops-color-field">
			{label}
			<span>
				<input
					type="color"
					value={value}
					onChange={(event) => onChange(event.target.value)}
				/>
				<input
					value={value}
					pattern="#[0-9a-fA-F]{6}"
					onChange={(event) => onChange(event.target.value)}
				/>
			</span>
		</label>
	);
}

const gradientLabels = {
	solid: "Sólido",
	soft: "Suave",
	rich: "Rico",
	custom: "Personalizado",
};
const gradientNotes = {
	solid: "Uma cor",
	soft: "Cor → claro",
	rich: "Escuro → cor → claro",
	custom: "Três cores manuais",
};

function gradient({
	value,
	style = value.gradientStyle,
}: {
	value: AppearanceSettings;
	style?: AppearanceSettings["gradientStyle"];
}) {
	if (style === "solid") return value.primaryColor;
	if (style === "soft")
		return `linear-gradient(120deg, ${value.primaryColor}, color-mix(in srgb, ${value.primaryColor} 45%, white))`;
	const colors =
		style === "custom"
			? value.customGradientColors
			: [value.accentColor, value.primaryColor, "#dcff9c"];
	return `linear-gradient(120deg, ${colors.join(", ")})`;
}

function LivePreview({ value }: { value: AppearanceSettings }) {
	return (
		<section className="ops-card ops-live-preview">
			<div className="ops-row between">
				<strong>PRÉ-VISUALIZAÇÃO AO VIVO</strong>
				<small>Atualiza ao alterar</small>
			</div>
			<div
				className="ops-live-hero"
				style={{
					background: gradient({ value }),
					borderRadius: value.borderRadius,
				}}
			>
				<div>
					{value.logoLight ? (
						<img src={value.logoLight} alt={value.productName} />
					) : (
						<>
							<img src={value.appIcon || DEFAULT_APP_ICON_URL} alt="" />
							<strong>{value.productName}</strong>
						</>
					)}
				</div>
				<h2>Sua plataforma</h2>
				<p>Identidade principal aplicada</p>
			</div>
			<div className="ops-row wrap ops-preview-controls">
				<button
					type="button"
					style={{
						background: value.primaryColor,
						borderRadius: value.borderRadius,
					}}
				>
					Botão primário
				</button>
				<button
					type="button"
					className="outline"
					style={{
						borderColor: value.primaryColor,
						color: value.primaryColor,
						borderRadius: value.borderRadius,
					}}
				>
					Outline
				</button>
				<span
					style={{
						background: value.accentColor,
						borderRadius: value.borderRadius,
					}}
				>
					Badge
				</span>
			</div>
			<div
				className="ops-preview-card"
				style={{ borderRadius: value.borderRadius }}
			>
				<img src={value.appIcon || DEFAULT_APP_ICON_URL} alt="" />
				<div>
					<strong>Card de exemplo</strong>
					<small>Bordas, ícones e cores acompanham seus tokens.</small>
				</div>
			</div>
		</section>
	);
}
