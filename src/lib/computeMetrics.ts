/**
 * computeMetrics - a small, deterministic metric engine for sprints.
 *
 * This implementation intentionally keeps the input shape simple and testable.
 * Each `issue` is expected to be an object with a `fields` property which may
 * contain: { storyPoints?: number, status?: string, issuetype?: { name: string }, labels?: string[], created?: string }
 *
 * The real Jira shape is more complex; this function is a pure, testable core
 * that can be adapted later to map Jira fields into this simplified shape.
 */

export type Issue = {
  key?: string;
  fields: {
    storyPoints?: number;
    status?: string;
    issuetype?: { name?: string };
    labels?: string[];
    created?: string; // ISO date string when the issue was created
  };
};

export type ComputeOptions = {
  committedKeys?: string[]; // keys considered committed at sprint start
  sprintStart?: string; // ISO date for sprint start (used to detect added issues)
};

export type Metrics = {
  totalIssues: number;
  totalStoryPoints: number;
  committedStoryPoints: number;
  completedStoryPoints: number;
  addedIssues: number;
  removedIssues: number; // not computed precisely - placeholder 0
  carryoverIssues: number;
  defects: number;
  blockers: number;
  throughput: number; // completed issue count
};

export function computeMetrics(issues: Issue[], opts: ComputeOptions = {}): Metrics {
  const committedSet = new Set((opts.committedKeys || []).map(String));
  const sprintStart = opts.sprintStart ? new Date(opts.sprintStart) : null;

  let totalStoryPoints = 0;
  let committedStoryPoints = 0;
  let completedStoryPoints = 0;
  let addedIssues = 0;
  let carryoverIssues = 0;
  let defects = 0;
  let blockers = 0;
  let throughput = 0;

  for (const issue of issues) {
    const sp = Number(issue.fields.storyPoints || 0);
    const status = (issue.fields.status || '').toLowerCase();
    const issuetype = (issue.fields.issuetype && issue.fields.issuetype.name) || '';
    const labels = issue.fields.labels || [];

    totalStoryPoints += sp;

    if (issue.key && committedSet.has(issue.key)) {
      committedStoryPoints += sp;
    }

    const isDone = ['done', 'closed', 'resolved'].includes(status);
    if (isDone) {
      completedStoryPoints += sp;
      throughput += 1;
    } else {
      // issue not done at sprint end -> candidate carryover
      carryoverIssues += 1;
    }

    // Added issues detection: created after sprintStart
    if (sprintStart && issue.fields.created) {
      const created = new Date(issue.fields.created);
      if (created > sprintStart) addedIssues += 1;
    }

    if (issuetype.toLowerCase() === 'bug') defects += 1;

    if (labels.some((l: string) => l.toLowerCase() === 'blocked') || status === 'blocked') blockers += 1;
  }

  return {
    totalIssues: issues.length,
    totalStoryPoints,
    committedStoryPoints,
    completedStoryPoints,
    addedIssues,
    removedIssues: 0,
    carryoverIssues,
    defects,
    blockers,
    throughput
  };
}

export default computeMetrics;
