export type InstagramAccount = {
	id: string;
	username: string;
	igUserId: string;
	loginType: "instagram" | "facebook";
	status: "unverified" | "connected" | "error";
	error?: string;
	verifiedAt?: string;
	followers?: number;
	mediaCount?: number;
	hasToken: boolean;
};
export type AppearanceSettings = {
	productName: string;
	logoLight: string;
	logoDark: string;
	appIcon: string;
	primaryColor: string;
	accentColor: string;
	gradientStyle: "solid" | "soft" | "rich" | "custom";
	customGradientColors: [string, string, string];
	borderRadius: number;
	defaultTheme: "light" | "dark" | "system";
	fontFamily: string;
	customFontUrl: string;
	baseFontSize: number;
};
export type SharedSettings = {
	model: string;
	hasOpenAIKey: boolean;
	keySource: string;
	revision: number;
	allowEdits: boolean;
	shareWithOpenAI: boolean;
	shareAudioWithOpenAI: boolean;
	shareFramesWithAgents: boolean;
	autoConnect: boolean;
	schedulerEnabled: boolean;
	timeZone: string;
	dailyLimit: number;
	postingSlots: string[];
	exportFolder: string;
	apiVersion: string;
	hasMediaHost: boolean;
	legacyImported: boolean;
	appearance: AppearanceSettings;
};
export type ContentAsset = {
	id: string;
	name: string;
	bytes: number;
	mimeType: string;
	kind: "source" | "export";
	projectId?: string;
	createdAt: string;
	media?: {
		duration: number;
		width: number;
		height: number;
		codec: string | null;
		reelProfile?: {
			compatible: true;
			fps: number;
			videoBitrate: number;
			codecString: string | null;
			audioSampleRate: number | null;
			audioChannels: number | null;
			audioBitrate: number | null;
			fastStart: boolean;
			noEditLists: boolean;
		};
	};
};
export type EditTask = {
	id: string;
	assetId?: string;
	projectId?: string;
	title: string;
	prompt: string;
	status: "queued" | "editing" | "review" | "failed" | "cancelled";
	createdAt: string;
	updatedAt: string;
	message?: string;
	exportAssetId?: string;
	// Guided batch intake (absent on older tasks).
	mode?: "template" | "presets" | "prompt";
	templateId?: string;
	templateName?: string;
	direction?: string;
	autoRender?: boolean;
	batchId?: string;
	batchTitle?: string;
	stage?: "queued" | "importing" | "transcribing" | "editing" | "rendering" | "done";
	retriedBy?: string;
	openInEditor?: boolean;
};
export type Publication = {
	id: string;
	assetId: string;
	accountId: string;
	caption: string;
	publishAt: string;
	status:
		| "scheduled"
		| "uploading"
		| "processing"
		| "publishing"
		| "published"
		| "failed"
		| "needs_review"
		| "cancelled";
	createdAt: string;
	mediaId?: string;
	permalink?: string;
	error?: string;
	containerId?: string;
	deliveryStage?:
		| "hosting_media"
		| "creating_container"
		| "uploading_media"
		| "processing"
		| "processing_wait"
		| "publishing"
		| "published"
		| "interrupted";
	providerStatus?: string;
	statusChecks?: number;
	lastCheckedAt?: string;
	lastProviderError?: string;
	deliveryAttempts?: number;
	nextDeliveryAttemptAt?: string | null;
};
export type PublicationProposal = {
	id: string;
	items: Array<{
		assetId: string;
		accountId: string;
		caption: string;
		publishAt: string;
	}>;
	status: "pending" | "confirmed" | "expired" | "superseded";
	createdAt: string;
	preflight?: {
		status: "passed";
		checkedAt: string;
		items: Array<{
			assetId: string;
			accountId: string;
			transport: "hosted_url" | "resumable";
			checks: string[];
		}>;
	};
};
export type HannaMessage = {
	id: string;
	role: "user" | "assistant";
	text: string;
	createdAt: string;
};
export type HannaThread = {
	id: string;
	title: string;
	messages: HannaMessage[];
	busy: boolean;
	updatedAt: string;
};
export type WorkspaceSnapshot = {
	settings: SharedSettings;
	editorProjectCount: number;
	accounts: InstagramAccount[];
	assets: ContentAsset[];
	tasks: EditTask[];
	publications: Publication[];
	proposals: PublicationProposal[];
	threads: HannaThread[];
	scheduler: { active: boolean; lastTick?: string; error?: string };
};
export type InstagramInsights = {
	accountId: string;
	fetchedAt: string;
	cached: boolean;
	profile: { username: string; followers_count?: number; media_count?: number };
	media: Array<{
		id: string;
		caption?: string;
		permalink?: string;
		timestamp?: string;
		media_type?: string;
		like_count?: number;
		comments_count?: number;
		insights: Record<string, number | null>;
		insightsError?: string;
	}>;
	totals: Record<string, number | null>;
};
