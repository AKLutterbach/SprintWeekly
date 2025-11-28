/**
 * computeSprintStatusMetrics - Converts report data into SprintStatusMetrics format
 * 
 * This function takes the existing report structure and transforms it into
 * the format needed by the SprintStatusOverview component.
 */

import { SprintStatusMetrics } from '../types/sprintStatus';

export type Issue = {
  key?: string;
  fields: {
    status?: string;
    created?: string;
  };
};

export type ComputeSprintStatusOptions = {
  issues: Issue[];
  sprintStart?: string; // ISO date string
  previousSprintIssueKeys?: string[]; // keys from previous sprint
  committedKeys?: string[]; // keys committed at sprint start
};

/**
 * Computes sprint status metrics showing breakdown by status and origin
 * 
 * @param options - Configuration and data for computing metrics
 * @returns SprintStatusMetrics object suitable for SprintStatusOverview component
 */
export function computeSprintStatusMetrics(
  options: ComputeSprintStatusOptions
): SprintStatusMetrics {
  const { issues, sprintStart, previousSprintIssueKeys = [], committedKeys = [] } = options;
  
  const previousSprintSet = new Set(previousSprintIssueKeys);
  const committedSet = new Set(committedKeys);
  const sprintStartDate = sprintStart ? new Date(sprintStart) : null;

  // Initialize counters for each status and origin combination
  const metrics = {
    committed: {
      fromLastSprint: 0,
      plannedAtStart: 0,
      addedMidSprint: 0
    },
    completed: {
      fromLastSprint: 0,
      plannedAtStart: 0,
      addedMidSprint: 0
    },
    incomplete: {
      fromLastSprint: 0,
      plannedAtStart: 0,
      addedMidSprint: 0
    }
  };

  for (const issue of issues) {
    const status = (issue.fields.status || '').toLowerCase();
    const isDone = ['done', 'closed', 'resolved'].includes(status);
    const issueKey = issue.key || '';
    
    // Determine origin of the issue
    const wasInPreviousSprint = previousSprintSet.has(issueKey);
    const wasAddedMidSprint = sprintStartDate && issue.fields.created 
      ? new Date(issue.fields.created) > sprintStartDate 
      : false;
    
    // Determine if issue was committed at sprint start
    const isCommitted = committedSet.size === 0 || committedSet.has(issueKey);
    
    // Determine origin category
    let origin: 'fromLastSprint' | 'plannedAtStart' | 'addedMidSprint';
    if (wasInPreviousSprint) {
      origin = 'fromLastSprint';
    } else if (wasAddedMidSprint) {
      origin = 'addedMidSprint';
    } else {
      origin = 'plannedAtStart';
    }

    // Categorize by status and origin
    if (isCommitted) {
      metrics.committed[origin]++;
    }
    
    if (isDone) {
      metrics.completed[origin]++;
    } else {
      metrics.incomplete[origin]++;
    }
  }

  // Return in the SprintStatusMetrics format
  return {
    committed: {
      total: metrics.committed.fromLastSprint + metrics.committed.plannedAtStart + metrics.committed.addedMidSprint,
      breakdown: {
        fromLastSprint: metrics.committed.fromLastSprint,
        plannedAtStart: metrics.committed.plannedAtStart,
        addedMidSprint: metrics.committed.addedMidSprint
      }
    },
    completed: {
      total: metrics.completed.fromLastSprint + metrics.completed.plannedAtStart + metrics.completed.addedMidSprint,
      breakdown: {
        fromLastSprint: metrics.completed.fromLastSprint,
        plannedAtStart: metrics.completed.plannedAtStart,
        addedMidSprint: metrics.completed.addedMidSprint
      }
    },
    incomplete: {
      total: metrics.incomplete.fromLastSprint + metrics.incomplete.plannedAtStart + metrics.incomplete.addedMidSprint,
      breakdown: {
        fromLastSprint: metrics.incomplete.fromLastSprint,
        plannedAtStart: metrics.incomplete.plannedAtStart,
        addedMidSprint: metrics.incomplete.addedMidSprint
      }
    }
  };
}
