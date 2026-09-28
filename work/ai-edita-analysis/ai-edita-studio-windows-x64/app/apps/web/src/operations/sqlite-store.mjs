import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalState = globalThis;
globalState.__aiEditaDatabases ??= new Map();

function parseJson(value, source) {
	try {
		return JSON.parse(value);
	} catch {
		throw new Error(
			`Não foi possível ler ${source}. Preserve os arquivos para recuperação.`,
		);
	}
}

function readLegacyJson(file) {
	if (!fs.existsSync(file)) return null;
	return parseJson(fs.readFileSync(file, "utf8"), file);
}

function insertLegacyDocument(statement, namespace, key, value) {
	if (value === null) return;
	statement.run(namespace, key, JSON.stringify(value), Date.now());
}

function migrateJsonDirectory(statement, directory, namespace) {
	if (!fs.existsSync(directory)) return;
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
		const key = entry.name.slice(0, -".json".length);
		insertLegacyDocument(
			statement,
			namespace,
			key,
			readLegacyJson(path.join(directory, entry.name)),
		);
	}
}

function migrateEditorMedia(statement, editorRoot) {
	const mediaRoot = path.join(editorRoot, "media");
	if (!fs.existsSync(mediaRoot)) return;
	for (const project of fs.readdirSync(mediaRoot, { withFileTypes: true })) {
		if (!project.isDirectory()) continue;
		const projectRoot = path.join(mediaRoot, project.name);
		migrateJsonDirectory(
			statement,
			path.join(projectRoot, "metadata"),
			`media-metadata:${project.name}`,
		);
		const filesRoot = path.join(projectRoot, "files");
		if (!fs.existsSync(filesRoot)) continue;
		for (const entry of fs.readdirSync(filesRoot, { withFileTypes: true })) {
			if (!entry.isFile() || !entry.name.endsWith(".bin")) continue;
			const key = entry.name.slice(0, -".bin".length);
			const file = path.join(filesRoot, entry.name);
			const metadata = readLegacyJson(`${file}.meta.json`) || {
				name: key,
				type: "application/octet-stream",
				lastModified: fs.statSync(file).mtimeMs,
				bytes: fs.statSync(file).size,
			};
			insertLegacyDocument(
				statement,
				`media-files:${project.name}`,
				key,
				metadata,
			);
		}
	}
}

function migrateLegacyFiles(database, root) {
	const migration = database
		.prepare("SELECT value FROM app_meta WHERE key = ?")
		.get("legacy-json-v1");
	if (migration) return;

	const insert = database.prepare(`
		INSERT OR IGNORE INTO documents(namespace, key, value, updated_at)
		VALUES (?, ?, ?, ?)
	`);
	database.exec("BEGIN IMMEDIATE");
	try {
		insertLegacyDocument(
			insert,
			"app",
			"settings",
			readLegacyJson(path.join(root, "settings.json")),
		);
		insertLegacyDocument(
			insert,
			"app",
			"workspace",
			readLegacyJson(path.join(root, "workspace.json")),
		);
		migrateJsonDirectory(insert, path.join(root, "insights"), "insights");

		const editorRoot = path.join(root, "editor");
		migrateJsonDirectory(insert, path.join(editorRoot, "projects"), "projects");
		migrateJsonDirectory(
			insert,
			path.join(editorRoot, "saved-sounds"),
			"saved-sounds",
		);
		migrateEditorMedia(insert, editorRoot);

		database
			.prepare("INSERT INTO app_meta(key, value) VALUES (?, ?)")
			.run("legacy-json-v1", new Date().toISOString());
		database.exec("COMMIT");
	} catch (error) {
		database.exec("ROLLBACK");
		throw error;
	}
}

