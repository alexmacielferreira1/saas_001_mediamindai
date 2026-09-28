import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const host = "127.0.0.1";
const defaultPort = 3000;
const portSearchCount = 20;
const canonicalDataProfile = "AI Edita";
const legacyDataProfiles = ["AI Edita Remotion"];
let logFilePath = null;

function appUrlForPort(port) {
	return `http://${host}:${port}`;
}

function healthUrlForPort(port) {
	return `${appUrlForPort(port)}/api/health`;
}

function writeLog(message) {
	if (!logFilePath) return;
	try {
		appendFileSync(
			logFilePath,
			`[${new Date().toISOString()}] ${String(message).trimEnd()}\n`,
			"utf8",
		);
	} catch {
		// A log failure must never prevent the application from starting.
	}
}

export function appDataRoot({
	platform = process.platform,
	environment = process.env,
	homeDirectory = os.homedir(),
	profile = canonicalDataProfile,
} = {}) {
	if (platform === "win32") {
		return path.win32.join(
			environment.LOCALAPPDATA ||
				path.win32.join(homeDirectory, "AppData", "Local"),
			profile,
		);
	}

	if (platform === "darwin") {
		return path.posix.join(
			homeDirectory,
			"Library",
			"Application Support",
			profile,
		);
	}

	return path.posix.join(
		environment.XDG_DATA_HOME ||
			path.posix.join(homeDirectory, ".local", "share"),
		profile.toLowerCase().replaceAll(" ", "-"),
	);
}

function containsCredentialVault(root, fileExists = existsSync) {
	const dataDirectory = path.join(root, "data");
	return (
		fileExists(path.join(dataDirectory, "vault.json")) &&
		fileExists(path.join(dataDirectory, "vault.key"))
	);
}

function containsDatabase(root, fileExists = existsSync) {
	return fileExists(path.join(root, "data", "ai-edita.db"));
}

export function resolveAppDataRoot({
	canonicalRoot = appDataRoot(),
	legacyRoots = legacyDataProfiles.map((profile) => appDataRoot({ profile })),
	fileExists = existsSync,
} = {}) {
	// Credentials are encrypted with a separate key, so the complete vault pair
	// takes precedence over an empty database created by a short-lived test build.
	if (containsCredentialVault(canonicalRoot, fileExists)) return canonicalRoot;
	const legacyVault = legacyRoots.find((root) =>
		containsCredentialVault(root, fileExists),
	);
	if (legacyVault) return legacyVault;
	if (containsDatabase(canonicalRoot, fileExists)) return canonicalRoot;
	return (
		legacyRoots.find((root) => containsDatabase(root, fileExists)) ??
		canonicalRoot
	);
}

function findFirst(paths) {
	return paths.find((candidate) => candidate && existsSync(candidate));
}

function findServer() {
	const server = findFirst([
		path.join(packageRoot, "app", "apps", "web", "server.js"),
		path.join(packageRoot, "app", "server.js"),
	]);

	if (!server) {
		throw new Error(
			"Servidor compilado nao encontrado. Extraia novamente o pacote completo.",
		);
	}

	return server;
}

/** This installation's identity: the build stamped at packaging time and its folder. */
export function installationIdentity(root = packageRoot) {
	let build = "";
	try {
		build = String(
			JSON.parse(readFileSync(path.join(root, "app", "ai-edita-build.json"), "utf8"))
				.id ?? "",
		);
	} catch {
		// An older package has no stamp. It then never matches a running instance, which
		// is the safe answer: a new installation must not hand the person an old one.
	}
	return { build, install: path.resolve(root) };
}

export function isSameInstallation({ headers, identity }) {
	const build = headers.build ?? "";
	const install = headers.install ?? "";
	if (!identity.build || !build) return false;
	return (
		build === identity.build &&
		path.resolve(install || ".") === path.resolve(identity.install)
	);
}

export async function inspectServer(port) {
	try {
		const response = await fetch(healthUrlForPort(port), {
			signal: AbortSignal.timeout(1_000),
		});
		if (
			!response.ok ||
			(await response.text()) !== "OK" ||
			response.headers.get("x-ai-edita-storage")?.toLowerCase() !== "sqlite"
		)
			return null;
		return {
			build: response.headers.get("x-ai-edita-build") ?? "",
			install: response.headers.get("x-ai-edita-install") ?? "",
		};
	} catch {
		return null;
	}
}

export async function isServerReady(port) {
	return (await inspectServer(port)) !== null;
}

function canListen(port) {
	return new Promise((resolve) => {
		const probe = createServer();
		probe.unref();
		probe.once("error", () => resolve(false));
		probe.listen({ host, port, exclusive: true }, () => {
			probe.close(() => resolve(true));
		});
	});
}

function preferredPort() {
	const requested = Number.parseInt(process.env.AI_EDITA_PORT ?? "", 10);
	return Number.isInteger(requested) && requested > 0 && requested <= 65_515
		? requested
		: defaultPort;
}

