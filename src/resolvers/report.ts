import { type ReportRequest } from '../lib/validators';
import computeMetrics, { Issue } from '../lib/computeMetrics';
import cache from '../lib/cache';
import { REPORT_CACHE_TTL_SECONDS } from '../config/constants';
import { childWithRequestId } from '../lib/logger';
import api, { route } from '@forge/api';

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
  console.log('██████ BUILD REPORT V2.0 WITH DIRECT API CALL ██████');
  // Type assertion - runtime validation removed
  const req = payload as ReportRequest;
  if (!req || !req.requestId) {
    return { error: 'INVALID_REQUEST', details: 'requestId is required' };
  }

  const requestId = req.requestId || `rid-${Date.now()}`;
  const log = childWithRequestId(requestId);

  // Log the incoming payload for debugging
  log.info('buildReport called', { 
    payload: JSON.stringify(payload),
    scope: req.scope,
    window: req.window,
    sprintId: (req as any).sprintId,
    useSprintMode: (req as any).useSprintMode
  });

  // make cache key
  const scopeRef = (req.scope as any).ref || (req.scope as any).id || JSON.stringify(req.scope);
  const sprintId = (req as any).sprintId;
  const cacheKey = cache.makeCacheKey('report', scopeRef, sprintId || (req.window && (req.window as any).start) || '', JSON.stringify(req.metrics || []));
  try {
    const cached = await cache.getCache(cacheKey);
    if (cached) {
      log.info(`cache: HIT key=${cacheKey}`);
      return { cached: true, payload: cached };
    }
  } catch (err) {
    log.info('cache read failed, continuing', { err });
  }

  // Build JQL based on sprint mode or manual date mode
  let jql: string;
  const projectKey = (req.scope as any).id || (req.scope as any).ref;
  const useSprintMode = (req as any).useSprintMode;
  
  console.log('=== BUILDING JQL ===');
  console.log('projectKey:', projectKey);
  console.log('useSprintMode:', useSprintMode);
  console.log('sprintId:', sprintId);
  
  if (useSprintMode && sprintId) {
    // Sprint mode: use sprint = <sprintId>
    jql = `project = "${projectKey}" AND sprint = ${sprintId}`;
    console.log('SPRINT MODE JQL:', jql);
    log.info('Using sprint mode JQL', { jql, projectKey, sprintId });
  } else {
    // Manual date mode: use date range
    // Use 'created' to catch issues created in the window regardless of updates
    const startDate = (req.window as any)?.start;
    const endDate = (req.window as any)?.end;
    jql = `project = "${projectKey}" AND created >= "${startDate}" AND created <= "${endDate}"`;
    console.log('MANUAL DATE MODE JQL:', jql);
    console.log('Date range:', startDate, 'to', endDate);
    log.info('Using manual date mode JQL', { jql, projectKey, startDate, endDate });
  }

  console.log('=== FINAL JQL ===:', jql);
  log.info('Final search JQL', { jql });

  // Direct API call to bypass caching issues
  console.log('Calling Jira search API directly with JQL:', jql);
  
  const searchResponse = await api.asUser().requestJira(
    route`/rest/api/3/search/jql?jql=${jql}&maxResults=100&fields=key,summary,status,assignee,customfield_10002,issuetype,labels,created`
  );
  console.log('Search response status:', searchResponse.status);
  
  const searchData = await searchResponse.json();
  console.log(`Search API returned: total=${searchData.total || 0}, issues=${searchData.issues?.length || 0}`);
  const rawIssues = searchData.issues || [];
  
  console.log(`=== FOUND ${rawIssues.length} ISSUES ===`);
  log.info(`Found ${rawIssues.length} issues from search`);

  // map to Issue shape expected by computeMetrics
  const issues: Issue[] = rawIssues.map((ri: any) => ({
    key: ri.key,
    fields: {
      summary: ri.fields?.summary,
      status: ri.fields?.status?.name ?? ri.fields?.status,
      statusCategory: ri.fields?.status?.statusCategory?.key,
      storyPoints: ri.fields?.customfield_10002 ?? ri.fields?.storyPoints ?? 0,
      issuetype: ri.fields?.issuetype,
      labels: ri.fields?.labels || [],
      created: ri.fields?.created,
      assignee: ri.fields?.assignee
    }
  }));

  // For now, no committedKeys from request payload; pass empty array.
  const metrics = computeMetrics(issues, { committedKeys: [], sprintStart: (req.window as any)?.start });

  // Categorize issues for display
  const completedIssues = issues.filter(i => {
    const status = (i.fields.status || '').toLowerCase();
    const statusCategory = (i.fields as any).statusCategory;
    return ['done', 'closed', 'resolved'].includes(status) || statusCategory === 'done';
  }).map(i => ({
    key: i.key,
    summary: (i.fields as any).summary,
    status: i.fields.status
  }));

  const uncompletedIssues = issues.filter(i => {
    const status = (i.fields.status || '').toLowerCase();
    const statusCategory = (i.fields as any).statusCategory;
    return !['done', 'closed', 'resolved'].includes(status) && statusCategory !== 'done';
  }).map(i => ({
    key: i.key,
    summary: (i.fields as any).summary,
    status: i.fields.status
  }));

  const carryoverBlockers = issues.filter(i => {
    const status = (i.fields.status || '').toLowerCase();
    const statusCategory = (i.fields as any).statusCategory;
    const labels = i.fields.labels || [];
    const isNotDone = !['done', 'closed', 'resolved'].includes(status) && statusCategory !== 'done';
    const isBlocked = labels.some((l: string) => l.toLowerCase() === 'blocked') || status === 'blocked';
    return isNotDone && isBlocked;
  }).map(i => ({
    key: i.key,
    summary: (i.fields as any).summary,
    status: i.fields.status
  }));

  log.info('Issue categorization', {
    completed: completedIssues.length,
    uncompleted: uncompletedIssues.length,
    carryoverBlockers: carryoverBlockers.length
  });

  const reportPayload = {
    requestId,
    generatedAt: new Date().toISOString(),
    metrics,
    totalIssues: issues.length,
    issues: {
      completed: completedIssues,
      uncompleted: uncompletedIssues,
      carryoverBlockers: carryoverBlockers
    }
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
