import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@forge/bridge';
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

  // Panel state - new rail + drawer pattern
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  // Load projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoadingProjects(true);
        setError(null);
        const response: any = await invoke('getProjects');
        if (response && response.projects) {
          setProjects(response.projects);
          if (response.projects.length > 0) {
            setSelectedProject(response.projects[0].key);
          }
        } else if (response && response.error) {
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
            incomplete: reportPayload.byStatus?.incomplete || { total: 0, breakdown: {} }
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
        setIsCustomizerOpen(false); // Collapse to rail after generation
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
    const helperColor = isDarkMode ? '#b3d4ff' : '#6b778c';
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <input 
            type="checkbox"
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            checked={useSprintMode}
            onChange={(e) => setUseSprintMode(e.target.checked)}
          />
          <label style={{ fontSize: '14px', fontWeight: 400, color: textColor, margin: 0 }}>
            Use sprint mode
          </label>
        </div>
        <p style={{ margin: '0 0 0 26px', fontSize: '12px', color: helperColor }}>
          When unchecked, you can specify custom date ranges instead of sprint boundaries.
        </p>
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
          {/* Header Card - Always visible */}
          <div className="sw-card sw-header-card">
            <h1 className="sw-header-title">
              <img src="./SprintWeeklyLogo.png" alt="Sprint Weekly" className="sw-header-logo" />
              Sprint Weekly
            </h1>
            <p className="sw-header-subtitle">
              Create clear, client-ready sprint reports in seconds.
            </p>
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
                  Report customization
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

      {/* Rail + Drawer Pattern - Only after report generation */}
      {hasGeneratedReport && (
        <>
          {/* Vertical Rail with Toggle Button */}
          <div className="sw-customization-rail">
            <button
              className="sw-rail-toggle-btn"
              onClick={() => setIsCustomizerOpen(true)}
              aria-label="Open customization panel"
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="sw-rail-text">Customize report</span>
              </div>
            </button>
          </div>

          {/* Overlay Drawer */}
          <div className={`sw-customization-drawer ${isCustomizerOpen ? 'open' : 'closed'}`}>
            <div className="sw-drawer-content">
              {/* Close Button - X in top left */}
              <button
                className="sw-drawer-close-btn"
                onClick={() => setIsCustomizerOpen(false)}
                aria-label="Close customization panel"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              
              {/* Drawer Header */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
                  Report customization
                </h3>
                <p style={{ margin: '0', fontSize: '13px', color: '#b3d4ff' }}>
                  Select a project and sprint to generate your report.
                </p>
              </div>
              {renderCustomizationControls(true)}
            </div>
          </div>

          {/* Backdrop overlay when drawer is open */}
          {isCustomizerOpen && (
            <div 
              className="sw-drawer-backdrop" 
              onClick={() => setIsCustomizerOpen(false)}
            />
          )}
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
