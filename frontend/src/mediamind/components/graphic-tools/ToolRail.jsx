import { useEffect, useRef, useState } from "react";

// Barra de ferramentas em slots, no padrão das ferramentas Adobe: ferramentas parecidas
// dividem um slot com flyout, e o slot mostra a ativa do grupo (ou a última usada nele).
// Cada app passa as próprias classes para manter a identidade visual.
const DEFAULT_CLASSES = {
  button: "grid h-9 w-9 place-items-center rounded",
  active: "bg-blue-500 text-white",
  idle: "text-slate-300 hover:bg-slate-700",
  disabled: "cursor-not-allowed text-slate-600 opacity-50",
  corner: "absolute bottom-0 right-0 h-2.5 w-2.5 text-slate-400 hover:text-white",
  menu: "absolute left-full top-0 z-50 ml-1 min-w-44 border border-[#555] bg-[#292929] py-1 shadow-xl",
  item: "flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-[11px] hover:bg-blue-600",
  itemActive: "text-white",
  itemIdle: "text-slate-300",
  shortcut: "text-slate-500",
};

function toolLabel(tool) {
  return tool.shortcut ? `${tool.name} (${tool.shortcut})` : tool.name;
}

export function shownToolForSlot(slot, activeTool, remembered) {
  return slot.tools.find((item) => item.name === activeTool) || slot.tools.find((item) => item.name === remembered) || slot.tools[0];
}

export default function ToolRail({ slots, activeTool, onSelect, iconSize = 17, classes: overrides = {}, unavailableLabel = "Ainda não disponível" }) {
  const classes = { ...DEFAULT_CLASSES, ...overrides };
  const [openSlot, setOpenSlot] = useState(null);
  const [remembered, setRemembered] = useState({});
  const rootRef = useRef(null);

  // O slot lembra a última ferramenta escolhida no grupo, inclusive quando ela vem por atalho.
  useEffect(() => {
    const index = slots.findIndex((slot) => slot.tools.some((item) => item.name === activeTool));
    if (index >= 0) setRemembered((current) => (current[index] === activeTool ? current : { ...current, [index]: activeTool }));
  }, [activeTool, slots]);

  useEffect(() => {
    if (openSlot === null) return undefined;
    const close = (event) => {
      if (!rootRef.current.contains(event.target)) setOpenSlot(null);
    };
    const escape = (event) => {
      if (event.key === "Escape") setOpenSlot(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [openSlot]);

  const choose = (tool) => {
    setOpenSlot(null);
    if (!tool.disabled) onSelect(tool.name);
  };

  return (
    <div ref={rootRef} className="contents">
      {slots.map((slot, index) => {
        const shown = shownToolForSlot(slot, activeTool, remembered[index]);
        const Icon = shown.Icon;
        const label = toolLabel(shown);
        const grouped = Boolean(slot.label) && slot.tools.length > 1;
        const open = openSlot === index;
        const active = activeTool === shown.name;
        const stateClass = shown.disabled ? classes.disabled : active ? classes.active : classes.idle;
        return (
          <div key={`${slot.label || shown.name}-${index}`} className="relative">
            <button
              type="button"
              aria-label={label}
              aria-pressed={active}
              aria-disabled={shown.disabled || undefined}
              title={shown.disabled ? `${label} · ${unavailableLabel}` : grouped ? `${label} · clique com o botão direito para ${slot.label.toLowerCase()}` : label}
              onClick={() => choose(shown)}
              onContextMenu={(event) => {
                if (!grouped) return;
                event.preventDefault();
                setOpenSlot(open ? null : index);
              }}
              className={`${classes.button} ${stateClass}`}
            >
              {Icon ? <Icon size={iconSize} /> : shown.name.slice(0, 1)}
            </button>
            {grouped && (
              <button
                type="button"
                aria-label={`Abrir grupo: ${slot.label}`}
                title={slot.label}
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpenSlot(open ? null : index)}
                className={classes.corner}
              >
                <span aria-hidden="true" className="absolute bottom-0.5 right-0.5 h-0 w-0 border-l-[4px] border-t-[4px] border-l-transparent border-t-current" style={{ transform: "rotate(-90deg)" }} />
              </button>
            )}
            {open && (
              <div role="group" aria-label={slot.label} className={classes.menu}>
                {slot.tools.map((item) => {
                  const ItemIcon = item.Icon;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      aria-label={toolLabel(item)}
                      aria-pressed={activeTool === item.name}
                      aria-disabled={item.disabled || undefined}
                      title={item.disabled ? unavailableLabel : undefined}
                      onClick={() => choose(item)}
                      className={`${classes.item} ${item.disabled ? classes.disabled : activeTool === item.name ? classes.itemActive : classes.itemIdle}`}
                    >
                      {ItemIcon && <ItemIcon size={14} />}
                      <span className="flex-1">{item.name}</span>
                      {item.shortcut && <span className={classes.shortcut}>{item.shortcut}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
