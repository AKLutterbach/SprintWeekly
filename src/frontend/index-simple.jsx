import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@forge/bridge';
import SprintStatusOverview from './SprintStatusOverview';

/**
 * Sprint Weekly - Custom UI Entry Point
 * 
 * Simplified version focusing on Sprint Status Overview with colored metric cards.
 * Uses standard React + ReactDOM for Custom UI rendering.
 */

const App = () => {
  const [loading, setLoading] = useState(false);
  const [statusMetrics, setStatusMetrics] = useState(null);
  const [error, setError] = useState(null);
  
  // Project and sprint state
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
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
        const response = await invoke('getProjects');
        if (response && response.projects) {
          setProjects(response.projects);
          if (response.projects.length > 0) {
            setSelectedProject(response.projects[0].key);
          }
        }
      } catch (e) {
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
        
        const response = await invoke('getSprintsForProject', { projectKey: selectedProject });
        if (response && response.sprints) {
          setSprints(response.sprints);
          const activeSprint = response.sprints.find(s => s.state === 'active');
          if (activeSprint) {
            setSelectedSprint(activeSprint.id);
          } else if (response.sprints.length > 0) {
            setSelectedSprint(response.sprints[0].id);
          }
        }
      } catch (e) {
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
    setStatusMetrics(null);
    
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
      
      const response = await invoke('getSprintStatusMetrics', {
        projectKey: selectedProject,
        sprintId: selectedSprint,
        startDate,
        endDate,
        useSprintMode
      });
      
      setStatusMetrics(response);
    } catch (e) {
      console.error('Error generating report:', e);
      setError(e.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  // Styles
  const styles = {
    container: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto'
    },
    header: {
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: '2px solid #0052cc'
    },
    title: {
      fontSize: '28px',
      fontWeight: 600,
      color: '#172b4d',
      margin: '0 0 8px 0'
    },
    controls: {
      backgroundColor: '#f4f5f7',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '24px'
    },
    controlRow: {
      display: 'flex',
      gap: '16px',
      marginBottom: '16px',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    label: {
      fontSize: '14px',
      fontWeight: 600,
      color: '#172b4d',
      marginBottom: '4px',
      display: 'block'
    },
    select: {
      padding: '8px 12px',
      borderRadius: '4px',
      border: '1px solid #dfe1e6',
      fontSize: '14px',
      minWidth: '200px'
    },
    input: {
      padding: '8px 12px',
      borderRadius: '4px',
      border: '1px solid #dfe1e6',
      fontSize: '14px'
    },
    button: {
      padding: '10px 24px',
      backgroundColor: '#0052cc',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 600
    },
    buttonDisabled: {
      padding: '10px 24px',
      backgroundColor: '#dfe1e6',
      color: '#a5adba',
      border: 'none',
      borderRadius: '4px',
      cursor: 'not-allowed',
      fontSize: '14px',
      fontWeight: 600
    },
    error: {
      padding: '16px',
      backgroundColor: '#ffebe6',
      border: '1px solid #ff5630',
      borderRadius: '4px',
      color: '#bf2600',
      marginBottom: '16px'
    },
    spinner: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '400px',
      fontSize: '16px',
      color: '#666'
    },
    toggle: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    checkbox: {
      width: '18px',
      height: '18px',
      cursor: 'pointer'
    }
  };

  const canGenerate = selectedProject && (useSprintMode ? selectedSprint : (manualStartDate && manualEndDate));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Sprint Weekly - Status Overview</h1>
      </div>

      {error && (
        <div style={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={styles.controls}>
        <div style={styles.controlRow}>
          <div>
            <label style={styles.label}>Project</label>
            <select 
              style={styles.select}
              value={selectedProject || ''}
              onChange={(e) => setSelectedProject(e.target.value)}
              disabled={loadingProjects}
            >
              <option value="">Select Project...</option>
              {projects.map(p => (
                <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
              ))}
            </select>
          </div>

          <div style={styles.toggle}>
            <input 
              type="checkbox"
              style={styles.checkbox}
              checked={useSprintMode}
              onChange={(e) => setUseSprintMode(e.target.checked)}
            />
            <label style={styles.label}>Use Sprint Mode</label>
          </div>
        </div>

        {useSprintMode ? (
          <div style={styles.controlRow}>
            <div>
              <label style={styles.label}>Sprint</label>
              <select 
                style={styles.select}
                value={selectedSprint || ''}
                onChange={(e) => setSelectedSprint(parseInt(e.target.value))}
                disabled={loadingSprints || !selectedProject}
              >
                <option value="">Select Sprint...</option>
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.state})
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div style={styles.controlRow}>
            <div>
              <label style={styles.label}>Start Date</label>
              <input 
                type="date"
                style={styles.input}
                value={manualStartDate}
                onChange={(e) => setManualStartDate(e.target.value)}
              />
            </div>
            <div>
              <label style={styles.label}>End Date</label>
              <input 
                type="date"
                style={styles.input}
                value={manualEndDate}
                onChange={(e) => setManualEndDate(e.target.value)}
              />
            </div>
          </div>
        )}

        <div style={styles.controlRow}>
          <button 
            style={canGenerate ? styles.button : styles.buttonDisabled}
            onClick={generateReport}
            disabled={!canGenerate || loading}
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {loading && (
        <div style={styles.spinner}>
          <div>Loading sprint data...</div>
        </div>
      )}

      {statusMetrics && !loading && (
        <SprintStatusOverview
          data={statusMetrics}
          projectKey={selectedProject}
          sprintId={selectedSprint}
          startDate={useSprintMode ? sprints.find(s => s.id === selectedSprint)?.startDate?.split('T')[0] : manualStartDate}
          endDate={useSprintMode ? sprints.find(s => s.id === selectedSprint)?.endDate?.split('T')[0] : manualEndDate}
          useSprintMode={useSprintMode}
        />
      )}
    </div>
  );
};

// Custom UI uses React 18 createRoot API
const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
