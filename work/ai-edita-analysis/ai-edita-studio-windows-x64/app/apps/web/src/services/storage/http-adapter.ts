import type { StorageAdapter } from "./types";

const endpoint = "/api/local-storage";
const localHeaders = { "x-opencut-client": "integrations" };

type Collection = "projects" | "saved-sounds" | "media-metadata";

function storageUrl({
	collection,
	projectId,
	key,
	values,
}: {
	collection: Collection | "media-files";
	projectId?: string;
	key?: string;
	values?: boolean;
}) {
	const search = new URLSearchParams({ collection });
	if (projectId) search.set("projectId", projectId);
	if (key) search.set("key", key);
	if (values) search.set("values", "1");
	return `${endpoint}?${search}`;
}

async function storageError(response: Response): Promise<Error> {
	let message = `Falha no armazenamento local (HTTP ${response.status}).`;
	try {
		const body: unknown = await response.json();
		if (
			body &&
			typeof body === "object" &&
			"error" in body &&
			typeof body.error === "string"
		)
			message = body.error;
	} catch {
		// Preserve the status-based message when the response is not JSON.
	}

	const error = new Error(message);
	if (response.status === 507) error.name = "QuotaExceededError";
	return error;
}

async function requireSuccess(response: Response) {
	if (!response.ok) throw await storageError(response);
	return response;
}

async function readStringArray(response: Response): Promise<string[]> {
	const value: unknown = await response.json();
	if (
		!Array.isArray(value) ||
		!value.every((item: unknown) => typeof item === "string")
	) {
		throw new Error("Resposta inválida do armazenamento local.");
	}
	return value;
}

export class HttpJsonStorageAdapter<T> implements StorageAdapter<T> {
	private readonly collection: Collection;
	private readonly projectId?: string;

	constructor({
		collection,
		projectId,
	}: {
		collection: Collection;
		projectId?: string;
	}) {
		this.collection = collection;
		this.projectId = projectId;
	}

	async get(key: string): Promise<T | null> {
		const response = await fetch(
			storageUrl({
				collection: this.collection,
				projectId: this.projectId,
				key,
			}),
			{ headers: localHeaders, cache: "no-store" },
		);
		if (response.status === 404) return null;
		await requireSuccess(response);
		const value: unknown = await response.json();
		// The adapter is the typed boundary for JSON written by the same client.
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
		return value as T;
	}

	async set({ key, value }: { key: string; value: T }): Promise<void> {
		await requireSuccess(
			await fetch(
				storageUrl({
					collection: this.collection,
					projectId: this.projectId,
					key,
				}),
				{
					method: "PUT",
					headers: {
						...localHeaders,
						"content-type": "application/json",
					},
					body: JSON.stringify(value),
				},
			),
		);
	}

	async remove(key: string): Promise<void> {
		await requireSuccess(
			await fetch(
				storageUrl({
					collection: this.collection,
					projectId: this.projectId,
					key,
				}),
				{ method: "DELETE", headers: localHeaders },
			),
		);
	}

	async list(): Promise<string[]> {
		const response = await requireSuccess(
			await fetch(
				storageUrl({
					collection: this.collection,
					projectId: this.projectId,
				}),
				{ headers: localHeaders, cache: "no-store" },
			),
		);
		return readStringArray(response);
	}

	async getAll(): Promise<T[]> {
		const response = await requireSuccess(
			await fetch(
				storageUrl({
					collection: this.collection,
					projectId: this.projectId,
					values: true,
				}),
				{ headers: localHeaders, cache: "no-store" },
			),
		);
		const value: unknown = await response.json();
		if (!Array.isArray(value)) {
			throw new Error("Resposta inválida do armazenamento local.");
		}
		// The adapter is the typed boundary for JSON written by the same client.
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
		return value as T[];
	}

	async clear(): Promise<void> {
		await requireSuccess(
			await fetch(
				storageUrl({
					collection: this.collection,
					projectId: this.projectId,
				}),
				{ method: "DELETE", headers: localHeaders },
			),
		);
	}
}

export class HttpFileStorageAdapter implements StorageAdapter<File> {
	constructor(private readonly projectId: string) {}

	async get(key: string): Promise<File | null> {
		const response = await fetch(
			storageUrl({
				collection: "media-files",
				projectId: this.projectId,
				key,
			}),
			{ headers: localHeaders, cache: "no-store" },
		);
		if (response.status === 404) return null;
		await requireSuccess(response);

		const blob = await response.blob();
		const encodedName = response.headers.get("x-ai-file-name") || key;
		const lastModified = Number(response.headers.get("x-ai-last-modified"));
		return new File([blob], decodeURIComponent(encodedName), {
			type: response.headers.get("content-type") || blob.type,
			lastModified: Number.isFinite(lastModified) ? lastModified : Date.now(),
		});
	}

	async set({ key, value }: { key: string; value: File }): Promise<void> {
		await requireSuccess(
			await fetch(
				storageUrl({
					collection: "media-files",
					projectId: this.projectId,
					key,
				}),
				{
					method: "PUT",
					headers: {
						...localHeaders,
						"content-type": value.type || "application/octet-stream",
						"x-ai-file-name": encodeURIComponent(value.name),
						"x-ai-last-modified": String(value.lastModified),
					},
					body: value,
				},
			),
		);
	}

	async remove(key: string): Promise<void> {
		await requireSuccess(
			await fetch(
				storageUrl({
					collection: "media-files",
					projectId: this.projectId,
					key,
				}),
				{ method: "DELETE", headers: localHeaders },
			),
		);
	}

	async list(): Promise<string[]> {
		const response = await requireSuccess(
			await fetch(
				storageUrl({
					collection: "media-files",
					projectId: this.projectId,
				}),
				{ headers: localHeaders, cache: "no-store" },
			),
		);
		return readStringArray(response);
	}

	async clear(): Promise<void> {
		await requireSuccess(
			await fetch(
				storageUrl({
					collection: "media-files",
					projectId: this.projectId,
				}),
				{ method: "DELETE", headers: localHeaders },
			),
		);
	}
}
