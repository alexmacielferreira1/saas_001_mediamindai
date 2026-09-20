import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import EmployeeAccessRow from './EmployeeAccessRow';

describe('EmployeeAccessRow role persistence', () => {
  it('persists a role change through the membership callback', async () => {
    const onRoleChange = vi.fn().mockResolvedValue(undefined);
    const user = {
      id: 'user-editor',
      membershipId: 'membership-editor',
      name: 'Editor Local',
      email: 'editor@mediamind.ai',
      role: 'editor',
    };

    render(
      <EmployeeAccessRow
        user={user}
        isSelf={false}
        peers={[user]}
        onRoleChange={onRoleChange}
      />,
    );

    fireEvent.change(screen.getByTitle('Cargo do funcionário'), {
      target: { value: 'reporter' },
    });

    await waitFor(() => {
      expect(onRoleChange).toHaveBeenCalledWith(user, 'reporter');
    });
  });

  it('persists an individual screen override through the membership callback', async () => {
    const onScreensChange = vi.fn();
    const user = { id: 'u1', membershipId: 'm1', name: 'Editor', email: 'e@x.test', role: 'editor', extraScreens: [], restrictedScreens: [] };
    render(<EmployeeAccessRow user={user} isSelf={false} peers={[user]} onScreensChange={onScreensChange} />);
    fireEvent.click(screen.getByRole('button', { name: '' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cedoc' }));
    expect(onScreensChange).toHaveBeenCalledWith(user, ['cedoc'], []);
  });
});
