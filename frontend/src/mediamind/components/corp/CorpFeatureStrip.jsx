import React from 'react';
import { Workflow, Database, Sparkles, BarChart3, ShieldCheck } from 'lucide-react';

const FEATURES = [
  { icon: Workflow, title: 'Workflow Completo', desc: 'Do planejamento à publicação' },
  { icon: Database, title: 'MAM Inteligente', desc: 'Organização e busca avançada' },
  { icon: Sparkles, title: 'IA Integrada', desc: 'Transcrição, resumo, capítulos' },
  { icon: BarChart3, title: 'Relatórios e Analytics', desc: 'Dados para decisões inteligentes' },
  { icon: ShieldCheck, title: 'Segurança e Permissões', desc: 'Controle de acesso e auditoria' },
];

export default function CorpFeatureStrip() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-3">
      {FEATURES.map((f) => {
        const Icon = f.icon;
        return (
          <div key={f.title} className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
              <Icon size={15} className="text-sky-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">{f.title}</p>
              <p className="text-[10px] text-slate-500">{f.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}