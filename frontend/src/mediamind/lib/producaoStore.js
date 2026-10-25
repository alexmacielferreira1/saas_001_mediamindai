import { useSyncExternalStore } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';
import { MOCK_CORP_PRODUCAO_PROJETOS } from '../data';
import { getAdjacentProductionStage, PRODUCTION_STAGE_ORDER } from './productionWorkflow';
import { isDemoRecord, markDemoRecords } from './demoCatalog';
import { getCurrentTenantId } from './currentTenant';
import { readLocalDemoSession } from './demoAccess';

// Memória compartilhada dos projetos de Produção — o coração do pipeline
// (Rascunhos, Gravações, Kanban e Em edição leem e escrevem aqui).
//
// Antes: seed em memória do mock, perdia a cada reload.
// Agora: a entidade ProducaoProjeto é a fonte de verdade. Na sessão de
// demonstração local o mock preenche a tela (nunca é gravado); numa empresa
// real a lista começa vazia e só mostra registros do servidor. Toda mutação atualiza a memória na hora (UX instantânea,
// API síncrona preservada) e persiste em background. A gravação devolve uma
// Promise<boolean>; falhas não são engolidas: ficam em useProducaoSaveState
// ('error') e geram aviso. Falha na carga não cai para o mock.

// Id da empresa ativa (tenant) — o da sessão, publicado pelo EmpresaProvider.
// O servidor isola os registros por empresa; o campo é só referência.
function currentEmpresaId() {
  return getCurrentTenantId();
}

// Começa vazia; exemplos só entram na carga, e só na sessão de demonstração.
let projetos = [];
let loaded = false;
let loadingPromise = null;
let loadError = null;
const listeners = new Set();

function seedMock() {
  return markDemoRecords(MOCK_CORP_PRODUCAO_PROJETOS).map((p) => ({
    ...p,
    gravacao: p.gravacao ? { ...p.gravacao } : null,
    equipe: [...(p.equipe || [])],
    apresentadores: (p.apresentadores || []).map((a) => ({ ...a })),
    grav_status: p.grav_status || (p.gravada ? 'gravada' : (p.etapa === 'gravacao' ? 'agendada' : '')),
    videomaker: p.videomaker || '',
    videomaker_confirmado: p.videomaker_confirmado || false,
    editor: p.editor || p.responsavel || '',
    pasta_midias: p.pasta_midias || '',
    historico: p.historico || [],
    _entityId: null,
  }));
}

function emit() {
  for (const l of listeners) l();
}
function subscribe(listener) {
  listeners.add(listener);
  ensureLoaded();
  return () => listeners.delete(listener);
}

export function getProjetos() {
  return projetos;
}

export function mergePersistedProject(projectId, patch) {
  projetos = projetos.map((p) => String(p._entityId || p.id) === String(projectId) ? { ...p, ...patch } : p);
  emit();
}

export function useProducaoProjetos() {
  return useSyncExternalStore(subscribe, getProjetos);
}

export function useProducaoReady() {
  return useSyncExternalStore(subscribe, () => loaded);
}

export function useProducaoLoadError() {
  return useSyncExternalStore(subscribe, () => loadError);
}

// Reconstrói o shape esperado pelos consumers a partir do registro da entidade.
function fromEntity(r) {
  return {
    id: r.id,
    empresa_id: r.empresa_id || '',
    programa: r.programa || '',
    episodio: r.episodio || '',
    titulo: r.titulo || 'Nova produção',
    etapa: r.etapa || 'rascunho',
    responsavel: r.responsavel || '',
    headline: r.headline || '',
    descricao: r.descricao || '',
    pauta: r.pauta || '',
    convidado_nome: r.convidado_nome || '',
    convidado_cg: r.convidado_cg || '',
    convidados: r.convidados || [], entrevistados: r.entrevistados || [], participantes: r.participantes || [],
    thumbnail_style: r.thumbnail_style || null, thumbnail_channel_logo: r.thumbnail_channel_logo || '',
    thumbnail_url: r.thumbnail_url || '', thumbnail_document_id: r.thumbnail_document_id || '', thumbnail_assets: r.thumbnail_assets || [],
    gravacao: r.gravacao_data ? { data: r.gravacao_data, horario: r.gravacao_horario || '', estudio: r.gravacao_estudio || '' } : null,
    equipe: r.equipe || [],
    apresentadores: r.apresentadores || [],
    gravada: !!r.gravada,
    grav_status: r.grav_status || (r.gravada ? 'gravada' : (r.etapa === 'gravacao' ? 'agendada' : '')),
    videomaker: r.videomaker || '',
    videomaker_confirmado: !!r.videomaker_confirmado,
    editor: r.editor || r.responsavel || '',
    pasta_midias: r.pasta_midias || '',
    materiais: r.materiais || [],
    edicao_status: r.edicao_status || '',
    edicao_obs: r.edicao_obs || '',
    prazo_edicao: r.prazo_edicao || '',
    historico: r.historico || [],
    tarefas: r.tarefas || [],
    _entityId: r.id,
    _updatedDate: r.updated_date || null,
  };
}

