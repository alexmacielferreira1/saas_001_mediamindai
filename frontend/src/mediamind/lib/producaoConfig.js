import { useSyncExternalStore } from 'react';

// Modo de transição Gravação → Em edição, configurável por empresa.
// 'editor_puxa'  (padrão): o editor puxa o projeto e se auto-atribui.
// 'auto_avanca': ao subir o primeiro material, o projeto avança sozinho pra Em edição.
// 'produtor_designa': o produtor designa um editor antes de enviar.
const KEY = 'mm_producao_modo_transicao';
const MODES = ['editor_puxa', 'auto_avanca', 'produtor_designa'];
const listeners = new Set();

let mode = localStorage.getItem(KEY) || 'editor_puxa';
if (!MODES.includes(mode)) mode = 'editor_puxa';

function emit() { for (const l of listeners) l(); }

export const TRANSITION_MODES = [
  { value: 'editor_puxa', label: 'Editor puxa pra editar' },
  { value: 'auto_avanca', label: 'Auto-avança ao subir material' },
  { value: 'produtor_designa', label: 'Produtor designa editor' },
];

export function getModoTransicao() { return mode; }
export function setModoTransicao(m) {
  if (!MODES.includes(m)) return;
  mode = m;
  localStorage.setItem(KEY, m);
  emit();
}
function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }
export function useModoTransicao() {
  return useSyncExternalStore(subscribe, getModoTransicao);
}