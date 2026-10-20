import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { DragDropContext } from '@hello-pangea/dnd';
import { describe, expect, it, vi } from 'vitest';
import RoteiroEditor from './RoteiroEditor';

// Arquivos auditados no QA de usabilidade (2026-10-20, item 14): todo <button>
// precisa ter ação (onClick/submit) ou estar desabilitado com motivo.
const AUDITED = [
  'corp/CorpProductionDetail.jsx', 'corp/roles/AudiovisualPage.jsx', 'corp/roles/DesignPage.jsx',
  'corp/roles/QualidadePage.jsx', 'corp/roles/CedocPage.jsx', 'corp/roles/AssessoriaPage.jsx',
  'corp/roles/EndomarketingPage.jsx', 'corp/roles/RedacaoPage.jsx', 'corp/roles/RevistasPage.jsx',
  'corp/roles/GravacaoPage.jsx', 'corp/roles/EstagiarioPage.jsx', 'corp/CorpMediaPanel.jsx',
  'corp/CorpProductionsList.jsx', 'RoteiroEditor.jsx', 'WorkspaceRoteiroPanel.jsx', 'WorkspaceSearchPanel.jsx',
  'corp/CorpPublications.jsx', 'corp/CorpAnalytics.jsx',
];

function buttonTags(source) {
  const tags = [];
  let index = source.indexOf('<button');
  while (index !== -1) {
    let depth = 0; let end = index + 7;
    for (; end < source.length; end += 1) {
      const c = source[end];
      if (c === '{') depth += 1; else if (c === '}') depth -= 1; else if (c === '>' && depth === 0) break;
    }
    tags.push(source.slice(index, end + 1));
    index = source.indexOf('<button', end);
  }
  return tags;
}

describe('botões sem ação nos arquivos auditados', () => {
  for (const file of AUDITED) {
    it(`${file} não tem botão morto`, () => {
      const source = readFileSync(resolve(process.cwd(), 'src/mediamind/components', file), 'utf8');
      const dead = buttonTags(source).filter((tag) => !/onClick|disabled|type="submit"|\{\.\.\./.test(tag));
      expect(dead).toEqual([]);
    });
  }

  it('RoteiroEditor não finge salvar, exportar ou enviar', () => {
    render(<DragDropContext onDragEnd={vi.fn()}><RoteiroEditor script={{ title: 'Roteiro', project_name: 'P' }} items={[]} status="draft" setStatus={vi.fn()} onRemove={vi.fn()} onUpdateItem={vi.fn()} onReorder={vi.fn()} onAddText={vi.fn()} totalDuration="00:00" /></DragDropContext>);
    for (const name of [/Salvar/, /Exportar/, /Enviar para edição/]) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Ainda não disponível');
    }
  });
});
