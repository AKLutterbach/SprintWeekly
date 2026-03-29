import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke, router } from '@forge/bridge';
import SprintReportPage from './components/SprintReportPage';
import type { SprintReportData } from './types';
import './index.css';

/**
 * Sprint Weekly Custom UI Entry Point
 * 
 * This app uses Custom UI (normal React + HTML/CSS) to render the sprint report
 * with exact styling that matches the PDF export.
 */

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<SprintReportData | null>(null);
  
  // Initial loading state for fetching projects and sprints
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Project and sprint state
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [sprints, setSprints] = useState<any[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<number | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingSprints, setLoadingSprints] = useState(false);
  
  // Date mode state
  const [useSprintMode, setUseSprintMode] = useState(true);
  const [manualStartDate, setManualStartDate] = useState('');
  const [manualEndDate, setManualEndDate] = useState('');

  // Panel state - centered modal for delivery settings
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

  // Feedback dropdown state
  const [feedbackMenuOpen, setFeedbackMenuOpen] = useState(false);
  // Briefly true after user copies the email address
  const [feedbackCopied, setFeedbackCopied] = useState(false);

  // ─── Email Delivery State ────────────────────────────────────────────
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [autoSendOnClose, setAutoSendOnClose] = useState(false);  const [companyName, setCompanyName] = useState('');  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [lastSentInfo, setLastSentInfo] = useState<any>(null);
  const [emailConfigLoading, setEmailConfigLoading] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);

  // ─── Confluence Publishing State ─────────────────────────────────────
  const [confluenceSpaces, setConfluenceSpaces] = useState<any[]>([]);
  const [confluencePages, setConfluencePages] = useState<any[]>([]);
  const [confluenceConfig, setConfluenceConfig] = useState<any>({
    spaceId: '', spaceKey: '', spaceName: '',
    parentPageId: '', parentPageTitle: '',
    autoPublish: false,
  });
  const [confluenceConfigLoading, setConfluenceConfigLoading] = useState(false);
  const [confluenceSaving, setConfluenceSaving] = useState(false);
  const [confluencePublishing, setConfluencePublishing] = useState(false);
  const [confluenceError, setConfluenceError] = useState<string | null>(null);
  const [confluenceSuccess, setConfluenceSuccess] = useState<string | null>(null);
  const [lastPublishedInfo, setLastPublishedInfo] = useState<any>(null);

  // ─── Load email config whenever the selected project changes ──────
  useEffect(() => {
    if (!selectedProject) return;
    const loadEmailConfig = async () => {
      setEmailConfigLoading(true);
      try {
        const [config, lastSent] = await Promise.all([
          invoke('email.getRecipients', { projectKey: selectedProject }),
          invoke('email.getLastSent', { projectKey: selectedProject }),
        ]) as [any, any];
        if (config) {
          setEmailRecipients(config.emails || []);
          setAutoSendOnClose(!!config.autoSendOnClose);
          setCompanyName(config.companyName || '');
        }
        setLastSentInfo(lastSent || null);
      } catch (err) {
        console.error('Failed to load email config:', err);
      } finally {
        setEmailConfigLoading(false);
      }
    };
    loadEmailConfig();
  }, [selectedProject]);

  // ─── Load Confluence config + spaces whenever the selected project changes ──
  useEffect(() => {
    if (!selectedProject) return;
    const loadConfluenceConfig = async () => {
      setConfluenceConfigLoading(true);
      try {
        const [config, lastPublished, spacesResult] = await Promise.all([
          invoke('confluence.getConfig', { projectKey: selectedProject }),
          invoke('confluence.getLastPublished', { projectKey: selectedProject }),
          invoke('confluence.listSpaces'),
        ]) as [any, any, any];
        if (config) {
          setConfluenceConfig({
            spaceId: config.spaceId || '',
            spaceKey: config.spaceKey || '',
            spaceName: config.spaceName || '',
            parentPageId: config.parentPageId || '',
            parentPageTitle: config.parentPageTitle || '',
            autoPublish: !!config.autoPublish,
          });
          // If a space is already selected, load its pages for the parent picker
          if (config.spaceId) {
            const pagesResult = await invoke('confluence.listPages', { spaceId: config.spaceId }) as any;
            setConfluencePages(pagesResult?.pages || []);
          }
        }
        setLastPublishedInfo(lastPublished || null);
        setConfluenceSpaces(spacesResult?.spaces || []);
      } catch (err) {
        console.error('Failed to load Confluence config:', err);
      } finally {
        setConfluenceConfigLoading(false);
      }
    };
    loadConfluenceConfig();
  }, [selectedProject]);

  // ─── Confluence helper functions ────────────────────────────────────
  const saveConfluenceSettings = async (overrides?: any) => {
    if (!selectedProject) return;
    setConfluenceSaving(true);
    const merged = { ...confluenceConfig, ...overrides };
    try {
      await invoke('confluence.saveConfig', {
        projectKey: selectedProject,
        ...merged,
      });
      setConfluenceConfig(merged);
    } catch (err) {
      console.error('Failed to save Confluence config:', err);
    } finally {
      setConfluenceSaving(false);
    }
  };

  const handleConfluenceSpaceChange = async (spaceId: string) => {
    const space = confluenceSpaces.find((s: any) => s.id === spaceId);
    const updates = {
      spaceId,
      spaceKey: space?.key || '',
      spaceName: space?.name || '',
      parentPageId: '',
      parentPageTitle: '',
    };
    setConfluenceConfig((prev: any) => ({ ...prev, ...updates }));
    // Load pages for the selected space
    if (spaceId) {
      try {
        const result = await invoke('confluence.listPages', { spaceId }) as any;
        setConfluencePages(result?.pages || []);
      } catch {
        setConfluencePages([]);
      }
    } else {
      setConfluencePages([]);
    }
    await saveConfluenceSettings(updates);
  };

  const handleConfluenceParentChange = async (pageId: string) => {
    const page = confluencePages.find((p: any) => p.id === pageId);
    const updates = { parentPageId: pageId, parentPageTitle: page?.title || '' };
    setConfluenceConfig((prev: any) => ({ ...prev, ...updates }));
    await saveConfluenceSettings(updates);
  };

  const toggleAutoPublish = async () => {
    const newVal = !confluenceConfig.autoPublish;
    setConfluenceConfig((prev: any) => ({ ...prev, autoPublish: newVal }));
    await saveConfluenceSettings({ autoPublish: newVal });
  };

  const handlePublishToConfluence = async () => {
    if (!selectedProject || !confluenceConfig.spaceId) return;
    setConfluencePublishing(true);
    setConfluenceError(null);
    setConfluenceSuccess(null);
    try {
      const sprintObj = sprints.find(s => s.id === selectedSprint);
      const result = await invoke('confluence.publish', {
        projectKey: selectedProject,
        sprintId: selectedSprint,
        sprintName: sprintObj?.name || 'Sprint Report',
        reportData: reportData ? {
          requestId: `confluence-${Date.now()}`,
          generatedAt: new Date().toISOString(),
          scope: { type: 'project', id: selectedProject },
          metrics: (reportData as any).metrics || {},
          byStatus: (reportData as any).overview ? {
            complete: (reportData as any).overview.complete || (reportData as any).overview.completed,
            inProgress: (reportData as any).overview.inProgress,
            toDo: (reportData as any).overview.toDo,
          } : {},
          issues: reportData.issues || {},
        } : undefined,
        startDate: sprintObj?.startDate,
        endDate: sprintObj?.endDate,
      }) as any;
      if (result?.success) {
        setConfluenceSuccess('Published to Confluence!');
        setLastPublishedInfo({
          publishedAt: new Date().toISOString(),
          sprintName: sprintObj?.name,
          pageUrl: result.pageUrl,
          pageId: result.pageId,
        });
        setTimeout(() => setConfluenceSuccess(null), 5000);
      } else {
        setConfluenceError(result?.error || 'Failed to publish.');
      }
    } catch (err: any) {
      setConfluenceError(err.message || 'Failed to publish to Confluence.');
    } finally {
      setConfluencePublishing(false);
    }
  };

  // ─── Email helper functions ─────────────────────────────────────────
  const addRecipient = () => {
    const email = newEmailInput.trim().toLowerCase();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    if (emailRecipients.includes(email)) {
      setEmailError('This email is already in the list.');
      return;
    }
    if (emailRecipients.length >= 8) {
      setEmailError('Maximum 8 recipients allowed.');
      return;
    }
    setEmailError(null);
    const updated = [...emailRecipients, email];
    setEmailRecipients(updated);
    setNewEmailInput('');
    saveEmailConfig(updated, autoSendOnClose, companyName);
  };

  const removeRecipient = (email: string) => {
    const updated = emailRecipients.filter(e => e !== email);
    setEmailRecipients(updated);
    saveEmailConfig(updated, autoSendOnClose, companyName);
  };

  const toggleAutoSend = () => {
    const newValue = !autoSendOnClose;
    setAutoSendOnClose(newValue);
    saveEmailConfig(emailRecipients, newValue, companyName);
  };

  const saveEmailConfig = async (emails: string[], autoSend: boolean, company: string) => {
    if (!selectedProject) return;
    setEmailSaving(true);
    try {
      await invoke('email.saveRecipients', {
        projectKey: selectedProject,
        emails,
        autoSendOnClose: autoSend,
        companyName: company,
      });
    } catch (err) {
      console.error('Failed to save email config:', err);
    } finally {
      setEmailSaving(false);
    }
  };

  const handleSendReport = async () => {
    if (!selectedProject || emailRecipients.length === 0) return;
    setEmailSending(true);
    setEmailError(null);
    setEmailSuccess(null);
    try {
      const sprintObj = sprints.find(s => s.id === selectedSprint);
      // Build the exact same byStatus structure that SprintReportPage.handleExportPDF
      // sends to the PDF export resolver — keeps both PDFs identical.
      // Key fix: overview.completed (past tense) maps to byStatus.complete — NOT overview.complete
      const emailByStatus = reportData?.overview ? {
        committed: {
          total: reportData.overview.committed.total,
          breakdown: reportData.overview.committed.breakdown,
        },
        complete: {
          total: reportData.overview.completed.total,
          breakdown: reportData.overview.completed.breakdown,
        },
        incomplete: {
          total: reportData.overview.incomplete.total,
          breakdown: reportData.overview.incomplete.breakdown,
        },
        ...(reportData.overview.inProgress ? { inProgress: reportData.overview.inProgress } : {}),
        ...(reportData.overview.toDo       ? { toDo: reportData.overview.toDo }             : {}),
      } : {};

      const result = await invoke('email.sendReport', {
        projectKey: selectedProject,
        sprintId: selectedSprint,
        sprintName: sprintObj?.name || 'Sprint Report',
        reportData: reportData ? {
          requestId: `email-${Date.now()}`,
          generatedAt: new Date().toISOString(),
          scope: { type: 'project', id: selectedProject },
          metrics: (reportData as any).metrics || {},
          byStatus: emailByStatus,
          issues: reportData.issues || {},
        } : undefined,
        startDate: sprintObj?.startDate,
        endDate: sprintObj?.endDate,
      }) as any;
      if (result?.success) {
        setEmailSuccess(`Report sent to ${emailRecipients.length} recipient${emailRecipients.length > 1 ? 's' : ''}!`);
        setLastSentInfo({ sentAt: new Date().toISOString(), sprintName: sprintObj?.name, recipientCount: emailRecipients.length });
        setTimeout(() => setEmailSuccess(null), 5000);
      } else {
        setEmailError(result?.error || 'Failed to send email.');
      }
    } catch (err: any) {
      setEmailError(err.message || 'Failed to send email.');
    } finally {
      setEmailSending(false);
    }
  };

  const handleSendTest = async () => {
    if (!selectedProject || emailRecipients.length === 0) return;
    setEmailSending(true);
    setEmailError(null);
    setEmailSuccess(null);
    try {
      const result = await invoke('email.sendTest', {
        projectKey: selectedProject,
      }) as any;
      if (result?.success) {
        setEmailSuccess('Test email sent!');
        setTimeout(() => setEmailSuccess(null), 5000);
      } else {
        setEmailError(result?.error || 'Failed to send test email.');
      }
    } catch (err: any) {
      setEmailError(err.message || 'Failed to send test email.');
    } finally {
      setEmailSending(false);
    }
  };

  // Load projects on mount, pre-selecting the most recently edited project.
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoadingProjects(true);
        setError(null);

        // Kick off both requests in parallel: the project list and the
        // most-recently-updated project key for the current user.
        const [projectsResponse, recentResponse] = await Promise.all([
          invoke('getProjects'),
          invoke('getRecentProjectKey')
        ]) as [any, any];

        if (projectsResponse && projectsResponse.projects) {
          setProjects(projectsResponse.projects);

          // Pre-select the project the user touched most recently.
          // Fall back to the first project in the list if the lookup fails
          // or returns a project the user no longer has access to.
          const recentKey = recentResponse?.projectKey;
          const matchesRecent = recentKey
            ? projectsResponse.projects.find((p: any) => p.key === recentKey)
            : null;

          if (matchesRecent) {
            setSelectedProject(matchesRecent.key);
          } else if (projectsResponse.projects.length > 0) {
            setSelectedProject(projectsResponse.projects[0].key);
          }
        } else if (projectsResponse && projectsResponse.error) {
          setError('Unable to load projects. Please refresh the page or contact your Jira admin if the problem persists.');
        }
      } catch (e: any) {
        console.error('Error loading projects:', e);
        setError('Unable to load projects. Please refresh the page or contact your Jira admin if the problem persists.');
      } finally {
        setLoadingProjects(false);
      }
    };
    
    fetchProjects();
  }, []);

  // Load sprints when project changes
  useEffect(() => {
    if (!selectedProject) {
      setSprints([]);
      setSelectedSprint(null);
      setIsInitialLoading(false);
      return;
    }

    const fetchSprints = async () => {
      try {
        setLoadingSprints(true);
        setError(null);
        setSprints([]);
        setSelectedSprint(null);
        
        const response: any = await invoke('getSprintsForProject', { projectKey: selectedProject });
        if (response && response.sprints) {
          setSprints(response.sprints);
          const activeSprint = response.sprints.find((s: any) => s.state === 'active');
          if (activeSprint) {
            setSelectedSprint(activeSprint.id);
          } else if (response.sprints.length > 0) {
            setSelectedSprint(response.sprints[0].id);
          }
        } else if (response && response.error) {
          setError('Unable to load sprints for this project. The project may not have any sprints yet.');
        }
      } catch (e: any) {
        console.error('Error loading sprints:', e);
        setError('Unable to load sprint data. Please try again or contact your Jira admin if the problem persists.');
      } finally {
        setLoadingSprints(false);
        setIsInitialLoading(false); // Initial load complete
      }
    };

    fetchSprints();
  }, [selectedProject]);

  const generateReport = async () => {
    if (!selectedProject) {
      setError('Please select a project to generate a report.');
      return;
    }

    if (useSprintMode && !selectedSprint) {
      setError('Please select a sprint to generate a report.');
      return;
    }

    if (!useSprintMode && (!manualStartDate || !manualEndDate)) {
      setError('Please select start and end dates to generate a report.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Build the payload structure expected by report.build
      const payload = {
        requestId: `custom-ui-${Date.now()}`,
        scope: {
          id: selectedProject,
          ref: selectedProject
        },
        useSprintMode,
        ...(useSprintMode 
          ? { sprintId: selectedSprint }
          : { 
              window: {
                start: manualStartDate,
                end: manualEndDate
              }
            }
        )
      };

      const result: any = await invoke('report.build', payload);
      
      // Handle cached vs fresh data
      const reportPayload = result.cached ? result.payload : result.payload;
      
      if (reportPayload && (reportPayload.metrics || reportPayload.byStatus)) {
        // Get sprint details for dates if in sprint mode
        const selectedSprintData = useSprintMode ? sprints.find(s => s.id === selectedSprint) : null;
        // Get actual project name from projects list
        const selectedProjectData = projects.find(p => p.key === selectedProject);
        const projectDisplayName = selectedProjectData?.name || selectedProject;
        
        // Transform the data structure to match what SprintReportPage expects
        const transformedData = {
          overview: {
            committed: reportPayload.byStatus?.committed || { total: 0, breakdown: {} },
            completed: reportPayload.byStatus?.complete || { total: 0, breakdown: {} },
            incomplete: reportPayload.byStatus?.incomplete || { total: 0, breakdown: {} },
            inProgress: reportPayload.byStatus?.inProgress || undefined,
            toDo: reportPayload.byStatus?.toDo || undefined
          },
          issues: reportPayload.issues || { completed: [], uncompleted: [] },
          sprintName: reportPayload.sprintName || selectedSprintData?.name || 'Sprint',
          projectName: projectDisplayName,
          projectKey: selectedProject,
          sprintId: selectedSprint || undefined,
          startDate: reportPayload.startDate || selectedSprintData?.startDate || (useSprintMode ? undefined : manualStartDate),
          endDate: reportPayload.endDate || selectedSprintData?.endDate || (useSprintMode ? undefined : manualEndDate)
        };
        
        setReportData(transformedData);
        setHasGeneratedReport(true); // Mark that report has been generated
        setIsDeliveryModalOpen(false); // Close modal after generation
      } else {
        setError('No data available for the selected sprint. The sprint may be empty or have no accessible issues.');
      }
    } catch (e: any) {
      console.error('Error generating report:', e);
      setError('Unable to generate the report. Please try again or contact your Jira admin if the problem persists.');
    } finally {
      setLoading(false);
    }
  };

  const canGenerate = !isInitialLoading && selectedProject && (useSprintMode ? selectedSprint : (manualStartDate && manualEndDate));

  // Render customization controls (reused in both initial card and drawer)
  const renderCustomizationControls = (isDarkMode = false) => {
    const labelColor = isDarkMode ? '#ffffff' : '#6b778c';
    const textColor = isDarkMode ? '#ffffff' : '#172b4d';
    const helperColor = isDarkMode ? '#d4e5ff' : '#6b778c';
    const buttonBg = canGenerate ? (isDarkMode ? '#ffffff' : '#0F2744') : '#5e6c84';
    const buttonText = canGenerate ? (isDarkMode ? '#0F2744' : '#ffffff') : '#172b4d';
    
    return (
    <>
      {/* Project selector */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: labelColor, marginBottom: '4px', display: 'block' }}>
          Project
        </label>
        <select 
          style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #dfe1e6', fontSize: '14px', backgroundColor: '#f4f5f7' }}
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          disabled={isInitialLoading || loadingProjects}
        >
          <option value="">{loadingProjects ? 'Project Loading...' : 'Select Project...'}</option>
          {projects.length === 0 && !loadingProjects && <option value="" disabled>No projects available</option>}
          {projects.map(p => (
            <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
          ))}
        </select>
      </div>

        {/* Sprint selector */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, color: labelColor, marginBottom: '4px', display: 'block' }}>
            Sprint
          </label>
          <select 
            style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #dfe1e6', fontSize: '14px', backgroundColor: '#f4f5f7' }}
            value={selectedSprint?.toString() || ''}
            onChange={(e) => setSelectedSprint(parseInt(e.target.value))}
            disabled={isInitialLoading || loadingSprints || !selectedProject}
          >
            <option value="">{loadingSprints ? 'Sprint Loading...' : 'Select Sprint...'}</option>
            {sprints.length === 0 && !loadingSprints && selectedProject && (
              <option value="" disabled>No sprints available for this project</option>
            )}
            {sprints.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.state})</option>
            ))}
          </select>
        </div>      {/* Use Sprint Mode checkbox with helper text */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <input 
            type="checkbox"
            style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0, marginTop: '2px' }}
            checked={!useSprintMode}
            onChange={(e) => setUseSprintMode(!e.target.checked)}
          />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 400, color: textColor }}>
              Use custom dates
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: helperColor }}>
              When checked, you can specify custom date ranges instead of sprint boundaries.
            </p>
          </div>
        </div>
      </div>

      {/* Manual date range when Sprint Mode is off */}
      {!useSprintMode && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div style={{ flex: '1 1 0' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: labelColor, marginBottom: '4px', display: 'block' }}>
              Start Date
            </label>
            <input 
              type="date"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #dfe1e6', fontSize: '14px' }}
              value={manualStartDate}
              onChange={(e) => setManualStartDate(e.target.value)}
            />
          </div>
          <div style={{ flex: '1 1 0' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: labelColor, marginBottom: '4px', display: 'block' }}>
              End Date
            </label>
            <input 
              type="date"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #dfe1e6', fontSize: '14px' }}
              value={manualEndDate}
              onChange={(e) => setManualEndDate(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Generate Report button at bottom-right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
        <div style={{ flex: '1 1 auto' }} />
        <div style={{ flex: '0 0 auto' }}>
          <button 
            style={{
              padding: '10px 24px',
              backgroundColor: buttonBg,
              color: buttonText,
              border: 'none',
              borderRadius: '4px',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 600
            }}
            onClick={generateReport}
            disabled={!canGenerate || loading || isInitialLoading}
          >
            {loading ? 'Loading...' : 'Generate report'}
          </button>
        </div>
      </div>
    </>
  );
  };

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#e9ebed',
      minHeight: '100vh'
    }}>
      {/* Hero Section - Always visible */}
      <section className="sw-hero-section">
        <div className="sw-hero-inner">
          {/* Header App Bar - Always visible, compact app-bar style */}
          <div className="sw-app-bar">
            {/* Left: logo + branding text */}
            <div className="sw-app-bar-brand">
              <img src="./SprintWeeklyLogo.png" alt="Smart Sprints" className="sw-header-logo" />
              <div>
                <h1 className="sw-header-title">Smart Sprints</h1>
                <p className="sw-header-subtitle">
                  Generate client-ready sprint reports in minutes
                </p>
              </div>
            </div>
            {/* Right: delivery settings + feedback actions */}
            <div className="sw-app-bar-actions">
              {/* Delivery Settings button – only visible after report generation */}
              {hasGeneratedReport && (
                <button
                  className="sw-delivery-settings-btn"
                  type="button"
                  onClick={() => setIsDeliveryModalOpen(true)}
                >
                  {/* Gear icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Delivery Settings
                </button>
              )}
              {/* Transparent fullscreen backdrop closes the menu when clicking outside */}
              {feedbackMenuOpen && (
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 79 }}
                  onClick={() => setFeedbackMenuOpen(false)}
                />
              )}
              <div style={{ position: 'relative', zIndex: 80 }}>
                {/* Main trigger button – toggles the dropdown */}
                <button
                  className={`sw-feedback-btn${feedbackCopied ? ' sw-feedback-btn--copied' : ''}`}
                  type="button"
                  onClick={() => setFeedbackMenuOpen(o => !o)}
                >
                  {/* Speech bubble icon */}
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M14 1H2C1.4 1 1 1.4 1 2v9c0 .6.4 1 1 1h2v3l3.5-3H14c.6 0 1-.4 1-1V2c0-.6-.4-1-1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                  {feedbackCopied ? 'Email copied!' : 'Send feedback'}
                </button>
                {/* Dropdown menu */}
                {feedbackMenuOpen && (
                  <div className="sw-feedback-menu">
                    {/* Option 1: open default email client via mailto: */}
                    <button
                      className="sw-feedback-menu-item"
                      type="button"
                      onClick={() => {
                        setFeedbackMenuOpen(false);
                        router.open('mailto:support@datainsightlab.co?subject=Smart%20Sprints%20Feedback');
                      }}
                    >
                      {/* Envelope icon */}
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M1.5 4.5L8 9.5L14.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      </svg>
                      Open email client
                    </button>
                    {/* Option 2: copy email address to clipboard for manual use */}
                    <button
                      className="sw-feedback-menu-item"
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('support@datainsightlab.co').then(() => {
                          setFeedbackCopied(true);
                          setFeedbackMenuOpen(false);
                          // Reset the copied state after 2.5 seconds
                          setTimeout(() => setFeedbackCopied(false), 2500);
                        });
                      }}
                    >
                      {/* Copy icon */}
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
                        <rect x="5" y="1" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M3 4.5H2C1.4 4.5 1 4.9 1 5.5v8.5c0 .6.4 1 1 1h7.5c.6 0 1-.4 1-1V13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      </svg>
                      <div>
                        <div>Copy email address</div>
                        <div className="sw-feedback-menu-email">support@datainsightlab.co</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Initial Customization Card - Only before report generation */}
          {!hasGeneratedReport && (
            <div 
              className="sw-card sw-customization-card-initial" 
              style={{ 
                position: 'relative', 
                opacity: isInitialLoading ? 0.4 : 1,
                transition: 'opacity 0.3s ease',
                pointerEvents: isInitialLoading ? 'none' : 'auto' 
              }}
            >
              {/* Loading overlay specifically for this card */}
              {isInitialLoading && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  borderRadius: '8px'
                }}>
                  <div className="sw-spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }}></div>
                  <div style={{ marginTop: '12px', fontSize: '14px', color: '#172b4d', fontWeight: 500 }}>
                    Loading project and sprint data...
                  </div>
                </div>
              )}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: '#172b4d' }}>
                  Email Automation
                </h3>
                <p style={{ margin: '0', fontSize: '13px', color: '#6b778c' }}>
                  Select a project and sprint to generate your report.
                </p>
              </div>
              {renderCustomizationControls(false)}
            </div>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 48px', position: 'relative' }}>
        <div style={{ paddingTop: hasGeneratedReport ? '12px' : '40px' }}>
          {error && (
            <div style={{
              backgroundColor: '#ffebe6',
              border: '1px solid #ff5630',
              borderRadius: '4px',
              padding: '16px',
              color: '#bf2600',
              marginBottom: '16px'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              <div>Loading sprint data...</div>
            </div>
          )}

          {reportData && !loading && (
            <div className="sw-card" style={{ padding: '24px' }}>
              <SprintReportPage data={reportData} onRefresh={generateReport} />
            </div>
          )}
        </div>
      </div>

      {/* Delivery Settings Modal - Only after report generation */}
      {hasGeneratedReport && isDeliveryModalOpen && (
        <>
          {/* Modal Backdrop */}
          <div
            className="sw-modal-backdrop"
            onClick={() => setIsDeliveryModalOpen(false)}
          />

          {/* Centered Modal */}
          <div className="sw-delivery-modal">
            {/* Modal Header */}
            <div className="sw-modal-header">
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600, color: '#ffffff' }}>
                  Delivery Settings
                </h3>
                <p style={{ margin: '0', fontSize: '14px', color: '#d4e5ff' }}>
                  Configure email delivery and Confluence publishing on a per-project basis.
                </p>
              </div>
              <button
                className="sw-modal-close-btn"
                onClick={() => setIsDeliveryModalOpen(false)}
                aria-label="Close delivery settings"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Modal Body – scrollable content area */}
            <div className="sw-modal-body">

              {/* ─── Section 1: Email Delivery ─── */}
              <div style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ width: '3px', height: '18px', backgroundColor: '#579DFF', borderRadius: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>Email Delivery</span>
                </div>

                {!selectedProject ? (
                  <p style={{ fontSize: '14px', color: '#d4e5ff', fontStyle: 'italic' }}>
                    Select a project above to configure email delivery.
                  </p>
                ) : emailConfigLoading ? (
                  <p style={{ fontSize: '14px', color: '#d4e5ff' }}>Loading email settings...</p>
                ) : (
                  <>
                    {/* Company name */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', marginBottom: '4px', display: 'block' }}>
                        Company Name
                      </label>
                      <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#d4e5ff' }}>
                        Shown in the email header. Leave blank to use the project name.
                      </p>
                      <input
                        type="text"
                        placeholder="e.g. Acme Corp"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        onBlur={() => saveEmailConfig(emailRecipients, autoSendOnClose, companyName)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.3)', fontSize: '14px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Auto-send toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '10px 12px' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 400, color: '#ffffff' }}>Auto-send on sprint close</div>
                        <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#d4e5ff' }}>
                          Automatically email the report when a sprint is completed.
                        </p>
                      </div>
                      <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', flexShrink: 0, marginLeft: '12px' }}>
                        <input
                          type="checkbox"
                          checked={autoSendOnClose}
                          onChange={toggleAutoSend}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: autoSendOnClose ? '#36b37e' : '#5e6c84',
                          borderRadius: '11px', transition: 'background-color 0.2s',
                        }}>
                          <span style={{
                            position: 'absolute', height: '16px', width: '16px', left: autoSendOnClose ? '21px' : '3px', bottom: '3px',
                            backgroundColor: '#ffffff', borderRadius: '50%', transition: 'left 0.2s',
                          }} />
                        </span>
                      </label>
                    </div>

                    {/* Recipient list */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', marginBottom: '4px', display: 'block' }}>
                        Recipients ({emailRecipients.length}/8)
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="email"
                          placeholder="email@example.com"
                          value={newEmailInput}
                          onChange={(e) => { setNewEmailInput(e.target.value); setEmailError(null); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRecipient(); } }}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.3)', fontSize: '14px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
                          disabled={emailRecipients.length >= 8}
                        />
                        <button
                          onClick={addRecipient}
                          disabled={emailRecipients.length >= 8 || !newEmailInput.trim()}
                          style={{
                            padding: '8px 14px', borderRadius: '4px', border: 'none',
                            backgroundColor: emailRecipients.length >= 8 || !newEmailInput.trim() ? '#5e6c84' : '#ffffff',
                            color: emailRecipients.length >= 8 || !newEmailInput.trim() ? '#172b4d' : '#0F2744',
                            fontSize: '14px', fontWeight: 600, cursor: emailRecipients.length >= 8 || !newEmailInput.trim() ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Email chips */}
                    {emailRecipients.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                        {emailRecipients.map(email => (
                          <span key={email} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '5px 12px', borderRadius: '12px',
                            backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', fontSize: '13px',
                          }}>
                            {email}
                            <button
                              onClick={() => removeRecipient(email)}
                              style={{ background: 'none', border: 'none', color: '#d4e5ff', cursor: 'pointer', padding: '0 0 0 2px', fontSize: '14px', lineHeight: 1 }}
                              aria-label={`Remove ${email}`}
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Error / success messages */}
                    {emailError && (
                      <div style={{ fontSize: '12px', color: '#ff5630', marginBottom: '12px' }}>
                        {emailError}
                      </div>
                    )}
                    {emailSuccess && (
                      <div style={{ fontSize: '12px', color: '#36b37e', marginBottom: '12px' }}>
                        {emailSuccess}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <button
                        onClick={handleSendTest}
                        disabled={emailSending || emailRecipients.length === 0}
                        style={{
                          padding: '9px 16px', borderRadius: '4px', fontSize: '14px', fontWeight: 500,
                          border: '1px solid rgba(255,255,255,0.3)', backgroundColor: 'transparent',
                          color: emailSending || emailRecipients.length === 0 ? '#5e6c84' : '#ffffff',
                          cursor: emailSending || emailRecipients.length === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {emailSending ? 'Sending...' : 'Send Test Email'}
                      </button>
                      {hasGeneratedReport && (
                        <button
                          onClick={handleSendReport}
                          disabled={emailSending || emailRecipients.length === 0}
                          style={{
                            padding: '9px 16px', borderRadius: '4px', fontSize: '14px', fontWeight: 600,
                            border: 'none',
                            backgroundColor: emailSending || emailRecipients.length === 0 ? '#5e6c84' : '#ffffff',
                            color: emailSending || emailRecipients.length === 0 ? '#172b4d' : '#0F2744',
                            cursor: emailSending || emailRecipients.length === 0 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {emailSending ? 'Sending...' : 'Send Report Now'}
                        </button>
                      )}
                    </div>

                    {/* Last sent info */}
                    {lastSentInfo?.sentAt && (
                      <div style={{ marginTop: '12px', fontSize: '12px', color: '#d4e5ff' }}>
                        Last sent: {new Date(lastSentInfo.sentAt).toLocaleString()} — {lastSentInfo.sprintName}
                      </div>
                    )}

                    {/* Saving indicator */}
                    {emailSaving && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#d4e5ff', fontStyle: 'italic' }}>Saving...</div>
                    )}
                  </>
                )}
              </div>

              {/* ─── Section 2: Confluence Publishing ─── */}
              <div style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ width: '3px', height: '18px', backgroundColor: '#579DFF', borderRadius: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>Confluence Publishing</span>
                </div>

                {!selectedProject ? (
                  <p style={{ fontSize: '14px', color: '#d4e5ff', fontStyle: 'italic' }}>
                    Select a project above to configure Confluence publishing.
                  </p>
                ) : confluenceConfigLoading ? (
                  <p style={{ fontSize: '14px', color: '#d4e5ff' }}>Loading Confluence settings...</p>
                ) : (
                  <>
                    {/* Space picker */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', marginBottom: '4px', display: 'block' }}>
                        Confluence Space
                      </label>
                      <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#d4e5ff' }}>
                        Reports will be published as pages in this space.
                      </p>
                      <select
                        value={confluenceConfig.spaceId}
                        onChange={(e) => handleConfluenceSpaceChange(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: '4px',
                          border: '1px solid rgba(255,255,255,0.3)', fontSize: '14px',
                          backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff',
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value="" style={{ color: '#172b4d' }}>Select a space...</option>
                        {confluenceSpaces.map((space: any) => (
                          <option key={space.id} value={space.id} style={{ color: '#172b4d' }}>
                            {space.name} ({space.key})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Parent page picker (only shown when a space is selected) */}
                    {confluenceConfig.spaceId && (
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', marginBottom: '4px', display: 'block' }}>
                          Parent Page <span style={{ fontWeight: 400, color: '#d4e5ff' }}>(optional)</span>
                        </label>
                        <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#d4e5ff' }}>
                          Reports will be nested under this page. Leave blank for top-level.
                        </p>
                        <select
                          value={confluenceConfig.parentPageId}
                          onChange={(e) => handleConfluenceParentChange(e.target.value)}
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.3)', fontSize: '14px',
                            backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff',
                            boxSizing: 'border-box',
                          }}
                        >
                          <option value="" style={{ color: '#172b4d' }}>Top level (no parent)</option>
                          {confluencePages.map((page: any) => (
                            <option key={page.id} value={page.id} style={{ color: '#172b4d' }}>
                              {page.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Auto-publish toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '10px 12px' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 400, color: '#ffffff' }}>Auto-publish on sprint close</div>
                        <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#d4e5ff' }}>
                          Automatically publish the report to Confluence when a sprint closes.
                        </p>
                      </div>
                      <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', flexShrink: 0, marginLeft: '12px' }}>
                        <input
                          type="checkbox"
                          checked={confluenceConfig.autoPublish}
                          onChange={toggleAutoPublish}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: confluenceConfig.autoPublish ? '#36b37e' : '#5e6c84',
                          borderRadius: '11px', transition: 'background-color 0.2s',
                        }}>
                          <span style={{
                            position: 'absolute', height: '16px', width: '16px', left: confluenceConfig.autoPublish ? '21px' : '3px', bottom: '3px',
                            backgroundColor: '#ffffff', borderRadius: '50%', transition: 'left 0.2s',
                          }} />
                        </span>
                      </label>
                    </div>

                    {/* Error / success messages */}
                    {confluenceError && (
                      <div style={{ fontSize: '12px', color: '#ff5630', marginBottom: '12px' }}>
                        {confluenceError}
                      </div>
                    )}
                    {confluenceSuccess && (
                      <div style={{ fontSize: '12px', color: '#36b37e', marginBottom: '12px' }}>
                        {confluenceSuccess}
                      </div>
                    )}

                    {/* Publish button */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {hasGeneratedReport && (
                        <button
                          onClick={handlePublishToConfluence}
                          disabled={confluencePublishing || !confluenceConfig.spaceId}
                          style={{
                            padding: '9px 16px', borderRadius: '4px', fontSize: '14px', fontWeight: 600,
                            border: 'none',
                            backgroundColor: confluencePublishing || !confluenceConfig.spaceId ? '#5e6c84' : '#ffffff',
                            color: confluencePublishing || !confluenceConfig.spaceId ? '#172b4d' : '#0F2744',
                            cursor: confluencePublishing || !confluenceConfig.spaceId ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {confluencePublishing ? 'Publishing...' : 'Publish to Confluence'}
                        </button>
                      )}
                    </div>

                    {/* Last published info */}
                    {lastPublishedInfo?.publishedAt && (
                      <div style={{ marginTop: '12px', fontSize: '12px', color: '#d4e5ff' }}>
                        Last published: {new Date(lastPublishedInfo.publishedAt).toLocaleString()} — {lastPublishedInfo.sprintName}
                        {lastPublishedInfo.pageUrl && (
                          <span>
                            {' · '}
                            <a
                              href={lastPublishedInfo.pageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#579DFF', textDecoration: 'underline' }}
                            >
                              View page
                            </a>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Saving indicator */}
                    {confluenceSaving && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#d4e5ff', fontStyle: 'italic' }}>Saving...</div>
                    )}
                  </>
                )}
              </div>

              {/* ─── Section 3: Report Settings ─── */}
              <div style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ width: '3px', height: '18px', backgroundColor: '#579DFF', borderRadius: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>Report Settings</span>
                </div>
                {renderCustomizationControls(true)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Mount the app
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
