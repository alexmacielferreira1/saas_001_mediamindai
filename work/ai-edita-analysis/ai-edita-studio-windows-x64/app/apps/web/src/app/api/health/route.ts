import { localDatabaseStatus } from "@/operations/store.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
	if (process.env.AI_EDITA_LOCAL_MODE !== "1") {
		return new Response("OK", { status: 200 });
	}

	const database = localDatabaseStatus();
	return new Response("OK", {
		status: 200,
		headers: {
			"Cache-Control": "no-store",
			"X-AI-Edita-Storage": "sqlite",
			"X-AI-Edita-Database-Version": String(database.userVersion),
			// Which installation is answering. The launcher reuses a running instance only
			// when it is this same build from this same folder; otherwise an old copy left
			// running would keep opening instead of the version just installed.
			"X-AI-Edita-Build": process.env.AI_EDITA_BUILD ?? "",
			"X-AI-Edita-Install": process.env.AI_EDITA_INSTALL ?? "",
		},
	});
}
