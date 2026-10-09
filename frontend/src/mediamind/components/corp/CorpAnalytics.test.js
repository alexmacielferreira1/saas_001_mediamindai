import { describe, expect, it } from 'vitest';
import { buildAiReport } from './CorpAnalytics';

describe('Analytics AI report', () => {
  it('turns a natural-language request into a management report', () => {
    const report = buildAiReport('Compare Instagram e YouTube nos últimos 30 dias por engajamento');
    expect(report.title).toMatch(/Instagram.*YouTube/i);
    expect(report.metrics).toHaveLength(4);
    expect(report.summary).toMatch(/30 dias/i);
  });
});
