import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MediaIdentity } from './MediaIdentity';

describe('MediaIdentity', () => {
  it('shows_initials_when_src_is_missing', () => {
    render(<MediaIdentity initials="AR" alt="Alex Ribeiro" kind="avatar" />);

    expect(screen.getByText('AR')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('falls_back_after_image_error', () => {
    render(<MediaIdentity src="/foto-inexistente.jpg" initials="AR" alt="Alex Ribeiro" kind="avatar" />);

    fireEvent.error(screen.getByRole('img', { name: 'Alex Ribeiro' }));

    expect(screen.getByText('AR')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('preserves_informative_alt_text', () => {
    render(<MediaIdentity src="/asset.jpg" alt="Prévia do Jornal da Noite" kind="thumbnail" />);

    expect(screen.getByRole('img', { name: 'Prévia do Jornal da Noite' })).toHaveAttribute('src', '/asset.jpg');
  });

  it('hides_decorative_image_from_accessibility_tree', () => {
    const { container } = render(<MediaIdentity src="/textura.jpg" alt="" kind="thumbnail" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });
});
