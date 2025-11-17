import type { ReportRequest, ExportRequest } from '../src/lib/validators';

describe('validators', () => {
  test('ReportRequest type accepts a valid payload', () => {
    const payload: ReportRequest = {
      requestId: 'req-1',
      scope: { type: 'project', ref: 'PROJ' },
      window: { type: 'calendar', start: '2025-01-01', end: '2025-01-31' },
      metrics: ['throughput'],
    };

    expect(payload.requestId).toBe('req-1');
    expect(payload.scope.type).toBe('project');
  });

  test('ExportRequest type accepts minimal payload', () => {
    const payload: ExportRequest = { requestId: 'export-1' };
    expect(payload.requestId).toBe('export-1');
  });
});

