import React, { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Trash2, GripVertical, Plus, Save, Copy, FileDown,
  GitBranch, Send, ChevronDown, FileText,
} from 'lucide-react';

const SEGMENTS = ['Jornalismo', 'Esportes', 'Entretenimento', 'Documentário', 'Institucional'];
const PROGRAMS = ['Jornal do Meio Dia', 'Jornal da Noite', 'Especial Enchentes RS', 'Documentário Turismo', 'Campanha Institucional'];
const STATUSES = ['Rascunho', 'Em revisão', 'Aprovado', 'Publicado'];
const VERSIONS = ['v1.0', 'v1.1', 'v2.0', 'v2.1'];

const TRACK_LABELS = { v1: 'V1', v2: 'V2', a1: 'A1', t1: 'T1' };
const TRACK_BADGE = {
  v1: 'bg-sky-500/20 text-sky-300',
  v2: 'bg-sky-400/20 text-sky-200',
  a1: 'bg-emerald-500/20 text-emerald-300',
  t1: 'bg-violet-500/20 text-violet-300',
};

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 pr-7 text-xs text-slate-200 outline-none focus:border-sky-500"
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" />
      </div>
    </label>
  );
}

function Input({ label, value, onChange, placeholder }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
      />
    </label>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-bold text-sky-300">{value}</p>
    </div>
  );
}

function InsertMenu({ index, onInsertMedia, onInsertText, onClose }) {
  return (
    <div className="relative">
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-xl">
        <button
          onClick={() => { onInsertMedia(index); onClose(); }}
          className="flex w-40 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          <Plus size={12} /> Mídia selecionada
        </button>
        <button
          onClick={() => { onInsertText(index); onClose(); }}
          className="flex w-40 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-violet-300 hover:bg-slate-800"
        >
          <FileText size={12} /> Bloco de texto
        </button>
      </div>
    </div>
  );
}

