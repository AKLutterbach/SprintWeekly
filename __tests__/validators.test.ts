import { ReportRequestSchema, ExportRequestSchema } from '../src/lib/validators';

describe('validators', () => {
  test('ReportRequestSchema accepts a valid payload', () => {
    const payload = {
      requestId: 'req-1',
      scope: { type: 'project', ref: 'PROJ' },
      window: { type: 'calendar', start: '2025-01-01', end: '2025-01-31' },
      metrics: ['throughput'],
    };

    const parsed = ReportRequestSchema.parse(payload);
    expect(parsed.requestId).toBe('req-1');
    expect(parsed.scope.type).toBe('project');
  });

  test('ReportRequestSchema rejects missing requestId', () => {
    const payload: any = {
      scope: { type: 'project', ref: 'PROJ' },
      window: { type: 'calendar', start: '2025-01-01', end: '2025-01-31' },
    };

    expect(() => ReportRequestSchema.parse(payload)).toThrow();
  });

  test('ExportRequestSchema accepts minimal payload', () => {
    const payload = { requestId: 'export-1' };
    const parsed = ExportRequestSchema.parse(payload);
    expect(parsed.requestId).toBe('export-1');
  });
});
