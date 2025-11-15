import { z } from 'zod';

// Scope: board | project | jql
export const ScopeSchema = z.object({
  type: z.enum(['board', 'project', 'jql']),
  // For board/project use id string, for jql use the actual JQL string in ref
  ref: z.string(),
});

// Time window: calendar (start/end) or sprint (sprintId)
export const WindowSchema = z.object({
  type: z.enum(['calendar', 'sprint']),
  start: z.string().optional(), // ISO date
  end: z.string().optional(), // ISO date
  sprintId: z.string().optional(),
});

export const ReportRequestSchema = z.object({
  requestId: z.string(),
  scope: ScopeSchema,
  window: WindowSchema,
  metrics: z.array(z.string()).optional(),
  locale: z.string().optional(),
  forceRebuild: z.boolean().optional(),
});

export const ExportRequestSchema = z.object({
  requestId: z.string(),
  cacheKey: z.string().optional(),
  listsToExport: z.array(z.enum(['done', 'changes', 'carryover', 'blockers'])).optional(),
  options: z.object({ zipIfMultiple: z.boolean().optional() }).optional(),
});

// Issue snapshot used inside report payloads
export const IssueSnapshotSchema = z.object({
  id: z.string(),
  key: z.string(),
  summary: z.string(),
  status: z.string(),
  storyPoints: z.number().nullable().optional(),
  issueType: z.string().optional(),
  assignee: z.object({
    accountId: z.string().optional(),
    displayName: z.string().optional(),
  }).optional(),
});

export const ReportPayloadSchema = z.object({
  id: z.string(),
  generatedAt: z.string(),
  timeWindow: WindowSchema,
  scopeRef: ScopeSchema,
  metricValues: z.record(z.string(), z.any()),
  issueLists: z.object({
    done: z.array(IssueSnapshotSchema).optional(),
    changes: z.array(IssueSnapshotSchema).optional(),
    carryover: z.array(IssueSnapshotSchema).optional(),
    blockers: z.array(IssueSnapshotSchema).optional(),
  }).optional(),
  narrative: z.string().optional(),
  checksum: z.string(),
  partialData: z.boolean().optional(),
});

export const ErrorObjectSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
});

// Types
export type Scope = z.infer<typeof ScopeSchema>;
export type Window = z.infer<typeof WindowSchema>;
export type ReportRequest = z.infer<typeof ReportRequestSchema>;
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export type IssueSnapshot = z.infer<typeof IssueSnapshotSchema>;
export type ReportPayload = z.infer<typeof ReportPayloadSchema>;
export type ErrorObject = z.infer<typeof ErrorObjectSchema>;

export default {
  ScopeSchema,
  WindowSchema,
  ReportRequestSchema,
  ExportRequestSchema,
  IssueSnapshotSchema,
  ReportPayloadSchema,
  ErrorObjectSchema,
};
