/**
 * Unit tests for `src/lib/jira.ts` using a mocked `@forge/api` module.
 */

jest.mock('@forge/api', () => {
  // mocked `route` as a tagged template function that joins parts
  const route = (strings: TemplateStringsArray, ...values: any[]) => {
    let out = '';
    strings.forEach((s, i) => {
      out += s + (values[i] !== undefined ? String(values[i]) : '');
    });
    return out;
  };

  // asUser returns an object with requestJira which we'll override per-test.
  // Use a let binding to avoid referencing the variable in its own initializer.
  const asUserMock: any = jest.fn();
  asUserMock.__mockImpl = jest.fn();
  asUserMock.mockImplementation(() => ({ requestJira: asUserMock.__mockImpl }));

  return { asUser: asUserMock, route };
});

import { asUser } from '@forge/api';
import jira from '../src/lib/jira';

describe('jira helpers', () => {
  beforeEach(() => {
    (asUser as any).__mockImpl.mockReset();
  });

  test('expandScopeToJQL returns project JQL for project scope', async () => {
    const jql = await jira.expandScopeToJQL({ type: 'project', id: 'PRJ' });
    expect(jql).toBe('project = PRJ');
  });

  test('expandScopeToJQL returns jql verbatim for jql scope', async () => {
    const q = 'project = PRJ and status = Done';
    const jql = await jira.expandScopeToJQL({ type: 'jql', jql: q });
    expect(jql).toBe(q);
  });

  test('expandScopeToJQL resolves board to multiple projects', async () => {
    // first call to requestJira (board) returns an object without projectKey
    (asUser as any).__mockImpl
      .mockImplementationOnce(async () => ({ status: 200, json: async () => ({ id: 1, location: {} }) }))
      // second call returns project list
      .mockImplementationOnce(async () => ({ status: 200, json: async () => ([{ key: 'PRJ' }, { key: 'OTHER' }]) }));

    const jql = await jira.expandScopeToJQL({ type: 'board', id: '123' });
    expect(jql).toBe('(project = PRJ OR project = OTHER)');
  });
});
