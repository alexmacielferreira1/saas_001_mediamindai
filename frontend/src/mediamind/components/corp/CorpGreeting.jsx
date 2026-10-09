import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Saudação no topo de cada profissão do Corp. "Boa noite/Bom dia/Boa tarde"
// conforme o horário local + data por extenso em pt-BR (ex.: "sábado, 12 de
// setembro de 2026").
export default function CorpGreeting() {
  const now = new Date();
  const h = now.getHours();
  const cumprimento = h < 6 || h >= 18 ? 'Boa noite' : h < 12 ? 'Bom dia' : 'Boa tarde';
  const data = format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-50">{cumprimento} 👋</h1>
        <p className="text-sm text-slate-400">{data}</p>
      </div>
    </div>
  );
}