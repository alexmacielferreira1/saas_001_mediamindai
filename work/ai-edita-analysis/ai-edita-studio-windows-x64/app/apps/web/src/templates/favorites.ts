"use client";
import { create } from "zustand";

/**
 * Titles the user starred, kept in this browser next to the model library.
 *
 * Favourites are a shortcut, never a source of truth: an id that no longer exists simply
 * stops matching, so uninstalling a pack cannot break the list.
 */
const STORAGE_KEY = "ai-edita-model-favorites-v1";

function read(): string[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed)
			? parsed.filter((id): id is string => typeof id === "string")
			: [];
	} catch {
		return [];
	}
}

export const useModelFavorites = create<{
	ids: string[];
	loaded: boolean;
	load: () => void;
	toggle: (id: string) => void;
	has: (id: string) => boolean;
}>((set, get) => ({
	ids: [],
	loaded: false,
	load: () => {
		if (get().loaded) return;
		set({ ids: read(), loaded: true });
	},
	toggle: (id) => {
		const ids = get().ids.includes(id)
			? get().ids.filter((value) => value !== id)
			: [...get().ids, id];
		set({ ids, loaded: true });
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
		} catch {
			// A full or blocked storage only costs the shortcut, not the edit.
		}
	},
	has: (id) => get().ids.includes(id),
}));
