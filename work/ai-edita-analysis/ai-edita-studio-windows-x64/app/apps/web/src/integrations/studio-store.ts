"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";
const messageSchema = z.object({
	id: z.string(),
	role: z.enum(["user", "assistant"]),
	content: z.string().max(12000),
});
type Message = z.infer<typeof messageSchema>;
const persistedSchema = z.object({
	threads: z.record(z.string(), z.array(messageSchema).max(40)),
});
export const useStudioStore = create<{
	threads: Record<string, Message[]>;
	append: (args: {
		key: string;
		role: Message["role"];
		content: string;
	}) => void;
	clear: (key: string) => void;
}>()(
	persist(
		(set) => ({
			threads: {},
			append: ({ key, role, content }) =>
				set((state) => {
					const threads = { ...state.threads };
					// Do not retain accidentally pasted API keys in the local conversation log.
					const safe = content
						.replace(/\bsk-[A-Za-z0-9_-]{8,}/g, "[API key removed]")
						.slice(0, 12000);
					delete threads[key];
					threads[key] = [
						...(state.threads[key] ?? []),
						{ id: crypto.randomUUID(), role, content: safe },
					].slice(-40);
					return {
						threads: Object.fromEntries(Object.entries(threads).slice(-30)),
					};
				}),
			clear: (key) =>
				set((state) => {
					const threads = { ...state.threads };
					delete threads[key];
					return { threads };
				}),
		}),
		{
			name: "ai-edita-studio-history-v1",
			skipHydration: true,
			partialize: (state) => ({ threads: state.threads }),
			merge: (saved, current) => {
				const parsed = persistedSchema.safeParse(saved);
				return {
					...current,
					threads: parsed.success ? parsed.data.threads : {},
				};
			},
		},
	),
);
