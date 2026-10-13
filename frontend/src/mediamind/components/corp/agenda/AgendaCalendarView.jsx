import React, { useState } from 'react';

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const TYPE_CHIP = {
  gravacao: 'bg-amber-500/15 text-amber-300 border-amber-600/30',
  aprovacao: 'bg-sky-500/15 text-sky-300 border-sky-600/30',
  publicacao: 'bg-emerald-500/15 text-emerald-300 border-emerald-600/30',
};

// Vista Calendário — mês inteiro em semanas. Células quadradas.
export default function AgendaCalendarView({ events, selectedEventId, onSelectEvent }) {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(6);

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = firstWeekday - 1; i >= 0; i--) cells.push({ day: prevDays - i, muted: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, muted: false });
  let next = 1;
  while (cells.length % 7 !== 0) cells.push({ day: next++, muted: true });

  function prev() { if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1); }
  function nextM() { if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1); }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden" style={{height:'auto', flexShrink:0}}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-300">{MONTHS[month]} de {year}</p>
        <div className="flex gap-1">
          <button onClick={prev} className="rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800">‹</button>
          <button onClick={nextM} className="rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800">›</button>
        </div>
      </div>
      <div className="grid min-h-0 grid-cols-7 gap-1 text-center" style={{height:18+(cells.length/7)*110+(cells.length/7)*4, flexShrink:0, gridTemplateColumns:'repeat(7, minmax(0, 1fr))',gridTemplateRows: `18px repeat(${cells.length / 7}, 110px)`}}>
        {DAYS.map((d) => (
          <div key={d} className="text-[9px] font-semibold uppercase text-slate-500">{d}</div>
        ))}
        {cells.map((c, i) => {
          const dEv = c.muted ? [] : events.filter((e) => e.day === c.day);
          const dayHasSelected = dEv.some((e) => e.id === selectedEventId);
          const isToday = !c.muted && c.day === 15 && month === 6 && year === 2026;
          return (
            <div
              key={i}
              className={`flex min-h-0 flex-col items-start gap-0.5 overflow-hidden rounded-lg p-1.5 text-left transition ${c.muted ? 'opacity-25' : dayHasSelected ? 'bg-sky-950/50 ring-1 ring-sky-600/50' : isToday ? 'bg-sky-950/30' : 'bg-slate-950/30'}`}
            >
              <span className={`text-[10px] font-bold leading-none ${!c.muted && (dayHasSelected || isToday) ? 'text-sky-300' : 'text-slate-300'}`}>{c.day}</span>
              <div className="flex min-h-0 w-full flex-1 flex-col gap-1 overflow-y-auto">
                {dEv.map((e) => {
                  const isSel = e.id === selectedEventId;
                  return (
                    <button
                      key={e.id}
                      onMouseDown={(ev) => ev.stopPropagation()}
                      onClick={() => onSelectEvent?.(isSel ? null : e.id)}
                      className={`flex items-center gap-1.5 rounded border px-1.5 py-1 text-left text-[10px] font-medium leading-tight transition truncate ${TYPE_CHIP[e.type]} ${isSel ? 'ring-1 ring-sky-400' : 'hover:brightness-125'}`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${e.tone}`} />
                      <span className="truncate">{e.episodio}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
