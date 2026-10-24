import { useCallback, useEffect, useRef, useState } from "react";

// Substitui window.prompt no MMFilm: o prompt nativo é bloqueado em painéis embutidos
// e falhava em silêncio. askText(rótulo, valor) devolve uma Promise com o texto
// confirmado ou null quando cancelado (mesma semântica do prompt nativo).
export function useTextPrompt() {
  const [request, setRequest] = useState(null);
  const pending = useRef(null);

  const finish = useCallback((value) => {
    const resolve = pending.current;
    pending.current = null;
    setRequest(null);
    resolve?.(value);
  }, []);

  const askText = useCallback((label, defaultValue = "") => {
    // Um novo pedido cancela o anterior em aberto.
    pending.current?.(null);
    return new Promise((resolve) => {
      pending.current = resolve;
      setRequest({ label, value: defaultValue == null ? "" : String(defaultValue), key: Date.now() + Math.random() });
    });
  }, []);

  useEffect(() => () => pending.current?.(null), []);

  const dialog = request ? (
    <TextPromptDialog
      key={request.key}
      label={request.label}
      defaultValue={request.value}
      onSubmit={(value) => finish(value)}
      onCancel={() => finish(null)}
    />
  ) : null;

  return [askText, dialog];
}

function TextPromptDialog({ label, defaultValue, onSubmit, onCancel }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="fixed inset-0 z-[260] grid place-items-center bg-black/60 p-6" onPointerDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(value);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") onCancel();
        }}
        className="w-full max-w-sm border border-mm-dialog-edge bg-mm-dialog shadow-2xl"
      >
        <header className="border-b border-mm-dialog-line px-4 py-3 text-sm font-bold text-slate-100">{label}</header>
        <div className="p-4">
          <input
            autoFocus
            aria-label={label}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full border border-sky-500 bg-slate-950 px-2 py-1.5 text-sm text-mm-dialog-ink outline-none"
          />
        </div>
        <footer className="flex justify-end gap-2 border-t border-mm-dialog-line px-4 py-3 text-xs">
          <button type="button" onClick={onCancel} className="border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-mm-dialog-hover">
            Cancelar
          </button>
          <button type="submit" className="bg-blue-600 px-3 py-1.5 font-bold text-white hover:bg-blue-500">
            OK
          </button>
        </footer>
      </form>
    </div>
  );
}
