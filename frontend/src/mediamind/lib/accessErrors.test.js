import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/httpClient';
import { accessErrorMessage, isAccessDenied } from './accessErrors';

describe('accessErrors', () => {
  it('uses the server message for SCREEN_ACCESS_DENIED and GRANT_EXCEEDS_AUTHORITY', () => {
    const screenDenied = new ApiError({ status: 403, code: 'SCREEN_ACCESS_DENIED', message: 'Esta tela não está liberada para você.' });
    const grant = new ApiError({ status: 403, code: 'GRANT_EXCEEDS_AUTHORITY', message: 'Concessão acima da sua autoridade.' });
    expect(accessErrorMessage(screenDenied, 'padrão')).toBe('Esta tela não está liberada para você.');
    expect(accessErrorMessage(grant, 'padrão')).toBe('Concessão acima da sua autoridade.');
    expect(isAccessDenied(grant)).toBe(true);
  });

  it('uses the server message for 409 LAST_USER_MANAGER', () => {
    const message = 'A empresa precisa manter ao menos um membro ativo que gerencie usuários.';
    expect(accessErrorMessage(new ApiError({ status: 409, code: 'LAST_USER_MANAGER', message }), 'padrão')).toBe(message);
    expect(accessErrorMessage(new ApiError({ status: 403, code: 'LAST_USER_MANAGER', message }), 'padrão')).toBe('padrão');
    expect(accessErrorMessage(new ApiError({ status: 409, code: 'OTHER_CONFLICT', message: 'x' }), 'padrão')).toBe('padrão');
  });

  it('keeps the screen fallback for other failures', () => {
    expect(accessErrorMessage(new ApiError({ status: 403, code: 'PERMISSION_DENIED', message: 'x' }), 'padrão')).toBe('padrão');
    expect(accessErrorMessage(new ApiError({ status: 500, code: 'GRANT_EXCEEDS_AUTHORITY', message: 'x' }), 'padrão')).toBe('padrão');
    expect(accessErrorMessage(new Error('offline'), 'padrão')).toBe('padrão');
    expect(accessErrorMessage(undefined, 'padrão')).toBe('padrão');
    expect(isAccessDenied(new Error('offline'))).toBe(false);
  });
});
