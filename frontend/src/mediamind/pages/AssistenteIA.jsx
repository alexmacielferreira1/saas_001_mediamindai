import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useWorkDraftState } from '../lib/workProtection';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Send, Loader2, ArrowRight, Bot, User as UserIcon } from 'lucide-react';
import { askAssistant } from '../../api/aiTools';
import { useAuth } from '../auth';
import { filterTabsForUser } from '../lib/permissions';
import { CORP_TABS } from '../lib/corpTabs';
import AudioPromptInput from '../components/corp/roles/AudioPromptInput';

// Assistente IA do MediaMind — página de menu separada. Conversa com a IA por
// texto ou voz para resolver qualquer coisa no sistema: ela entende o pedido,
// busca no perfil de trabalho, confirma se é aquilo (Sim/Não) e sugere as
// páginas certas para o usuário ir e executar — sem se perder.
export default function AssistenteIA() {
  const { user, roleLabels } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useWorkDraftState('assistant:messages', [
    {
      role: 'assistant',
      content: `Olá${user?.name ? `, ${user.name}` : ''}! Sou o assistente do MediaMind. Diga o que você quer fazer (por texto ou voz) e eu te ajudo a encontrar e executar mais rápido.`,
      rotas: [],
      confirmacao: null,
    },
  ]);
  const [input, setInput] = useWorkDraftState('assistant:input', '');
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Mapa de destinos que a IA conhece: páginas principais + abas do Corp
  // permitidas para o perfil do usuário.
  const destinations = useMemo(() => {
    const main = [
      { path: '/search', label: 'Pesquisa', desc: 'Buscar mídias, transcrições, palavras-chave' },
      { path: '/ingest', label: 'Ingest', desc: 'Importar/enviar novos arquivos de mídia' },
      { path: '/workspace', label: 'Workspace', desc: 'Editor NLE: prévia, grade, roteiro, timeline' },
      { path: '/timeline', label: 'Timeline', desc: 'Linha do tempo de produção' },
      { path: '/social', label: 'Redes sociais', desc: 'Cortes virais e publicações' },
      { path: '/acervo', label: 'Acervo', desc: 'Coleção de mídias e direitos' },
      { path: '/management', label: 'Gestão', desc: 'Relatórios, processamentos, auditoria' },
      { path: '/corp', label: 'IAcervo Corp', desc: 'Painel corporativo por função' },
    ];
    const corp = filterTabsForUser(CORP_TABS, user).map((t) => ({
      path: `/corp?tab=${t.id}`,
      label: `Corp · ${t.name}`,
      desc: `Aba ${t.name} do IAcervo Corp`,
    }));
    return [...main, ...corp];
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function enviar(texto) {
    const content = (texto ?? input).trim();
    if (!content && !audioUrl) return;
    const userMsg = { role: 'user', content: content || '[áudio]' };
    const hist = [...messages, userMsg];
    setMessages((m) => [...m, userMsg, { role: 'assistant', content: '', loading: true }]);
    setInput('');
    setLoading(true);
    try {
      const data = await askAssistant({
        message: content,
        audioUrl,
        history: hist.map((h) => ({ role: h.role, content: h.content })),
        roleLabel: roleLabels[user?.role] || user?.role,
        userName: user?.name,
        destinations,
      });
      setMessages((m) => [...m.slice(0, -1), {
        role: 'assistant',
        content: data.reply || 'Não consegui processar agora.',
        rotas: data.rotas || [],
        confirmacao: data.confirmacao || null,
      }]);
      setAudioUrl('');
    } catch (e) {
      setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: 'Erro: ' + (e?.message || e), rotas: [], confirmacao: null }]);
    } finally {
      setLoading(false);
    }
  }

  function goTo(path) {
    navigate(path);
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col rounded-2xl border border-slate-800 bg-slate-900/60">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 text-slate-950">
          <Sparkles size={20} />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-50">Assistente IA</h1>
          <p className="text-xs text-slate-500">Peça por voz ou texto — a IA busca no seu perfil, confirma e te direciona para a página certa.</p>
        </div>
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${m.role === 'user' ? 'bg-slate-700 text-slate-200' : 'bg-violet-500/20 text-violet-300'}`}>
              {m.role === 'user' ? <UserIcon size={15} /> : <Bot size={15} />}
            </div>
            <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-sky-600/20 text-slate-100' : 'bg-slate-800/70 text-slate-200'}`}>
              {m.loading ? (
                <span className="flex items-center gap-2 text-slate-400"><Loader2 size={14} className="animate-spin" /> pensando…</span>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.rotas?.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-slate-700/60 pt-3">
                      {m.rotas.map((r, j) => (
                        <button
                          key={j}
                          onClick={() => goTo(r.path)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-sky-700/40 bg-sky-950/30 px-3 py-2 text-left text-xs text-slate-200 transition hover:border-sky-500/60 hover:bg-sky-900/30"
                        >
                          <span>
                            <span className="font-bold text-sky-300">{r.label}</span>
                            {r.motivo ? <span className="block text-[11px] text-slate-400">{r.motivo}</span> : null}
                          </span>
                          <ArrowRight size={14} className="shrink-0 text-sky-400" />
                        </button>
                      ))}
                    </div>
                  )}
                  {m.confirmacao && (
                    <div className="mt-3 flex items-center gap-2 border-t border-slate-700/60 pt-3">
                      <span className="text-xs text-slate-300">{m.confirmacao}</span>
                      <button onClick={() => enviar('Sim')} disabled={loading} className="rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">Sim</button>
                      <button onClick={() => enviar('Não')} disabled={loading} className="rounded-md border border-slate-600 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50">Não</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 p-3">
        <div className="mb-2">
          <AudioPromptInput onAudioUrl={setAudioUrl} />
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            rows={1}
            placeholder="O que você quer fazer agora? (ex.: subir as gravações de ontem, aprovar o corte do Jornal, ver pendências de produção)"
            className="max-h-32 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-violet-500"
          />
          <button
            onClick={() => enviar()}
            disabled={loading || (!input.trim() && !audioUrl)}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-violet-500 px-4 text-sm font-bold text-slate-950 hover:bg-violet-400 disabled:opacity-40"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
