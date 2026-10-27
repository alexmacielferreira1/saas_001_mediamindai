import {
  AlarmClock, Archive, BarChart3, Briefcase, CalendarClock, CalendarX2, CheckSquare, ClipboardList, Clock3,
  Copy, Download, FileSearch, FileText, Film, FolderOpen, Gauge, History, Image, KeyRound, Layers, ListChecks,
  MessageSquare, Megaphone, Scissors, Search, Send, ShieldCheck, Sparkles, Upload, UserX, Users, Wallet,
} from 'lucide-react';
import { PRODUCTION_STAGES, isProjectInProductionStage, isScheduleReady, resolveProjectProductionStage } from './productionWorkflow';
import { copilotTools, exportRows, listResult, localDate, openTool, today } from './mcpPageTools';

// Catálogos MCP das páginas fora das Ferramentas Gráficas (mesmo modelo de ícones).
// Toda ferramenta lê dados reais pelo env (API do tenant) ou navega/exporta; nada é simulado.

const TABS = {
  abrir: { id: 'abrir', label: 'Abrir', icon: FolderOpen, description: 'Leva à guia certa da página, já com o filtro aplicado.' },
  consultar: { id: 'consultar', label: 'Consultar', icon: Search, description: 'Analisar mostra a prévia com dados reais; nada é alterado.' },
  conferir: { id: 'conferir', label: 'Conferir', icon: ListChecks, description: 'Encontra pendências e inconsistências nos dados reais.' },
  exportar: { id: 'exportar', label: 'Exportar', icon: Download, description: 'Baixa CSV (Excel) com os registros reais.' },
  copiloto: { id: 'copiloto', label: 'Copiloto', icon: MessageSquare, description: 'Prepara o pedido no chat; você revisa e envia.' },
};
const tabs = (...ids) => ids.map((id) => TABS[id]);

