import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
vi.mock('../mediamind/components/ai-tools/StudioProjectBar', () => ({ default: () => <div>Versões do projeto</div> }));
import TrendStudio from '../mediamind/components/ai-tools/TrendStudio';
import DubbingStudio from '../mediamind/components/ai-tools/DubbingStudio';
import FramesStudio from '../mediamind/components/ai-tools/FramesStudio';
import VoiceStudio from '../mediamind/components/ai-tools/VoiceStudio';
import VideoWorkspace from '../mediamind/components/ai-tools/VideoWorkspace';
import AnimatedStudio from '../mediamind/components/ai-tools/AnimatedStudio';
beforeEach(() => { let id = 0; URL.createObjectURL = vi.fn(() => `blob:qa-${++id}`); URL.revokeObjectURL = vi.fn(); });
afterEach(() => vi.unstubAllGlobals());
describe('reference workflows', () => {
 it('adds a source-grounded radar card and filters saved references', () => {
  render(<TrendStudio/>); fireEvent.change(screen.getByLabelText('Nicho / produto'), {target:{value:'Edição de vídeo'}}); fireEvent.change(screen.getByLabelText('Link da fonte'), {target:{value:'javascript:alert(1)'}}); fireEvent.click(screen.getByText('Adicionar ao radar')); expect(screen.getByRole('status')).toHaveTextContent('link válido');
  fireEvent.change(screen.getByLabelText('Link da fonte'), {target:{value:'https://example.com/video'}}); fireEvent.change(screen.getByLabelText('Data da observação'), {target:{value:'2026-10-09'}}); fireEvent.click(screen.getByText('Adicionar ao radar')); expect(screen.getByRole('link',{name:/Conferir fonte/})).toHaveAttribute('href','https://example.com/video'); fireEvent.click(screen.getByRole('button',{name:'Salvar referência Edição de vídeo'})); fireEvent.click(screen.getByText('Salvos · 1')); expect(screen.getByRole('heading',{name:'Edição de vídeo'})).toBeInTheDocument();
 });
 it('organizes dubbing segments and rejects reversed timestamps before exporting', () => {
  render(<DubbingStudio/>); fireEvent.change(screen.getByLabelText('Texto original'),{target:{value:'Primeira fala\nSegunda fala'}});fireEvent.click(screen.getByText('Organizar trechos')); expect(screen.getByLabelText('Início da fala 2')).toHaveValue(5); fireEvent.change(screen.getByLabelText('Fim da fala 1'),{target:{value:'0'}});fireEvent.click(screen.getByText('Baixar legenda SRT revisada'));expect(screen.getByRole('status')).toHaveTextContent('terminar depois');
 });
 it('prepares a frame batch and switches fill mode without claiming MP4 export', () => {
  render(<FramesStudio/>); fireEvent.change(screen.getByLabelText('Vídeos do lote'),{target:{files:[new File(['v'],'a.mp4',{type:'video/mp4'}),new File(['v'],'b.mp4',{type:'video/mp4'})]}}); expect(screen.getByText('Fila de vídeos · 2')).toBeInTheDocument();fireEvent.change(screen.getByLabelText('Como o vídeo entra'),{target:{value:'cover'}});expect(screen.getByLabelText('Como o vídeo entra')).toHaveValue('cover');expect(screen.getByText('Baixar quadro da prévia · PNG')).toBeEnabled();
 });
 it('supports an actual browser voice preview and reuses its text from history', () => {
  const synthesis = {getVoices:()=>[{voiceURI:'pt',name:'Voz QA',lang:'pt-BR',localService:true}],addEventListener:vi.fn(),removeEventListener:vi.fn(),cancel:vi.fn(),speak:vi.fn()};vi.stubGlobal('speechSynthesis',synthesis);vi.stubGlobal('SpeechSynthesisUtterance',class{constructor(text){this.text=text;}});
  render(<VoiceStudio/>);fireEvent.click(screen.getByText('Ouvir prévia'));expect(synthesis.speak).toHaveBeenCalledOnce();fireEvent.click(screen.getByRole('tab',{name:'Histórico de prévias'}));expect(screen.getByText('Reutilizar texto e parâmetros')).toBeInTheDocument();fireEvent.click(screen.getByText('Reutilizar texto e parâmetros'));expect(screen.getByText('Ouvir prévia')).toBeInTheDocument();
 });
 it('distributes multiple media files into scenes and keeps ordering controls', () => {
  function Harness(){const [scenes,setScenes]=useState([]);return <VideoWorkspace scenes={scenes} setScenes={setScenes}/>;}
  render(<Harness/>);fireEvent.change(screen.getByLabelText('Mídias em lote'),{target:{files:[new File(['img'],'foto.png',{type:'image/png'}),new File(['v'],'video.mp4',{type:'video/mp4'})]}});expect(screen.getByRole('status')).toHaveTextContent('2 mídias');expect(screen.getByLabelText('Mover cena para direita')).toBeEnabled();fireEvent.click(screen.getByLabelText('Mover cena para direita'));expect(screen.getByLabelText('Mover cena para esquerda')).toBeEnabled();
 });
 it('parses bracketed scene directions instead of rendering brackets as narration', () => {
  render(<AnimatedStudio/>);fireEvent.change(screen.getByLabelText('Uma frase por linha · [cena] opcional'),{target:{value:'[tempo] Comece agora\n[ideia] Um passo de cada vez'}});fireEvent.click(screen.getByText('Organizar cenas'));expect(screen.getAllByText('Comece agora').length).toBeGreaterThan(0);expect(screen.queryByText('[tempo] Comece agora')).not.toBeInTheDocument();
 });
});
