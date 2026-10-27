// MCP das páginas (fora das Ferramentas Gráficas) no mesmo modelo de ícones do MMFilm/MMPhoto.
// Cada página tem um catálogo { tabs, tools }; cada ferramenta executa algo real:
//   - navegar para a guia/filtro certo da página,
//   - consultar dados do tenant pela API e mostrar a prévia (Analisar),
//   - exportar CSV a partir dos dados reais,
//   - preparar um pedido no chat do Copiloto.
// Nada é simulado: sem dado ou sem permissão, a ferramenta devolve { ok: false } com o motivo.
//
// Ferramenta de página: {
//   id, tab, label, icon, description, how?, params?,
//   preview?(params, env) -> Promise<resultado>   // botão Analisar (não altera nada)
//   run(params, env) -> Promise<resultado>         // botão Aplicar
//   analyze: false quando não há prévia, applyLabel?, confirm? (texto de confirmação)
// }
// env: { navigate(url), ask(texto), request(path, options), download(nome, conteúdo, tipo) }

export function createPageProvider({ source, label, catalogue, env }) {
  const find = (id) => catalogue.tools.find((tool) => tool.id === id);
  return {
    source,
    label,
    catalogue: () => catalogue,
    async analyze(id, params) {
      const tool = find(id);
      if (!tool?.preview) return { ok: false, summary: 'Esta ferramenta não tem prévia.' };
      return tool.preview(params, env);
    },
    async apply(id, params) {
      const tool = find(id);
      if (!tool) return { ok: false, summary: 'Ferramenta não encontrada nesta página.' };
      return tool.run(params, env);
    },
    // Ações de página consultam, navegam ou exportam: não há desfazer local nem "última ação".
    undo: () => false,
    canUndo: () => false,
    tracksLastAction: false,
  };
}

/** Ferramentas "Pedir ao Copiloto": preparam o pedido no chat; o usuário revisa e envia. */
export function copilotTools(pageLabel, cards, icon) {
  return cards.map((card, index) => ({
    id: `copiloto-${index}`,
    tab: 'copiloto',
    label: card,
    icon,
    description: `Prepara no chat do Copiloto o pedido “${card}” para a página ${pageLabel}.`,
    how: 'O texto vai para o campo do chat na guia Executar. Nada é enviado nem alterado até você revisar e enviar.',
    analyze: false,
    applyLabel: 'Preparar no chat',
    run: async (_params, env) => {
      env.ask(`Na página ${pageLabel}, quero: ${card}. Use o registro selecionado se houver; caso contrário pergunte o que falta.`);
      return { ok: true, count: 0, summary: 'Pedido preparado no chat do Copiloto. Revise e envie.' };
    },
  }));
}

/** Ferramenta que só abre uma guia/filtro da página (navegação real, sem alterar dados). */
export function openTool({ id, tab = 'abrir', label, icon, description, url, params }) {
  return {
    id,
    tab,
    label,
    icon,
    description,
    params,
    analyze: false,
    applyLabel: 'Abrir',
    run: async (values, env) => {
      const target = typeof url === 'function' ? url(values || {}, env) : url;
      env.navigate(target);
      return { ok: true, count: 0, summary: `Aberto: ${label}.` };
    },
  };
}

const CSV_SEPARATOR = ';';

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Evita fórmula ao abrir no Excel (=, +, -, @, TAB ou CR no início; recomendação OWASP).
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** CSV com ";" (Excel pt-BR) e BOM para acentos. */
export function toCsv(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(CSV_SEPARATOR));
  return `﻿${lines.join('\r\n')}`;
}

export function downloadFile(filename, content, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Alguns navegadores ainda leem a URL logo após o clique: libera depois.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Exporta linhas reais em CSV; sem linhas, não baixa arquivo vazio. */
export function exportRows(env, { filename, headers, rows, what }) {
  if (!rows.length) return { ok: false, summary: `Nenhum registro de ${what} para exportar.` };
  env.download(filename, toCsv(headers, rows));
  return { ok: true, count: rows.length, summary: `${rows.length} registro(s) de ${what} exportado(s) em ${filename}.` };
}

/** Prévia em lista (até 50 itens) a partir de registros reais. */
export function listResult(items, { empty, found, describe }) {
  if (!items.length) return { ok: true, count: 0, summary: empty };
  return {
    ok: true,
    count: items.length,
    headline: { count: items.length, text: found },
    summary: `${items.length} encontrado(s).`,
    details: items.slice(0, 50).map(describe),
  };
}

/** Data local AAAA-MM-DD (UTC viraria o dia às 21h em Brasília). */
export function localDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function today() {
  return localDate();
}