function toEntityData(p) {
  return {
    empresa_id: p.empresa_id != null ? p.empresa_id : currentEmpresaId(),
    programa: p.programa,
    episodio: p.episodio,
    titulo: p.titulo,
    etapa: p.etapa,
    responsavel: p.responsavel,
    headline: p.headline,
    descricao: p.descricao,
    pauta: p.pauta,
    convidado_nome: p.convidado_nome,
    convidado_cg: p.convidado_cg,
    convidados: p.convidados || [], entrevistados: p.entrevistados || [], participantes: p.participantes || [],
    thumbnail_style: p.thumbnail_style || null, thumbnail_channel_logo: p.thumbnail_channel_logo || '',
    thumbnail_url: p.thumbnail_url || '', thumbnail_document_id: p.thumbnail_document_id || '', thumbnail_assets: p.thumbnail_assets || [],
    gravacao_data: p.gravacao?.data || '',
    gravacao_horario: p.gravacao?.horario || '',
    gravacao_estudio: p.gravacao?.estudio || '',
    equipe: p.equipe || [],
    apresentadores: p.apresentadores || [],
    gravada: !!p.gravada,
    grav_status: p.grav_status || '',
    videomaker: p.videomaker || '',
    videomaker_confirmado: !!p.videomaker_confirmado,
    editor: p.editor || '',
    pasta_midias: p.pasta_midias || '',
    materiais: p.materiais || [],
    edicao_status: p.edicao_status || '',
    edicao_obs: p.edicao_obs || '',
    prazo_edicao: p.prazo_edicao || '',
    historico: p.historico || [],
    tarefas: p.tarefas || [],
  };
}

// Estado de gravação por projeto (id local): 'saving' | 'saved' | 'error'.
// "Salvo" só existe depois de o servidor confirmar. Em falha a edição local é
// mantida e marcada como não salva (para nova tentativa) e um aviso é exibido.
// Mudança de etapa recusada pelo servidor (409/422) volta para a etapa
// confirmada, para a tela não ficar numa etapa que o servidor não aceitou.
let saveStates = {};
// Fila por projeto: as gravações saem uma de cada vez, na ordem em que foram
// feitas, cada uma com o retrato do projeto no momento da alteração. Assim
// movimentos rápidos não chegam fora de ordem e o create nunca recebe uma
// etapa que ainda não passou pelas etapas intermediárias.
const queues = new Map();
// Última etapa/histórico confirmados pelo servidor, por id local.
const confirmed = new Map();
// Incrementa no reset (logout): respostas atrasadas da sessão anterior são ignoradas.
let storeEpoch = 0;

function setSaveState(localId, state) {
  saveStates = { ...saveStates, [localId]: state };
  emit();
}

export function getSaveState(localId) {
  return saveStates[localId] || null;
}

export function useProducaoSaveState(localId) {
  return useSyncExternalStore(subscribe, () => saveStates[localId] || null);
}

function saveErrorMessage(error) {
  const detail = error?.message || '';
  return detail ? `A alteração não foi salva no servidor: ${detail}` : 'A alteração não foi salva no servidor. Tente novamente.';
}

function isStageRejection(error) {
  return error?.status === 409 || error?.status === 422 || /^PRODUCTION_STAGE_/.test(String(error?.code || ''));
}

function rememberConfirmed(localId, data) {
  confirmed.set(localId, { etapa: data?.etapa, historico: data?.historico || [] });
}

