// Node platform adapter: private local persistence, encryption and legacy migration.
import fs from "node:fs";
import path from "node:path";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import {
	changeDocument,
	countDocuments,
	deleteDocument,
	getDocument,
	setDocument,
	sqliteStatus,
} from "./sqlite-store.mjs";

export function repoRoot() {
	const cwd = process.cwd();
	return cwd.replaceAll("\\", "/").endsWith("/apps/web")
		? path.resolve(cwd, "../..")
		: cwd;
}
export function dataRoot() {
	return process.env.AI_EDITA_DATA_DIR || path.join(repoRoot(), ".ai-edita");
}
export function legacyRoot() {
	return (
		process.env.AI_EDITA_LEGACY_ROOT ||
		path.join(process.env.LOCALAPPDATA || "", "Ai Edita", "app")
	);
}
function readJson(file, fallback) {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") return fallback;
		throw new Error(
			"Não foi possível ler o armazenamento local. Preserve o arquivo para recuperação.",
		);
	}
}
export function atomicJson(file, value) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const temp = file + "." + randomBytes(8).toString("hex") + ".tmp";
	fs.writeFileSync(temp, JSON.stringify(value), { mode: 0o600, flag: "wx" });
	fs.renameSync(temp, file);
}
function masterKey() {
	const file = path.join(dataRoot(), "vault.key");
	fs.mkdirSync(dataRoot(), { recursive: true });
	if (!fs.existsSync(file)) {
		try {
			fs.writeFileSync(file, randomBytes(32), { flag: "wx", mode: 0o600 });
		} catch (error) {
			if (error.code !== "EEXIST") throw error;
		}
	}
	const value = fs.readFileSync(file);
	if (value.length !== 32)
		throw new Error("Chave do cofre inválida. Não remova o arquivo.");
	return value;
}
export function vault() {
	const envelope = readJson(path.join(dataRoot(), "vault.json"), null);
	if (!envelope) return { openaiKey: "", accounts: {}, mcpToken: "" };
	const cipher = createDecipheriv(
		"aes-256-gcm",
		masterKey(),
		Buffer.from(envelope.iv, "base64"),
	);
	cipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
	return JSON.parse(
		Buffer.concat([
			cipher.update(Buffer.from(envelope.data, "base64")),
			cipher.final(),
		]).toString("utf8"),
	);
}
export function saveVault(value) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
	const data = Buffer.concat([
		cipher.update(JSON.stringify(value)),
		cipher.final(),
	]);
	atomicJson(path.join(dataRoot(), "vault.json"), {
		iv: iv.toString("base64"),
		tag: cipher.getAuthTag().toString("base64"),
		data: data.toString("base64"),
	});
}
function defaultSettings() {
	return {
		model: "gpt-5.4",
		revision: 0,
		allowEdits: false,
		shareWithOpenAI: false,
		shareAudioWithOpenAI: false,
		shareFramesWithAgents: false,
		autoConnect: false,
		schedulerEnabled: true,
		timeZone: "America/Sao_Paulo",
		dailyLimit: 4,
		postingSlots: ["08:00", "12:30", "18:30", "21:00"],
		exportFolder: "",
		apiVersion: "v25.0",
		cloudflaredPath: "",
		legacyImported: false,
		appearance: {
			productName: "AI Edita",
			logoLight: "",
			logoDark: "",
			appIcon: "",
			primaryColor: "#b9f443",
			accentColor: "#86b733",
			gradientStyle: "rich",
			customGradientColors: ["#557d1e", "#b9f443", "#dcff9c"],
			borderRadius: 12,
			defaultTheme: "dark",
			fontFamily: "DM Sans",
			customFontUrl: "",
			baseFontSize: 16,
		},
	};
}

export function readSettings() {
	const defaults = defaultSettings();
	const saved =
		getDocument({
			root: dataRoot(),
			namespace: "app",
			key: "settings",
		}) || {};
	return {
		...defaults,
		...saved,
		appearance: {
			...defaults.appearance,
			...(saved.appearance || {}),
		},
	};
}
export function saveSettings(value) {
	setDocument({
		root: dataRoot(),
		namespace: "app",
		key: "settings",
		value,
	});
}
function defaultWorkspace() {
	return {
		accounts: [],
		assets: [],
		tasks: [],
		publications: [],
		proposals: [],
		threads: [],
	};
}

