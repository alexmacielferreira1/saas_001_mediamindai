import { request } from './httpClient';

// Ferramentas de IA das telas (backend/app/api/v1/ai_tools.py). Cada uma usa a conexão
// escolhida para ela em Configuração de IA (ex.: Llama local) e devolve só sugestões
// validadas pelo servidor; quem aplica é o usuário na tela.

export function generateScript({ prompt = '', audioUrl = '', context = {} }) {
  return request('/ai/tools/script', { method: 'POST', body: { prompt, audio_url: audioUrl || null, context } });
}

export function askAssistant({ message = '', audioUrl = '', history = [], roleLabel = '', userName = '', destinations = [] }) {
  return request('/ai/tools/assistant', {
    method: 'POST',
    body: { message, audio_url: audioUrl || null, history, role_label: roleLabel || '', user_name: userName || '', destinations },
  });
}

export function resolveTasks({ segment = '', prompt = '', audioUrl = '', pendencias = [] }) {
  return request('/ai/tools/tasks', { method: 'POST', body: { segment, prompt, audio_url: audioUrl || null, pendencias } });
}

export function suggestAccess({ userName = '', prompt = '', audioUrl = '', screens = [], cargos = [] }) {
  return request('/ai/tools/access', {
    method: 'POST',
    body: { user_name: userName, prompt, audio_url: audioUrl || null, screens, cargos },
  });
}
