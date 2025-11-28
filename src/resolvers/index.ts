import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import * as cache from '../lib/cache';
import createForgeBackend from '../lib/cacheForgeBackend';
import { buildReport } from './report';
import { exportReport } from './export';

const resolver = new Resolver();

// Attempt to wire Forge storage backend when available
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const { asApp } = require('@forge/api');
  if (asApp && typeof asApp === 'function') {
    const storageClient = asApp().storage;
    if (storageClient) {
      const backend = createForgeBackend(storageClient);
      cache.setBackend(backend);
    }
  }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_) {
  // ignore - use default in-memory backend
}

resolver.define('getText', () => {
  return 'Hello, world!';
});

// Wire report.build to our typed implementation
resolver.define('report.build', async (req) => {
  // Debug logging
  console.log('report.build called with req:', JSON.stringify(req));
  
  // Our typed buildReport expects the payload object
  // When called from invoke(), the payload is the first arg directly
  const payload = (req && req.payload) ? req.payload : req;
  console.log('Extracted payload:', JSON.stringify(payload));
  
  const result = await buildReport(payload);
  console.log('buildReport returned:', JSON.stringify(result));
  
  return result;
});

// Get all projects accessible to the user
resolver.define('getProjects', async () => {
  console.log('getProjects called');
  
  try {
    const response = await api.asUser().requestJira(route`/rest/api/3/project/search?maxResults=100&orderBy=name`);
    const data = await response.json();
    
    if (data && data.values) {
      // Return simplified project list with key and name
      const projects = data.values.map((project: any) => ({
        key: project.key,
        name: project.name,
        id: project.id
      }));
      console.log(`Found ${projects.length} projects`);
      return { projects };
    }
    
    return { projects: [] };
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    return { projects: [], error: error.message };
  }
});

// Get sprints for a specific project
// Note: Team-managed (simplified) boards don't support the Agile API sprint endpoints
// So we use JQL to discover sprints and then fetch their details
resolver.define('getSprintsForProject', async (req) => {
  console.log('getSprintsForProject called with:', JSON.stringify(req));
  
  // Extract payload similar to report.build
  const payload: any = (req && (req as any).payload) ? (req as any).payload : req;
  const projectKey = payload?.projectKey;
  
  if (!projectKey) {
    return { sprints: [], error: 'No project key provided' };
  }
  
  try {
    console.log(`Fetching sprints for project ${projectKey} using JQL approach`);
    
    // Use JQL to find issues with sprint field populated
    // This works for both team-managed and company-managed projects
    const jql = `project = "${projectKey}" AND sprint is not EMPTY ORDER BY sprint DESC`;
    console.log(`Using JQL: ${jql}`);
    
    const issuesResponse = await api.asUser().requestJira(
      route`/rest/api/3/search/jql?jql=${jql}&fields=*all&maxResults=100`
    );
    const issuesData = await issuesResponse.json();
    console.log(`Found ${issuesData.total || 0} issues with sprints`);
    
    if (!issuesData || !issuesData.issues || issuesData.issues.length === 0) {
      console.log(`No issues with sprints found for project ${projectKey}`);
      return { sprints: [] };
    }
    
    // Extract unique sprints from ANY sprint-related field
    const sprintMap = new Map();
    
    for (const issue of issuesData.issues) {
      const fields = issue.fields || {};
      console.log(`Issue ${issue.key} has ${Object.keys(fields).length} fields`);
      
      // Try multiple possible sprint field names
      let sprintField = fields.sprint || fields.customfield_10020 || fields.customfield_10010;
      
      // Also search for any field containing sprint data in its name
      if (!sprintField) {
        const sprintFieldKey = Object.keys(fields).find(key => 
          key.toLowerCase().includes('sprint') && fields[key]
        );
        if (sprintFieldKey) {
          console.log(`Found sprint field: ${sprintFieldKey}`);
          sprintField = fields[sprintFieldKey];
        }
      }
      
      // The sprint field can be an array or a single value
      const sprints = Array.isArray(sprintField) ? sprintField : (sprintField ? [sprintField] : []);
      
      for (const sprint of sprints) {
        if (sprint && sprint.id && !sprintMap.has(sprint.id)) {
          console.log(`Found sprint: ${sprint.id} - ${sprint.name} (${sprint.state})`);
          sprintMap.set(sprint.id, sprint);
        }
      }
    }
    
    if (sprintMap.size === 0) {
      console.log(`No valid sprints extracted for project ${projectKey}`);
      return { sprints: [] };
    }
    
    // Convert to array and sort by start date (most recent first)
    const sprints = Array.from(sprintMap.values())
      .sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateB - dateA;
      })
      .map((sprint: any) => ({
        id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate
    }));
    
    console.log(`Returning ${sprints.length} unique sprints for project ${projectKey}`);
    return { sprints };
  } catch (error: any) {
    console.error('Error fetching sprints:', error);
    return { sprints: [], error: error.message };
  }
});

// Export report as PDF or CSV
resolver.define('export.report', async (req) => {
  console.log('export.report called with:', JSON.stringify(req));
  const payload = (req && req.payload) ? req.payload : req;
  return await exportReport(payload);
});

export const handler = resolver.getDefinitions();

export default handler;
