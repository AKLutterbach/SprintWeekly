/**
 * confluence.ts — Backend resolvers for publishing sprint reports to Confluence.
 *
 * Handles:
 *  - Saving / loading per-project Confluence publishing config (Forge KV Storage)
 *  - Listing Confluence spaces and pages (for the UI pickers)
 *  - Publishing the sprint report as a native Confluence page + PDF attachment
 *
 * All Confluence operations use the Confluence REST API via confluenceService.ts.
 */

import api, { route, storage } from '@forge/api';
import {
  listSpaces as svcListSpaces,
  listPagesInSpace as svcListPages,
  buildConfluencePageBody,
  createPage,
  attachPdfToPage,
  ConfluenceReportData,
} from '../lib/confluenceService';
import { buildReport } from './report';
import { generatePDF } from './export';

// ─── Storage Keys ────────────────────────────────────────────────────────────

const configStorageKey = (projectKey: string) => `confluence:config:${projectKey}`;
const lastPublishedKey = (projectKey: string) => `confluence:lastPublished:${projectKey}`;

/**
 * Shape of the per-project Confluence publishing config.
 */
interface ConfluenceConfig {
  spaceId: string;       // Target Confluence space ID
  spaceKey: string;      // Target Confluence space key (for display)
  spaceName: string;     // Target Confluence space name (for display)
  parentPageId: string;  // Parent page ID (reports nest under this page)
  parentPageTitle: string; // Parent page title (for display)
  autoPublish: boolean;  // Auto-publish when a sprint closes
  updatedAt: string;     // ISO timestamp of last config update
}

/**
 * Accessor for Forge Storage (app-scoped).
 */
function getStorage() {
  return storage;
}

// ─── Resolver: List Confluence Spaces ────────────────────────────────────────

/**
 * Return all Confluence spaces the current user can see.
 * Called from the UI to populate the space picker dropdown.
 *
 * @returns - { spaces: { id, key, name }[] }
 */
export async function listConfluenceSpaces(): Promise<any> {
  try {
    const spaces = await svcListSpaces();
    return { spaces };
  } catch (err: any) {
    console.error('Error listing Confluence spaces:', err);
    return { spaces: [], error: err.message };
  }
}

// ─── Resolver: List Pages in Space ───────────────────────────────────────────

/**
 * Return top-level pages in a space (for parent-page picker).
 *
 * @param payload - { spaceId: string }
 * @returns       - { pages: { id, title }[] }
 */
export async function listConfluencePages(payload: any): Promise<any> {
  const { spaceId } = payload || {};
  if (!spaceId) return { pages: [] };

  try {
    const pages = await svcListPages(spaceId);
    return { pages };
  } catch (err: any) {
    console.error('Error listing Confluence pages:', err);
    return { pages: [], error: err.message };
  }
}

// ─── Resolver: Get Config ────────────────────────────────────────────────────

/**
 * Load the saved Confluence publishing config for a project.
 *
 * @param payload - { projectKey: string }
 * @returns       - The stored ConfluenceConfig or defaults
 */
export async function getConfluenceConfig(payload: any): Promise<ConfluenceConfig> {
  const { projectKey } = payload || {};
  const defaults: ConfluenceConfig = {
    spaceId: '', spaceKey: '', spaceName: '',
    parentPageId: '', parentPageTitle: '',
    autoPublish: false, updatedAt: '',
  };
  if (!projectKey) return defaults;

  try {
    const stored = await getStorage().get(configStorageKey(projectKey));
    return stored ? (stored as ConfluenceConfig) : defaults;
  } catch (err: any) {
    console.error('Error reading Confluence config:', err);
    return defaults;
  }
}

// ─── Resolver: Save Config ───────────────────────────────────────────────────

/**
 * Persist the Confluence publishing config for a project.
 *
 * @param payload - ConfluenceConfig fields + projectKey
 * @returns       - { success: boolean, error?: string }
 */
export async function saveConfluenceConfig(payload: any): Promise<any> {
  const { projectKey, spaceId, spaceKey, spaceName, parentPageId, parentPageTitle, autoPublish } = payload || {};
  if (!projectKey) return { success: false, error: 'No project key provided.' };

  const config: ConfluenceConfig = {
    spaceId: spaceId || '',
    spaceKey: spaceKey || '',
    spaceName: spaceName || '',
    parentPageId: parentPageId || '',
    parentPageTitle: parentPageTitle || '',
    autoPublish: !!autoPublish,
    updatedAt: new Date().toISOString(),
  };

  try {
    await getStorage().set(configStorageKey(projectKey), config);
    return { success: true };
  } catch (err: any) {
    console.error('Error saving Confluence config:', err);
    return { success: false, error: 'Failed to save Confluence settings.' };
  }
}

// ─── Resolver: Publish to Confluence ─────────────────────────────────────────

