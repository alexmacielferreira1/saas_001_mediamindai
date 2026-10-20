import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import CorpAnalytics from './CorpAnalytics';

beforeAll(() => {
  // recharts (ResponsiveContainer) usa ResizeObserver, ausente no jsdom.
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});

describe('CorpAnalytics — controles sem ação ficam honestos', () => {
  it('desabilita filtros e ações ainda não implementados com motivo', () => {
    render(<CorpAnalytics />);
    for (const name of [/Últimos 30 dias/, /Programa: Todos/, /Canal: Todos/, /Campanha: Todas/, /Gerar relatório/, /Compartilhar dashboard/]) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Ainda não disponível');
    }
  });

  it('"Ver todos" e "Ver todas" abrem as abas correspondentes', () => {
    render(<CorpAnalytics />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos' }));
    expect(screen.getByText('Conteúdos com melhor resultado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exportar recorte/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Visão geral' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas' }));
    expect(screen.getByText('Campanhas e resultados')).toBeInTheDocument();
  });

  it('"Salvar relatório" do recorte gerado fica desabilitado', () => {
    render(<CorpAnalytics />);
    fireEvent.change(screen.getByLabelText('Pedido de relatório para IA'), { target: { value: 'Instagram 7 dias' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar análise' }));
    expect(screen.getByRole('button', { name: 'Salvar relatório' })).toBeDisabled();
  });
});