async function runWrite(localId, snapshot) {
  const p = projetos.find((x) => x.id === localId);
  if (!p) return null;
  if (p._entityId) {
    // If-Match com a versão lida: outra tela/pessoa que gravou antes gera 409 em vez de ser sobrescrita.
    const saved = await base44.entities.ProducaoProjeto.update(p._entityId, snapshot, { ifMatch: p._updatedDate || undefined });
    rememberVersion(localId, saved);
    return saved;
  }
  const created = await base44.entities.ProducaoProjeto.create({ ...snapshot, ordem: Number(p.id) || 0 });
  if (!created?.id) throw new Error('o servidor não devolveu o registro criado');
  // Amarra o id da entidade ao id local, sem trocar o id local.
  projetos = projetos.map((x) => (x.id === localId ? { ...x, _entityId: created.id, _updatedDate: created.updated_date || null } : x));
  return created;
}

function rememberVersion(localId, saved) {
  if (!saved?.updated_date) return;
  projetos = projetos.map((x) => (x.id === localId ? { ...x, _updatedDate: saved.updated_date } : x));
}

function isVersionConflict(error) {
  return error?.status === 409 && error?.code === 'RECORD_VERSION_CONFLICT';
}
const VERSION_CONFLICT_MESSAGE = 'Esta produção foi alterada em outra tela ou por outra pessoa depois que você a abriu. Recarregue a página para ver a versão atual; sua alteração não foi gravada.';

function revertRejectedStage(localId, queue) {
  const conf = confirmed.get(localId);
  if (!conf) return;
  projetos = projetos.map((x) => (x.id === localId ? { ...x, etapa: conf.etapa, historico: conf.historico } : x));
  // A próxima gravação na fila não deve repetir a etapa recusada.
  if (queue.pending) queue.pending.snapshot = { ...queue.pending.snapshot, etapa: conf.etapa, historico: conf.historico };
}

// Exemplo de demonstração: a alteração fica só na tela e não vira registro real.
const DEMO_WRITE_MESSAGE = 'Este projeto é um exemplo de demonstração e não é salvo. Crie uma nova produção para gravar no servidor.';
const warnedDemo = new Set();
function refuseDemoWrite(localId) {
  setSaveState(localId, { status: 'error', error: DEMO_WRITE_MESSAGE });
  if (!warnedDemo.has(localId)) {
    warnedDemo.add(localId);
    toast({ title: 'Projeto de demonstração', description: DEMO_WRITE_MESSAGE });
  }
  return Promise.resolve(false);
}

// Persiste o projeto. Resolve true quando o servidor confirmou e false em
// falha — nunca rejeita, para não quebrar chamadores que ignoram o retorno.
function persist(localId) {
  const p = projetos.find((x) => x.id === localId);
  if (!p) return Promise.resolve(false);
  if (isDemoRecord(p)) return refuseDemoWrite(localId);
  const snapshot = toEntityData(p);
  let queue = queues.get(localId);
  if (!queue) {
    queue = { tail: Promise.resolve(), pending: null, size: 0 };
    queues.set(localId, queue);
  }
  setSaveState(localId, { status: 'saving', error: null });
  // Edição que ainda não saiu e não muda a etapa: atualiza o retrato pendente.
  if (queue.pending && queue.pending.snapshot.etapa === snapshot.etapa) {
    queue.pending.snapshot = snapshot;
    return queue.pending.promise;
  }
  const epoch = storeEpoch;
  const entry = { snapshot, promise: null };
  const start = async () => {
    if (queue.pending === entry) queue.pending = null;
    if (epoch !== storeEpoch) return false;
    try {
      const saved = await runWrite(localId, entry.snapshot);
      if (epoch !== storeEpoch) return false;
      rememberConfirmed(localId, saved && saved.etapa !== undefined ? saved : entry.snapshot);
      if (queue.size === 1) setSaveState(localId, { status: 'saved', error: null });
      return true;
    } catch (error) {
      if (epoch !== storeEpoch) return false;
      if (isVersionConflict(error)) {
        setSaveState(localId, { status: 'error', error: VERSION_CONFLICT_MESSAGE });
        toast({ title: 'Produção alterada em outro lugar', description: VERSION_CONFLICT_MESSAGE, variant: 'destructive' });
        return false;
      }
      const rejected = isStageRejection(error);
      if (rejected) revertRejectedStage(localId, queue);
      const message = rejected
        ? `Mudança de etapa recusada pelo servidor: ${error?.message || 'etapa inválida'}`
        : saveErrorMessage(error);
      setSaveState(localId, { status: 'error', error: message });
      toast({ title: rejected ? 'Mudança de etapa recusada' : 'Falha ao salvar produção', description: message, variant: 'destructive' });
      return false;
    } finally {
      queue.size -= 1;
    }
  };
  const idle = queue.size === 0;
  queue.size += 1;
  if (idle) {
    entry.promise = start();
  } else {
    queue.pending = entry;
    entry.promise = queue.tail.then(start);
  }
  queue.tail = entry.promise;
  return entry.promise;
}

