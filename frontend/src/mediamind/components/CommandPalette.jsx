import React, { useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import {
  Search, CornerDownLeft, ArrowUp, ArrowDown, Home, Briefcase, Film, Calendar,
  Layers, ShieldCheck, BarChart3, Send, AlertCircle, Hash, FolderOpen, CheckSquare,
  FileText, Newspaper, MessageSquare, Users, Clapperboard, Sparkles, Command as CommandIcon,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '../auth';
import { useEmpresa } from '../lib/empresaContext';
import { CORP_TABS } from '../lib/corpTabs';
import { filterTabsForUser } from '../lib/permissions';
import { tokenize, scoreItem } from '../lib/searchUtils';
import { ACTIONS, canRunAction, runAction, tabForAction } from '../lib/quickActions';
import Highlight from './Highlight';

// Tints por tipo: container bg-{color}-500/15 + texto text-{color}-300.
const TINT = {
  emerald: 'bg-emerald-500/15 text-emerald-300',
  slate: 'bg-slate-500/15 text-slate-300',
  amber: 'bg-amber-500/15 text-amber-300',
  sky: 'bg-sky-500/15 text-sky-300',
};

// Atalhos de navegação (estáticos, sempre visíveis).
const NAV = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/corp', label: 'IAcervo Corp', icon: Briefcase },
  { to: '/search', label: 'Busca de mídias', icon: Search },
  { to: '/ingest', label: 'Ingest', icon: Layers },
  { to: '/workspace', label: 'Workspace', icon: Film },
  { to: '/timeline', label: 'Timeline', icon: Calendar },
  { to: '/social', label: 'Clipes / Redes sociais', icon: Send },
  { to: '/acervo', label: 'Acervo', icon: ShieldCheck },
  { to: '/management', label: 'Gestão', icon: BarChart3 },
  { to: '/assistente', label: 'Assistente IA', icon: Sparkles },
];

// Fontes de registros (uma entidade por grupo). `param` = aba do Corp (filtrada
// por permissão); `to` = rota aberta. `keywords` vira um campo peso 1 pra que
// digitar o tipo (ex.: "producao") surfaced os registros.
const SOURCES = [
  { entity: 'ProducaoProjeto', group: 'Produções', icon: Clapperboard, label: (r) => r.titulo || 'Produção', hint: (r) => `${r.programa || ''} ${r.episodio ? `· ${r.episodio}` : ''} · ${r.etapa || ''}`.replace(/^·\s*|·\s*$/g, '').trim(), to: '/corp', param: 'producao', keywords: 'producao podcast episodio programa gravacao edicao entrega rascunho materia reportagem' },
  { entity: 'Asset', group: 'Acervo', icon: Film, label: (r) => r.title || r.filename, hint: (r) => `${r.filename || ''} · ${r.asset_type || ''}`.replace(/^·\s*|·\s*$/g, '').trim(), to: '/search', keywords: 'midia video audio imagem arquivo acervo filme clipe reportagem materia entrevista documento' },
  { entity: 'Project', group: 'Projetos', icon: FolderOpen, label: (r) => r.name, hint: (r) => `${r.status || ''} · ${r.asset_count || 0} arquivos`, to: '/workspace', keywords: 'projeto' },
  { entity: 'Task', group: 'Tarefas', icon: CheckSquare, label: (r) => r.title, hint: (r) => `${r.project_name || ''} · ${r.status || ''}`.replace(/^·\s*|·\s*$/g, '').trim(), to: '/workspace', keywords: 'tarefa pendencia pendente atividade fazer entrega' },
  { entity: 'Script', group: 'Roteiros', icon: FileText, label: (r) => r.title, hint: (r) => `${r.project_name || ''} · ${r.status || ''}`.replace(/^·\s*|·\s*$/g, '').trim(), to: '/workspace', keywords: 'roteiro' },
  { entity: 'Library', group: 'Bibliotecas', icon: ShieldCheck, label: (r) => r.name, hint: (r) => `${r.status || ''} · ${r.asset_count || 0} itens`, to: '/acervo', keywords: 'biblioteca' },
  { entity: 'IngestPackage', group: 'Ingest', icon: Layers, label: (r) => r.name, hint: (r) => `${r.status || ''} · ${r.file_count || 0} arquivos`, to: '/ingest', keywords: 'ingest pacote' },
  { entity: 'Clip', group: 'Clipes', icon: Film, label: (r) => r.title, hint: (r) => `${r.program_name || ''} · ${r.status || ''}`.replace(/^·\s*|·\s*$/g, '').trim(), to: '/social', keywords: 'clip corte publicacao social viral reels tiktok instagram youtube short' },
  { entity: 'ComentarioRevisao', group: 'Comentários', icon: MessageSquare, label: (r) => (r.texto || '').slice(0, 60), hint: (r) => `${r.asset_title || ''} · ${r.timecode_label || ''}`.replace(/^·\s*|·\s*$/g, '').trim(), to: '/workspace', keywords: 'comentario revisao' },
  { entity: 'AgendaEvento', group: 'Agenda', icon: Calendar, label: (r) => r.titulo, hint: (r) => `${r.programa || ''} · dia ${r.day || ''} ${r.horario || ''}`.replace(/^·\s*|·\s*$/g, '').trim(), to: '/corp', param: 'producao', keywords: 'agenda evento gravacao' },
  { entity: 'BriefingProducao', group: 'Briefings', icon: FileText, label: (r) => r.titulo, hint: (r) => r.programa || '', to: '/corp', param: 'producao', keywords: 'briefing' },
  { entity: 'Release', group: 'Releases', icon: Newspaper, label: (r) => r.titulo, hint: (r) => `${r.status || ''} · ${r.veiculos || 0} veículos`, to: '/corp', param: 'assessoria', keywords: 'release assessoria' },
  { entity: 'Clipping', group: 'Clippings', icon: Newspaper, label: (r) => r.titulo, hint: (r) => `${r.veiculo || ''} · ${r.tom || ''}`.replace(/^·\s*|·\s*$/g, '').trim(), to: '/corp', param: 'assessoria', keywords: 'clipping' },
  { entity: 'Mencao', group: 'Menções', icon: Hash, label: (r) => r.titulo, hint: (r) => `${r.veiculo || ''} · ${r.tom || ''}`.replace(/^·\s*|·\s*$/g, '').trim(), to: '/corp', param: 'assessoria', keywords: 'mencao' },
  { entity: 'Jornalista', group: 'Jornalistas', icon: Users, label: (r) => r.nome, hint: (r) => `${r.veiculo || ''} · ${r.area || ''}`.replace(/^·\s*|·\s*$/g, '').trim(), to: '/corp', param: 'assessoria', keywords: 'jornalista' },
];

function segmentToTabId(seg) {
  return String(seg || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current, isGlobal } = useEmpresa();
  const [data, setData] = useState({});
  const [query, setQuery] = useState('');

  // Carga: resolve o tenant ativo e filtra cada entidade por empresa_id.
  // Visão "all" (admin) não aplica filtro. Erros silenciosos mantêm dados
  // anteriores. Cache key = empresa ativa; invalidado ao trocar (dep current).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const filterObj = isGlobal || !current ? null : { empresa_id: current };
    const names = [...SOURCES.map((s) => s.entity), 'PendenciaCorp'];
    Promise.all(
      names.map((n) => {
        const e = base44.entities[n];
        if (!e) return Promise.resolve([n, []]);
        const p = filterObj ? e.filter(filterObj, '-created_date', 200) : e.list('-created_date', 200);
        return p.then((r) => [n, r || []]).catch(() => [n, []]);
      })
    )
      .then((pairs) => {
        if (alive) setData(Object.fromEntries(pairs));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, current, isGlobal]);

  // Limpa a query ao (re)abrir.
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const sections = useMemo(() => {
    const tokens = tokenize(query);
    const allowedIds = new Set(filterTabsForUser(CORP_TABS, user).map((t) => t.id));
    const has = (tabId) => !tabId || allowedIds.has(tabId);
    const go = (to) => () => {
      onClose();
      navigate(to);
    };
    const run = (id) => () => {
      onClose();
      runAction(id, navigate);
    };

    const pass = (fields) => !tokens.length || scoreItem(fields, tokens) !== null;
    const rank = (fields) => (tokens.length ? scoreItem(fields, tokens) || 0 : 0);
    const cap = (items) => items.slice().sort((a, b) => rank(b.fields) - rank(a.fields)).slice(0, 12);

    const result = [];

    // 1. Ações (estáticos, disponíveis antes do índice carregar).
    //    Filtra por permissão: papel (roles) + aba do Corp (tab). Sem aba = todos.
    const actionItems = ACTIONS.filter((a) => canRunAction(a, user))
      .filter((a) => has(tabForAction(a)))
      .map((a) => ({
        value: `acao:${a.id}`,
        label: a.label,
        hint: a.entity,
        icon: a.icon,
        tint: 'emerald',
        fields: [
          { text: a.label, weight: 3 },
          { text: 'novo nova cadastrar criar adicionar iniciar registrar', weight: 2 },
          { text: a.entity, weight: 2 },
        ],
        onSelect: run(a.id),
      }))
      .filter((it) => pass(it.fields));
    if (actionItems.length) result.push({ heading: 'Ações', items: cap(actionItems) });

    // 2. Grupos de dados (uma entidade por grupo).
    for (const s of SOURCES) {
      if (s.param && !has(s.param)) continue;
      const recs = data[s.entity] || [];
      const items = recs
        .map((r, i) => ({
          value: `${s.entity}:${r.id ?? i}`,
          label: s.label(r) || '—',
          hint: s.hint(r) || '',
          icon: s.icon,
          tint: 'slate',
          fields: [
            { text: s.label(r) || '', weight: 3 },
            { text: s.hint(r) || '', weight: 2 },
            { text: s.keywords, weight: 1 },
          ],
          onSelect: go(s.param ? `${s.to}?tab=${s.param}` : s.to),
        }))
        .filter((it) => pass(it.fields));
      const capped = cap(items);
      if (capped.length) result.push({ heading: s.group, items: capped });
    }

    // 3. Pendências (exceções operacionais — em aberto).
    const pendRecs = (data.PendenciaCorp || []).filter(
      (p) => p.status === 'pendente' || p.status === 'em_andamento'
    );
    const pendItems = pendRecs
      .map((p, i) => {
        const tabId = segmentToTabId(p.segmento);
        if (!has(tabId)) return null;
        return {
          value: `pend:${p.id ?? i}`,
          label: p.titulo || 'Pendência',
          hint: `${p.segmento || ''} · ${p.responsavel || ''}`.replace(/^·\s*|·\s*$/g, '').trim(),
          icon: AlertCircle,
          tint: p.status === 'em_andamento' ? 'sky' : 'amber',
          fields: [
            { text: p.titulo || '', weight: 3 },
            { text: `${p.segmento || ''} ${p.responsavel || ''}`, weight: 2 },
            { text: 'pendencia', weight: 1 },
          ],
          onSelect: go(`/corp?tab=${tabId}`),
        };
      })
      .filter(Boolean)
      .filter((it) => pass(it.fields));
    const pendCapped = cap(pendItems);
    if (pendCapped.length) result.push({ heading: 'Pendências', items: pendCapped });

    // 4. Navegação (estáticos).
    const navItems = NAV.map((r) => ({
      value: `nav:${r.to}`,
      label: r.label,
      hint: r.to,
      icon: r.icon,
      tint: 'slate',
      fields: [
        { text: r.label, weight: 3 },
        { text: r.to, weight: 1 },
      ],
      onSelect: go(r.to),
    })).filter((it) => pass(it.fields));
    const navCapped = cap(navItems);
    if (navCapped.length) result.push({ heading: 'Navegação', items: navCapped });

    return result;
  }, [query, data, user, navigate, onClose]);

  const allEmpty = sections.every((s) => s.items.length === 0);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[15vh] z-50 w-[92vw] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl outline-none">
          <DialogPrimitive.Title className="sr-only">Busca global</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Pesquise registros, ações e atalhos de navegação.
          </DialogPrimitive.Description>

          <Command shouldFilter={false} loop label="Busca global" className="flex flex-col">
            {/* Input */}
            <div className="flex items-center gap-2.5 border-b border-slate-800 px-4 py-3">
              <Search size={18} className="shrink-0 text-slate-500" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Buscar ou criar — …"
                className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
              />
              <kbd className="hidden shrink-0 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">
                ESC
              </kbd>
            </div>

            {/* Resultados */}
            <Command.List className="max-h-[60vh] overflow-y-auto py-1">
              {allEmpty ? (
                <Command.Empty>
                  <div className="px-4 py-10 text-center text-sm text-slate-500">
                    Nada encontrado para “{query}”.
                  </div>
                </Command.Empty>
              ) : (
                sections.map((sec) => (
                  <React.Fragment key={sec.heading}>
                    <div className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {sec.heading}
                    </div>
                    <Command.Group>
                      {sec.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Command.Item
                            key={item.value}
                            value={item.value}
                            onSelect={item.onSelect}
                            className="flex w-full cursor-default items-center gap-3 px-4 py-2 text-left outline-none data-[selected=true]:bg-sky-500/15"
                          >
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TINT[item.tint] || TINT.slate}`}>
                              <Icon size={14} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-slate-200">
                                <Highlight text={item.label} query={query} />
                              </p>
                              {item.hint && (
                                <p className="truncate text-[11px] text-slate-500">
                                  <Highlight text={item.hint} query={query} />
                                </p>
                              )}
                            </div>
                            <CornerDownLeft size={13} className="shrink-0 text-slate-700 data-[selected=true]:text-sky-300" />
                          </Command.Item>
                        );
                      })}
                    </Command.Group>
                  </React.Fragment>
                ))
              )}
            </Command.List>

            {/* Rodapé com pills de teclado */}
            <div className="flex items-center gap-4 border-t border-slate-800 px-4 py-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <ArrowUp size={11} />
                <ArrowDown size={11} /> navegar
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft size={11} /> abrir
              </span>
              <span className="flex items-center gap-1">esc fechar</span>
              <span className="ml-auto flex items-center gap-3">
                <span className="flex items-center gap-1"><kbd className="rounded border border-slate-700 bg-slate-800 px-1">/</kbd> busca</span>
                <span className="flex items-center gap-1"><kbd className="rounded border border-slate-700 bg-slate-800 px-1">n</kbd> novo</span>
                <span className="flex items-center gap-1"><kbd className="rounded border border-slate-700 bg-slate-800 px-1">g</kbd> ir</span>
                <span className="flex items-center gap-1"><CommandIcon size={11} /> K</span>
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}