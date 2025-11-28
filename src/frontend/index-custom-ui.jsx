import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { invoke } from '@forge/bridge';
import SprintStatusOverview from './SprintStatusOverview';

/**
 * Sprint Weekly - Custom UI Main App
 * 
 * This is the entry point for the Custom UI version of Sprint Weekly.
 * Uses standard React rendering instead of ForgeReconciler.
 */

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusMetrics, setStatusMetrics] = useState(null);
  const [config, setConfig] = useState({
    projectKey: '',
    sprintId: null,
    useSprintMode: true,
    startDate: '',
    endDate: ''
  });

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch sprint status metrics
      const result = await invoke('getSprintStatusMetrics', {
        projectKey: config.projectKey || 'DEMO',
        sprintId: config.sprintId,
        useSprintMode: config.useSprintMode,
        startDate: config.startDate,
        endDate: config.endDate
      });

      setStatusMetrics(result);
    } catch (err) {
      console.error('Failed to load sprint status:', err);
      setError(err.message || 'Failed to load sprint data');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = {
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px'
    },
    header: {
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: '1px solid #ddd'
    },
    title: {
      fontSize: '24px',
      fontWeight: 600,
      margin: '0 0 8px 0'
    },
    subtitle: {
      fontSize: '14px',
      color: '#666',
      margin: 0
    },
    controls: {
      marginBottom: '24px',
      padding: '16px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px'
    },
    button: {
      padding: '8px 16px',
      backgroundColor: '#0052cc',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px'
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
    }
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.spinner}>
          <div>Loading sprint data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <strong>Error:</strong> {error}
        </div>
        <button style={styles.button} onClick={loadData}>
          Retry
        </button>
      </div>
    );
  }

  if (!statusMetrics) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Sprint Weekly</h1>
          <p style={styles.subtitle}>Configure your sprint settings to view metrics</p>
        </div>
        <button style={styles.button} onClick={loadData}>
          Load Data
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Sprint Status Overview</h1>
        <p style={styles.subtitle}>
          {config.projectKey} | Sprint {config.sprintId || 'Custom Date Range'}
        </p>
      </div>

      <div style={styles.controls}>
        <button style={styles.button} onClick={loadData}>
          Refresh Data
        </button>
      </div>

      <SprintStatusOverview
        data={statusMetrics}
        projectKey={config.projectKey}
        sprintId={config.sprintId}
        startDate={config.startDate}
        endDate={config.endDate}
        useSprintMode={config.useSprintMode}
      />
    </div>
  );
};

// Render the app using React DOM
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
