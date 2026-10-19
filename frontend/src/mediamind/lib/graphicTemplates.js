// Reusable model; editors create independent instances rather than mutating it.
export function createEditorialBar(start = 0) {
  return {
    id: `gc-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
    template: 'barra-editorial', tipo: 'lower_third', titulo: 'Título principal', subtitulo: 'Texto complementar',
    cor_barra: '#ffcc00', cor_painel: '#ffffff', cor_texto: '#000000', fonte: 'Arial', tamanho: 24,
    start_ms: start, end_ms: start + 5000,
  };
}
