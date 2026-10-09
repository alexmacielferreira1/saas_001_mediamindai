import React from 'react';
import {describe,expect,it,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
vi.mock('../mediamind/components/ai-tools/StudioProjectBar',()=>({default:()=>null}));
vi.mock('../mediamind/pages/ThumbnailStudio',()=>({default:()=> <div>Editor de thumbs preservado</div>}));
vi.mock('../mediamind/components/ai-tools/AIThumbnailStudio',()=>({default:()=> <div>Variações preservadas</div>}));
vi.mock('../mediamind/components/carousel/CarouselStudio',()=>({default:()=> <div>Carrossel preservado</div>}));
import AITools from '../mediamind/pages/AITools';
describe('tool navigation without placeholder screens',()=>{
 it('keeps thumbnails as default and opens the frame workspace from its tab',()=>{render(<MemoryRouter initialEntries={['/ferramentas-ia']}><AITools/></MemoryRouter>);expect(screen.getByText('Editor de thumbs preservado')).toBeInTheDocument();fireEvent.click(screen.getByRole('tab',{name:/Bordas\/Molduras/}));expect(screen.getByRole('heading',{name:'Bordas e Molduras'})).toBeInTheDocument();expect(screen.getByLabelText('Vídeos do lote')).toBeInTheDocument();});
 it('opens radar and dubbing controls instead of the planned implementation card',()=>{render(<MemoryRouter initialEntries={['/ferramentas-ia?tool=trend-radar']}><AITools/></MemoryRouter>);expect(screen.getByLabelText('Link da fonte')).toBeInTheDocument();fireEvent.click(screen.getByRole('tab',{name:/Dublagem IA/}));expect(screen.getByLabelText('Texto original')).toBeInTheDocument();expect(screen.queryByText('Implementação programada')).not.toBeInTheDocument();});
});