const stageLabel = (id) => PRODUCTION_STAGES.find((stage) => stage.id === id)?.label || id;
// Etapa como a tela mostra (registros antigos usam 'gravacao' etc.).
const projectStage = (project) => stageLabel(resolveProjectProductionStage(project));
const dateOf = (record) => String(record?.created_date || record?.created_at || '').slice(0, 10);
const nameOf = (record) => record?.titulo || record?.title || record?.filename || record?.nome || record?.name || 'Sem título';
const daysAgo = (days) => localDate(new Date(Date.now() - days * 86400000));
// "Hoje" (1 dia) começa hoje; "7 dias" inclui hoje e os 6 anteriores.
const recent = (records, days) => records.filter((record) => dateOf(record) >= daysAgo(days - 1));
const DAYS_PARAM = { key: 'days', type: 'select', label: 'Período', default: '7', options: [['1', 'Hoje'], ['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['3650', 'Tudo']] };

// ---------- leituras reais compartilhadas ----------
const projects = (env) => env.records('ProducaoProjeto', { sort: '-updated_date', limit: 500 });
const projectsIn = async (env, stage) => (await projects(env)).filter((project) => isProjectInProductionStage(project, stage));
const overdue = (list) => list.filter((project) => project.prazo_edicao && project.prazo_edicao < today());

const projectRow = (project) => [nameOf(project), project.programa || '', projectStage(project), project.responsavel || project.editor || '', project.prazo_edicao || '', dateOf(project)];
const PROJECT_HEADERS = ['Título', 'Programa', 'Etapa', 'Responsável', 'Prazo de edição', 'Criado em'];
const describeProject = (project) => `${nameOf(project)} · ${projectStage(project)}${project.prazo_edicao ? ` · prazo ${project.prazo_edicao}` : ''}`;

const assetRow = (asset) => [nameOf(asset), asset.filename || '', asset.asset_type || '', asset.file_size || '', asset.duration || '', asset.origin || '', dateOf(asset)];
const ASSET_HEADERS = ['Título', 'Arquivo', 'Tipo', 'Tamanho (bytes)', 'Duração (s)', 'Origem', 'Criado em'];
const describeAsset = (asset) => `${nameOf(asset)} · ${asset.asset_type || 'mídia'}${asset.duration ? ` · ${Math.round(asset.duration)} s` : ''}`;

function projectsTool({ id, tab = 'consultar', label, icon, description, select, empty, found }) {
  return {
    id, tab, label, icon, description,
    analyze: false, applyLabel: 'Consultar', run: async (_params, env) => listResult(await select(env), { empty, found, describe: describeProject }),
  };
}

function exportProjectsTool({ id, label, stage, filename }) {
  return {
    id, tab: 'exportar', label, icon: Download,
    description: `Baixa em CSV ${stage ? `as produções em “${stageLabel(stage)}”` : 'todas as produções'} do tenant.`,
    analyze: false, applyLabel: 'Exportar CSV',
    run: async (_params, env) => {
      const list = stage ? await projectsIn(env, stage) : await projects(env);
      return exportRows(env, { filename, headers: PROJECT_HEADERS, rows: list.map(projectRow), what: 'produções' });
    },
  };
}

const exportAssetsTool = (id = 'exportar-midias') => ({
  id, tab: 'exportar', label: 'Exportar mídias', icon: Download,
  description: 'Baixa em CSV as mídias do acervo do tenant no período escolhido.',
  params: [DAYS_PARAM], analyze: false, applyLabel: 'Exportar CSV',
  run: async ({ days }, env) => exportRows(env, {
    filename: `midias-${today()}.csv`, headers: ASSET_HEADERS, what: 'mídias',
    rows: recent(await env.assets(), Number(days)).map(assetRow),
  }),
});

const recentAssetsTool = (id = 'midias-recentes') => ({
  id, tab: 'consultar', label: 'Mídias recentes', icon: Clock3,
  description: 'Lista as mídias que entraram no acervo no período.',
  params: [DAYS_PARAM],
  analyze: false, applyLabel: 'Consultar', run: async ({ days }, env) => listResult(recent(await env.assets(), Number(days)), { empty: 'Nenhuma mídia no período.', found: 'mídia(s) no período', describe: describeAsset }),
});

const searchAssetsTool = {
  id: 'buscar-acervo', tab: 'consultar', label: 'Buscar no acervo', icon: FileSearch,
  description: 'Procura no título e no nome do arquivo das mídias do tenant.',
  params: [{ key: 'q', type: 'text', label: 'Texto', default: '', placeholder: 'Ex.: entrevista, LGPD, abertura' }],
  analyze: false,
  applyLabel: 'Buscar',
  run: async ({ q }, env) => searchAssets(q, env),
};
async function searchAssets(q, env) {
  const text = String(q || '').trim().toLocaleLowerCase('pt-BR');
  if (!text) return { ok: false, summary: 'Digite o que procurar.' };
  const items = (await env.assets()).filter((asset) => `${nameOf(asset)} ${asset.filename || ''}`.toLocaleLowerCase('pt-BR').includes(text));
  return listResult(items, { empty: `Nada encontrado para “${q}”.`, found: `mídia(s) com “${q}”`, describe: describeAsset });
}

const corp = (sub, extra = '') => (_values, env) => env.corpUrl(sub, extra);

// ---------- catálogos por página ----------
const CATALOGUES = {
  dashboard: {
    tabs: tabs('abrir', 'consultar', 'conferir', 'exportar', 'copiloto'),
    tools: [
      openTool({ id: 'abrir-ingest', label: 'Ingest', icon: Upload, description: 'Abre a entrada de mídias.', url: corp('ingest') }),
      openTool({ id: 'abrir-pesquisa', label: 'Pesquisa', icon: Search, description: 'Abre a pesquisa no acervo.', url: corp('pesquisa') }),
      openTool({ id: 'abrir-rascunhos', label: 'Rascunhos', icon: FileText, description: 'Abre os rascunhos e roteiros.', url: corp('rascunhos') }),
      openTool({ id: 'abrir-edicao', label: 'Em edição', icon: Scissors, description: 'Abre as produções em edição.', url: corp('em_edicao') }),
      openTool({ id: 'abrir-revisao', label: 'Em revisão', icon: CheckSquare, description: 'Abre as aprovações.', url: corp('em_aprovacao') }),
      openTool({ id: 'abrir-publicar', label: 'Para publicação', icon: Send, description: 'Abre as publicações pendentes.', url: corp('para_publicar') }),
      {
        id: 'nova-producao', tab: 'abrir', label: 'Nova produção', icon: Sparkles,
        description: 'Cria um rascunho de produção no servidor e abre para você preencher.',
        how: 'É o mesmo botão “Nova produção” da página: grava um rascunho (ProducaoProjeto) e abre o formulário.',
        analyze: false, applyLabel: 'Criar rascunho',
        confirm: 'Criar um rascunho de produção agora? Ele fica salvo em Rascunhos e pode ser apagado depois.',
        run: async (_p, env) => {
          env.navigate(env.corpUrl('overview', 'novo=producao'));
          return { ok: true, count: 0, summary: 'Rascunho de produção sendo criado pela página.' };
        },
      },
      {
        id: 'producoes-por-etapa', tab: 'consultar', label: 'Produções por etapa', icon: Layers,
        description: 'Conta as produções reais em cada etapa do fluxo.',
        analyze: false, applyLabel: 'Consultar', run: async (_p, env) => stageCount(await projects(env)),
      },
      recentAssetsTool(),
      projectsTool({ id: 'prazos-vencidos', tab: 'conferir', label: 'Prazos vencidos', icon: AlarmClock, description: 'Produções com prazo de edição antes de hoje.', select: async (env) => overdue(await projects(env)), empty: 'Nenhum prazo vencido.', found: 'produção(ões) com prazo vencido' }),
      projectsTool({ id: 'sem-responsavel', tab: 'conferir', label: 'Sem responsável', icon: UserX, description: 'Produções sem responsável nem editor.', select: async (env) => (await projects(env)).filter((p) => !p.responsavel && !p.editor), empty: 'Todas têm responsável.', found: 'produção(ões) sem responsável' }),
      exportProjectsTool({ id: 'exportar-producoes', label: 'Exportar produções', filename: `producoes-${today()}.csv` }),
      exportAssetsTool(),
    ],
  },
  ingest: {
    tabs: tabs('abrir', 'consultar', 'conferir', 'exportar', 'copiloto'),
    tools: [
      openTool({ id: 'novo-pacote', label: 'Novo pacote', icon: Upload, description: 'Abre o envio de um novo pacote de mídias.', url: (_v, env) => env.ingestUrl('novo=pacote') }),
      recentAssetsTool(),
      {
        id: 'midias-por-tipo', tab: 'consultar', label: 'Mídias por tipo', icon: BarChart3,
        description: 'Quantidade de mídias por tipo (vídeo, áudio, imagem, documento) no período.',
        params: [DAYS_PARAM],
        analyze: false, applyLabel: 'Consultar', run: async ({ days }, env) => countBy(recent(await env.assets(), Number(days)), (a) => a.asset_type || 'sem tipo', 'mídia(s)'),
      },
      {
        id: 'duplicados', tab: 'conferir', label: 'Possíveis duplicados', icon: Copy,
        description: 'Mídias com o mesmo nome de arquivo e o mesmo tamanho.',
        analyze: false, applyLabel: 'Consultar', run: async (_p, env) => duplicates(await env.assets()),
      },
      {
        id: 'sem-duracao', tab: 'conferir', label: 'Vídeos sem duração', icon: Clock3,
        description: 'Vídeos e áudios sem duração registrada (o servidor não conseguiu medir).',
        analyze: false, applyLabel: 'Consultar', run: async (_p, env) => listResult((await env.assets()).filter((a) => ['video', 'audio'].includes(a.asset_type) && !Number(a.duration)), { empty: 'Todos têm duração.', found: 'mídia(s) sem duração', describe: describeAsset }),
      },
      exportAssetsTool(),
    ],
  },
  search: {
    tabs: tabs('abrir', 'consultar', 'exportar', 'copiloto'),
    tools: [
      searchAssetsTool,
      openTool({ id: 'abrir-busca', label: 'Abrir na Pesquisa', icon: Search, description: 'Abre a página de busca com o texto.', params: [{ key: 'q', type: 'text', label: 'Texto', default: '' }], url: ({ q }) => `/search?q=${encodeURIComponent(q || '')}` }),
      recentAssetsTool(),
      {
        id: 'maiores-midias', tab: 'consultar', label: 'Maiores arquivos', icon: Archive,
        description: 'As 20 mídias que mais ocupam espaço.',
        analyze: false, applyLabel: 'Consultar', run: async (_p, env) => listResult([...(await env.assets())].sort((a, b) => (b.file_size || 0) - (a.file_size || 0)).slice(0, 20), { empty: 'Acervo vazio.', found: 'maiores mídias', describe: (a) => `${nameOf(a)} · ${Math.round((a.file_size || 0) / 1048576)} MB` }),
      },
      exportAssetsTool(),
    ],
  },
  workspace: {
    tabs: tabs('abrir', 'consultar', 'exportar', 'copiloto'),
    tools: [
      {
        id: 'abrir-midia', tab: 'abrir', label: 'Abrir mídia', icon: Film,
        description: 'Procura a mídia pelo nome e abre no Workspace.',
        params: [{ key: 'q', type: 'text', label: 'Nome da mídia', default: '' }],
        preview: async ({ q }, env) => searchAssets(q, env),
        applyLabel: 'Abrir a primeira',
        run: async ({ q }, env) => {
          const text = String(q || '').trim().toLocaleLowerCase('pt-BR');
          if (!text) return { ok: false, summary: 'Digite o que procurar.' };
          const asset = (await env.assets()).find((a) => `${nameOf(a)} ${a.filename || ''}`.toLocaleLowerCase('pt-BR').includes(text));
          if (!asset) return { ok: false, summary: `Nada encontrado para “${q}”.` };
          env.navigate(env.corpUrl('workspace', `assetId=${encodeURIComponent(asset.id)}`));
          return { ok: true, count: 0, summary: `Aberto no Workspace: ${nameOf(asset)}.` };
        },
      },
      searchAssetsTool,
      recentAssetsTool(),
      exportAssetsTool(),
    ],
  },
  script: stagePage('rascunho', 'rascunhos', [
    {
      id: 'roteiros', tab: 'consultar', label: 'Roteiros salvos', icon: FileText,
      description: 'Lista os roteiros (Script) do tenant.',
      analyze: false, applyLabel: 'Consultar', run: async (_p, env) => listResult(await env.records('Script', { sort: '-updated_date', limit: 200 }), { empty: 'Nenhum roteiro salvo.', found: 'roteiro(s)', describe: (s) => `${nameOf(s)} · ${dateOf(s)}` }),
    },
    openTool({ id: 'roteiro2', label: 'Roteiro 2', icon: FileText, description: 'Abre o editor de roteiro.', url: '/roteiro2' }),
    {
      id: 'exportar-roteiros', tab: 'exportar', label: 'Exportar roteiros', icon: Download,
      description: 'Baixa em CSV a lista de roteiros do tenant.', analyze: false, applyLabel: 'Exportar CSV',
      run: async (_p, env) => exportRows(env, { filename: `roteiros-${today()}.csv`, headers: ['Título', 'Criado em'], rows: (await env.records('Script', { sort: '-updated_date', limit: 500 })).map((s) => [nameOf(s), dateOf(s)]), what: 'roteiros' }),
    },
  ]),
  recording: stagePage('agendamentos', 'agendamentos', [
    openTool({ id: 'abrir-gravacoes', label: 'Gravações', icon: Film, description: 'Abre os materiais gravados.', url: corp('gravacoes') }),
    projectsTool({ id: 'sem-data', tab: 'conferir', label: 'Sem data ou horário', icon: CalendarX2, description: 'Agendamentos sem data e horário de gravação definidos.', select: async (env) => (await projectsIn(env, 'agendamentos')).filter((p) => !isScheduleReady(p)), empty: 'Todos os agendamentos têm data e horário.', found: 'agendamento(s) incompleto(s)' }),
    projectsTool({ id: 'gravadas', tab: 'consultar', label: 'Gravadas', icon: CalendarClock, description: 'Produções na etapa Gravações.', select: (env) => projectsIn(env, 'gravacoes'), empty: 'Nenhuma produção gravada.', found: 'produção(ões) gravada(s)' }),
  ]),
  edit: stagePage('em_edicao', 'em_edicao', [
    projectsTool({ id: 'para-editar', tab: 'consultar', label: 'Material para editar', icon: Scissors, description: 'Produções aguardando o início da edição.', select: (env) => projectsIn(env, 'para_editar'), empty: 'Nada aguardando edição.', found: 'produção(ões) para editar' }),
    projectsTool({ id: 'sem-editor', tab: 'conferir', label: 'Sem editor', icon: UserX, description: 'Produções em edição sem editor definido.', select: async (env) => (await projectsIn(env, 'em_edicao')).filter((p) => !(p.editor || p.responsavel)), empty: 'Todas têm editor.', found: 'produção(ões) sem editor' }),
  ]),
  review: stagePage('em_aprovacao', 'em_aprovacao', [
    {
      id: 'aprovacoes-pendentes', tab: 'conferir', label: 'Aprovações pendentes', icon: CheckSquare,
      description: 'Itens de aprovação ainda sem decisão.',
      analyze: false, applyLabel: 'Consultar', run: async (_p, env) => pendingApprovals(env),
    },
    projectsTool({ id: 'finalizadas', tab: 'consultar', label: 'Finalizadas', icon: ShieldCheck, description: 'Produções finalizadas.', select: (env) => projectsIn(env, 'finalizado'), empty: 'Nenhuma finalizada.', found: 'produção(ões) finalizada(s)' }),
  ]),
  publication: stagePage('para_publicar', 'para_publicar', [
    {
      id: 'publicacoes-status', tab: 'consultar', label: 'Publicações por status', icon: Megaphone,
      description: 'Conta as publicações do tenant por status.',
      analyze: false, applyLabel: 'Consultar', run: async (_p, env) => countBy(await env.records('Publicacao', { sort: '-created_date', limit: 500 }), (p) => p.status || 'sem status', 'publicação(ões)'),
    },
    openTool({ id: 'abrir-publicado', label: 'Publicado', icon: Send, description: 'Abre o histórico do que já foi publicado.', url: corp('publicado') }),
    openTool({ id: 'abrir-redes', label: 'Redes sociais', icon: Megaphone, description: 'Abre cortes e redes sociais.', url: corp('redes_sociais') }),
    {
      id: 'exportar-publicacoes', tab: 'exportar', label: 'Exportar publicações', icon: Download,
      description: 'Baixa em CSV as publicações do tenant.', analyze: false, applyLabel: 'Exportar CSV',
      run: async (_p, env) => exportRows(env, { filename: `publicacoes-${today()}.csv`, headers: ['Título', 'Plataforma', 'Status', 'Publicado em', 'Criado em'], rows: (await env.records('Publicacao', { sort: '-created_date', limit: 500 })).map((p) => [nameOf(p), p.plataforma || '', p.status || '', String(p.published_at || '').slice(0, 10), dateOf(p)]), what: 'publicações' }),
    },
  ]),
  analytics: {
    tabs: tabs('abrir', 'consultar', 'exportar', 'copiloto'),
    tools: [
      openTool({ id: 'dash-ias', label: 'Dash de IAs', icon: Gauge, description: 'Abre o consumo real das IAs.', url: '/dash-ias' }),
      projectsTool({ id: 'publicadas', tab: 'consultar', label: 'Produções publicadas', icon: Megaphone, description: 'Produções na etapa Publicado.', select: (env) => projectsIn(env, 'publicado'), empty: 'Nenhuma produção publicada.', found: 'produção(ões) publicada(s)' }),
      {
        id: 'exportar-consumo-ia', tab: 'exportar', label: 'Exportar consumo de IA', icon: Download,
        description: 'Baixa o CSV de consumo de IA do tenant (mesmo arquivo do Dash de IAs).',
        // Mesmo limite do servidor (no máximo 31 dias).
        params: [{ key: 'days', type: 'select', label: 'Período', default: '30', options: [['1', '1 dia'], ['7', '7 dias'], ['30', '30 dias'], ['31', '31 dias']] }],
        analyze: false, applyLabel: 'Exportar CSV',
        run: async ({ days }, env) => {
          const blob = await env.fetchBlob(`/ai/usage/export.csv?days=${Number(days)}`);
          env.download('mediamind-ia-consumo.csv', blob, 'text/csv');
          return { ok: true, summary: 'Consumo de IA exportado em mediamind-ia-consumo.csv.' };
        },
      },
      exportProjectsTool({ id: 'exportar-producoes', label: 'Exportar produções', filename: `producoes-${today()}.csv` }),
    ],
  },
  admin: {
    tabs: tabs('abrir', 'consultar', 'conferir', 'exportar', 'copiloto'),
    tools: [
      openTool({ id: 'abrir-usuarios', label: 'Usuários', icon: Users, description: 'Abre a lista de usuários.', url: '/administration2?tab=users' }),
      openTool({ id: 'abrir-acessos', label: 'Acessos por Função', icon: KeyRound, description: 'Abre os acessos por função.', url: '/administration2?tab=access' }),
      openTool({ id: 'abrir-seguranca', label: 'Segurança', icon: ShieldCheck, description: 'Abre a segurança.', url: '/administration2?tab=security' }),
      {
        id: 'usuarios-por-status', tab: 'consultar', label: 'Usuários por status', icon: Users,
        description: 'Conta os usuários do tenant por status (ativo, convite, suspenso, bloqueado).',
        analyze: false, applyLabel: 'Consultar', run: async (_p, env) => countBy(await env.adminUsers(), (u) => u.status, 'usuário(s)'),
      },
      {
        id: 'sem-perfil', tab: 'conferir', label: 'Usuários sem perfil', icon: UserX,
        description: 'Usuários ativos sem perfil (grupo de permissões): só têm o que o cargo libera.',
        analyze: false, applyLabel: 'Consultar', run: async (_p, env) => listResult((await env.adminUsers()).filter((u) => u.status === 'active' && !u.profile_name), { empty: 'Todos os usuários ativos têm perfil.', found: 'usuário(s) sem perfil', describe: (u) => `${u.full_name || u.email} · ${u.tenant_role}` }),
      },
      {
        id: 'auditoria-recente', tab: 'consultar', label: 'Auditoria recente', icon: History,
        description: 'Últimas 50 ações registradas na auditoria do tenant.',
        analyze: false, applyLabel: 'Consultar', run: async (_p, env) => listResult(await env.auditLogs(50), { empty: 'Nenhuma ação registrada.', found: 'ação(ões) recentes', describe: (e) => `${dateOf(e)} · ${e.action} · ${e.entity_type || ''}` }),
      },
      {
        id: 'exportar-usuarios', tab: 'exportar', label: 'Exportar usuários', icon: Download,
        description: 'Baixa em CSV os usuários do tenant (sem senhas nem dados sensíveis).', analyze: false, applyLabel: 'Exportar CSV',
        run: async (_p, env) => exportRows(env, { filename: `usuarios-${today()}.csv`, headers: ['Nome', 'E-mail', 'Função', 'Perfil', 'Status'], rows: (await env.adminUsers()).map((u) => [u.full_name || '', u.email, u.tenant_role, u.profile_name || '', u.status]), what: 'usuários' }),
      },
      {
        id: 'exportar-auditoria', tab: 'exportar', label: 'Exportar auditoria', icon: Download,
        description: 'Baixa em CSV as últimas 500 ações da auditoria.', analyze: false, applyLabel: 'Exportar CSV',
        run: async (_p, env) => exportRows(env, { filename: `auditoria-${today()}.csv`, headers: ['Data', 'Ação', 'Entidade', 'ID', 'Usuário'], rows: (await env.auditLogs(500)).map((e) => [e.created_date || '', e.action, e.entity_type || '', e.entity_id || '', e.user_id || '']), what: 'auditoria' }),
      },
    ],
  },
  clips: {
    tabs: tabs('abrir', 'consultar', 'exportar', 'copiloto'),
    tools: [
      {
        id: 'cortes', tab: 'consultar', label: 'Cortes salvos', icon: Scissors,
        description: 'Lista os cortes (Clip) do tenant.',
        analyze: false, applyLabel: 'Consultar', run: async (_p, env) => listResult(await env.records('Clip', { sort: '-created_date', limit: 200 }), { empty: 'Nenhum corte salvo.', found: 'corte(s)', describe: (c) => `${nameOf(c)} · ${dateOf(c)}` }),
      },
      recentAssetsTool(),
      {
        id: 'exportar-cortes', tab: 'exportar', label: 'Exportar cortes', icon: Download,
        description: 'Baixa em CSV a lista de cortes do tenant.', analyze: false, applyLabel: 'Exportar CSV',
        run: async (_p, env) => exportRows(env, { filename: `cortes-${today()}.csv`, headers: ['Título', 'Início (s)', 'Fim (s)', 'Duração (s)', 'Criado em'], rows: (await env.records('Clip', { sort: '-created_date', limit: 500 })).map((c) => [nameOf(c), seconds(c.in_ms), seconds(c.out_ms), c.duration ?? '', dateOf(c)]), what: 'cortes' }),
      },
    ],
  },
  video: {
    tabs: tabs('abrir', 'consultar', 'copiloto'),
    tools: [
      openTool({ id: 'gerar-imagem', label: 'Gerar imagem', icon: Image, description: 'Abre o gerador de imagens.', url: '/ferramentas-ia?tool=image-generator' }),
      openTool({ id: 'gerar-video', label: 'Gerar vídeo', icon: Film, description: 'Abre o gerador de vídeo.', url: '/ferramentas-ia?tool=video-generator' }),
      openTool({ id: 'video-studio', label: 'Video Studio', icon: Sparkles, description: 'Abre o estúdio de vídeo por etapas.', url: '/ferramentas-ia?tool=video-studio' }),
      openTool({ id: 'thumbnails', label: 'Thumbnails', icon: Image, description: 'Abre o gerador de thumbnails.', url: '/ferramentas-ia?tool=thumbnails' }),
      {
        id: 'documentos-criativos', tab: 'consultar', label: 'Documentos criativos', icon: FileText,
        description: 'Lista os documentos criativos salvos (hoje, os carrosséis) com o status de cada um.',
        analyze: false, applyLabel: 'Consultar', run: async (_p, env) => listResult(await env.records('CreativeDocument', { sort: '-created_date', limit: 200 }), { empty: 'Nenhum documento salvo.', found: 'documento(s)', describe: (d) => `${d.content?.title || nameOf(d)} · ${d.tool_type || 'documento'} · ${d.status || 'sem status'}` }),
      },
    ],
  },
  image: {
    tabs: tabs('abrir', 'consultar', 'conferir', 'copiloto'),
    tools: [
      openTool({ id: 'estudio', label: 'Estúdio de Arte', icon: Image, description: 'Abre o Estúdio de Arte.', url: '/estudio-de-arte' }),
      openTool({ id: 'gerador-thumbnails', label: 'Gerador de thumbnails', icon: Sparkles, description: 'Abre o gerador de thumbnails com IA.', url: '/ferramentas-ia?tool=thumbnails' }),
      openTool({ id: 'carrossel', label: 'Carrossel', icon: Layers, description: 'Abre o estúdio de carrosséis.', url: '/ferramentas-ia?tool=carousel' }),
      projectsTool({ id: 'em-publicacao', label: 'Produções em publicação', icon: Megaphone, description: 'Produções em Redes sociais ou Para publicação (as que precisam de arte).', select: async (env) => (await projects(env)).filter((p) => ['para_publicar', 'redes_sociais'].includes(p.etapa)), empty: 'Nenhuma produção em publicação.', found: 'produção(ões) em publicação' }),
      projectsTool({ id: 'sem-thumbnail', tab: 'conferir', label: 'Produções sem thumbnail', icon: Image, description: 'Produções em publicação sem thumbnail definida.', select: async (env) => (await projects(env)).filter((p) => ['para_publicar', 'redes_sociais'].includes(p.etapa) && !p.thumbnail_url && !p.thumbnail), empty: 'Todas as produções em publicação têm thumbnail.', found: 'produção(ões) sem thumbnail' }),
    ],
  },
  office: {
    tabs: tabs('abrir', 'copiloto'),
    tools: [
      openTool({ id: 'word', label: 'Word', icon: FileText, description: 'Abre o editor de documentos.', url: '/ferramentas-graficas?tool=word' }),
      openTool({ id: 'excel', label: 'Excel', icon: BarChart3, description: 'Abre as planilhas.', url: '/ferramentas-graficas?tool=excel' }),
      openTool({ id: 'powerpoint', label: 'PowerPoint', icon: Layers, description: 'Abre as apresentações.', url: '/ferramentas-graficas?tool=powerpoint' }),
      openTool({ id: 'assistente', label: 'Assistente IA', icon: Sparkles, description: 'Abre o Assistente IA.', url: '/assistente' }),
    ],
  },
};

// Páginas de uma etapa do fluxo: lista, prazos vencidos e exportação daquela etapa + extras.
function stagePage(stage, sub, extra) {
  return {
    tabs: tabs('abrir', 'consultar', 'conferir', 'exportar', 'copiloto'),
    tools: [
      openTool({ id: `abrir-${sub}`, label: stageLabel(stage), icon: FolderOpen, description: `Abre a etapa ${stageLabel(stage)}.`, url: corp(sub) }),
      projectsTool({ id: `etapa-${stage}`, label: 'Produções da etapa', icon: ClipboardList, description: `Produções na etapa ${stageLabel(stage)}.`, select: (env) => projectsIn(env, stage), empty: 'Nenhuma produção nesta etapa.', found: 'produção(ões) nesta etapa' }),
      projectsTool({ id: `vencidas-${stage}`, tab: 'conferir', label: 'Prazos vencidos', icon: AlarmClock, description: `Produções em ${stageLabel(stage)} com prazo de edição antes de hoje.`, select: async (env) => overdue(await projectsIn(env, stage)), empty: 'Nenhum prazo vencido nesta etapa.', found: 'produção(ões) com prazo vencido' }),
      exportProjectsTool({ id: `exportar-${stage}`, label: `Exportar ${stageLabel(stage)}`, stage, filename: `producoes-${stage}-${today()}.csv` }),
      ...extra,
    ],
  };
}

// ---------- agência (protótipo local: dados ficam no navegador) ----------
const AGENCY_GUIDES = {
  agency_command: ['comando', 'Comando'], agency_planning: ['planejamento', 'Planejamento'], agency_radar: ['radar', 'Radar'],
  agency_prospect: ['prospeccao', 'Prospecção'], agency_crm: ['crm', 'CRM'], agency_campaign: ['campanhas', 'Campanhas'],
  agency_project: ['projetos', 'Projetos'], agency_production: ['edicao', 'Produção'], agency_approval: ['aprovacao', 'Aprovação'],
  agency_finance: ['financeiro', 'Financeiro'], agency_client: ['clientes', 'Clientes'], agency_agents: ['agentes', 'Agentes'],
};
const AGENCY_COLLECTIONS = [['leads', 'Leads', Users], ['opportunities', 'Oportunidades', Briefcase], ['campaigns', 'Campanhas', Megaphone], ['projects', 'Projetos', ClipboardList], ['tasks', 'Tarefas', CheckSquare]];

function agencyCatalogue(group) {
  const [guide] = AGENCY_GUIDES[group];
  return {
    tabs: [{ ...TABS.abrir }, { ...TABS.consultar, description: 'Dados do protótipo da Agência, guardados neste navegador.' }, TABS.exportar, TABS.copiloto],
    tools: [
      ...Object.entries(AGENCY_GUIDES).map(([, [id, text]]) => openTool({ id: `guia-${id}`, label: text, icon: id === guide ? Sparkles : FolderOpen, description: `Abre a guia ${text} da Agência.`, url: `/agencia-video?guia=${id}` })),
      ...AGENCY_COLLECTIONS.map(([key, text, icon]) => ({
        id: `listar-${key}`, tab: 'consultar', label: text, icon,
        description: `Lista ${text.toLowerCase()} do protótipo (salvos neste navegador).`,
        analyze: false, applyLabel: 'Consultar', run: async (_p, env) => listResult(env.agencyData()[key] || [], { empty: `Nenhum registro em ${text}.`, found: text.toLowerCase(), describe: (item) => `${nameOf(item)}${item.status ? ` · ${item.status}` : ''}` }),
      })),
      {
        id: 'ganhos', tab: 'consultar', label: 'Negócios ganhos', icon: Wallet,
        description: 'Valor das oportunidades com status Ganha (negócio fechado, não é valor recebido).',
        analyze: false, applyLabel: 'Consultar', run: async (_p, env) => wonRevenue(env),
      },
      ...AGENCY_COLLECTIONS.map(([key, text]) => ({
        id: `exportar-${key}`, tab: 'exportar', label: `Exportar ${text}`, icon: Download,
        description: `Baixa em CSV ${text.toLowerCase()} do protótipo.`, analyze: false, applyLabel: 'Exportar CSV',
        run: async (_p, env) => {
          const items = env.agencyData()[key] || [];
          const headers = [...new Set(items.flatMap((item) => Object.keys(item)))];
          return exportRows(env, { filename: `agencia-${key}-${today()}.csv`, headers, rows: items.map((item) => headers.map((h) => (typeof item[h] === 'object' ? JSON.stringify(item[h]) : item[h]))), what: text.toLowerCase() });
        },
      })),
    ],
  };
}

function wonRevenue(env) {
  const won = (env.agencyData().opportunities || []).filter((item) => item.status === 'Ganha');
  const total = won.reduce((sum, item) => sum + (Number(item.valor ?? item.value) || 0), 0);
  return { ok: true, count: won.length, headline: { count: won.length, text: 'oportunidade(s) ganha(s)' }, summary: `Total: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.` };
}

// ---------- análises compartilhadas ----------
const seconds = (ms) => (Number.isFinite(Number(ms)) && ms !== null && ms !== '' ? Number(ms) / 1000 : '');

function stageCount(list) {
  if (!list.length) return { ok: true, count: 0, summary: 'Nenhuma produção cadastrada.' };
  const details = PRODUCTION_STAGES.map((stage) => [stage.label, list.filter((p) => isProjectInProductionStage(p, stage.id)).length]).filter(([, n]) => n).map(([label, n]) => `${label}: ${n}`);
  return { ok: true, count: list.length, headline: { count: list.length, text: 'produção(ões) no total' }, summary: 'Distribuição por etapa:', details };
}

function countBy(list, key, noun) {
  if (!list.length) return { ok: true, count: 0, summary: `Nenhum registro de ${noun}.` };
  const counts = list.reduce((acc, item) => ({ ...acc, [key(item)]: (acc[key(item)] || 0) + 1 }), {});
  return { ok: true, count: list.length, headline: { count: list.length, text: noun }, summary: 'Por categoria:', details: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name}: ${n}`) };
}

function duplicates(assets) {
  const groups = assets.reduce((acc, asset) => {
    const id = `${String(asset.filename || '').toLowerCase()}|${asset.file_size || ''}`;
    return asset.filename ? { ...acc, [id]: [...(acc[id] || []), asset] } : acc;
  }, {});
  const repeated = Object.values(groups).filter((group) => group.length > 1);
  return listResult(repeated, { empty: 'Nenhum duplicado (mesmo nome e tamanho).', found: 'arquivo(s) repetido(s)', describe: (group) => `${group[0].filename} · ${group.length} cópias` });
}

async function pendingApprovals(env) {
  const items = (await env.records('AprovacaoItem', { sort: 'ordem', limit: 500 })).filter((item) => !['aprovado', 'reprovado', 'concluido'].includes(String(item.status || item.decisao || '').toLowerCase()));
  return listResult(items, { empty: 'Nenhuma aprovação pendente.', found: 'aprovação(ões) pendente(s)', describe: (item) => `${nameOf(item)}${item.status ? ` · ${item.status}` : ''}` });
}

/** Catálogo da página (ou null). `cards` são os pedidos de Copiloto já existentes do grupo. */
export function pageCatalogue(group, { label, cards = [] } = {}) {
  const base = group.startsWith('agency_') ? (AGENCY_GUIDES[group] ? agencyCatalogue(group) : null) : CATALOGUES[group];
  if (!base) return null;
  return { tabs: base.tabs, tools: [...base.tools, ...copilotTools(label, cards, MessageSquare)] };
}

export const PAGE_CATALOGUE_GROUPS = [...Object.keys(CATALOGUES), ...Object.keys(AGENCY_GUIDES)];
