/**
 * Type definitions for request/response payloads.
 * Runtime validation removed to avoid bundling issues with Zod.
 * Can re-add validation later with a simpler approach.
 */

// Scope: board | project | jql
export interface Scope {
  type: 'board' | 'project' | 'jql';
  ref: string; // board/project ID or JQL string
}

// Time window: calendar (start/end) or sprint (sprintId)
export interface Window {
  type: 'calendar' | 'sprint';
  start?: string; // ISO date
  end?: string; // ISO date
  sprintId?: string;
}

export interface ReportRequest {
  requestId: string;
  scope: Scope;
  window: Window;
  metrics?: string[];
  locale?: string;
  forceRebuild?: boolean;
}

export interface ExportRequest {
  requestId: string;
  cacheKey?: string;
  listsToExport?: Array<'done' | 'changes' | 'carryover' | 'blockers'>;
  options?: { zipIfMultiple?: boolean };
}

// Issue snapshot used inside report payloads
export interface IssueSnapshot {
  id: string;
  key: string;
  summary: string;
  status: string;
  storyPoints?: number | null;
  issueType?: string;
  assignee?: {
    accountId?: string;
    displayName?: string;
  };
}

export interface ReportPayload {
  id: string;
  generatedAt: string;
  timeWindow: Window;
  scopeRef: Scope;
  metricValues: Record<string, unknown>;
  issueLists?: {
    done?: IssueSnapshot[];
    changes?: IssueSnapshot[];
    carryover?: IssueSnapshot[];
    blockers?: IssueSnapshot[];
  };
  narrative?: string;
  checksum: string;
  partialData?: boolean;
}

export interface ErrorObject {
  code: string;
  message: string;
  details?: unknown;
}
