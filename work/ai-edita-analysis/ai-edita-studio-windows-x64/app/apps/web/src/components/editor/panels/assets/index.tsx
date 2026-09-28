"use client";
import { useEffect } from "react";

import { Separator } from "@/components/ui/separator";
import {
	type Tab,
	useAssetsPanelStore,
} from "@/components/editor/panels/assets/assets-panel-store";
import { TabBar } from "./tabbar";
import { Captions } from "@/subtitles/components/assets-view";
import { MediaView } from "./views/assets";
import { SettingsView } from "./views/settings";
import { SoundsView } from "@/sounds/components/assets-view";
import { StickersView } from "@/stickers/components/assets-view";
import { SimpleTextView } from "@/text/components/simple-assets-view";
import { EffectsView } from "@/effects/components/assets-view";
import { AdjustmentsView } from "@/effects/components/adjustments-view";
import { TransitionsView } from "@/transitions/components/assets-view";
import { SettingsEntry } from "@/operations/settings";
import { AgentStudio } from "@/integrations/agent-studio";
import { ModelsView } from "@/templates/models-view";
import { EditingTemplatesView } from "@/templates/editing-templates-view";

export function AssetsPanel() {
	const { activeTab } = useAssetsPanelStore();
	useEffect(() => {
		const openHashPanel = () => {
			if (window.location.hash === "#editing-templates")
				useAssetsPanelStore.getState().setActiveTab("models");
			if (
				["#models", "#modelos", "#titles", "#titulos"].includes(
					window.location.hash,
				)
			)
				useAssetsPanelStore.getState().setActiveTab("titles");
		};
		openHashPanel();
		window.addEventListener("hashchange", openHashPanel);
		return () => window.removeEventListener("hashchange", openHashPanel);
	}, []);

	const viewMap: Record<Tab, React.ReactNode> = {
		agent: <AgentStudio />,
		models: (
			<div className="h-full overflow-y-auto p-3">
				<EditingTemplatesView />
			</div>
		),
		titles: <ModelsView />,
		media: <MediaView />,
		sounds: <SoundsView />,
		text: <SimpleTextView />,
		stickers: <StickersView />,
		effects: <EffectsView />,
		transitions: <TransitionsView />,
		captions: <Captions />,
		adjustment: <AdjustmentsView />,
		settings: <SettingsView />,
		integrations: <SettingsEntry />,
	};

	return (
		<div className="panel bg-background flex h-full rounded-sm border overflow-hidden">
			<TabBar />
			<Separator orientation="vertical" />
			<div className="flex-1 overflow-hidden">{viewMap[activeTab]}</div>
		</div>
	);
}
