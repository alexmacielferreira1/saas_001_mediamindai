import { useEffect } from 'react';

// Atalhos globais de teclado — navegação rápida por todo o app.
//   /        → abre a busca global (Command Palette)
//   n        → abre o menu "Novo" (ações de criação)
//   g <letra>→ vai direto para uma página:
//     h=Início  c=Corp  s=Busca  i=Ingest  w=Workspace
//     t=Timeline  o=Social/Clipes  a=Acervo  m=Gestão  e=Assistente IA
// Ignora quando o foco está em campo de entrada ou com teclas modificadoras.
const GOTO = {
  h: '/', c: '/corp', s: '/search', i: '/ingest', w: '/workspace',
  t: '/timeline', o: '/social', a: '/acervo', m: '/management', e: '/assistente',
};

function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function useGlobalShortcuts({ openPalette, navigate }) {
  useEffect(() => {
    let pendingG = false;
    let timer = null;

    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/' && !isTyping()) {
        e.preventDefault();
        openPalette?.();
        return;
      }
      if (e.key.toLowerCase() === 'n' && !isTyping()) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('mm:open-novo'));
        return;
      }
      if (e.key.toLowerCase() === 'g' && !isTyping()) {
        pendingG = true;
        clearTimeout(timer);
        timer = setTimeout(() => { pendingG = false; }, 700);
        return;
      }
      if (pendingG) {
        const dest = GOTO[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          navigate?.(dest);
        }
        pendingG = false;
      }
    }

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, [openPalette, navigate]);
}