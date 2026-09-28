"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	LayoutDashboard,
	Sparkles,
	Film,
	CalendarDays,
	ChartNoAxesCombined,
	Settings2,
	Clapperboard,
	ListVideo,
} from "lucide-react";
import { LanguageToggle } from "@/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWorkspace, useWorkspacePolling } from "./client";
import { DEFAULT_APP_ICON_URL, useAppearance } from "./appearance";
import { ContentIntakeButton } from "./content-intake";
import { useTheme } from "next-themes";
import "./workspace.css";
import "./intake-queue.css";

const navigation = [
	{ href: "/overview", label: "Visão geral", icon: LayoutDashboard },
	{ href: "/conteudos", label: "Conteúdos", icon: Clapperboard },
	{ href: "/fila", label: "Fila", icon: ListVideo },
	{ href: "/hanna", label: "Hanna", icon: Sparkles },
	{ href: "/projects", label: "Editor", icon: Film },
	{ href: "/agenda", label: "Agenda", icon: CalendarDays },
	{ href: "/insights", label: "Insights", icon: ChartNoAxesCombined },
	{ href: "/configuracoes", label: "Configurações", icon: Settings2 },
];
export function OperationsShell({ children }: { children: React.ReactNode }) {
	useWorkspacePolling();
	const pathname = usePathname();
	const { data, error, accountId, selectAccount } = useWorkspace();
	const appearance = useAppearance();
	const { resolvedTheme } = useTheme();
	const brandLogo =
		resolvedTheme === "dark"
			? appearance.logoDark || appearance.logoLight
			: appearance.logoLight || appearance.logoDark;
	const active = navigation.find((item) => item.href === pathname);
	return (
		<div className="operations ops-shell">
			<aside className="ops-sidebar">
				<Link href="/overview" className="ops-brand">
					{brandLogo ? (
						<img src={brandLogo} alt={appearance.productName} />
					) : (
						<>
							<img
								className="ops-brand-icon"
								src={appearance.appIcon || DEFAULT_APP_ICON_URL}
								alt=""
							/>
							<strong>{appearance.productName}</strong>
						</>
					)}
				</Link>
				<div className="ops-overline">SEU ESTÚDIO DE CONTEÚDO</div>
				<nav aria-label="Menu principal">
					{navigation.map(({ href, label, icon: Icon }, index) => (
						<Link
							key={href}
							href={href}
							className={pathname === href ? "active" : ""}
							aria-current={pathname === href ? "page" : undefined}
						>
							<Icon size={18} />
							<span>{label}</span>
							<small>{String(index + 1).padStart(2, "0")}</small>
						</Link>
					))}
				</nav>
				<div className="ops-sidebar-foot">
					<span
						className={
							data?.scheduler.active && data?.settings.schedulerEnabled
								? "ops-dot"
								: "ops-dot off"
						}
					/>
					{data?.scheduler.active && data?.settings.schedulerEnabled
						? "Agendador ativo"
						: "Agendador pausado"}
					<p>
						Dados neste computador.
						<br />
						Mantenha o servidor ligado para publicar.
					</p>
				</div>
			</aside>
			<div className="ops-main">
				<header className="ops-header">
					<div>
						<div className="ops-overline">OPERAÇÃO DE CONTEÚDO</div>
						<h1>{active?.label || "AI Edita"}</h1>
					</div>
					<div className="ops-header-actions">
						<LanguageToggle />
						<ThemeToggle />
						<label className="ops-account">
							<span className="ops-avatar">IG</span>
							<select
								aria-label="Instagram ativo"
								value={accountId}
								onChange={(e) => selectAccount(e.target.value)}
							>
								{!data?.accounts.length && (
									<option value="">Conectar Instagram</option>
								)}
								{data?.accounts.map((a) => (
									<option key={a.id} value={a.id}>
										@{a.username} ·{" "}
										{a.status === "connected" ? "conectado" : "validar"}
									</option>
								))}
							</select>
						</label>
						<ContentIntakeButton label="Novo conteúdo" />
					</div>
				</header>
				{error && (
					<div className="ops-alert" role="alert">
						{error}
					</div>
				)}
				{data?.scheduler.error && (
					<div className="ops-alert" role="alert">
						{data.scheduler.error}
					</div>
				)}
				{children}
			</div>
		</div>
	);
}
export function EmptyPanel({
	title,
	text,
	children,
}: {
	title: string;
	text: string;
	children?: React.ReactNode;
}) {
	return (
		<div className="ops-empty">
			<Sparkles size={25} />
			<h3>{title}</h3>
			<p>{text}</p>
			{children}
		</div>
	);
}
