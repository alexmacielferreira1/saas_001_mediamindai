import { describe, expect, it } from 'vitest';
import { mcpErrorMessage } from './mcpErrors';

describe('mensagens honestas de MCP e IA', () => {
  it('traduz os recusas do servidor', () => {
    expect(mcpErrorMessage({ status: 409, code: 'MCP_QUEUE_RUNNING' }, 'x')).toMatch(/já está em execução/);
    expect(mcpErrorMessage({ status: 403, code: 'AI_DISABLED' }, 'x')).toMatch(/IA está desativada/);
    expect(mcpErrorMessage({ status: 429, message: 'Limite diário atingido.' }, 'x')).toBe('Limite de uso de IA atingido: Limite diário atingido.');
    expect(mcpErrorMessage({ status: 429 }, 'x')).toMatch(/Limite de uso de IA atingido/);
    expect(mcpErrorMessage({ status: 403, message: 'Seu perfil permite somente leitura.' }, 'x')).toBe('Seu perfil permite somente leitura.');
    expect(mcpErrorMessage({ status: 403 }, 'x')).toMatch(/permissão de produção/);
    expect(mcpErrorMessage({ message: 'Outro' }, 'x')).toBe('Outro');
    expect(mcpErrorMessage(undefined, 'padrão')).toBe('padrão');
  });
});
