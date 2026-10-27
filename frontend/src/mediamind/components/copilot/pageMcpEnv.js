import { useMemo, useRef } from 'react';
import { base44 } from '../../../api/base44Client';
import { listAdminActivity, listAdminUsers } from '../../../api/admin';
import { listMediaAssets } from '../../../api/media';
import { pageCatalogue } from '../../lib/mcpPageCatalogues';
import { createPageProvider, downloadFile } from '../../lib/mcpPageTools';

const AGENCY_KEY = 'mediamind_agencia_video_prototipo_v1';
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function readAgencyData() {
  try {
    const value = JSON.parse(localStorage.getItem(AGENCY_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

// Ambiente real das ferramentas de página: API do tenant, navegação, download e chat do Copiloto.
export function createPageEnv({ location, navigate, ask }) {
  const query = new URLSearchParams(location.search);
  const corpUrl = (sub, extra = '') => {
    const params = new URLSearchParams();
    if (query.get('tab')) params.set('tab', query.get('tab'));
    params.set('sub', sub);
    return `/corp?${params.toString()}${extra ? `&${extra}` : ''}`;
  };
  return {
    navigate,
    ask,
    corpUrl,
    ingestUrl: (extra) => (location.pathname === '/corp' ? corpUrl('ingest', extra) : `/ingest?${extra}`),
    records: async (entity, { sort = '-created_date', limit = 200 } = {}) => (await base44.entities[entity].list(sort, limit)) || [],
    assets: async () => (await listMediaAssets()) || [],
    // O servidor devolve no máximo 100 por página: percorre todas para não cortar a lista.
    adminUsers: async () => {
      const all = [];
      for (let page = 1; page <= 50; page += 1) {
        const result = await listAdminUsers({ page, pageSize: 100 });
        all.push(...(result?.items || []));
        if (!result?.items?.length || all.length >= (result.total ?? all.length)) break;
      }
      return all;
    },
    auditLogs: async (limit) => (await listAdminActivity(limit)) || [],
    fetchBlob: async (path) => {
      // Mesma base de URL do httpClient (no Render a API fica em outro domínio).
      const response = await fetch(`${API_BASE}/api/v1${path}`, { credentials: 'include' });
      if (!response.ok) throw new Error(response.status === 403 ? 'Sem permissão para este relatório.' : `Falha ao baixar (${response.status}).`);
      // Sem API configurada o site devolve a página (HTML) com 200: isso não é o relatório.
      if (!String(response.headers.get('content-type') || '').includes('text/csv')) throw new Error('O servidor não devolveu um arquivo CSV.');
      return response.blob();
    },
    download: downloadFile,
    agencyData: readAgencyData,
  };
}

/** Provedor MCP da página atual (ou null quando a página não tem catálogo). */
export function usePageMCPProvider({ group, label, cards, location, navigate, ask }) {
  // O chat muda a cada render; a ferramenta sempre usa a versão mais recente.
  const askRef = useRef(ask);
  askRef.current = ask;
  return useMemo(() => {
    const catalogue = pageCatalogue(group, { label, cards });
    if (!catalogue) return null;
    const env = createPageEnv({ location, navigate, ask: (text) => askRef.current(text) });
    return createPageProvider({ source: `page:${group}`, label, catalogue, env });
    // location.search entra porque /corp mantém a função (?tab=) ao navegar entre etapas.
  }, [group, label, cards, location.pathname, location.search, navigate]);
}
