import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EditingProjectPanels from './EditingProjectPanels';

describe('editing delivery controls', () => {
  it('records a correction at the real player time and lets the editor resolve it', () => {
    render(<EditingProjectPanels project={{id:'delivery-1',materiais:[{nome:'master.mp4',url:'/master.mp4',tipo:'video'}]}} lane="aguardando" onChange={()=>{}}/>);
    const video=screen.getByTestId('media-player-video');
    Object.defineProperty(video,'duration',{value:60,configurable:true});
    fireEvent.loadedMetadata(video);video.currentTime=12;fireEvent.timeUpdate(video);
    fireEvent.change(screen.getByLabelText('Novo apontamento'),{target:{value:'Corrigir GC'}});
    fireEvent.click(screen.getByRole('button',{name:'Adicionar marcador em 12.00 s'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Status de Corrigir GC'}),{target:{value:'Resolvido'}});
    expect(screen.getByText(/1 apontamento.*1 resolvido/)).toBeInTheDocument();
    video.currentTime=30;
    fireEvent.click(screen.getByRole('button',{name:'00:12 · Corrigir GC'}));
    expect(video.currentTime).toBe(12);
  });
  it('does not claim missing production materials are complete', () => {
    render(<EditingProjectPanels project={{id:'empty',materiais:[]}} lane="para_editar" onChange={()=>{}}/>);
    const check=screen.getByRole('checkbox',{name:'Mídias de gravação'});
    expect(check).not.toBeChecked();fireEvent.click(check);expect(check).toBeChecked();
    expect(screen.getByRole('button',{name:'Reproduzir mídia'})).toBeDisabled();
  });
});