export async function chooseEndpoint({ candidatePorts, identity } = {}) {
	const start = preferredPort();
	const candidates =
		candidatePorts ??
		Array.from({ length: portSearchCount }, (_, index) => start + index).filter(
			(port) => port <= 65_535,
		);
	const self = identity ?? installationIdentity();
	let firstAvailable = null;
	let otherVersion = null;

	for (const candidate of candidates) {
		if (await canListen(candidate)) {
			firstAvailable ??= candidate;
			continue;
		}
		const headers = await inspectServer(candidate);
		if (!headers) continue;
		// Reuse only this very installation: another build, or the same build from another
		// folder, is a different version and must not be opened in its place.
		if (isSameInstallation({ headers, identity: self })) {
			return { port: candidate, reuseExisting: true };
		}
		otherVersion ??= { port: candidate, install: headers.install };
	}

	if (firstAvailable !== null && otherVersion) {
		return { port: firstAvailable, reuseExisting: false, otherVersion };
	}

	if (firstAvailable !== null) {
		return { port: firstAvailable, reuseExisting: false };
	}

	throw new Error(
		`Nenhuma porta livre encontrada entre ${candidates[0]} e ${candidates.at(-1)}. Feche outro programa ou defina AI_EDITA_PORT.`,
	);
}

// The first start after extracting can be slow: macOS scans the bundled Node.js and
// older Intel Macs need time to load the server. Give it room and say what is happening.
const serverStartTimeoutMs = 120_000;

async function waitForServer(child, port) {
	const startedAt = Date.now();
	const deadline = startedAt + serverStartTimeoutMs;
	let notified = false;

	while (Date.now() < deadline) {
		if (!notified && Date.now() - startedAt > 15_000) {
			notified = true;
			console.log(
				"Preparando o AI Edita. Na primeira abertura isso pode levar ate 2 minutos...",
			);
		}
		if (child.exitCode !== null) {
			throw new Error(
				`O servidor local encerrou com o codigo ${child.exitCode}.`,
			);
		}

		if (await isServerReady(port)) return;
		await new Promise((resolve) => setTimeout(resolve, 250));
	}

	throw new Error(
		`O servidor local nao respondeu em ${serverStartTimeoutMs / 1000} segundos.`,
	);
}

function pipeServerOutput(child) {
	child.stdout?.on("data", (chunk) => {
		process.stdout.write(chunk);
		writeLog(`[servidor] ${chunk}`);
	});
	child.stderr?.on("data", (chunk) => {
		process.stderr.write(chunk);
		writeLog(`[servidor/erro] ${chunk}`);
	});
}

function startServer(dataRoot, port) {
	const serverPath = findServer();
	const appUrl = appUrlForPort(port);
	const bundledCloudflared = path.join(
		packageRoot,
		"tools",
		process.platform === "win32" ? "cloudflared.exe" : "cloudflared",
	);
	const env = {
		...process.env,
		AI_EDITA_DATA_DIR: path.join(dataRoot, "data"),
		AI_EDITA_LOCAL_MODE: "1",
		AI_EDITA_BUILD: installationIdentity().build,
		AI_EDITA_INSTALL: path.resolve(packageRoot),
		NEXT_PUBLIC_AI_EDITA_LOCAL_MODE: "1",
		NODE_ENV: "production",
		HOSTNAME: host,
		PORT: String(port),
		NEXT_PUBLIC_SITE_URL: appUrl,
		NEXT_PUBLIC_MARBLE_API_URL: "https://api.marblecms.com",
		DATABASE_URL: "postgresql://local:local@127.0.0.1:5432/local",
		BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"),
		UPSTASH_REDIS_REST_URL: "http://127.0.0.1:8079",
		UPSTASH_REDIS_REST_TOKEN: "local",
		MARBLE_WORKSPACE_KEY: "local",
		FREESOUND_CLIENT_ID: "local",
		FREESOUND_API_KEY: "local",
		AI_EDITA_CLOUDFLARED_PATH: existsSync(bundledCloudflared)
			? bundledCloudflared
			: "",
	};

	const child = spawn(process.execPath, [serverPath], {
		cwd: path.dirname(serverPath),
		env,
		stdio: ["ignore", "pipe", "pipe"],
		windowsHide: true,
	});
	pipeServerOutput(child);
	return child;
}

export function macChromeApp({
	homeDirectory = os.homedir(),
	fileExists = existsSync,
} = {}) {
	return [
		"/Applications/Google Chrome.app",
		path.posix.join(homeDirectory, "Applications", "Google Chrome.app"),
	].find((candidate) => fileExists(candidate));
}

function openApp(port) {
	const appUrl = appUrlForPort(port);
	if (process.platform === "win32") {
		return spawn("explorer.exe", [appUrl], {
			stdio: "ignore",
			windowsHide: true,
		});
	}
	if (process.platform === "darwin") {
		// Editing and export are validated in Chrome; Safari lacks parts of the video APIs.
		const chrome = macChromeApp();
		if (!chrome)
			console.log(
				"Dica: use o Google Chrome atualizado para editar e exportar. Abrindo no navegador padrao.",
			);
		return spawn("open", chrome ? ["-a", chrome, appUrl] : [appUrl], {
			stdio: "ignore",
		});
	}
	return spawn("xdg-open", [appUrl], { stdio: "ignore" });
}

