import React, { useState } from 'react';
import {
  LayoutDashboard, Inbox, Film, ListChecks, Users, ShieldCheck, UserCog, Plus, Search,
  Activity, MonitorCog, CheckCircle2, AlertTriangle, Archive, Library, ScrollText,
  UsersRound, RotateCcw,
} from 'lucide-react';
import CorpPanel from '../CorpPanel';
import { SubTabsBar, StatCard, StatusBadge, Panel } from './RoleShared';
import ManagementProcessamentosTab from '../../management/ManagementProcessamentosTab';
import CedocArquivosTab from './CedocArquivosTab';
import CedocIngestTab from './CedocIngestTab';
import {
  MOCK_MONITORING, MOCK_LIBRARIES, MOCK_AUDIT_LOGS, formatBytes,
  MOCK_CEDOC_INGEST, MOCK_CEDOC_MIDIAS, MOCK_CEDOC_TAREFAS,
  MOCK_CEDOC_GRUPOS, MOCK_CEDOC_USUARIOS, PERMISSOES_CEDOC, CEDOC_FUNCIONARIO_EXEMPLO,
} from '../../../data';
import RoleInicio from '../RoleInicio';

// Cedoc / Administrador de Acervo — diretor do Cedoc de várias TVs + funcionários.
// O Administrador vê tudo (ingest, mídias, tarefas) MAIS gestão de usuários e
// permissões. O Funcionário vê apenas o que lhe é atribuído (ingest/mídias/tarefas)
// e não acessa a aba de usuários. Toda a administração de mídias do app mora aqui.

const TONE = {
  pendente: 'bg-amber-500/15 text-amber-300',
  processando: 'bg-sky-500/15 text-sky-300',
  concluido: 'bg-emerald-500/15 text-emerald-300',
  falhou: 'bg-rose-500/15 text-rose-300',
  aberta: 'bg-sky-500/15 text-sky-300',
  em_andamento: 'bg-amber-500/15 text-amber-300',
  concluida: 'bg-emerald-500/15 text-emerald-300',
  ativo: 'bg-emerald-500/15 text-emerald-300',
  inativo: 'bg-slate-500/15 text-slate-400',
  suspenso: 'bg-rose-500/15 text-rose-300',
  active: 'bg-emerald-500/15 text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-300',
};
const LABEL = {
  pendente: 'Pendente', processando: 'Processando', concluido: 'Concluído', falhou: 'Falhou',
  aberta: 'Aberta', em_andamento: 'Em andamento', concluida: 'Concluída',
  ativo: 'Ativo', inativo: 'Inativo', suspenso: 'Suspenso',
  active: 'Ativo', warning: 'Atenção',
};

const PERMISSOES = PERMISSOES_CEDOC;
const FUNCIONARIO_EXEMPLO = CEDOC_FUNCIONARIO_EXEMPLO;

