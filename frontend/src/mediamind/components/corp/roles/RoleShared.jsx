// Reexporta do kit canônico (src/mediamind/components/shared.jsx) para manter
// imports existentes (SubTabsBar, StatCard, StatusBadge, Panel) funcionando.
// O Panel deste módulo era a variante com cabeçalho fixo + corpo rolável —
// corresponde ao PanelScroll do kit canônico.
export { SubTabsBar, StatCard, StatusBadge } from '../../shared';
export { PanelScroll as Panel } from '../../shared';