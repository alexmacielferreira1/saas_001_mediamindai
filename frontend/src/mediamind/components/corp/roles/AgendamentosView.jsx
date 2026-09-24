import React, { useState } from 'react';
import { Plus, Search, Calendar, Edit3, Clock3, Video, CircleAlert } from 'lucide-react';
import PanelSplit from '../../ui/PanelSplit';
import CorpAgenda from '../CorpAgenda';
import AgendamentoDetail from './AgendamentoDetail';
import { useProducaoProjetos, addProjeto } from '../../../lib/producaoStore';
import { isProjectInProductionStage } from '../../../lib/productionWorkflow';
import { MOCK_CORP_PRODUCTIONS } from '../../../data';

const PROGRAMAS = Array.from(new Set(MOCK_CORP_PRODUCTIONS.map((p) => p.programa)));

// Agendamentos — a agenda de calendário é a entrada principal. Vindo de
// Rascunhos, o agendamento cai aqui pra terminar de preencher (selecione-o no
// calendário ou no placeholder). Se já tem data, aparece no calendário e pode
// ser editado. O +Nova cria um agendamento novo direto aqui.
// Painéis redimensionáveis e com toggle pra ligar/desligar (lembrado entre sessões).
export default function AgendamentosView() {
  const projetos = useProducaoProjetos();
  const gravacoes = projetos.filter((p) => isProjectInProductionStage(p, 'agendamentos'));

  const [selectedId, setSelectedId] = useState(() => {
    const incomplete = gravacoes.find((p) => !p.gravacao?.data);
    return incomplete?.id || gravacoes[0]?.id || null;
  });

  const events = gravacoes.map((p) => {
    const day = p.gravacao?.data ? Number(p.gravacao.data.split('-')[2]) : null;
    return {
      id: p.id,
      day,
      titulo: p.titulo,
      programa: p.programa,
      episodio: p.episodio,
      convidado: p.convidado_nome || '',
      horario: p.gravacao?.horario || '',
      estudio: p.gravacao?.estudio || '',
      type: 'gravacao',
      tone: 'bg-amber-500',
    };
  });

  const rec = gravacoes.find((p) => p.id === selectedId) || gravacoes[0];
  const confirmadas = gravacoes.filter((p) => p.gravacao?.data && p.gravacao?.horario).length;
  const incompletas = gravacoes.length - confirmadas;
  const estudios = new Set(gravacoes.map((p) => p.gravacao?.estudio).filter(Boolean)).size;

  function nova() {
    const id = addProjeto({
      etapa: 'agendamentos',
      programa: PROGRAMAS[0] || '',
      titulo: 'Nova gravação',
      gravacao: { data: '', horario: '', estudio: 'Estúdio 1' },
      equipe: [],
      apresentadores: [],
    });
    setSelectedId(id);
  }

  const panels = [
    {
      id: 'agenda',
      label: 'Agenda',
      icon: Calendar,
      defaultSize: 55,
      minSize: 30,
      content: (
        <div className="h-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <CorpAgenda events={events} selectedEventId={selectedId} onSelectEvent={setSelectedId} />
        </div>
      ),
    },
    {
      id: 'detalhe',
      label: 'Detalhe',
      icon: Edit3,
      defaultSize: 45,
      minSize: 25,
      content: rec ? (
        <AgendamentoDetail rec={rec} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-center">
          <Search size={22} className="mb-2 text-slate-600" />
          <p className="text-sm font-medium text-slate-300">Selecione um item na agenda</p>
          <p className="mt-1 text-xs text-slate-500">Os detalhes e ajustes aparecem aqui.</p>
          <button onClick={nova} className="mt-4 flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400">
            <Plus size={13} /> Criar novo agendamento
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col border border-slate-800 bg-slate-950/35">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-400">Produção / Agenda</p><h2 className="text-base font-semibold text-slate-100">Agenda de gravações</h2><p className="text-[11px] text-slate-500">Selecione um compromisso para editar os detalhes no painel ao lado.</p></div>
        <button onClick={nova} className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400">
          <Plus size={13} /> Novo agendamento
        </button>
      </div>

      <div className="grid border-b border-slate-800 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Gravações no calendário', gravacoes.length, Calendar, 'text-sky-300'],
          ['Confirmadas', confirmadas, Clock3, 'text-emerald-300'],
          ['Pendentes de dados', incompletas, CircleAlert, 'text-amber-300'],
          ['Estúdios em uso', estudios, Video, 'text-violet-300'],
        ].map(([label, value, Icon, tone]) => <div key={label} className="flex items-center gap-3 border-b border-slate-800 px-4 py-2.5 last:border-b-0 sm:border-b-0 sm:border-r"><Icon size={15} className={tone} /><div><p className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p></div></div>)}
      </div>

      <div className="min-h-0 flex-1 p-3">
        <PanelSplit panels={panels} storageKey="mm_layout_agendamentos" />
      </div>
    </div>
  );
}
