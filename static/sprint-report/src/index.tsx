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

  // Panel collapse state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Load projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoadingProjects(true);
        const response: any = await invoke('getProjects');
        if (response && response.projects) {
          setProjects(response.projects);
          if (response.projects.length > 0) {
            setSelectedProject(response.projects[0].key);
          }
        }
      } catch (e: any) {
        console.error('Error loading projects:', e);
        setError(e.message);
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
      return;
    }

    const fetchSprints = async () => {
      try {
        setLoadingSprints(true);
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
        }
      } catch (e: any) {
        console.error('Error loading sprints:', e);
        setError(e.message);
      } finally {
        setLoadingSprints(false);
      }
    };

    fetchSprints();
  }, [selectedProject]);

  const generateReport = async () => {
    if (!selectedProject) {
      setError('Please select a project');
      return;
    }

    if (useSprintMode && !selectedSprint) {
      setError('Please select a sprint');
      return;
    }

    if (!useSprintMode && (!manualStartDate || !manualEndDate)) {
      setError('Please select start and end dates');
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

      console.log('Calling report.build with payload:', payload);
      const result: any = await invoke('report.build', payload);
      console.log('report.build returned:', result);
      
      // Handle cached vs fresh data
      const reportPayload = result.cached ? result.payload : result.payload;
      
      if (reportPayload && (reportPayload.metrics || reportPayload.byStatus)) {
        // Transform the data structure to match what SprintReportPage expects
        const transformedData = {
          overview: {
            committed: reportPayload.byStatus?.committed || { total: 0, breakdown: {} },
            completed: reportPayload.byStatus?.complete || { total: 0, breakdown: {} },
            incomplete: reportPayload.byStatus?.incomplete || { total: 0, breakdown: {} }
          },
          issues: reportPayload.issues || { completed: [], uncompleted: [] },
          sprintName: reportPayload.sprintName || 'Sprint',
          projectName: reportPayload.projectName || selectedProject,
          projectKey: selectedProject
        };
        
        console.log('Transformed data:', transformedData);
        setReportData(transformedData);
        setIsPanelCollapsed(true); // Collapse panel after successful generation
      } else {
        console.error('Invalid data structure:', reportPayload);
        setError('No data returned from report generation');
      }
    } catch (e: any) {
      console.error('Error generating report:', e);
      setError(e.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const canGenerate = selectedProject && (useSprintMode ? selectedSprint : (manualStartDate && manualEndDate));

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Hero Section - only show when panel is not collapsed */}
      {!isPanelCollapsed && (
        <section className="sw-hero-section">
          <div className="sw-hero-inner">
            {/* Header Card */}
            <div className="sw-card sw-header-card">
              <div className="sw-header-eyebrow">Sprint report</div>
              <h1 className="sw-header-title">
                <img src="/SprintWeeklyLogo.png" alt="Sprint Weekly" className="sw-header-logo" />
                Sprint Weekly
              </h1>
              <p className="sw-header-subtitle">
                Lightweight weekly status report for your active sprint.
              </p>
              <div className="sw-header-divider"></div>
            </div>

            {/* Customization Card */}
            <div className="sw-card sw-customization-card">
              <div 
                style={{ 
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: '#172b4d' }}>
                    Report customization
                  </h3>
                  <p style={{ margin: '0', fontSize: '13px', color: '#6b778c' }}>
                    Select a project and sprint to generate your report.
                  </p>
                </div>
              </div>
            
              {/* Two-column row for Project and Sprint */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: '1 1 0' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#6b778c', marginBottom: '4px', display: 'block' }}>
                    Project
                  </label>
                  <select 
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #dfe1e6', fontSize: '14px' }}
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    disabled={loadingProjects}
                  >
                    <option value="">Select Project...</option>
                    {projects.map(p => (
                      <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: '1 1 0' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#6b778c', marginBottom: '4px', display: 'block' }}>
                    Sprint
                  </label>
                  <select 
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #dfe1e6', fontSize: '14px' }}
                    value={selectedSprint?.toString() || ''}
                    onChange={(e) => setSelectedSprint(parseInt(e.target.value))}
                    disabled={loadingSprints || !selectedProject}
                  >
                    <option value="">Select Sprint...</option>
                    {sprints.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.state})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Use Sprint Mode checkbox with helper text */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <input 
                    type="checkbox"
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    checked={useSprintMode}
                    onChange={(e) => setUseSprintMode(e.target.checked)}
                  />
                  <label style={{ fontSize: '14px', fontWeight: 400, color: '#172b4d', margin: 0 }}>
                    Use sprint mode
                  </label>
                </div>
                <p style={{ margin: '0 0 0 26px', fontSize: '12px', color: '#6b778c' }}>
                  When unchecked, you can specify custom date ranges instead of sprint boundaries.
                </p>
              </div>

              {/* Manual date range when Sprint Mode is off */}
              {!useSprintMode && (
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: '1 1 0' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: '#6b778c', marginBottom: '4px', display: 'block' }}>
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
                    <label style={{ fontSize: '13px', fontWeight: 500, color: '#6b778c', marginBottom: '4px', display: 'block' }}>
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
                      backgroundColor: canGenerate ? '#0052cc' : '#dfe1e6',
                      color: canGenerate ? 'white' : '#a5adba',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: canGenerate ? 'pointer' : 'not-allowed',
                      fontSize: '14px',
                      fontWeight: 600
                    }}
                    onClick={generateReport}
                    disabled={!canGenerate || loading}
                  >
                    {loading ? 'Loading...' : 'Generate report'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Collapsed Panel State */}
      {isPanelCollapsed && (
        <div style={{ backgroundColor: 'white', padding: '16px 24px', borderBottom: '1px solid #dfe1e6', marginBottom: '24px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: '#172b4d' }}>
                Report customization
              </h3>
            </div>
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '20px',
                color: '#42526e',
                display: 'flex',
                alignItems: 'center'
              }}
              onClick={() => setIsPanelCollapsed(false)}
              aria-label="Expand customization panel"
            >
              ▼
            </button>
          </div>
        </div>
      )}

      {/* Report Content Area */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
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
          <SprintReportPage data={reportData} onRefresh={generateReport} />
        )}
      </div>
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
