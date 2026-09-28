// One MCP entry for every screen that offers it, so Claude and Codex always get the same
// server name (ai_edita) and the installation's persistent token.
export type McpClient = "claude" | "codex";
export type McpConfigValue = {
	token: string;
	nodePath: string;
	scriptPath: string;
};

export function buildMcpConfig({
	client,
	value,
	url,
}: {
	client: McpClient;
	value: McpConfigValue;
	/** Address the app is open on now; the bridge also finds it if the port later changes. */
	url: string;
}) {
	const env = { OPENCUT_URL: url, OPENCUT_MCP_TOKEN: value.token };
	if (client === "claude")
		return JSON.stringify(
			{
				mcpServers: {
					ai_edita: { command: value.nodePath, args: [value.scriptPath], env },
				},
			},
			null,
			2,
		);
	return [
		"[mcp_servers.ai_edita]",
		`command = ${JSON.stringify(value.nodePath)}`,
		`args = [${JSON.stringify(value.scriptPath)}]`,
		"",
		"[mcp_servers.ai_edita.env]",
		`OPENCUT_URL = ${JSON.stringify(env.OPENCUT_URL)}`,
		`OPENCUT_MCP_TOKEN = ${JSON.stringify(env.OPENCUT_MCP_TOKEN)}`,
		"",
	].join("\n");
}