function createDatabase(root) {
	fs.mkdirSync(root, { recursive: true });
	const file = path.join(root, "ai-edita.db");
	const database = new DatabaseSync(file, {
		enableForeignKeyConstraints: true,
	});
	database.exec("PRAGMA journal_mode = WAL");
	database.exec("PRAGMA synchronous = FULL");
	database.exec("PRAGMA foreign_keys = ON");
	database.exec("PRAGMA busy_timeout = 5000");
	database.exec(`
		CREATE TABLE IF NOT EXISTS app_meta (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS documents (
			namespace TEXT NOT NULL,
			key TEXT NOT NULL,
			value TEXT NOT NULL,
			updated_at INTEGER NOT NULL,
			PRIMARY KEY (namespace, key)
		);
		CREATE INDEX IF NOT EXISTS documents_updated_at
			ON documents(namespace, updated_at DESC);
		PRAGMA user_version = 1;
	`);
	migrateLegacyFiles(database, root);
	return database;
}

function databaseFor(root) {
	const file = path.resolve(root, "ai-edita.db");
	let database = globalState.__aiEditaDatabases.get(file);
	if (!database) {
		database = createDatabase(root);
		globalState.__aiEditaDatabases.set(file, database);
	}
	return database;
}

export function getDocument({ root, namespace, key }) {
	const row = databaseFor(root)
		.prepare("SELECT value FROM documents WHERE namespace = ? AND key = ?")
		.get(namespace, key);
	return row ? parseJson(row.value, `${namespace}/${key}`) : null;
}

export function setDocument({ root, namespace, key, value }) {
	databaseFor(root)
		.prepare(
			`
			INSERT INTO documents(namespace, key, value, updated_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(namespace, key) DO UPDATE SET
				value = excluded.value,
				updated_at = excluded.updated_at
		`,
		)
		.run(namespace, key, JSON.stringify(value), Date.now());
}

export function changeDocument({ root, namespace, key, fallback, change }) {
	const database = databaseFor(root);
	database.exec("BEGIN IMMEDIATE");
	try {
		const row = database
			.prepare("SELECT value FROM documents WHERE namespace = ? AND key = ?")
			.get(namespace, key);
		const value = row
			? parseJson(row.value, `${namespace}/${key}`)
			: fallback();
		const result = change(value);
		database
			.prepare(
				`
				INSERT INTO documents(namespace, key, value, updated_at)
				VALUES (?, ?, ?, ?)
				ON CONFLICT(namespace, key) DO UPDATE SET
					value = excluded.value,
					updated_at = excluded.updated_at
			`,
			)
			.run(namespace, key, JSON.stringify(value), Date.now());
		database.exec("COMMIT");
		return result;
	} catch (error) {
		database.exec("ROLLBACK");
		throw error;
	}
}

export function listDocuments({ root, namespace }) {
	return databaseFor(root)
		.prepare("SELECT key FROM documents WHERE namespace = ? ORDER BY key")
		.all(namespace)
		.map((row) => row.key);
}

export function countDocuments({ root, namespace }) {
	return databaseFor(root)
		.prepare("SELECT COUNT(*) AS count FROM documents WHERE namespace = ?")
		.get(namespace).count;
}

export function getAllDocuments({ root, namespace }) {
	return databaseFor(root)
		.prepare(
			"SELECT key, value FROM documents WHERE namespace = ? ORDER BY updated_at DESC, key",
		)
		.all(namespace)
		.map((row) => ({
			key: row.key,
			value: parseJson(row.value, `${namespace}/${row.key}`),
		}));
}

export function deleteDocument({ root, namespace, key }) {
	databaseFor(root)
		.prepare("DELETE FROM documents WHERE namespace = ? AND key = ?")
		.run(namespace, key);
}

export function clearDocuments({ root, namespace }) {
	databaseFor(root)
		.prepare("DELETE FROM documents WHERE namespace = ?")
		.run(namespace);
}

export function sqliteStatus({ root }) {
	const database = databaseFor(root);
	return {
		file: path.join(root, "ai-edita.db"),
		journalMode: database.prepare("PRAGMA journal_mode").get().journal_mode,
		synchronous: database.prepare("PRAGMA synchronous").get().synchronous,
		userVersion: database.prepare("PRAGMA user_version").get().user_version,
	};
}
