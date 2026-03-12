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
  const cacheKey = cache.makeCacheKey('report_v3', scopeRef, sprintId || (req.window && (req.window as any).start) || '', JSON.stringify(req.metrics || []));
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

  // Fetch issues for the current sprint. customfield_10002 is story points.
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

  // Fetch sprint details now — we need originBoardId for carry-over detection
  // and sprintStartDate for mid-sprint detection, both done below.
  let sprintStartDate: string | undefined = (req.window as any)?.start;
  let sprintEndDate: string | undefined = (req.window as any)?.end;
  let sprintName: string | undefined = (payload as any).sprint?.name;
  let sprintData: any = null;

  if (useSprintMode && sprintId) {
    try {
      const sprintResponse = await api.asUser().requestJira(route`/rest/agile/1.0/sprint/${sprintId}`);
      sprintData = await sprintResponse.json();
      sprintName = sprintData.name || `Sprint ${sprintId}`;
      sprintStartDate = sprintData.startDate || sprintStartDate;
      sprintEndDate = sprintData.endDate || sprintEndDate;
      log.info('Fetched sprint details', { sprintName, sprintStartDate, sprintEndDate, boardId: sprintData.originBoardId });
    } catch (err) {
      log.info('Failed to fetch sprint details, using defaults', { err });
      sprintName = sprintName || `Sprint ${sprintId}`;
    }
  }

  // Fetch project details to get the actual project name.
  let projectName: string = projectKey;
  try {
    const projectResponse = await api.asApp().requestJira(route`/rest/api/3/project/${projectKey}`, {
      headers: { 'Accept': 'application/json' }
    });
    const projectData = await projectResponse.json();
    projectName = projectData.name || projectKey;
  } catch (err) {
    log.info('Failed to fetch project name, using key', { err });
  }

  // --- Carry-over detection via previous sprint query ---
  //
  // We find the most recently closed sprint on the same board, then ask Jira
  // which of our current sprint's issues were ALSO in that previous sprint.
  // This is far more reliable than reading customfield_10020, which only
  // contains active sprint membership in most Jira configurations.
  const currentSprintIdNum = sprintId ? parseInt(String(sprintId), 10) : null;
  const carryOverKeys = new Set<string>();

  if (useSprintMode && currentSprintIdNum && rawIssues.length > 0) {
    try {
      // originBoardId is available on the sprint object we already fetched above.
      const boardId = (sprintData as any)?.originBoardId;

      if (boardId) {
        // Get the most recently closed sprints for this board.
        const boardSprintsRes = await api.asUser().requestJira(
          route`/rest/agile/1.0/board/${String(boardId)}/sprint?state=closed&maxResults=50`
        );
        const boardSprintsData = await boardSprintsRes.json();
        const closedSprints: any[] = boardSprintsData.values || [];

        // The previous sprint is the closed sprint with the highest ID that is
        // still less than the current sprint ID.
        const prevSprint = closedSprints
          .filter((s: any) => s.id < currentSprintIdNum)
          .sort((a: any, b: any) => b.id - a.id)[0];

        if (prevSprint) {
          log.info('Previous sprint found', { prevSprintId: prevSprint.id, prevSprintName: prevSprint.name });

          // Build a comma-separated list of current issue keys to scope the JQL.
          // NOTE: the JQL field name is "key" (not "issueKey").
          const keyList = rawIssues.map((ri: any) => ri.key).join(',');
          const prevJql = `sprint = ${prevSprint.id} AND key IN (${keyList})`;

          const prevSprintRes = await api.asUser().requestJira(
            route`/rest/api/3/search/jql?jql=${prevJql}&maxResults=100&fields=key`
          );
          const prevSprintData = await prevSprintRes.json();

          for (const issue of (prevSprintData.issues || [])) {
            if (issue.key) carryOverKeys.add(issue.key);
          }

          log.info('Carry-over detection via previous sprint query', {
            prevSprintId: prevSprint.id,
            carryOverCount: carryOverKeys.size,
            carryOverKeys: Array.from(carryOverKeys)
          });
        } else {
          log.info('No previous sprint found for board', { boardId, currentSprintId: currentSprintIdNum });
        }
      } else {
        log.info('No originBoardId on sprint, skipping carry-over detection');
      }
    } catch (err) {
      // Non-fatal: if previous sprint query fails, carry-over counts will show 0.
      log.info('Carry-over detection failed, continuing without it', { err });
    }
  }

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

  // Count carry-overs and mid-sprint additions within each status bucket.
  //
  // Origin precedence (mirrors computeMetrics.ts):
  //   1. "fromLastSprint"  – was in any previous sprint (via customfield_10020)
  //   2. "addedMidSprint"  – created AFTER sprint start AND NOT a carry-over
  //   3. "plannedAtStart"  – everything else
  //
  // We need sprintStartDate (fetched above) to detect mid-sprint additions.
  const sprintStartParsed = sprintStartDate ? new Date(sprintStartDate) : null;

  // Build a Set of issue keys that were created after the sprint started and are
  // not carry-overs.  We look at the full `issues` array which carries `fields.created`.
  const midSprintKeys = new Set<string>();
  if (sprintStartParsed) {
    for (const issue of issues) {
      const key = issue.key || '';
      if (carryOverKeys.has(key)) continue; // carry-over takes precedence
      const created = issue.fields.created;
      if (created && new Date(created) > sprintStartParsed) {
        midSprintKeys.add(key);
      }
    }
    log.info('Mid-sprint detection', {
      sprintStartDate,
      midSprintCount: midSprintKeys.size,
      midSprintKeys: Array.from(midSprintKeys)
    });
  }

  const completedFromLastSprint = completedIssues.filter(i => i.key && carryOverKeys.has(i.key)).length;
  const completedMidSprint      = completedIssues.filter(i => i.key && midSprintKeys.has(i.key)).length;

  const incompleteFromLastSprint = uncompletedIssues.filter(i => i.key && carryOverKeys.has(i.key)).length;
  const incompleteMidSprint      = uncompletedIssues.filter(i => i.key && midSprintKeys.has(i.key)).length;

  // Further split uncompleted into "In Progress" vs "To Do" so the export
  // renderer can show per-column sub-counts without proportional guessing.
  const inProgressIssues = uncompletedIssues.filter(i =>
    (i.status || '').toLowerCase().includes('progress')
  );
  const toDoIssues = uncompletedIssues.filter(i =>
    !(i.status || '').toLowerCase().includes('progress')
  );

  const ipFromLastSprint = inProgressIssues.filter(i => i.key && carryOverKeys.has(i.key)).length;
  const ipMidSprint      = inProgressIssues.filter(i => i.key && midSprintKeys.has(i.key)).length;
  const tdFromLastSprint = toDoIssues.filter(i => i.key && carryOverKeys.has(i.key)).length;
  const tdMidSprint      = toDoIssues.filter(i => i.key && midSprintKeys.has(i.key)).length;

  const totalFromLastSprint = carryOverKeys.size;
  const totalMidSprint      = midSprintKeys.size;
  const totalIssuesInSprint = completedIssues.length + uncompletedIssues.length;

  const byStatus = {
    committed: {
      // "committed" = in sprint at start = total minus those added mid-sprint
      total: totalIssuesInSprint - totalMidSprint,
      breakdown: {
        fromLastSprint: totalFromLastSprint,
        plannedAtStart: totalIssuesInSprint - totalMidSprint - totalFromLastSprint,
        addedMidSprint: 0  // mid-sprint issues are not part of the committed count
      }
    },
    complete: {
      total: completedIssues.length,
      breakdown: {
        fromLastSprint: completedFromLastSprint,
        plannedAtStart: completedIssues.length - completedFromLastSprint - completedMidSprint,
        addedMidSprint: completedMidSprint
      }
    },
    incomplete: {
      total: uncompletedIssues.length,
      breakdown: {
        fromLastSprint: incompleteFromLastSprint,
        plannedAtStart: uncompletedIssues.length - incompleteFromLastSprint - incompleteMidSprint,
        addedMidSprint: incompleteMidSprint
      }
    },
    // Granular In Progress / To Do sub-counts so the export doesn't
    // have to guess via proportional splitting.
    inProgress: {
      total: inProgressIssues.length,
      breakdown: {
        fromLastSprint: ipFromLastSprint,
        plannedAtStart: inProgressIssues.length - ipFromLastSprint - ipMidSprint,
        addedMidSprint: ipMidSprint
      }
    },
    toDo: {
      total: toDoIssues.length,
      breakdown: {
        fromLastSprint: tdFromLastSprint,
        plannedAtStart: toDoIssues.length - tdFromLastSprint - tdMidSprint,
        addedMidSprint: tdMidSprint
      }
    }
  };

  const reportPayload = {
    requestId,
    generatedAt: new Date().toISOString(),
    metrics,
    byStatus,
    totalIssues: issues.length,
    issues: {
      completed: completedIssues,
      uncompleted: uncompletedIssues,
      // Pre-split In Progress and To Do lists so consumers (frontend preview & PDF
      // export) never need to independently re-filter issues.  This guarantees the
      // detail tables always match the metric card totals from byStatus.
      inProgress: inProgressIssues,
      toDo: toDoIssues,
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
