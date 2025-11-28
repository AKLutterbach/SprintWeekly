// Jira helpers: expand scope to JQL, page search, and sprint date helper.
// This file uses the Forge server-side `@forge/api` helpers via `asUser()` to make
// requests on behalf of the current user. The functions are small, focused, and
// well-documented so they can be unit-tested by mocking the `asUser` client.

import { asUser, route } from '@forge/api';

// Simple scope -> JQL expansion helper. A `scope` may be either:
// - { type: 'project', id: 'PRJKEY' }
// - { type: 'board', id: '123' }
// - { type: 'jql', jql: 'project = PRJ' }
// The function returns a JQL string suitable for use with the Search API.
export type Scope =
  | { type: 'project'; id: string }
  | { type: 'board'; id: string }
  | { type: 'jql'; jql: string };

/**
 * Convert a Scope into a JQL string.
 * - project -> `project = KEY`
 * - board -> fetch board configuration to find the project(s) behind it and return a JQL
 *           limiting to those projects. If board lookup fails, fall back to `issueKey IS NOT NULL`
 * - jql -> returned verbatim
 */
export async function expandScopeToJQL(scope: Scope): Promise<string> {
  if (scope.type === 'jql') {
    return scope.jql;
  }

  if (scope.type === 'project') {
    // simple project filter
    return `project = ${escapeJqlValue(scope.id)}`;
  }

  // scope.type === 'board'
  try {
    const res = await asUser().requestJira(route`/rest/agile/1.0/board/${scope.id}`, {
      method: 'GET'
    });

    if (!res || res.status !== 200) {
      return 'issueKey IS NOT NULL';
    }

    const body = await res.json();
    // The Agile board object can contain a 'location' with project info.
    // If it exposes a projectKey, use project = KEY, otherwise fall back.
    if (body && body.location && body.location.projectKey) {
      return `project = ${escapeJqlValue(body.location.projectKey)}`;
    }

    // Some boards map to multiple projects; fetch associated projects endpoint.
    const projRes = await asUser().requestJira(route`/rest/agile/1.0/board/${scope.id}/project`, {
      method: 'GET'
    });
    if (projRes && projRes.status === 200) {
      const pbody = await projRes.json();
      if (Array.isArray(pbody) && pbody.length > 0) {
        const keys = pbody.map((p: any) => `project = ${escapeJqlValue(p.key)}`);
        return `(${keys.join(' OR ')})`;
      }
    }

    return 'issueKey IS NOT NULL';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    // On any error, return a permissive JQL so callers don't break; caller can
    // detect `partial`/permission problems and surface them in the UI.
    return 'issueKey IS NOT NULL';
  }
}

/**
 * pageSearch: perform JQL search with automatic pagination. Uses `asUser()` to
 * make requests on behalf of the current user and aggregates issues until
 * `maxResults` are collected. Returns an array of issue objects (raw from Jira).
 */
export async function pageSearch(jql: string, fields: string[] = ['*all'], maxResults = 1000): Promise<any[]> {
  const perPage = 50; // Jira default/typical page size for Agile endpoints
  let startAt = 0;
  const collected: any[] = [];

  while (collected.length < maxResults) {
  const url = route`/rest/api/3/search?jql=${jql}&startAt=${startAt}&maxResults=${perPage}&fields=${fields.join(',')}`;
  const res = await asUser().requestJira(url, { method: 'GET' });
    console.log(`pageSearch request: ${url}`);
    console.log(`pageSearch response status: ${res?.status}`);
    
    if (!res || res.status !== 200) {
      // Log the error response for debugging
      try {
        const errorBody = await res?.json();
        console.error(`pageSearch error response:`, JSON.stringify(errorBody));
      } catch {
        console.error(`pageSearch failed with status ${res?.status}, could not parse error`);
      }
      // If we get a permission error or other non-200, stop and return what we have.
      break;
    }

    const body = await res.json();
    console.log(`pageSearch returned ${body?.issues?.length || 0} issues, total: ${body?.total || 0}`);
    if (!body || !Array.isArray(body.issues)) break;

    collected.push(...body.issues);

    if (body.issues.length < perPage) break; // last page
    startAt += body.issues.length;
  }

  console.log(`pageSearch collected ${collected.length} total issues`);
  return collected.slice(0, maxResults);
}

/**
 * getSprintDates: given a boardId and sprintId, return { startDate, endDate } or null.
 * Uses Agile REST endpoints and returns ISO strings when available.
 */
export async function getSprintDates(boardId: string | number, sprintId: string | number): Promise<{ startDate?: string; endDate?: string } | null> {
  try {
  const url = route`/rest/agile/1.0/board/${String(boardId)}/sprint/${String(sprintId)}`;
  const res = await asUser().requestJira(url, { method: 'GET' });
    if (!res || res.status !== 200) return null;
    const body = await res.json();
    return {
      startDate: body?.startDate,
      endDate: body?.endDate
    };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    return null;
  }
}

// Small helper to escape simple JQL values (project keys are usually safe but
// this keeps a consistent approach). We don't perform full JQL escaping here,
// just a conservative wrapper for project keys and simple values.
function escapeJqlValue(v: string) {
  // If value contains whitespace or special chars, wrap in double-quotes and escape existing quotes
  if (/[^A-Za-z0-9_-]/.test(v)) {
    return `"${String(v).replace(/"/g, '\\"')}"`;
  }
  return v;
}

export default {
  expandScopeToJQL,
  pageSearch,
  getSprintDates
};
