import { useSyncExternalStore } from 'react';
import { base44 } from '@/api/base44Client';
import { MOCK_CORP_PRODUCAO_PROJETOS } from '../data';
import { getAdjacentProductionStage, PRODUCTION_STAGE_ORDER } from './productionWorkflow';

// Memória compartilhada dos projetos de Produção — o coração do pipeline
// (Rascunhos, Gravações, Kanban e Em edição leem e escrevem aqui).
//
// Antes: seed em memória do mock, perdia a cada reload.
// Agora: a entidade ProducaoProjeto é a fonte de verdade. O seed do mock só
// preenche o primeiro render (pra não piscar tela vazia) e é substituído pelos
// registros reais assim que a carga termina; se a entidade estiver vazia, o
// mock é semeado nela. Toda mutação atualiza a memória na hora (UX instantânea,
// API síncrona preservada) e persiste em background (best-effort, degradação
// graciosa se o backend estiver fora).

// Id da empresa ativa (tenant) — lido do localStorage (mesma chave do EmpresaProvider).
function currentEmpresaId() {
  try { return localStorage.getItem('mm_current_empresa_v1') || ''; } catch { return ''; }
}

let projetos = seedMock();
let loaded = false;
let loadingPromise = null;
const listeners = new Set();

function seedMock() {
  return MOCK_CORP_PRODUCAO_PROJETOS.map((p) => ({
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
    historico: r.historico || [],
    _entityId: r.id,
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
    historico: p.historico || [],
  };
}

// Persiste o projeto em background. Se ainda não tem _entityId, cria; senão,
// atualiza. Nunmo bloqueia a UI — falhas são silenciosas (degradação graciosa).
function persist(localId) {
  const p = projetos.find((x) => x.id === localId);
  if (!p) return;
  if (p._entityId) {
    base44.entities.ProducaoProjeto.update(p._entityId, toEntityData(p)).catch(() => {});
  } else {
    base44.entities.ProducaoProjeto.create({ ...toEntityData(p), ordem: Number(p.id) || 0 })
      .then((created) => {
        // Re-persiste o estado atual (inclui updates feitos durante o create)
        // e amarra o id da entidade ao id local, sem trocar o id local.
        const cur = projetos.find((x) => x.id === localId);
        if (cur) {
          base44.entities.ProducaoProjeto.update(created.id, toEntityData(cur)).catch(() => {});
          projetos = projetos.map((x) => (x.id === localId ? { ...x, _entityId: created.id } : x));
          emit();
        }
      })
      .catch(() => {});
  }
}

// Carga inicial: entidade é a fonte de verdade. Se vazia, semeia do mock.
async function loadOrSeed() {
  try {
    const existing = await base44.entities.ProducaoProjeto.list('ordem', 200);
    if (existing.length > 0) {
      projetos = existing.map(fromEntity);
    } else {
      const created = await base44.entities.ProducaoProjeto.bulkCreate(
        projetos.map((p, i) => ({ ...toEntityData(p), ordem: i }))
      );
      projetos = projetos.map((p, i) => ({ ...p, _entityId: created[i]?.id || null }));
    }
  } catch {
    // Mantém o seed do mock em memória (degradação graciosa).
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
  persist(id);
}

export const STAGE_ORDER = PRODUCTION_STAGE_ORDER;

export function setEtapa(id, etapa) {
  updateProjeto(id, { etapa });
}

// Move um projeto uma etapa no pipeline (dir = -1 volta, +1 avança).
export function moverEtapa(id, dir) {
  const p = projetos.find((x) => x.id === id);
  if (!p) return;
  const next = getAdjacentProductionStage(p.etapa, dir);
  if (next) updateProjeto(id, { etapa: next });
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
  updateProjeto(id, { etapa: novaEtapa, historico: [...(p.historico || []), entrada] });
}
