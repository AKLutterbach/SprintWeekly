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
  previousSprintIssueKeys?: string[]; // keys from previous sprint (for carryover detection)
};

export type Metrics = {
  // New five-metric system
  committedAtStart: number; // issues in sprint at start
  committedCarryover: number; // committed issues that were also in previous sprint
  addedMidSprint: number; // issues added after sprint started
  completed: number; // issues in Done status
  incompleteCarryover: number; // issues not Done that will carry over
  
  // Legacy fields (kept for compatibility)
  totalIssues: number;
  totalStoryPoints: number;
  committedStoryPoints: number;
  completedStoryPoints: number;
  addedIssues: number;
  removedIssues: number;
  carryoverIssues: number;
  defects: number;
  blockedIssues: number;
  throughput: number;
  committedIssues: number;
  completedIssues: number;
};

export function computeMetrics(issues: Issue[], opts: ComputeOptions = {}): Metrics {
  const committedSet = new Set((opts.committedKeys || []).map(String));
  const previousSprintSet = new Set((opts.previousSprintIssueKeys || []).map(String));
  const sprintStart = opts.sprintStart ? new Date(opts.sprintStart) : null;

  // New metric counters
  let committedAtStart = 0;
  let committedCarryover = 0;
  let addedMidSprint = 0;
  let completed = 0;
  let incompleteCarryover = 0;

  // Legacy metric counters
  let totalStoryPoints = 0;
  let committedStoryPoints = 0;
  let completedStoryPoints = 0;
  let addedIssues = 0;
  let carryoverIssues = 0;
  let defects = 0;
  let blockedIssues = 0;
  let throughput = 0;
  let committedIssues = 0;
  let completedIssues = 0;

  for (const issue of issues) {
    const sp = Number(issue.fields.storyPoints || 0);
    const status = (issue.fields.status || '').toLowerCase();
    const issuetype = (issue.fields.issuetype && issue.fields.issuetype.name) || '';
    const labels = issue.fields.labels || [];
    const isDone = ['done', 'closed', 'resolved'].includes(status);

    totalStoryPoints += sp;

    // Determine if issue was committed at sprint start
    const isCommitted = committedSet.size === 0 || (issue.key && committedSet.has(issue.key));
    const wasInPreviousSprint = issue.key && previousSprintSet.has(issue.key);
    const wasAddedMidSprint = sprintStart && issue.fields.created && new Date(issue.fields.created) > sprintStart;

    // NEW METRICS
    // committedAtStart: all issues in sprint at start
    if (isCommitted) {
      committedAtStart += 1;
      
      // committedCarryover: committed issues that were also in previous sprint
      if (wasInPreviousSprint) {
        committedCarryover += 1;
      }
    }

    // addedMidSprint: issues added after sprint started
    if (wasAddedMidSprint) {
      addedMidSprint += 1;
    }

    // completed: issues in Done status
    if (isDone) {
      completed += 1;
    } else {
      // incompleteCarryover: not Done, will carry over
      incompleteCarryover += 1;
    }

    // LEGACY METRICS (for backward compatibility)
    if (isCommitted) {
      committedIssues += 1;
      committedStoryPoints += sp;
      
      if (isDone) {
        completedIssues += 1;
      }
    }

    if (isDone) {
      completedStoryPoints += sp;
      throughput += 1;
    } else {
      carryoverIssues += 1;
    }

    if (wasAddedMidSprint) addedIssues += 1;

    if (issuetype.toLowerCase() === 'bug') defects += 1;

    if (labels.some((l: string) => l.toLowerCase() === 'blocked') || status === 'blocked') blockedIssues += 1;
  }

  return {
    // New five metrics
    committedAtStart,
    committedCarryover,
    addedMidSprint,
    completed,
    incompleteCarryover,
    
    // Legacy metrics
    totalIssues: issues.length,
    totalStoryPoints,
    committedStoryPoints,
    completedStoryPoints,
    addedIssues,
    removedIssues: 0,
    carryoverIssues,
    defects,
    blockedIssues,
    throughput,
    committedIssues,
    completedIssues
  };
}

export default computeMetrics;
