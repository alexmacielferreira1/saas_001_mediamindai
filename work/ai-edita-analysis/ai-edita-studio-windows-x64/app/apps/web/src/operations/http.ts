import { z } from "zod";
import { IntegrationError } from "@/integrations/server";
import { vault } from "./store.mjs";
export function workspaceError(error: unknown) {
	let message =
		error instanceof Error
			? error.message
			: "Não foi possível concluir a operação.";
	let status = error instanceof IntegrationError ? error.status : 400;
	if (error instanceof z.ZodError)
		message =
			"Confira os campos: " +
			error.issues
				.map((issue) => issue.path.join("."))
				.filter(Boolean)
				.join(", ");
	if (error && typeof error === "object" && "code" in error) {
		message =
			"Falha no armazenamento ou na conexão local. Confira espaço em disco e os registros do servidor.";
		status = 500;
	}
	try {
		const secrets = vault();
		for (const value of [
			secrets.openaiKey,
			secrets.mcpToken,
			...Object.values(secrets.accounts),
		])
			if (typeof value === "string" && value)
				message = message.replaceAll(value, "[redigido]");
	} catch {
		message =
			"Não foi possível abrir o armazenamento privado. Preserve os arquivos para recuperação.";
	}
	return Response.json(
		{ error: message.slice(0, 1500) },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}
