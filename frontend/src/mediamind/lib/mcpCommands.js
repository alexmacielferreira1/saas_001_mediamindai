// Lista única de ações MCP por aplicativo, usada pelo MCP Express (barra) e
// pelo MCP Completo (Dock). Os títulos coincidem com os das ferramentas do
// catálogo do servidor (backend/app/mcp/registry.py), que decide o que executa.
export const MCP_APP_COMMANDS = {
  mmfilm: ['Ler timeline', 'Inspecionar projeto', 'Montar sequência', 'Cortar trechos (IN / OUT)', 'Remover silêncios', 'Selecionar melhores cenas', 'Criar legendas automáticas', 'Adicionar imagens de apoio', 'Inserir GC e artes', 'Aplicar transições', 'Ajustar áudio e normalização', 'Ajustar cor e exposição', 'Estabilizar imagem', 'Preparar exportação'],
  mmeffects: ['Criar composição', 'Animar títulos', 'Criar lower third', 'Aplicar transição', 'Tracking e estabilização', 'Chroma key', 'Máscara e rotoscopia', 'Aplicar efeitos', 'Correção de cor', 'Aplicar template', 'Preparar renderização'],
  mmphoto: ['Recortar', 'Remover fundo', 'Ajustar luz e cor', 'Retoque automático', 'Corrigir pele', 'Redimensionar imagem', 'Criar thumbnail', 'Aplicar identidade', 'Inserir textos', 'Gerar variações', 'Exportar e salvar'],
  mmvector: ['Vetorizar', 'Aplicar paleta', 'Montar layout', 'Criar variações', 'Ajustar tipografia', 'Gerar lower third', 'Criar ícones', 'Organizar pranchetas', 'Preparar SVG', 'Exportar PNG'],
  mmsom: ['Limpar ruído', 'Remover pausas', 'Normalizar loudness', 'Equalizar', 'Comprimir', 'De-esser', 'Separar voz e música', 'Misturar faixas', 'Trilha e SFX', 'Masterizar', 'Exportar áudio'],
  word: ['Criar documento', 'Gerar roteiro', 'Resumir conteúdo', 'Revisar e reescrever', 'Organizar seções', 'Aplicar estilo', 'Inserir referências', 'Exportar DOCX ou PDF'],
  excel: ['Criar planilha', 'Organizar dados', 'Classificar dados', 'Criar fórmula', 'Gerar gráficos', 'Validar dados', 'Criar painel', 'Exportar XLSX ou CSV'],
  powerpoint: ['Montar apresentação', 'Gerar slides', 'Criar resumo visual', 'Aplicar template', 'Organizar slides', 'Criar gráfico', 'Revisar narrativa', 'Exportar PPTX ou PDF'],
  ai: ['Executar prompt com IA cadastrada', 'Transcrever', 'Resumir', 'Gerar cortes', 'Classificar mídia', 'Sugerir roteiro', 'Gerar imagem', 'Gerar vídeo', 'Automatizar fluxo', 'Exportar resultados'],
};

// Quantas ações o MCP Express já mostra ao abrir (o resto fica no seletor).
export const EXPRESS_INITIAL_ACTIONS = 4;

export function appCommands(appId) {
  return [...(MCP_APP_COMMANDS[appId] || [])];
}

// Motivo do estado do módulo no catálogo MCP, para o selo e o tooltip.
export function moduleStatusReason(status, label) {
  if (status === 'connected') return `Conectado: o MCP lê e gera conteúdo do ${label}; ações de escrita só com ponte e confirmação.`;
  if (status === 'planned') return `Planejado: falta instalar a ponte local do ${label}. Ações que alteram o projeto exigem a ponte e confirmação humana.`;
  return 'Não foi possível consultar o catálogo MCP. Verifique a conexão e tente de novo.';
}

export function unavailableActionReason(label) {
  return `Ainda não disponível: falta a ponte MCP do ${label} para executar esta ação.`;
}
