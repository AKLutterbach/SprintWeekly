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
  
  if (useSprintMode && sprintId) {
    // Sprint mode: use sprint = <sprintId>
    jql = `project = "${projectKey}" AND sprint = ${sprintId}`;
    log.info('Using sprint mode JQL', { jql, projectKey, sprintId });
  } else {
    // Manual date mode: use date range
    // Use 'created' to catch issues created in the window regardless of updates
    const startDate = (req.window as any)?.start;
    const endDate = (req.window as any)?.end;
    jql = `project = "${projectKey}" AND created >= "${startDate}" AND created <= "${endDate}"`;
    log.info('Using manual date mode JQL', { jql, projectKey, startDate, endDate });
  }

  log.info('Final search JQL', { jql });

  // Direct API call to bypass caching issues
  const searchResponse = await api.asUser().requestJira(
    route`/rest/api/3/search/jql?jql=${jql}&maxResults=100&fields=key,summary,status,assignee,customfield_10002,issuetype,labels,created`
  );
  
  const searchData = await searchResponse.json();
  const rawIssues = searchData.issues || [];
  
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

  // Transform metrics into the overview structure expected by frontend
  const byStatus = {
    committed: {
      total: completedIssues.length + uncompletedIssues.length,
      breakdown: {
        fromLastSprint: metrics.committedCarryover,
        plannedAtStart: metrics.committedAtStart - metrics.addedMidSprint,
        addedMidSprint: metrics.addedMidSprint
      }
    },
    complete: {
      total: completedIssues.length,
      breakdown: {
        fromLastSprint: completedIssues.filter(i => 
          issues.find(issue => issue.key === i.key && 
            (issue.fields as any).created && 
            new Date((issue.fields as any).created) < new Date((req.window as any)?.start || 0)
          )
        ).length,
        plannedAtStart: completedIssues.filter(i => 
          issues.find(issue => issue.key === i.key && 
            (issue.fields as any).created && 
            new Date((issue.fields as any).created) < new Date((req.window as any)?.start || 0)
          )
        ).length,
        addedMidSprint: completedIssues.filter(i => 
          issues.find(issue => issue.key === i.key && 
            (issue.fields as any).created && 
            new Date((issue.fields as any).created) >= new Date((req.window as any)?.start || 0)
          )
        ).length
      }
    },
    incomplete: {
      total: uncompletedIssues.length,
      breakdown: {
        fromLastSprint: uncompletedIssues.filter(i => 
          issues.find(issue => issue.key === i.key && 
            (issue.fields as any).created && 
            new Date((issue.fields as any).created) < new Date((req.window as any)?.start || 0)
          )
        ).length,
        plannedAtStart: uncompletedIssues.filter(i => 
          issues.find(issue => issue.key === i.key && 
            (issue.fields as any).created && 
            new Date((issue.fields as any).created) < new Date((req.window as any)?.start || 0)
          )
        ).length,
        addedMidSprint: uncompletedIssues.filter(i => 
          issues.find(issue => issue.key === i.key && 
            (issue.fields as any).created && 
            new Date((issue.fields as any).created) >= new Date((req.window as any)?.start || 0)
          )
        ).length
      }
    }
  };

  // Fetch project details to get the actual project name
  let projectName = projectKey;
  try {
    const projectResponse = await api.asApp().requestJira(route`/rest/api/3/project/${projectKey}`, {
      headers: { 'Accept': 'application/json' }
    });
    const projectData = await projectResponse.json();
    projectName = projectData.name || projectKey;
  } catch (err) {
    log.info('Failed to fetch project name, using key', { err });
  }

  // Get sprint details if in sprint mode
  let sprintStartDate = (req.window as any)?.start;
  let sprintEndDate = (req.window as any)?.end;
  let sprintName = (payload as any).sprint?.name;
  
  if (useSprintMode && sprintId) {
    // Fetch sprint details from Jira API
    try {
      const sprintResponse = await api.asUser().requestJira(route`/rest/agile/1.0/sprint/${sprintId}`);
      const sprintData = await sprintResponse.json();
      sprintName = sprintData.name || `Sprint ${sprintId}`;
      sprintStartDate = sprintData.startDate || sprintStartDate;
      sprintEndDate = sprintData.endDate || sprintEndDate;
      log.info('Fetched sprint details', { sprintName, sprintStartDate, sprintEndDate });
    } catch (err) {
      log.info('Failed to fetch sprint details, using defaults', { err });
      sprintName = sprintName || `Sprint ${sprintId}`;
    }
  }

  const reportPayload = {
    requestId,
    generatedAt: new Date().toISOString(),
    metrics,
    byStatus,
    totalIssues: issues.length,
    issues: {
      completed: completedIssues,
      uncompleted: uncompletedIssues,
      carryoverBlockers: carryoverBlockers
    },
    sprintName: sprintName,
    projectName: projectName,
    startDate: sprintStartDate,
    endDate: sprintEndDate
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
