import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { listToolDocuments, parseProjectFile, saveToolDocument } from '../../lib/creativeToolDocuments';
import { Button, Notice, downloadJson, inputClass } from './StudioUI';

export default function StudioProjectBar({ tool, value, onLoad }) {
  const [params] = useSearchParams();
  const [projectId, setProjectId] = useState(params.get('project_id') || params.get('project') || '');
  const [projects, setProjects] = useState([]), [records, setRecords] = useState([]), [title, setTitle] = useState(''), [previousId, setPreviousId] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => { let active = true; base44.entities.ProducaoProjeto.list('-created_date', 500).then((list) => { if (active) setProjects(list); }).catch(() => { if (active) setMessage('Não foi possível carregar os projetos. Você pode continuar e exportar um arquivo de projeto.'); }); return () => { active = false; }; }, []);
  useEffect(() => { let active = true; setRecords([]); setPreviousId(null); listToolDocuments(tool, projectId).then((list) => { if (active) setRecords(list); }).catch(() => { if (active) setMessage('Histórico compartilhado indisponível para esta sessão.'); }); return () => { active = false; }; }, [tool, projectId]);
  async function save() {
    setBusy(true); setMessage('Salvando composição e mídias…');
    try { const record = await saveToolDocument({ tool, projectId, title, value, previousId }); setPreviousId(record.id); setRecords((list) => [record, ...list]); setMessage('Nova versão salva no MediaMind, com vínculo ao projeto selecionado.'); } catch (error) { setMessage(error.message || 'Não foi possível salvar. Confira suas permissões de criação e mídia.'); } finally { setBusy(false); }
  }
  async function importFile(file) {
    if (!file) return;
    try { if (file.size > 5 * 1024 * 1024) throw new Error('Use um arquivo de projeto de até 5 MB.'); const imported = parseProjectFile(await file.text(), tool); onLoad(imported.content); setTitle(imported.title || ''); setProjectId(imported.projectId || ''); setPreviousId(null); setMessage('Projeto importado. Confira as mídias e salve uma nova versão.'); } catch (error) { setMessage(error.message); }
  }
  return <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
    <div className="flex flex-wrap items-end gap-3"><label className="min-w-[200px] flex-1 text-xs text-slate-400">Projeto MediaMind<select aria-label="Projeto MediaMind" className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Criação avulsa</option>{projectId && !projects.some((p) => String(p.id) === projectId) && <option value={projectId}>Projeto {projectId}</option>}{projects.map((p) => <option key={p.id} value={p.id}>{p.titulo || p.title || p.nome || p.id}</option>)}</select></label><label className="min-w-[180px] flex-1 text-xs text-slate-400">Nome da criação<input aria-label="Nome da criação" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Identifique esta composição" /></label><Button disabled={busy} primary onClick={save}>{busy ? 'Salvando…' : 'Salvar nova versão'}</Button><Button onClick={() => downloadJson({ schema: 'mediamind-creative/v1', tool, projectId, title, content: value }, `mediamind-${tool}.json`)}>Exportar projeto</Button><label className="cursor-pointer rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-200">Importar projeto<input aria-label="Importar projeto" hidden type="file" accept=".json,application/json" onChange={(e) => { importFile(e.target.files[0]); e.target.value = ''; }} /></label></div>
    <details><summary className="cursor-pointer text-xs text-sky-300">Versões salvas · {records.length}</summary><div className="mt-2 space-y-2">{records.map((record) => <div key={record.id} className="flex items-center gap-3 rounded-lg bg-slate-950/40 p-2 text-xs"><span className="flex-1">{record.title} · {record.created_date || ''}</span><Button disabled={busy} onClick={() => { onLoad(record.content); setTitle(record.title || ''); setPreviousId(record.id); setMessage('Composição reaberta.'); }}>Reabrir</Button><Button disabled={busy} onClick={() => { onLoad(record.content); setTitle(`${record.title} · cópia`); setPreviousId(null); setMessage('Cópia preparada. Salve para registrar outra versão.'); }}>Duplicar</Button></div>)}{!records.length && <p className="text-xs text-slate-500">Nenhuma versão desta ferramenta encontrada.</p>}</div></details><Notice>{message}</Notice>
  </section>;
}