export function desktopShortcutSpec(root = packageRoot) {
	return {
		target: path.join(root, "Iniciar AI Edita.cmd"),
		workingDirectory: root,
		icon: path.join(root, "AI Edita.ico"),
	};
}

export function desktopShortcutScript() {
	return [
		"$shell = New-Object -ComObject WScript.Shell",
		"$desktop = [Environment]::GetFolderPath('Desktop')",
		"$shortcut = $shell.CreateShortcut((Join-Path $desktop 'AI Edita Studio.lnk'))",
		"$shortcut.TargetPath = $env:AI_EDITA_SHORTCUT_TARGET",
		"$shortcut.WorkingDirectory = $env:AI_EDITA_SHORTCUT_WORKDIR",
		"$shortcut.IconLocation = $env:AI_EDITA_SHORTCUT_ICON + ',0'",
		"$shortcut.Description = 'AI Edita Studio'",
		"$shortcut.WindowStyle = 1",
		"$shortcut.Save()",
	].join("; ");
}

export function ensureDesktopShortcut() {
	if (process.platform !== "win32") return false;
	const spec = desktopShortcutSpec();
	if (!existsSync(spec.target) || !existsSync(spec.icon)) {
		writeLog("Atalho nao criado: iniciador ou icone do pacote ausente.");
		return false;
	}
	const result = spawnSync(
		"powershell.exe",
		[
			"-NoLogo",
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			desktopShortcutScript(),
		],
		{
			windowsHide: true,
			encoding: "utf8",
			env: {
				...process.env,
				AI_EDITA_SHORTCUT_TARGET: spec.target,
				AI_EDITA_SHORTCUT_WORKDIR: spec.workingDirectory,
				AI_EDITA_SHORTCUT_ICON: spec.icon,
			},
		},
	);
	if (result.status !== 0 || result.error) {
		writeLog(
			`Atalho nao criado: ${result.error?.message || result.stderr || `codigo ${result.status}`}`,
		);
		return false;
	}
	writeLog("Atalho da area de trabalho criado ou atualizado.");
	return true;
}

function waitForSpawn(child) {
	return new Promise((resolve, reject) => {
		child.once("spawn", resolve);
		child.once("error", reject);
	});
}

async function main() {
	const dataRoot = resolveAppDataRoot();
	mkdirSync(path.join(dataRoot, "data"), { recursive: true });
	logFilePath = path.join(dataRoot, "launcher.log");
	writeLog(`Iniciando pelo pacote ${packageRoot}`);
	writeLog(`Dados persistentes em ${dataRoot}`);
	ensureDesktopShortcut();

	const identity = installationIdentity();
	const endpoint = await chooseEndpoint({ identity });
	const { port } = endpoint;
	if (endpoint.otherVersion) {
		writeLog(
			`Outra versao do AI Edita responde na porta ${endpoint.otherVersion.port}` +
				(endpoint.otherVersion.install
					? ` (${endpoint.otherVersion.install})`
					: "") +
				`. Esta instalacao vai abrir na porta ${port}.`,
		);
	}
	writeLog(
		endpoint.reuseExisting
			? `Instancia existente encontrada na porta ${port}.`
			: `Porta ${port} selecionada para uma nova instancia.`,
	);

	let server;
	if (!endpoint.reuseExisting) {
		server = startServer(dataRoot, port);
		await waitForServer(server, port);
	}

	const browserProcess = openApp(port);
	await waitForSpawn(browserProcess);
	writeLog(`Navegador aberto em ${appUrlForPort(port)}.`);
	if (!server) {
		browserProcess.unref();
		return;
	}

	let requestedShutdown = false;
	const stopServer = () => {
		requestedShutdown = true;
		if (server.exitCode === null) server.kill();
	};

	process.once("SIGINT", stopServer);
	process.once("SIGTERM", stopServer);
	process.once("exit", stopServer);

	browserProcess.unref();
	console.log(
		`AI Edita esta ativo em ${appUrlForPort(port)}. Mantenha este terminal aberto; pressione Ctrl+C para encerrar.`,
	);
	writeLog(`Servidor pronto em ${appUrlForPort(port)}.`);
	const exit = await new Promise((resolve) =>
		server.once("exit", (code, signal) => resolve({ code, signal })),
	);
	if (!requestedShutdown) {
		throw new Error(
			`O servidor encerrou inesperadamente (codigo ${exit.code ?? "?"}, sinal ${exit.signal ?? "nenhum"}). Consulte ${logFilePath}.`,
		);
	}
}

const isDirectRun =
	process.argv[1] &&
	path.resolve(process.argv[1]) ===
		path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
	main().catch((error) => {
		writeLog(error?.stack ?? error);
		console.error(
			`\nAI Edita nao conseguiu iniciar:\n${error.message}\n\nDiagnostico: ${logFilePath ?? "launcher.log"}\n`,
		);
		process.exitCode = 1;
	});
}