export default function WorkspaceRoteiroPanel({
  items, project, setProject,
  onRemove, onReorder, onUpdateItem, onInsertAt, onInsertText, onToggleTimeline,
}) {
  const [showSaved, setShowSaved] = useState(false);
  const [openInsert, setOpenInsert] = useState(null);

  function update(field, value) {
    setProject((p) => ({ ...p, [field]: value, saved: false }));
  }

  function handleSave() {
    setProject((p) => ({ ...p, saved: true }));
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  }

  const blocks = items.length;
  const clipCount = items.filter((i) => i.type === 'video' || i.type === 'audio' || i.type === 'media').length;
  const textCount = items.filter((i) => i.type === 'text').length;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
        <h2 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Projeto ativo</h2>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${project.saved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
          {showSaved ? 'Salvo!' : project.saved ? 'Salvo' : 'Não salvo'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Project metadata */}
        <div className="border-b border-slate-800 p-3">
          <input
            value={project.title}
            onChange={(e) => update('title', e.target.value)}
            className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-sky-500"
          />

          <div className="grid grid-cols-2 gap-2">
            <Select label="Segmento" value={project.segment} onChange={(e) => update('segment', e.target.value)} options={SEGMENTS} />
            <Select label="Programa" value={project.program} onChange={(e) => update('program', e.target.value)} options={PROGRAMS} />
            <Select label="Status" value={project.status} onChange={(e) => update('status', e.target.value)} options={STATUSES} />
            <Select label="Versão" value={project.version} onChange={(e) => update('version', e.target.value)} options={VERSIONS} />
            <Input label="Duração estimada" value={project.duration} onChange={(e) => update('duration', e.target.value)} />
            <Input label="Repórter" value={project.reporter} onChange={(e) => update('reporter', e.target.value)} />
            <Input label="Produtor" value={project.producer} onChange={(e) => update('producer', e.target.value)} />
            <Input label="Editor" value={project.editor} onChange={(e) => update('editor', e.target.value)} />
          </div>

          <p className="mt-2 text-[10px] text-slate-500">Última alteração: {project.saved ? 'Atualizado agora' : 'Atualiza ao salvar'}</p>

          {/* Stats */}
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <StatBox label="Clipes" value={clipCount} />
            <StatBox label="Textos" value={textCount} />
            <StatBox label="Versão" value={project.version} />
          </div>

          {/* Actions */}
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <button onClick={handleSave} className="flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400">
              <Save size={13} /> Salvar
            </button>
            <button className="flex items-center justify-center gap-1.5 rounded-lg border border-sky-700 bg-sky-950/30 py-2 text-xs font-medium text-sky-300 hover:bg-sky-900/40">
              <Copy size={13} /> Salvar como
            </button>
            <button className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800">
              <FileDown size={13} /> Exportar
            </button>
            <button className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800">
              <GitBranch size={13} /> Versões
            </button>
          </div>
          <button
            onClick={onToggleTimeline}
            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-sky-400"
          >
            <Send size={13} /> Enviar pra Edição
          </button>
        </div>

        {/* Roteiro list (drag-drop) */}
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Roteiro / Blocos ({blocks})</h3>
            <span className="text-[10px] text-slate-500">Arraste mídias do grid →</span>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 py-12 text-center">
              <Plus size={28} className="text-slate-600" />
              <p className="text-xs text-slate-500">Arraste mídias do grid aqui, ou use o botão +</p>
              <div className="relative mt-1">
                <button
                  onClick={() => setOpenInsert(openInsert === 'empty' ? null : 'empty')}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/30"
                >
                  <Plus size={13} /> Adicionar bloco
                </button>
                {openInsert === 'empty' && (
                  <InsertMenu
                    index={0}
                    onInsertMedia={onInsertAt}
                    onInsertText={onInsertText}
                    onClose={() => setOpenInsert(null)}
                  />
                )}
              </div>
            </div>
          ) : (
            <Droppable droppableId="roteiro">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex flex-col gap-2 rounded-xl transition ${snapshot.isDraggingOver ? 'bg-sky-950/30' : ''}`}
                >
                  {/* Top insert */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenInsert(openInsert === 'top' ? null : 'top')}
                      className="flex w-full items-center justify-center rounded-lg border border-dashed border-sky-700/50 py-1 text-sky-500 transition hover:bg-sky-950/30"
                    >
                      <Plus size={14} />
                    </button>
                    {openInsert === 'top' && (
                      <InsertMenu
                        index={0}
                        onInsertMedia={onInsertAt}
                        onInsertText={onInsertText}
                        onClose={() => setOpenInsert(null)}
                      />
                    )}
                  </div>

                  {items.map((item, index) => (
                    <Draggable key={String(item.id)} draggableId={String(item.id)} index={index}>
                      {(p) => (
                        <div
                          ref={p.innerRef}
                          {...p.draggableProps}
                          className={`rounded-xl border border-dashed p-3 ${
                            item.type === 'text'
                              ? 'border-violet-700/50 bg-violet-950/20'
                              : 'border-slate-700 bg-slate-950/40'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span {...p.dragHandleProps} className="mt-0.5 cursor-grab text-slate-600 hover:text-slate-400">
                              <GripVertical size={14} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-600">{String(index + 1).padStart(2, '0')}</span>
                                <span className="text-base">{item.icon}</span>
                                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${TRACK_BADGE[item.track] || 'bg-slate-700 text-slate-300'}`}>
                                  {TRACK_LABELS[item.track] || item.track}
                                </span>
                                <p className="truncate text-xs font-semibold text-slate-200">
                                  {item.type === 'text' ? 'Bloco de texto' : item.title}
                                </p>
                              </div>

                              {item.type === 'text' ? (
                                <textarea
                                  value={item.text || ''}
                                  onChange={(e) => onUpdateItem(item.id, 'text', e.target.value)}
                                  placeholder="Digite o texto do bloco..."
                                  rows={3}
                                  className="w-full resize-none rounded-md border border-violet-700/50 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-violet-500"
                                />
                              ) : (
                                <>
                                  <p className="truncate text-[10px] text-slate-500">
                                    {Math.floor(item.duration || 0)}s{item.assetId ? ` • ASSET-00-${item.assetId}` : ''}
                                  </p>
                                  <p className="truncate text-[10px] font-mono text-slate-600">{item.filePath || '—'}</p>
                                  <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-sky-300">
                                    <span>{item.in}</span>
                                    <span className="text-slate-600">→</span>
                                    <span>{item.out}</span>
                                  </div>
                                </>
                              )}

                              <input
                                value={item.aiSummary || ''}
                                onChange={(e) => onUpdateItem(item.id, 'aiSummary', e.target.value)}
                                placeholder="Resumo IA do trecho..."
                                className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-300 outline-none focus:border-sky-500"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => onRemove(item.id)}
                                className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-300 hover:bg-rose-500/25"
                              >
                                <Trash2 size={11} />
                              </button>
                              <button className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-700">
                                Mover
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}

                  {/* Bottom insert */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenInsert(openInsert === 'bottom' ? null : 'bottom')}
                      className="flex w-full items-center justify-center rounded-lg border border-dashed border-sky-700/50 py-1 text-sky-500 transition hover:bg-sky-950/30"
                    >
                      <Plus size={14} />
                    </button>
                    {openInsert === 'bottom' && (
                      <InsertMenu
                        index={items.length}
                        onInsertMedia={onInsertAt}
                        onInsertText={onInsertText}
                        onClose={() => setOpenInsert(null)}
                      />
                    )}
                  </div>

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          )}
        </div>
      </div>
    </div>
  );
}