export function readWorkspace() {
	return {
		...defaultWorkspace(),
		...(getDocument({
			root: dataRoot(),
			namespace: "app",
			key: "workspace",
		}) || {}),
	};
}
export function changeWorkspace(change) {
	return changeDocument({
		root: dataRoot(),
		namespace: "app",
		key: "workspace",
		fallback: defaultWorkspace,
		change,
	});
}
export function readInsights(accountId) {
	return getDocument({
		root: dataRoot(),
		namespace: "insights",
		key: accountId,
	});
}
export function saveInsights(accountId, value) {
	setDocument({
		root: dataRoot(),
		namespace: "insights",
		key: accountId,
		value,
	});
}
export function deleteInsights(accountId) {
	deleteDocument({
		root: dataRoot(),
		namespace: "insights",
		key: accountId,
	});
}
export function localDatabaseStatus() {
	return sqliteStatus({ root: dataRoot() });
}
export function openAIKey() {
	return vault().openaiKey || process.env.OPENAI_API_KEY || "";
}
export function mediaHostPath() {
	const configured = readSettings().cloudflaredPath;
	const candidates = [
		configured,
		process.env.AI_EDITA_CLOUDFLARED_PATH,
		path.join(
			legacyRoot(),
			"bin",
			process.platform === "win32" ? "cloudflared.exe" : "cloudflared",
		),
	];
	return (
		candidates.find((candidate) => candidate && fs.existsSync(candidate)) || ""
	);
}
export function publicSettings() {
	const { cloudflaredPath: _secretPath, ...settings } = readSettings();
	return {
		...settings,
		hasOpenAIKey: Boolean(openAIKey()),
		keySource: vault().openaiKey
			? "shared"
			: process.env.OPENAI_API_KEY
				? "environment"
				: "none",
		hasMediaHost: Boolean(mediaHostPath()),
	};
}
export function safeWorkspace() {
	const state = readWorkspace(),
		secrets = vault();
	return {
		...state,
		editorProjectCount: countDocuments({
			root: dataRoot(),
			namespace: "projects",
		}),
		assets: state.assets.map(({ file: _file, ...asset }) => asset),
		tasks: state.tasks.map(({ lease: _lease, ...task }) => task),
		accounts: state.accounts.map((account) => ({
			...account,
			hasToken: Boolean(secrets.accounts[account.id]),
		})),
		settings: publicSettings(),
	};
}
export function importLegacySettings() {
	const file = path.join(legacyRoot(), ".env");
	if (!fs.existsSync(file))
		throw new Error("Configuração anterior não encontrada neste computador.");
	const entries = {};
	for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
		const match = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
		if (match) entries[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
	}
	const secrets = vault(),
		settings = readSettings();
	if (!secrets.openaiKey && entries.OPENAI_API_KEY)
		secrets.openaiKey = entries.OPENAI_API_KEY;
	settings.exportFolder ||= entries.EXPORT_FOLDER || "";
	settings.cloudflaredPath ||= entries.CLOUDFLARED_PATH || "";
	if (entries.POSTING_TIME_ZONE) {
		try {
			new Intl.DateTimeFormat("en", { timeZone: entries.POSTING_TIME_ZONE });
			settings.timeZone = entries.POSTING_TIME_ZONE;
		} catch {}
	}
	const slots = (entries.POSTING_SLOTS || "")
		.split(",")
		.map((s) => s.trim())
		.filter((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s));
	if (slots.length) settings.postingSlots = [...new Set(slots)].slice(0, 25);
	const daily = Number(entries.DAILY_POST_LIMIT);
	if (Number.isInteger(daily) && daily >= 1 && daily <= 25)
		settings.dailyLimit = daily;
	if (/^v\d+\.\d+$/.test(entries.META_API_VERSION || ""))
		settings.apiVersion = entries.META_API_VERSION;
	if (
		entries.IG_USER_ID &&
		entries.IG_ACCESS_TOKEN &&
		/^\d+$/.test(entries.IG_USER_ID)
	) {
		const id = "ig-" + entries.IG_USER_ID;
		if (!secrets.accounts[id]) secrets.accounts[id] = entries.IG_ACCESS_TOKEN;
		changeWorkspace((state) => {
			if (!state.accounts.some((a) => a.id === id))
				state.accounts.push({
					id,
					igUserId: entries.IG_USER_ID,
					username: "Conta importada",
					loginType: "instagram",
					status: "unverified",
				});
		});
	}
	settings.legacyImported = true;
	settings.revision += 1;
	saveVault(secrets);
	saveSettings(settings);
	// Never migrate the old queue: both schedulers might publish the same media.
	return publicSettings();
}
