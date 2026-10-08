import { Download, FilePlus2, Film, RotateCcw, Save } from 'lucide-react';

const STEPS = [
  { id: 'create', number: 1, label: 'Informações iniciais', Icon: FilePlus2 },
  { id: 'script', number: 2, label: 'Montar roteiro', Icon: Film },
  { id: 'timeline', number: 3, label: 'Timeline', Icon: Film },
  { id: 'export', number: 4, label: 'Exportar', Icon: Download },
];

export default function Workspace2Stepper({ activeStep, onStepChange, selectedCount, onSave = () => {}, onReset = () => {} }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        {STEPS.map(({ id, number, label }, index) => (
          <div key={id} className="flex items-center gap-1">
            {index > 0 && <span className="h-px w-4 bg-slate-700" />}
            <button
              type="button"
              onClick={() => onStepChange(id)}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold transition ${activeStep === id ? 'border-sky-400 bg-sky-500 text-slate-950' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-700'}`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-full ${activeStep === id ? 'bg-sky-300' : 'bg-slate-800'}`}>
                {number}
              </span>
              {label}
            </button>
          </div>
        ))}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button type="button" onClick={onSave} className="w2-button"><Save size={14} /> Salvar projeto</button>
        <button type="button" onClick={onReset} className="w2-button"><RotateCcw size={14} /> Resetar projeto</button>
        <span className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white">
          <Film size={14} /> Mídias selecionadas ({selectedCount})
        </span>
      </div>
    </div>
  );
}
