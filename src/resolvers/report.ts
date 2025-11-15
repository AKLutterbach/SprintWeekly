import { ReportRequestSchema, type ReportRequest } from '../lib/validators';
import jira from '../lib/jira';
import computeMetrics, { Issue } from '../lib/computeMetrics';
import cache from '../lib/cache';
import { REPORT_CACHE_TTL_SECONDS } from '../config/constants';
import { childWithRequestId } from '../lib/logger';

/**
 * Minimal report.build resolver implementation.
 * - validates input
 * - expands scope to JQL
 * - pages issues using `pageSearch`
 * - maps to Issue shape used by computeMetrics
 * - computes metrics
 * - caches the result
 */
export async function buildReport(payload: unknown) {
  // validate
  const parsed = ReportRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: 'INVALID_REQUEST', details: parsed.error }
  }

  const req = parsed.data as ReportRequest;
  const requestId = req.requestId || `rid-${Date.now()}`;
  const log = childWithRequestId(requestId);

  // make cache key
  const scopeRef = (req.scope as any).ref || JSON.stringify(req.scope);
  const cacheKey = cache.makeCacheKey('report', scopeRef, (req.window && (req.window as any).start) || '', JSON.stringify(req.metrics || []));
  try {
    const cached = await cache.getCache(cacheKey);
    if (cached) {
      log.info(`cache: HIT key=${cacheKey}`);
      return { cached: true, payload: cached };
    }
  } catch (err) {
    log.info('cache read failed, continuing', { err });
  }

  // expand scope
  const jql = await jira.expandScopeToJQL(req.scope as any);
  log.info('search jql', { jql });

  // page search (limit a reasonable number)
  const rawIssues = await jira.pageSearch(jql, ['key', 'fields'], 1000);

  // map to Issue shape expected by computeMetrics
  const issues: Issue[] = rawIssues.map((ri: any) => ({
    key: ri.key,
    fields: {
      storyPoints: ri.fields?.customfield_10002 ?? ri.fields?.storyPoints ?? 0,
      status: ri.fields?.status?.name ?? ri.fields?.status,
      issuetype: ri.fields?.issuetype,
      labels: ri.fields?.labels || [],
      created: ri.fields?.created
    }
  }));

  // For now, no committedKeys from request payload; pass empty array.
  const metrics = computeMetrics(issues, { committedKeys: [], sprintStart: (req.window as any)?.start });

  const reportPayload = {
    requestId,
    generatedAt: new Date().toISOString(),
    metrics,
    totalIssues: issues.length
  };

  try {
    await cache.setCache(cacheKey, reportPayload, REPORT_CACHE_TTL_SECONDS);
    log.info(`cache: SET key=${cacheKey}`);
  } catch (err) {
    log.info('cache set failed', { err });
  }

  return { cached: false, payload: reportPayload };
}

export default {
  buildReport
};
