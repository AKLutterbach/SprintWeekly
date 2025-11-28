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
      } finally {
        setLoadingSprints(false);
      }
    };
    
    fetchSprints();
  }, [selectedProject]);

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    setReportData(null);
    
    try {
      let startDate, endDate;
      
      if (useSprintMode) {
        const sprint = sprints.find(s => s.id === selectedSprint);
        if (!sprint) {
          throw new Error('Sprint not found');
        }
        startDate = sprint.startDate?.split('T')[0];
        endDate = sprint.endDate?.split('T')[0];
      } else {
        if (!manualStartDate || !manualEndDate) {
          throw new Error('Please provide both start and end dates');
        }
        startDate = manualStartDate;
        endDate = manualEndDate;
      }
      
      const response: any = await invoke('getSprintStatusMetrics', {
        projectKey: selectedProject,
        sprintId: selectedSprint,
        startDate,
        endDate,
        useSprintMode
      });
      
      // Transform the response to match our expected shape
      setReportData({
        overview: {
          committed: response.byStatus?.committed || { total: 0, breakdown: { fromLastSprint: 0, plannedAtStart: 0, addedMidSprint: 0 } },
          completed: response.byStatus?.complete || { total: 0, breakdown: { fromLastSprint: 0, plannedAtStart: 0, addedMidSprint: 0 } },
          incomplete: response.byStatus?.incomplete || { total: 0, breakdown: { fromLastSprint: 0, plannedAtStart: 0, addedMidSprint: 0 } }
        },
        projectKey: selectedProject,
        sprintName: response.sprintName,
        startDate,
        endDate
      });
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
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #0052cc' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#172b4d', margin: '0 0 8px 0' }}>
          Sprint Weekly - Status Overview
        </h1>
      </div>

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

      <div style={{ backgroundColor: '#f4f5f7', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '14px', fontWeight: 600, color: '#172b4d', marginBottom: '4px', display: 'block' }}>
              Project
            </label>
            <select 
              style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #dfe1e6', fontSize: '14px', minWidth: '200px' }}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="checkbox"
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              checked={useSprintMode}
              onChange={(e) => setUseSprintMode(e.target.checked)}
            />
            <label style={{ fontSize: '14px', fontWeight: 600, color: '#172b4d' }}>
              Use Sprint Mode
            </label>
          </div>
        </div>

        {useSprintMode ? (
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#172b4d', marginBottom: '4px', display: 'block' }}>
                Sprint
              </label>
              <select 
                style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #dfe1e6', fontSize: '14px', minWidth: '200px' }}
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
        ) : (
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#172b4d', marginBottom: '4px', display: 'block' }}>
                Start Date
              </label>
              <input 
                type="date"
                style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #dfe1e6', fontSize: '14px' }}
                value={manualStartDate}
                onChange={(e) => setManualStartDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#172b4d', marginBottom: '4px', display: 'block' }}>
                End Date
              </label>
              <input 
                type="date"
                style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #dfe1e6', fontSize: '14px' }}
                value={manualEndDate}
                onChange={(e) => setManualEndDate(e.target.value)}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
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
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <div>Loading sprint data...</div>
        </div>
      )}

      {reportData && !loading && (
        <SprintReportPage data={reportData} />
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
