import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke, view } from '@forge/bridge';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<SprintReportData | null>(null);

  useEffect(() => {
    // Get the Jira context (project key, etc.)
    const fetchContext = async () => {
      try {
        const ctx = await view.getContext();
        return ctx;
      } catch (e) {
        console.error('Error getting context:', e);
        setError('Failed to load Jira context');
        return null;
      }
    };

    // Fetch the sprint report data from the resolver
    const fetchReportData = async (ctx: any) => {
      try {
        setLoading(true);
        
        // Call the same resolver that the UI Kit version uses
        const response: any = await invoke('getSprintStatusMetrics', {
          projectKey: ctx?.extension?.project?.key,
          useSprintMode: true
        });

        // Transform the response to match our expected shape
        setReportData({
          overview: {
            committed: response.byStatus?.committed || { total: 0, breakdown: { fromLastSprint: 0, plannedAtStart: 0, addedMidSprint: 0 } },
            completed: response.byStatus?.complete || { total: 0, breakdown: { fromLastSprint: 0, plannedAtStart: 0, addedMidSprint: 0 } },
            incomplete: response.byStatus?.incomplete || { total: 0, breakdown: { fromLastSprint: 0, plannedAtStart: 0, addedMidSprint: 0 } }
          },
          projectKey: ctx?.extension?.project?.key || '',
          sprintName: response.sprintName,
          startDate: response.startDate,
          endDate: response.endDate
        });
      } catch (e: any) {
        console.error('Error fetching report data:', e);
        setError(e.message || 'Failed to load report data');
      } finally {
        setLoading(false);
      }
    };

    // Execute the fetch sequence
    fetchContext().then(ctx => {
      if (ctx) {
        fetchReportData(ctx);
      } else {
        setLoading(false);
      }
    });
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div>Loading sprint report...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          backgroundColor: '#ffebe6',
          border: '1px solid #ff5630',
          borderRadius: '4px',
          padding: '16px',
          color: '#bf2600'
        }}>
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div style={{ 
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div>No report data available</div>
      </div>
    );
  }

  return <SprintReportPage data={reportData} />;
};

// Mount the app
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
