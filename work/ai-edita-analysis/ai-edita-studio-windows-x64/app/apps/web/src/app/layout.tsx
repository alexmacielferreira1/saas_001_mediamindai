import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "../components/ui/sonner";
import { TooltipProvider } from "../components/ui/tooltip";
import { baseMetaData } from "./metadata";
import { I18nProvider } from "@/i18n";
import { AppearanceProvider } from "@/operations/appearance";

export const metadata = baseMetaData;

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const localServerStorage = process.env.NEXT_PUBLIC_AI_EDITA_LOCAL_MODE === "1";

	return (
		<html
			lang="pt-BR"
			data-ai-edita-local-server={localServerStorage ? "true" : "false"}
			suppressHydrationWarning
		>
			<head></head>
			<body className="font-sans antialiased">
				<I18nProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="dark"
						storageKey="ai-edita-theme"
						disableTransitionOnChange
					>
						<AppearanceProvider>
							<TooltipProvider>
								<Toaster />
								{children}
							</TooltipProvider>
						</AppearanceProvider>
					</ThemeProvider>
				</I18nProvider>
			</body>
		</html>
	);
}
