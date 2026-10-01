import { describe, expect, it } from 'vitest';
import { canAccessModule } from './moduleAccess';

describe('module route access', () => {
  it('denies unknown roles and grants administrators all modules', () => {
    expect(canAccessModule('unknown', 'management')).toBe(false);
    expect(canAccessModule('admin', 'management')).toBe(true);
    expect(canAccessModule('superadmin', 'ingest')).toBe(true);
  });

  it('applies role-specific access instead of authentication only', () => {
    expect(canAccessModule('viewer', 'management')).toBe(false);
    expect(canAccessModule('cedoc', 'acervo')).toBe(true);
    expect(canAccessModule('editor', 'social')).toBe(true);
    expect(canAccessModule('producer', 'ingest')).toBe(true);
  });

  it('limits the MVP profile to its existing route surfaces', () => {
    for (const moduleId of ['home', 'corp', 'acervo', 'workspace2', 'timeline2']) {
      expect(canAccessModule('mvp', moduleId)).toBe(true);
    }
    for (const moduleId of ['assistente', 'ingest', 'workspace', 'timeline', 'social', 'management']) {
      expect(canAccessModule('mvp', moduleId)).toBe(false);
    }
  });
});