/**
 * Create a Confluence page from the sprint report data and attach the PDF.
 * This is the primary action triggered by the "Publish to Confluence" button
 * or automatically on sprint close.
 *
 * @param payload - { projectKey, sprintId?, sprintName, reportData?, startDate?, endDate? }
 * @returns       - { success, pageUrl?, error? }
 */
export async function publishToConfluence(payload: any): Promise<any> {
  const { projectKey, sprintId, sprintName, reportData, startDate, endDate } = payload || {};
  if (!projectKey) return { success: false, error: 'No project key provided.' };

  // Load the Confluence publishing config for this project
  const config = await getConfluenceConfig({ projectKey });
  if (!config.spaceId) {
    return { success: false, error: 'No Confluence space configured. Select a space in the settings.' };
  }

  try {
    // ── Step 1: Ensure we have report data ─────────────────────────────
    let data = reportData;
    if (!data && sprintId && projectKey) {
      const reportResult = await buildReport({
        requestId: `confluence-${Date.now()}`,
        scope: { type: 'project', id: projectKey, ref: projectKey },
        sprintId,
        useSprintMode: true,
        metrics: ['status'],
      });
      data = (reportResult as any).payload || reportResult;
    }
    if (!data) {
      return { success: false, error: 'Could not generate report data.' };
    }

    // ── Step 2: Build the Confluence page body (XHTML) ─────────────────
    // Map issue lists — fall back to uncompleted if inProgress/toDo not split
    const confluenceData: ConfluenceReportData = {
      byStatus: data.byStatus || {
        complete: { total: 0, breakdown: { fromLastSprint: 0, plannedAtStart: 0, addedMidSprint: 0 } },
        inProgress: { total: 0, breakdown: { fromLastSprint: 0, plannedAtStart: 0, addedMidSprint: 0 } },
        toDo: { total: 0, breakdown: { fromLastSprint: 0, plannedAtStart: 0, addedMidSprint: 0 } },
      },
      issues: {
        completed: data.issues?.completed || [],
        inProgress: data.issues?.inProgress || [],
        toDo: data.issues?.toDo || [],
      },
    };

    // Look up the project name for the page title
    const projectName = await getProjectName(projectKey);

    const pageBody = buildConfluencePageBody(
      confluenceData,
      sprintName || 'Sprint Report',
      projectName,
      startDate,
      endDate,
    );

    // ── Step 3: Build a descriptive page title ─────────────────────────
    const fmtDate = (iso?: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    const dateStr = startDate && endDate ? ` (${fmtDate(startDate)} – ${fmtDate(endDate)})` : '';
    const pageTitle = `${sprintName || 'Sprint Report'} — ${projectName}${dateStr}`;

    // ── Step 4: Create the Confluence page ─────────────────────────────
    const { id: pageId, link: pageLink } = await createPage(
      config.spaceId,
      pageTitle,
      pageBody,
      config.parentPageId || undefined,
    );

    // ── Step 5: Generate and attach the PDF ────────────────────────────
    try {
      const pdfBuffer = await generatePDF(
        data,
        sprintName || 'Sprint Report',
        projectName,
        startDate,
        endDate,
      );
      if (pdfBuffer) {
        const pdfFilename = `${(sprintName || 'Sprint-Report').replace(/\s+/g, '-')}_${projectKey}.pdf`;
        await attachPdfToPage(pageId, pdfBuffer, pdfFilename);
      }
    } catch (pdfErr) {
      // PDF attachment is non-critical — the page was already created
      console.error('Failed to attach PDF to Confluence page:', pdfErr);
    }

    // ── Step 6: Persist last-published metadata ────────────────────────
    try {
      await getStorage().set(lastPublishedKey(projectKey), {
        pageId,
        pageUrl: pageLink,
        publishedAt: new Date().toISOString(),
        sprintName: sprintName || 'Sprint Report',
      });
    } catch {
      // Non-critical
    }

    return { success: true, pageUrl: pageLink, pageId };
  } catch (err: any) {
    console.error('Error publishing to Confluence:', err);
    return { success: false, error: `Failed to publish: ${err.message || 'Unknown error'}` };
  }
}

// ─── Resolver: Get Last Published Info ───────────────────────────────────────

/**
 * Fetch the last-published metadata for a project.
 *
 * @param payload - { projectKey: string }
 * @returns       - { pageId, pageUrl, publishedAt, sprintName } or null
 */
export async function getLastPublishedInfo(payload: any): Promise<any> {
  const { projectKey } = payload || {};
  if (!projectKey) return null;

  try {
    return await getStorage().get(lastPublishedKey(projectKey)) || null;
  } catch {
    return null;
  }
}

// ─── Helper: Get Project Name ────────────────────────────────────────────────

/**
 * Look up the human-readable project name from the project key.
 * Falls back to the project key if the API call fails.
 */
async function getProjectName(projectKey: string): Promise<string> {
  try {
    const response = await api.asApp().requestJira(
      route`/rest/api/3/project/${projectKey}`
    );
    const data = await response.json();
    return data?.name || projectKey;
  } catch {
    return projectKey;
  }
}
