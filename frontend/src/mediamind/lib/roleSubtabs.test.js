import { describe, expect, it } from 'vitest';

import { ROLE_SUBTABS } from './roleSubtabs';

describe('producer role workflow access', () => {
  it('includes every new canonical queue', () => {
    expect(ROLE_SUBTABS.producer).toEqual(expect.arrayContaining([
      'para_editar', 'aguardando_aprovacao', 'para_publicar', 'publicado',
    ]));
  });
});
