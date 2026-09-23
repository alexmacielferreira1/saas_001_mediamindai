import { useMemo, useRef, useState } from 'react';
import { Download, LayoutTemplate, Lock, PanelLeft, PanelRight, Unlock, Upload } from 'lucide-react';
import Workspace2Stepper from '../components/workspace2/Workspace2Stepper';
import Workspace2Search from '../components/workspace2/Workspace2Search';
import Workspace2Script from '../components/workspace2/Workspace2Script';
import Workspace2Timeline from '../components/workspace2/Workspace2Timeline';
import { MOCK_ASSETS } from '../data';
import { appendScriptBlock, appendTextBlock, removeScriptBlock, toggleSelectedAsset } from '../lib/workspace2Model';

export default function Workspace2() {
  const initialProject = {
    title: 'Jornal 12h - 15/05/2026', segment: 'Jornalismo', program: 'Jornal do Meio Dia',
    status: 'Rascunho', version: 'v1.0', estimatedDuration: '02:48:10', reporter: 'João Silva',
    producer: 'Maria Oliveira', editor: 'Alex',
  };
  const [activeStep, setActiveStep] = useState('search');
  const [selectedIds, setSelectedIds] = useState(() => MOCK_ASSETS.slice(0, 5).map((asset) => asset.id));
  const [previewAssetId, setPreviewAssetId] = useState(MOCK_ASSETS[1]?.id || MOCK_ASSETS[0]?.id);
  const [blocks, setBlocks] = useState([]);
  const [project, setProject] = useState(initialProject);
  const [notice, setNotice] = useState('Projeto ativo · Não salvo');
  const [showPreview, setShowPreview] = useState(true);
  const [locked, setLocked] = useState(false);
  const importRef = useRef(null);
  const selectedAssets = useMemo(
    () => MOCK_ASSETS.filter((asset) => selectedIds.includes(asset.id)),
    [selectedIds],
  );
  const previewAsset = MOCK_ASSETS.find((asset) => asset.id === previewAssetId) || MOCK_ASSETS[0];

  const saveProject = () => {
    localStorage.setItem('mm_workspace2_draft', JSON.stringify({ activeStep, selectedIds, previewAssetId, blocks, project }));
    setNotice('Projeto salvo localmente · Última alteração: agora');
  };
  const resetProject = () => {
    setActiveStep('search'); setSelectedIds(MOCK_ASSETS.slice(0, 5).map((asset) => asset.id));
    setPreviewAssetId(MOCK_ASSETS[1]?.id || MOCK_ASSETS[0]?.id); setBlocks([]); setProject(initialProject);
    localStorage.removeItem('mm_workspace2_draft'); setNotice('Projeto restaurado ao padrão');
  };
  const exportProject = () => {
    const blob = new Blob([JSON.stringify({ project, blocks, selectedIds }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'workspace2-projeto.json'; anchor.click(); URL.revokeObjectURL(url);
    setNotice('Projeto exportado');
  };
  const importProject = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.project) setProject((current) => ({ ...current, ...data.project }));
      if (Array.isArray(data.blocks)) setBlocks(data.blocks);
      if (Array.isArray(data.selectedIds)) setSelectedIds(data.selectedIds);
      setNotice('Projeto importado com sucesso');
    } catch { setNotice('Arquivo inválido: importe um projeto JSON do Workspace 2'); }
    event.target.value = '';
  };

  const shared = {
    assets: MOCK_ASSETS,
    selectedAssets,
    selectedIds,
    previewAsset,
    blocks,
    onPreview: (asset) => setPreviewAssetId(asset.id),
    onToggle: (id) => setSelectedIds((ids) => toggleSelectedAsset(ids, id)),
    onClearSelection: () => setSelectedIds([]),
    onAddAsset: (asset) => { if (!locked) setBlocks((items) => appendScriptBlock(items, asset)); },
    onAddText: (text) => { if (!locked) setBlocks((items) => appendTextBlock(items, text)); },
    onRemoveBlock: (id) => { if (!locked) setBlocks((items) => removeScriptBlock(items, id)); },
    onStepChange: setActiveStep,
    project,
    onProjectChange: (field, value) => { if (!locked) setProject((current) => ({ ...current, [field]: value })); },
    onSave: saveProject,
    onSaveAs: () => { setProject((current) => ({ ...current, title: `${current.title} — cópia` })); setNotice('Cópia criada; salve para registrar'); },
    onExport: exportProject,
    onNotice: setNotice,
    showPreview,
  };

  return (
    <div className="workspace2 -m-4 min-h-[calc(100vh-4rem)] bg-[#020817] p-4 text-slate-100">
      <div className="mb-4 flex items-start gap-5">
        <div className="min-w-64">
          <h1 className="text-2xl font-bold">Workspace <span className="text-amber-400">2</span></h1>
          <p className="text-sm text-slate-400">Pesquisa, roteiro e timeline em um único fluxo</p>
        </div>
        <div className="flex-1"><Workspace2Stepper activeStep={activeStep} onStepChange={setActiveStep} selectedCount={selectedIds.length} onSave={saveProject} onReset={resetProject} /></div>
      </div>
      <div role="status" className="mb-3 min-h-5 text-right text-xs text-sky-300">{notice}</div>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-2">
        <button type="button" onClick={() => setActiveStep('search')} className={`w2-button ${activeStep === 'search' ? 'border-sky-500 bg-sky-500 text-slate-950' : ''}`}><PanelLeft size={14} /> Pesquisa</button>
        <button type="button" onClick={() => setShowPreview((value) => !value)} className={`w2-button ${showPreview ? 'border-sky-500 bg-sky-500 text-slate-950' : ''}`}><PanelRight size={14} /> Prévia</button>
        <button type="button" onClick={() => importRef.current?.click()} className="w2-button"><Upload size={14} /> Importar</button><input ref={importRef} aria-label="Importar projeto" type="file" accept="application/json,.json" onChange={importProject} className="hidden" />
        <button type="button" onClick={exportProject} className="w2-button"><Download size={14} /> Exportar</button>
        <button type="button" onClick={() => setNotice('Layout Padrão MediaMind ativo')} className="w2-button"><LayoutTemplate size={14} /> Layouts</button>
        <button type="button" onClick={() => { setLocked((value) => !value); setNotice(locked ? 'Projeto destravado' : 'Projeto travado para evitar alterações'); }} className={`w2-button ${locked ? 'border-amber-500 text-amber-300' : ''}`}>{locked ? <Lock size={14} /> : <Unlock size={14} />} Travar</button>
      </div>
      {activeStep === 'search' && <Workspace2Search {...shared} />}
      {activeStep === 'script' && <Workspace2Script {...shared} />}
      {activeStep === 'timeline' && <Workspace2Timeline {...shared} />}
    </div>
  );
}
