import { X } from 'lucide-react';

// Lista inspirada nas ações padrão do OpenCut (MIT) — ver THIRD_PARTY_NOTICES.md (actions/definitions.ts).
export const TIMELINE2_SHORTCUTS = [
  ['Reprodução', [['Espaço', 'Reproduzir / pausar'], ['L', 'Reproduzir'], ['K', 'Pausar'], ['J', 'Pausar e voltar 1 quadro']]],
  ['Navegação', [['← / →', 'Quadro anterior / próximo'], ['Shift + ← / →', 'Voltar / avançar 1 segundo'], ['Home / End', 'Início / fim da sequência'], ['I / O', 'Marcar IN / OUT']]],
  ['Edição', [['S', 'Dividir no playhead (seleção ou clipes sob a agulha)'], ['Q', 'Aparar início até o playhead'], ['W', 'Aparar fim até o playhead'], ['Delete / Backspace', 'Excluir seleção (fecha a lacuna com Ripple ligado)'], ['Ctrl + C / Ctrl + V', 'Copiar / colar no playhead'], ['Ctrl + D', 'Duplicar seleção'], ['N', 'Ligar / desligar snapping'], ['M', 'Marcador no playhead']]],
  ['Seleção', [['Ctrl + A', 'Selecionar todos os clipes'], ['Esc', 'Limpar seleção'], ['Shift / Ctrl + clique', 'Adicionar ou remover clipe da seleção'], ['Shift + arrastar na trilha', 'Seleção por área']]],
  ['Histórico e visão', [['Ctrl + Z', 'Desfazer'], ['Ctrl + Shift + Z', 'Refazer'], ['Shift + Z', 'Ajustar zoom à sequência'], ['?', 'Abrir esta lista']]],
];

export default function Timeline2ShortcutsPanel({ onClose }) {
  return (
    <div role="dialog" aria-label="Atalhos de teclado da Timeline 2" className="absolute right-0 top-0 z-50 w-[380px] max-w-[calc(100%-1.5rem)] rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase text-slate-300">Atalhos de teclado</h3>
        <button type="button" onClick={onClose} aria-label="Fechar atalhos" className="text-slate-500 hover:text-white"><X size={14} /></button>
      </div>
      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {TIMELINE2_SHORTCUTS.map(([group, items]) => <section key={group}>
          <p className="mb-1 text-[9px] font-bold uppercase text-slate-500">{group}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
            {items.map(([keys, description]) => [
              <dt key={`${keys}-k`}><kbd className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">{keys}</kbd></dt>,
              <dd key={`${keys}-d`} className="text-slate-300">{description}</dd>,
            ])}
          </dl>
        </section>)}
      </div>
    </div>
  );
}
