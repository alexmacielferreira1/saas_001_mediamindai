import React from 'react';
import { CalendarDays, CheckCircle2, Clock3, FolderOpen, History, Instagram, Layers, Lightbulb, Link2, Send, Sparkles, Youtube } from 'lucide-react';
import { MOCK_ASSETS, MOCK_PUBLICATION_CALENDAR, MOCK_PUBLICATIONS, MOCK_SOCIAL_METRICS } from '../../../data';

const cards = {
  selecao: [
    { icon: Layers, title: 'Versões do corte', lines: ['V3 · corte vertical atual', 'V2 · versão com legendas', 'V1 · primeiro recorte'] },
    { icon: FolderOpen, title: 'Biblioteca disponível', lines: MOCK_ASSETS.slice(0, 3).map((asset) => asset.title) },
    { icon: History, title: 'Histórico', lines: ['Trecho criado a partir do Acervo', 'IN e OUT preservados', 'Versão original protegida'] },
  ],
  ia: [
    { icon: Sparkles, title: 'Sugestões da IA', lines: ['Gancho forte nos primeiros 3s', 'Formato vertical recomendado', 'Remover pausa entre 00:21–00:23'] },
    { icon: Lightbulb, title: 'Preparo editorial', lines: ['Legenda automática PT-BR', 'Palavras-chave e hashtags', 'Área segura para títulos e CGs'] },
    { icon: CheckCircle2, title: 'Qualidade', lines: ['Transcrição revisável', 'Detecção de silêncio', 'Score de potencial por trecho'] },
  ],
  legendas: [
    { icon: Link2, title: 'Edição externa', lines: ['Exportar XML para Premiere', 'Baixar legendas em SRT', 'Reconectar mídia master'] },
    { icon: Layers, title: 'Versões não destrutivas', lines: ['Nova versão não sobrescreve a anterior', 'Comparar versões', 'Definir versão atual'] },
    { icon: FolderOpen, title: 'Materiais vinculados', lines: ['Vídeo master', 'Áudio tratado', 'Imagens e documentos de apoio'] },
  ],
  cg: [
    { icon: CheckCircle2, title: 'Fila de aprovação', lines: ['7 apontamentos nesta revisão', '3 comentários resolvidos', 'Versão V3 aguardando decisão'] },
    { icon: History, title: 'Histórico da revisão', lines: ['Alex enviou V3', 'Marcelo solicitou ajustes', 'João enviou V2'] },
    { icon: Send, title: 'Próximas ações', lines: ['Aprovar versão', 'Solicitar alterações', 'Devolver para edição'] },
  ],
  reimport: [
    { icon: CalendarDays, title: 'Calendário', lines: MOCK_PUBLICATION_CALENDAR.slice(0, 3).map((item) => `${item.date} · ${item.title}`) },
    { icon: Send, title: 'Fila e publicação', lines: MOCK_PUBLICATIONS.slice(0, 3).map((item) => `${item.title} · ${item.status}`) },
    { icon: Clock3, title: 'Desempenho e melhor horário', lines: MOCK_SOCIAL_METRICS.slice(0, 3).map((item) => `${item.platform} · ${item.engagement} engajamento`) },
  ],
};

export default function ClipStageResources({ stage }) {
  const items = cards[stage] || [];
  if (!items.length) return null;
  return (
    <section className="grid gap-2 xl:grid-cols-3">
      {items.map(({ icon: Icon, title, lines }) => (
        <article key={title} className="rounded-xl border border-slate-800 bg-slate-950/45 p-2.5">
          <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-sky-300"><Icon size={12} />{title}</p>
          <div className="mt-2 space-y-1">
            {lines.map((line, index) => <button type="button" key={`${line}-${index}`} className="flex w-full items-center gap-2 border-b border-slate-800/70 py-1 text-left text-[9px] text-slate-400 last:border-0 hover:text-slate-200"><span className="size-1 rounded-full bg-sky-400" />{line}</button>)}
          </div>
        </article>
      ))}
    </section>
  );
}
