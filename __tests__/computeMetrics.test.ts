import { computeMetrics } from '../src/lib/computeMetrics';

describe('computeMetrics', () => {
  test('computes basic metrics correctly', () => {
    const sprintStart = new Date('2025-11-01T00:00:00Z').toISOString();
    const issues = [
      { key: 'A-1', fields: { storyPoints: 5, status: 'Done', issuetype: { name: 'Story' }, labels: [], created: '2025-10-30T12:00:00Z' } },
      { key: 'A-2', fields: { storyPoints: 3, status: 'In Progress', issuetype: { name: 'Story' }, labels: [], created: '2025-11-02T12:00:00Z' } },
      { key: 'A-3', fields: { storyPoints: 2, status: 'Done', issuetype: { name: 'Bug' }, labels: ['blocked'], created: '2025-10-28T12:00:00Z' } }
    ];

    const metrics = computeMetrics(issues, { committedKeys: ['A-1', 'A-2'], sprintStart });

    expect(metrics.totalIssues).toBe(3);
    expect(metrics.totalStoryPoints).toBe(10);
    expect(metrics.committedStoryPoints).toBe(8);
    expect(metrics.completedStoryPoints).toBe(7); // A-1 (5) + A-3 (2)
    expect(metrics.addedIssues).toBe(1); // A-2 created after sprintStart
    expect(metrics.defects).toBe(1);
    expect(metrics.blockers).toBe(1);
    expect(metrics.throughput).toBe(2); // two done issues
  });
});