// Grava de novo o estado atual do projeto (botão "Salvar" / nova tentativa).
export function salvarProjeto(id) {
  if (!projetos.some((p) => p.id === id)) return Promise.resolve(false);
  return persist(id);
}

// Logout/troca de sessão: descarta os dados da empresa da memória.
export function resetProducaoStore() {
  storeEpoch += 1;
  projetos = [];
  loaded = false;
  loadingPromise = null;
  loadError = null;
  saveStates = {};
  queues.clear();
  confirmed.clear();
  warnedDemo.clear();
  emit();
}

// Carga inicial: entidade é a fonte de verdade. Se vazia, o mock fica na tela
// como demonstração, sem ser gravado no banco da empresa.
async function loadOrSeed() {
  try {
    const existing = await base44.entities.ProducaoProjeto.list('ordem', 200);
    if (existing.length > 0) {
      projetos = existing.map(fromEntity);
      for (const p of projetos) rememberConfirmed(p.id, p);
    } else {
      // Empresa sem produções: lista vazia; exemplos só na sessão demo local.
      projetos = readLocalDemoSession() ? seedMock() : [];
    }
    loadError = null;
  } catch (error) {
    // Sem confirmação do servidor não exibimos dados de exemplo como se fossem
    // reais (editá-los criaria registros falsos): a lista fica vazia com aviso.
    projetos = [];
    loadError = error?.message || 'Não foi possível carregar as produções.';
    toast({ title: 'Falha ao carregar produções', description: loadError, variant: 'destructive' });
  } finally {
    loaded = true;
    emit();
  }
}

function ensureLoaded() {
  if (!loaded && !loadingPromise) {
    loadingPromise = loadOrSeed();
  }
  return loadingPromise;
}

export function updateProjeto(id, patch) {
  projetos = projetos.map((p) => (p.id === id ? { ...p, ...patch } : p));
  emit();
  return persist(id);
}

export const STAGE_ORDER = PRODUCTION_STAGE_ORDER;

export function setEtapa(id, etapa) {
  return updateProjeto(id, { etapa });
}

// Move um projeto uma etapa no pipeline (dir = -1 volta, +1 avança).
export function moverEtapa(id, dir) {
  const p = projetos.find((x) => x.id === id);
  if (!p) return;
  const next = getAdjacentProductionStage(p.etapa, dir);
  if (next) return updateProjeto(id, { etapa: next });
}

export function addProjeto(data = {}) {
  const id = Math.max(0, ...projetos.map((p) => Number(p.id) || 0)) + 1;
  const np = {
    id,
    empresa_id: currentEmpresaId(),
    programa: '',
    episodio: '',
    titulo: 'Nova produção',
    etapa: 'rascunho',
    responsavel: '',
    headline: '',
    descricao: '',
    pauta: '',
    convidado_nome: '',
    convidado_cg: '',
    gravacao: null,
    equipe: [],
    apresentadores: [],
    gravada: false,
    grav_status: '',
    videomaker: '',
    videomaker_confirmado: false,
    editor: '',
    pasta_midias: '',
    historico: [],
    _entityId: null,
    ...data,
    gravacao: data.gravacao ? { ...data.gravacao } : null,
  };
  projetos = [np, ...projetos];
  emit();
  persist(id);
  return id;
}

// Transição rastreável: muda a etapa e registra no histórico do projeto
// (quem, quando, observação). Toda volta (reprovação/ajuste) passa por aqui.
export function transicionar(id, novaEtapa, { quem = '', obs = '' } = {}) {
  const p = projetos.find((x) => x.id === id);
  if (!p) return;
  const entrada = { etapa: novaEtapa, quem, quando: new Date().toISOString(), obs };
  return updateProjeto(id, { etapa: novaEtapa, historico: [...(p.historico || []), entrada] });
}