export default function CedocPage() {
  const [papel, setPapel] = useState('admin'); // 'admin' | 'funcionario'
  const [sub, setSub] = useState('overview');
  const [busca, setBusca] = useState('');
  const [selMidia, setSelMidia] = useState(101);

  const isAdmin = papel === 'admin';

  // Funcionário só vê o que lhe é atribuído.
  const ingests = isAdmin ? MOCK_CEDOC_INGEST : MOCK_CEDOC_INGEST.filter((i) => i.responsavel === FUNCIONARIO_EXEMPLO);
  const midias = isAdmin ? MOCK_CEDOC_MIDIAS : MOCK_CEDOC_MIDIAS.filter((m) => m.responsavel === FUNCIONARIO_EXEMPLO);
  const tarefas = isAdmin ? MOCK_CEDOC_TAREFAS : MOCK_CEDOC_TAREFAS.filter((t) => t.responsavel === FUNCIONARIO_EXEMPLO);

  const [usuarios, setUsuarios] = useState(MOCK_CEDOC_USUARIOS);
  const [grupos, setGrupos] = useState(MOCK_CEDOC_GRUPOS);

  function permsDoGrupo(gid) {
    const g = grupos.find((x) => x.id === gid);
    return g ? g.permissoes : { ingest: false, editar: false, excluir: false, gerenciar: false };
  }

  // Permissões efetivas: herda do grupo ou usa as personalizadas.
  function permsEfetivas(u) {
    if (u.papel === 'admin') return { ingest: true, editar: true, excluir: true, gerenciar: true };
    return u.herdaGrupo ? permsDoGrupo(u.grupo) : u.permissoes;
  }

  // Alterna permissão individual. Se o usuário está herdando o grupo, vira
  // personalizado a partir da cópia do padrão do grupo e então aplica o toggle.
  function togglePermissao(uid, key) {
    setUsuarios((us) => us.map((u) => {
      if (u.id !== uid) return u;
      if (u.papel === 'admin') return u;
      const base = u.herdaGrupo ? { ...permsDoGrupo(u.grupo) } : { ...u.permissoes };
      base[key] = !base[key];
      return { ...u, herdaGrupo: false, permissoes: base };
    }));
  }

  // Liga/desliga herança do grupo. Ao reativar herança, as permissões individuais
  // voltam a espelhar o padrão do grupo.
  function toggleHerdaGrupo(uid) {
    setUsuarios((us) => us.map((u) => {
      if (u.id !== uid || u.papel === 'admin') return u;
      const herda = !u.herdaGrupo;
      return { ...u, herdaGrupo: herda, permissoes: herda ? { ...permsDoGrupo(u.grupo) } : u.permissoes };
    }));
  }

  // Altera o grupo de um usuário (mantém o estado de herança).
  function trocarGrupo(uid, gid) {
    setUsuarios((us) => us.map((u) => {
      if (u.id !== uid || u.papel === 'admin') return u;
      return { ...u, grupo: gid, permissoes: u.herdaGrupo ? { ...permsDoGrupo(gid) } : u.permissoes };
    }));
  }

  // Edita o padrão de permissões de um grupo — usuários que herdam refletem a mudança.
  function toggleGrupoPermissao(gid, key) {
    setGrupos((gs) => gs.map((g) => g.id === gid ? { ...g, permissoes: { ...g.permissoes, [key]: !g.permissoes[key] } } : g));
  }

  const subtabs = isAdmin
    ? [
        { id: 'overview', name: 'Visão geral', Icon: LayoutDashboard },
        { id: 'ingest', name: 'Ingest', Icon: Inbox },
        { id: 'midias', name: 'Mídias', Icon: Film },
        { id: 'arquivos', name: 'Arquivos', Icon: Archive },
        { id: 'tarefas', name: 'Tarefas de mídia', Icon: ListChecks },
        { id: 'processados', name: 'Processados IA', Icon: Activity },
        { id: 'sistema', name: 'Sistema', Icon: MonitorCog },
        { id: 'usuarios', name: 'Gestão de usuários', Icon: Users },
      ]
    : [
        { id: 'overview', name: 'Visão geral', Icon: LayoutDashboard },
        { id: 'ingest', name: 'Ingest', Icon: Inbox },
        { id: 'midias', name: 'Minhas mídias', Icon: Film },
        { id: 'tarefas', name: 'Minhas tarefas', Icon: ListChecks },
      ];

  // Se trocar pra funcionário e estiver numa aba exclusiva de admin, volta pra visão geral.
  function trocarPapel(p) {
    setPapel(p);
    if (p === 'funcionario' && (sub === 'usuarios' || sub === 'processados' || sub === 'sistema' || sub === 'arquivos')) setSub('overview');
  }

  const midiaSel = midias.find((m) => m.id === selMidia);

  return (
    <div className="space-y-4">
      {/* Alternador de papel — demonstra as duas visões (diretor vs funcionário) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-2.5">
        <div className="flex items-center gap-2 rounded-lg bg-slate-950/60 p-1">
          <button
            onClick={() => trocarPapel('admin')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
              isAdmin ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <ShieldCheck size={13} /> Administrador de Acervo
          </button>
          <button
            onClick={() => trocarPapel('funcionario')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
              !isAdmin ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <UserCog size={13} /> Funcionário do Cedoc
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          {isAdmin
            ? 'Diretor do Cedoc — gestão de mídias, ingest, tarefas e usuários de todas as TVs.'
            : `Funcionário — vê apenas mídias e tarefas atribuídas a ${FUNCIONARIO_EXEMPLO}.`}
        </p>
      </div>

      <SubTabsBar tabs={subtabs} active={sub} onChange={setSub} />

      <div className="h-[calc(100vh-19rem)]">
        {sub === 'overview' && <RoleInicio roleId="cedoc" onNavigate={setSub} />}
        {false && (
          <div className="h-full space-y-4 overflow-y-auto">
            {/* Indicadores principais */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
              <StatCard label="Mídias no acervo" value={MOCK_CEDOC_MIDIAS.length} tone="text-sky-300" />
              <StatCard label="Ingest pendente" value={MOCK_CEDOC_INGEST.filter((i) => i.status === 'pendente' || i.status === 'processando').length} tone="text-amber-300" />
              <StatCard label="Tarefas abertas" value={MOCK_CEDOC_TAREFAS.filter((t) => t.status !== 'concluida').length} tone="text-violet-300" />
              <StatCard label="Processando IA" value={MOCK_MONITORING.processing} tone="text-sky-300" />
              <StatCard label="Falhas IA" value={MOCK_MONITORING.failed} tone="text-rose-300" />
              {isAdmin
                ? <StatCard label="Funcionários ativos" value={MOCK_CEDOC_USUARIOS.filter((u) => u.status === 'ativo' && u.papel === 'funcionario').length} tone="text-emerald-300" />
                : <StatCard label="Minhas tarefas" value={tarefas.length} tone="text-emerald-300" />}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* Recursos do sistema */}
              <CorpPanel title="Recursos do sistema" className="min-h-0">
                <div className="space-y-3">
                  <ResourceBar label="CPU" percent={MOCK_MONITORING.resources.cpu_percent ?? 0} detail={`${MOCK_MONITORING.resources.cpu_logical_cores} núcleos`} />
                  <ResourceBar label="Memória" percent={MOCK_MONITORING.resources.memory_used_bytes && MOCK_MONITORING.resources.memory_total_bytes ? Math.round((MOCK_MONITORING.resources.memory_used_bytes / MOCK_MONITORING.resources.memory_total_bytes) * 100) : 0} detail={`${formatBytes(MOCK_MONITORING.resources.memory_used_bytes)} / ${formatBytes(MOCK_MONITORING.resources.memory_total_bytes)}`} />
                  <ResourceBar label="GPU" percent={MOCK_MONITORING.resources.gpu_percent ?? 0} detail={`${formatBytes(MOCK_MONITORING.resources.gpu_memory_used_bytes)}`} />
                  <ResourceBar label="Storage" percent={MOCK_MONITORING.storage.total_bytes ? Math.round((MOCK_MONITORING.storage.used_bytes / MOCK_MONITORING.storage.total_bytes) * 100) : 0} detail={`${formatBytes(MOCK_MONITORING.storage.used_bytes)} / ${formatBytes(MOCK_MONITORING.storage.total_bytes)}`} />
                </div>
              </CorpPanel>

              {/* Serviços & modelos IA */}
              <CorpPanel title="Serviços & modelos de IA" className="min-h-0">
                <div className="space-y-2">
                  {MOCK_MONITORING.services.map((s) => (
                    <div key={s.key} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div><p className="text-xs font-medium text-slate-200">{s.label}</p><p className="text-[10px] text-slate-500">{s.detail}</p></div>
                      <StatusBadge status={s.status} map={TONE} labels={LABEL} />
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {MOCK_MONITORING.ai_models.map((model) => (
                      <span key={model.key} className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1 text-[10px] text-slate-300">
                        {model.label} <StatusBadge status={model.status} map={TONE} labels={LABEL} />
                      </span>
                    ))}
                  </div>
                </div>
              </CorpPanel>

              {/* Ingest recente */}
              <CorpPanel title="Ingest recente" className="min-h-0">
                <div className="space-y-2">
                  {ingests.slice(0, 5).map((i) => (
                    <div key={i.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-200">{i.titulo}</p>
                        <p className="text-[10px] text-slate-500">{i.arquivos} arq · {i.tamanho_gb} GB · {i.responsavel}</p>
                      </div>
                      <StatusBadge status={i.status} map={TONE} labels={LABEL} />
                    </div>
                  ))}
                </div>
              </CorpPanel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Tarefas de mídia */}
              <CorpPanel title="Tarefas de mídia" className="min-h-0">
                <div className="space-y-2">
                  {tarefas.slice(0, 6).map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{t.titulo}</p>
                        <p className="text-[11px] text-slate-500">{t.midia} · prazo {t.prazo} · {t.responsavel}</p>
                      </div>
                      <StatusBadge status={t.status} map={TONE} labels={LABEL} />
                    </div>
                  ))}
                </div>
              </CorpPanel>

              {/* Administração (admin) ou minhas mídias (funcionário) */}
              {isAdmin ? (
                <CorpPanel title="Usuários & permissões" className="min-h-0">
                  <div className="space-y-2">
                    {usuarios.map((u) => {
                      const ef = permsEfetivas(u);
                      return (
                      <div key={u.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-200">{u.nome}</p>
                          <p className="text-[10px] text-slate-500">{u.tvs.join(', ')} · {u.midias} mídias · {grupos.find((g)=>g.id===u.grupo)?.nome ?? '—'}{u.herdaGrupo && u.papel!=='admin' ? ' (herda)' : ''}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {PERMISSOES.map((p) => (
                            <span key={p.key} className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${u.papel === 'admin' ? 'bg-sky-500/15 text-sky-300' : ef[p.key] ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-600'}`}>
                              {p.label}
                            </span>
                          ))}
                          <StatusBadge status={u.status} map={TONE} labels={LABEL} />
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </CorpPanel>
              ) : (
                <CorpPanel title="Minhas mídias" className="min-h-0">
                  <div className="space-y-2">
                    {midias.slice(0, 6).map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-200">{m.titulo}</p>
                          <p className="text-[10px] text-slate-500">{m.programa} · {m.tamanho_gb} GB</p>
                        </div>
                        <StatusBadge status={m.status} map={TONE} labels={LABEL} />
                      </div>
                    ))}
                  </div>
                </CorpPanel>
              )}
            </div>
          </div>
        )}

        {isAdmin && sub === 'arquivos' && (
          <div className="h-full">
            <CedocArquivosTab />
          </div>
        )}

        {sub === 'ingest' && <CedocIngestTab isAdmin={isAdmin} />}

        {sub === 'midias' && (
          <div className="grid h-full gap-4 lg:grid-cols-5">
            <div className="overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 lg:col-span-2">
              <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2.5">
                <Search size={13} className="text-slate-500" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar mídia..."
                  className="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5 p-3">
                {midias
                  .filter((m) => m.titulo.toLowerCase().includes(busca.toLowerCase()))
                  .map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelMidia(m.id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selMidia === m.id ? 'border-sky-600 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-200">{m.titulo}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">{m.programa}</span>
                        <StatusBadge status={m.status} map={TONE} labels={LABEL} />
                      </div>
                    </button>
                  ))}
              </div>
            </div>
            <CorpPanel title="Detalhe da mídia" className="lg:col-span-3">
              {midiaSel && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-slate-100">{midiaSel.titulo}</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5"><p className="text-[9px] uppercase text-slate-500">Programa</p><p className="text-xs text-slate-200">{midiaSel.programa}</p></div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5"><p className="text-[9px] uppercase text-slate-500">Tipo</p><p className="text-xs text-slate-200">{midiaSel.tipo}</p></div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5"><p className="text-[9px] uppercase text-slate-500">Responsável</p><p className="text-xs text-slate-200">{midiaSel.responsavel}</p></div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5"><p className="text-[9px] uppercase text-slate-500">Tamanho</p><p className="text-xs text-slate-200">{midiaSel.tamanho_gb} GB</p></div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5"><p className="text-[9px] uppercase text-slate-500">Status</p><div className="mt-0.5"><StatusBadge status={midiaSel.status} map={TONE} labels={LABEL} /></div></div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5"><p className="text-[9px] uppercase text-slate-500">Criado em</p><p className="text-xs text-slate-200">{midiaSel.criado}</p></div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button className="rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400">Reatribuir</button>
                      <button className="rounded-md border border-slate-700 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-800">Editar metadados</button>
                      <button className="rounded-md border border-rose-800 px-3 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-950/40">Arquivar</button>
                    </div>
                  )}
                </div>
              )}
            </CorpPanel>
          </div>
        )}

        {sub === 'tarefas' && (
          <Panel title="Tarefas de mídia">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 text-left font-semibold">Tarefa</th>
                  <th className="px-2 py-2 text-left font-semibold">Mídia</th>
                  <th className="px-2 py-2 text-left font-semibold">Responsável</th>
                  <th className="px-2 py-2 text-left font-semibold">Prazo</th>
                  <th className="px-2 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {tarefas.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-2 py-2.5 font-medium text-slate-200">{t.titulo}</td>
                    <td className="px-2 py-2.5 text-slate-400">{t.midia}</td>
                    <td className="px-2 py-2.5 text-slate-400">{t.responsavel}</td>
                    <td className="px-2 py-2.5 font-mono text-slate-500">{t.prazo}</td>
                    <td className="px-2 py-2.5"><StatusBadge status={t.status} map={TONE} labels={LABEL} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {isAdmin && sub === 'processados' && (
          <div className="h-full overflow-y-auto">
            <ManagementProcessamentosTab />
          </div>
        )}

        {isAdmin && sub === 'sistema' && <SistemaView />}

        {isAdmin && sub === 'usuarios' && (
          <div className="space-y-4">
            {/* Grupos de permissões */}
            <CorpPanel title="Grupos de permissões" className="min-h-0">
              <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
                Cada grupo tem um padrão de autorizações. Usuários que <span className="text-slate-300">herdam</span> o grupo
                recebem automaticamente estas permissões — altere o padrão do grupo e todos os herdeiros acompanham na hora.
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                {grupos.map((g) => {
                  const herdeiros = usuarios.filter((u) => u.grupo === g.id && u.herdaGrupo && u.papel !== 'admin').length;
                  return (
                    <div key={g.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UsersRound size={14} className="text-sky-400" />
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{g.nome}</p>
                            <p className="text-[10px] text-slate-500">{g.descricao}</p>
                          </div>
                        </div>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400">{herdeiros} herdeiros</span>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {PERMISSOES.map((p) => {
                          const on = g.permissoes[p.key];
                          return (
                            <button
                              key={p.key}
                              onClick={() => toggleGrupoPermissao(g.id, p.key)}
                              title={`${on ? 'Revogar' : 'Conceder'} ${p.label} no grupo ${g.nome}`}
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase transition ${
                                on ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                                    : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                              }`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CorpPanel>

            {/* Usuários */}
            <Panel
              title="Gestão de usuários do Cedoc"
              action={
                <button className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400">
                  <Plus size={11} /> Novo funcionário
                </button>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2 text-left font-semibold">Nome</th>
                      <th className="px-2 py-2 text-left font-semibold">Grupo</th>
                      <th className="px-2 py-2 text-left font-semibold">TVs / Mídias</th>
                      <th className="px-2 py-2 text-left font-semibold">Status</th>
                      <th className="px-2 py-2 text-left font-semibold">Permissões</th>
                      <th className="px-2 py-2 text-left font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => {
                      const efetivas = permsEfetivas(u);
                      const isAdminUser = u.papel === 'admin';
                      return (
                        <tr key={u.id} className="border-b border-slate-800/50 last:border-0">
                          <td className="px-2 py-2.5">
                            <p className="font-medium text-slate-200">{u.nome}</p>
                            <p className="text-[10px] text-slate-500">{u.email}</p>
                          </td>
                          <td className="px-2 py-2.5">
                            {isAdminUser ? (
                              <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-300">Administrador</span>
                            ) : (
                              <select
                                value={u.grupo}
                                onChange={(e) => trocarGrupo(u.id, e.target.value)}
                                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 focus:border-sky-600 focus:outline-none"
                              >
                                {grupos.map((g) => (
                                  <option key={g.id} value={g.id}>{g.nome}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-2 py-2.5">
                            <p className="text-[11px] text-slate-400">{u.tvs.join(', ')}</p>
                            <p className="text-[10px] text-slate-500">{u.midias} mídias</p>
                          </td>
                          <td className="px-2 py-2.5"><StatusBadge status={u.status} map={TONE} labels={LABEL} /></td>
                          <td className="px-2 py-2.5">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex flex-wrap gap-1">
                                {PERMISSOES.map((p) => {
                                  const on = efetivas[p.key];
                                  const herdada = !isAdminUser && u.herdaGrupo;
                                  return (
                                    <button
                                      key={p.key}
                                      onClick={() => togglePermissao(u.id, p.key)}
                                      disabled={isAdminUser || u.herdaGrupo}
                                      title={
                                        isAdminUser ? 'Administrador tem acesso total'
                                          : u.herdaGrupo ? `Herdada do grupo — desative a herança pra personalizar`
                                          : `${on ? 'Revogar' : 'Conceder'} ${p.label}`
                                      }
                                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase transition ${
                                        isAdminUser
                                          ? 'cursor-not-allowed bg-sky-500/15 text-sky-300'
                                          : herdada
                                            ? 'cursor-default bg-sky-500/10 text-sky-300/80 ring-1 ring-sky-500/20'
                                            : on
                                              ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                                              : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                                      }`}
                                    >
                                      {p.label}
                                    </button>
                                  );
                                })}
                              </div>
                              {!isAdminUser && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => toggleHerdaGrupo(u.id)}
                                    className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase transition ${
                                      u.herdaGrupo
                                        ? 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
                                        : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
                                    }`}
                                  >
                                    <span className={`inline-block h-2 w-2 rounded-full ${u.herdaGrupo ? 'bg-sky-400' : 'bg-slate-600'}`} />
                                    {u.herdaGrupo ? 'Herdando grupo' : 'Personalizado'}
                                  </button>
                                  {!u.herdaGrupo && (
                                    <button
                                      onClick={() => toggleHerdaGrupo(u.id)}
                                      title="Voltar a herdar o padrão do grupo"
                                      className="flex items-center gap-1 rounded-md border border-slate-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400 hover:bg-slate-800"
                                    >
                                      <RotateCcw size={10} /> Usar padrão
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex gap-1.5">
                              <button className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800">Editar</button>
                              {u.status === 'ativo'
                                ? <button className="rounded border border-amber-800 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-amber-950/40">Suspender</button>
                                : <button className="rounded border border-emerald-800 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-950/40">Reativar</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Cada funcionário pode <span className="text-slate-300">herdar</span> as permissões do seu grupo (padrão) ou
                <span className="text-slate-300"> personalizar</span> as próprias — clique num chip pra personalizar, ou use
                "Usar padrão" pra voltar a herdar o grupo.
              </p>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function SistemaView() {
  const m = MOCK_MONITORING;
  const memPct = m.resources.memory_used_bytes && m.resources.memory_total_bytes
    ? Math.round((m.resources.memory_used_bytes / m.resources.memory_total_bytes) * 100) : 0;
  const gpuPct = m.resources.gpu_percent ?? 0;
  const cpuPct = m.resources.cpu_percent ?? 0;
  const storagePct = m.storage.total_bytes ? Math.round((m.storage.used_bytes / m.storage.total_bytes) * 100) : 0;

  return (
    <div className="h-full space-y-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Processando" value={m.processing} tone="text-sky-300" />
        <StatCard label="Concluídos" value={m.completed.toLocaleString('pt-BR')} tone="text-emerald-300" />
        <StatCard label="Falhas" value={m.failed} tone="text-rose-300" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CorpPanel title="Serviços">
          <div className="space-y-2">
            {m.services.map((s) => (
              <div key={s.key} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                <div>
                  <p className="font-medium text-slate-200">{s.label}</p>
                  <p className="text-xs text-slate-500">{s.detail}</p>
                </div>
                <StatusBadge status={s.status} map={TONE} labels={LABEL} />
              </div>
            ))}
          </div>
        </CorpPanel>
        <CorpPanel title="Recursos do sistema">
          <div className="space-y-4">
            <ResourceBar label="CPU" percent={cpuPct} detail={`${m.resources.cpu_logical_cores} núcleos`} />
            <ResourceBar label="Memória" percent={memPct} detail={`${formatBytes(m.resources.memory_used_bytes)} / ${formatBytes(m.resources.memory_total_bytes)}`} />
            <ResourceBar label="GPU" percent={gpuPct} detail={`${formatBytes(m.resources.gpu_memory_used_bytes)} / ${formatBytes(m.resources.gpu_memory_total_bytes)}`} />
            <ResourceBar label="Storage" percent={storagePct} detail={`${formatBytes(m.storage.used_bytes)} / ${formatBytes(m.storage.total_bytes)}`} />
          </div>
        </CorpPanel>
      </div>
      <CorpPanel title="Modelos de IA">
        <div className="flex flex-wrap gap-2">
          {m.ai_models.map((model) => (
            <div key={model.key} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
              <span className="text-sm text-slate-200">{model.label}</span>
              <StatusBadge status={model.status} map={TONE} labels={LABEL} />
            </div>
          ))}
        </div>
      </CorpPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <CorpPanel title="Bibliotecas">
          <div className="space-y-2">
            {MOCK_LIBRARIES.map((lib) => (
              <div key={lib.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-200">{lib.name}</p>
                  <p className="text-[11px] text-slate-500">{lib.asset_count.toLocaleString('pt-BR')} arquivos · {formatBytes(lib.storage_bytes)}</p>
                  <p className="text-[10px] text-slate-600">Backup {lib.last_backup_at} · Auditoria {lib.last_audit_at}</p>
                </div>
                <StatusBadge status={lib.status} map={TONE} labels={LABEL} />
              </div>
            ))}
          </div>
        </CorpPanel>
        <CorpPanel title="Logs de auditoria">
          <div className="space-y-2">
            {MOCK_AUDIT_LOGS.map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded-lg border border-slate-800/50 px-3 py-2 text-sm">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${log.action.includes('Falha') ? 'bg-rose-500/15 text-rose-300' : 'bg-sky-500/15 text-sky-300'}`}>{log.action}</span>
                <span className="flex-1 truncate text-slate-300">{log.asset}</span>
                <span className="text-[11px] text-slate-500">{log.user} · {log.date}</span>
              </div>
            ))}
          </div>
        </CorpPanel>
      </div>
    </div>
  );
}

function ResourceBar({ label, percent, detail }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-xs text-slate-500">{detail}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${percent > 80 ? 'bg-rose-500' : percent > 60 ? 'bg-amber-500' : 'bg-gradient-to-r from-sky-400 to-violet-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-right text-xs text-slate-500">{percent}%</p>
    </div>
  );
}
