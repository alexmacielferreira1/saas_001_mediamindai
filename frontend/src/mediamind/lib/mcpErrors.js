// Mensagem honesta para as recusas do servidor (fila em execução, permissão,
// política de IA da empresa). Sem código conhecido, usa a mensagem do servidor.
export function mcpErrorMessage(error, fallback) {
  const code = error?.code;
  if (code === "MCP_QUEUE_RUNNING") return "Esta fila já está em execução. Aguarde o resultado antes de executar de novo.";
  if (code === "AI_DISABLED") return "A IA está desativada para esta empresa. Um administrador pode reativá-la nas configurações de IA.";
  if (error?.status === 429) return error?.message ? `Limite de uso de IA atingido: ${error.message}` : "Limite de uso de IA atingido. Tente mais tarde ou peça ajuste do limite.";
  if (error?.status === 403) return error?.message || "Seu perfil não tem permissão para esta ação (é preciso permissão de produção).";
  return error?.message || fallback;
}
