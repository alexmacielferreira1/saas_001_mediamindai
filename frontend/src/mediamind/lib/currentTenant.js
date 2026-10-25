// Empresa (tenant) ativa da sessão, publicada pelo EmpresaProvider.
// Módulos fora da árvore React (ex.: producaoStore) leem daqui em vez de
// chaves soltas do localStorage. "all" (visão global do admin) vira vazio.
let currentTenantId = '';

export function setCurrentTenantId(id) {
  currentTenantId = id && id !== 'all' ? String(id) : '';
}

export function getCurrentTenantId() {
  return currentTenantId;
}
