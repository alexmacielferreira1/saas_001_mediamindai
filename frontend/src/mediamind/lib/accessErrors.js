// Recusas de acesso devolvidas pelo servidor (ApiError de httpClient).
// SCREEN_ACCESS_DENIED: tela retirada do membro pelo gestor.
// GRANT_EXCEEDS_AUTHORITY: concessão acima da autoridade de quem altera.
// LAST_USER_MANAGER (409): a alteração deixaria a empresa sem quem gerencie usuários.
export const SCREEN_ACCESS_DENIED = 'SCREEN_ACCESS_DENIED';
export const GRANT_EXCEEDS_AUTHORITY = 'GRANT_EXCEEDS_AUTHORITY';
export const LAST_USER_MANAGER = 'LAST_USER_MANAGER';
export const NO_AREA_ACCESS_TITLE = 'Sem acesso a esta área';

const SERVER_MESSAGE_CODES = new Set([SCREEN_ACCESS_DENIED, GRANT_EXCEEDS_AUTHORITY]);
const CONFLICT_MESSAGE_CODES = new Set([LAST_USER_MANAGER]);

export function isAccessDenied(error) {
  return error?.status === 403;
}

// Mensagem do servidor para as recusas de acesso conhecidas; demais falhas usam o texto padrão da tela.
export function accessErrorMessage(error, fallback) {
  if (isAccessDenied(error) && SERVER_MESSAGE_CODES.has(error?.code) && error?.message) return error.message;
  if (error?.status === 409 && CONFLICT_MESSAGE_CODES.has(error?.code) && error?.message) return error.message;
  return fallback;
}
