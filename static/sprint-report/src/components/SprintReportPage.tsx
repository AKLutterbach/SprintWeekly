import React from 'react';
import { invoke } from '@forge/bridge';
import { ViewIssueModal } from '@forge/jira-bridge';
import type { SprintReportData } from '../types';
import './SprintReportPage.css';

interface SprintReportPageProps {
  data: SprintReportData;
  onRefresh?: () => Promise<void>;
}

/**
 * SprintReportPage - Custom UI Component
 * 
 * Renders the Sprint Status Overview with exact styling to match the PDF export.
 * Uses normal HTML/CSS with pastel colors, rounded corners, and thick colored borders.
 */
const SprintReportPage: React.FC<SprintReportPageProps> = ({ data, onRefresh }) => {
  const { overview, issues } = data;
  const [loading, setLoading] = React.useState(false);

  // Use pre-categorised issue lists from the backend.  The backend is the single
  // source of truth for ALL metric values — this component is a pure renderer.
  const completeIssues = issues?.completed || [];
  const incompleteIssues = issues?.uncompleted || [];
  const inProgressIssues = issues?.inProgress || [];
  const toDoIssues = issues?.toDo || [];

  // Total issue count for the subtitle meta line
  const totalIssueCount = completeIssues.length + incompleteIssues.length;

  // Format an ISO date string as MM/DD/YY for the subtitle
  const formatDate = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
  };

  // Return the right CSS class for a status pill based on the status label
  const getStatusPillClass = (status: string): string => {
    const s = status.toLowerCase();
    if (s.includes('done') || s.includes('complete')) return 'status-pill-complete';
    if (s.includes('progress')) return 'status-pill-inprogress';
    return 'status-pill-todo';
  };

  /**
   * Opens the issue in a Jira modal dialog using ViewIssueModal from @forge/jira-bridge.
   * When the modal is closed, refreshes the report data to reflect any changes.
   */
  const openIssueModal = async (issueKey: string): Promise<void> => {
    const modal = new ViewIssueModal({
      context: { issueKey },
      onClose: async () => {
        // Refresh the report data when dialog closes
        if (onRefresh) {
          await onRefresh();
        }
      },
    });

    try {
      await modal.open();
    } catch (error) {
      console.error('Failed to open ViewIssueModal', error);
      // Fallback to opening in new tab
      window.open(`/browse/${issueKey}`, '_blank');
    }
  };

  // Function to export report as PDF
  const handleExportPDF = async () => {
    try {
      setLoading(true);
      
      // Build the byStatus structure expected by the export resolver
      // This structure directly maps the overview data to what the PDF renderer expects
      const byStatus = {
        committed: {
          total: overview.committed.total,
          breakdown: overview.committed.breakdown
        },
        complete: {
          total: overview.completed.total,
          breakdown: overview.completed.breakdown
        },
        incomplete: {
          total: overview.incomplete.total,
          breakdown: overview.incomplete.breakdown
        },
        // Pass granular In Progress / To Do sub-counts so the export
        // renderer doesn't fall back to proportional splitting.
        ...(overview.inProgress ? { inProgress: overview.inProgress } : {}),
        ...(overview.toDo ? { toDo: overview.toDo } : {})
      };
      
      // Call the export.report resolver with proper structure
      const exportRequest = {
        format: 'pdf',
        reportData: {
          requestId: `export-${Date.now()}`,
          generatedAt: new Date().toISOString(),
          scope: { type: 'sprint', id: data.sprintId?.toString() || '' },
          byStatus: byStatus,
          metrics: {}, // Keep empty for backwards compatibility
          issues: issues || {
            completed: [],
            uncompleted: [],
            carryoverBlockers: []
          }
        },
        sprintName: data.sprintName || '',
        reportTitle: data.projectName ? `${data.projectName}` : 'Sprint Report',
        startDate: data.startDate,
        endDate: data.endDate,
        // Send pre-formatted timestamp in the user's local timezone so the PDF footer is correct
        generatedAt: new Date().toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      };
      
      const response: any = await invoke('export.report', exportRequest);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Check if we have the PDF data
      const pdfData = response.base64 || response.pdf || response.data;
      
      if (!pdfData) {
        throw new Error('No PDF data received');
      }
      
      // Convert base64 to blob and download
      const byteCharacters = atob(pdfData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.projectName || 'Sprint'}-Report-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Unable to export PDF. Please try again or contact your Jira admin if the problem persists.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sprint-report-page">
      <div className="report-header">
        <div className="header-content">
          <div className="header-text">
            <h1 className="report-title">
              {/* iOS-style bar chart icon — matches the PDF header icon */}
              <span className="header-icon-wrap" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="26" height="26" rx="6" fill="#EAEDF8"/>
                  <rect x="5.5" y="14" width="4" height="7" rx="1" fill="#3A6BD6"/>
                  <rect x="11" y="9" width="4" height="12" rx="1" fill="#3A6BD6"/>
                  <rect x="16.5" y="11.5" width="4" height="9.5" rx="1" fill="#3A6BD6"/>
                </svg>
              </span>
              {data.projectName || 'Sprint Report'}
            </h1>
            {/* Meta line: sprint name · date range · issue count, matching PDF subtitle */}
            <p className="report-meta">
              {[
                data.sprintName,
                (data.startDate && data.endDate)
                  ? `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`
                  : null,
                `${totalIssueCount} ${totalIssueCount === 1 ? 'issue' : 'issues'}`
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button className="export-pdf-button" onClick={handleExportPDF} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 11v3H2v-3H0v3c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3h-2z"/>
              <path d="M7 11.5L3.5 8 5 6.5 7 8.5V0h2v8.5l2-2L12.5 8 9 11.5z"/>
            </svg>
            {loading ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Sprint Overview heading + separator — matches PDF section heading */}
      <div className="sprint-overview-section">
        <h2 className="sprint-overview-title">Sprint Overview</h2>
        <hr className="section-divider" />
      </div>

      <div className="metrics-container">
        {/* Complete Card */}
        <div className="metric-column">
          <div className="metric-card metric-card-complete">
            <div className="metric-card-accent"></div>
            <div className="card-content">
              <h2 className="card-title">Complete</h2>
              <div className="card-value">{overview.completed.total}</div>
              <p className="card-subtitle">Issues finished by the end of the sprint</p>
            </div>
          </div>
          <div className="small-cards">
            <div className="small-card">
              <div className="small-card-value">{overview.completed.breakdown.fromLastSprint}</div>
              <div className="small-card-label">From last sprint</div>
            </div>
            <div className="small-card">
              <div className="small-card-value">{overview.completed.breakdown.plannedAtStart}</div>
              <div className="small-card-label">Planned at start</div>
            </div>
            <div className="small-card">
              <div className="small-card-value">{overview.completed.breakdown.addedMidSprint}</div>
              <div className="small-card-label">Added mid-sprint</div>
            </div>
          </div>
        </div>

        {/* In Progress Card — issues where status contains 'progress' */}
        <div className="metric-column">
          <div className="metric-card metric-card-inprogress">
            <div className="metric-card-accent"></div>
            <div className="card-content">
              <h2 className="card-title">In Progress</h2>
              <div className="card-value">{overview.inProgress?.total ?? inProgressIssues.length}</div>
              <p className="card-subtitle">Issues actively being worked on</p>
            </div>
          </div>
          <div className="small-cards">
            <div className="small-card">
              <div className="small-card-value">{overview.inProgress?.breakdown?.fromLastSprint ?? 0}</div>
              <div className="small-card-label">From last sprint</div>
            </div>
            <div className="small-card">
              <div className="small-card-value">{overview.inProgress?.breakdown?.plannedAtStart ?? 0}</div>
              <div className="small-card-label">Planned at start</div>
            </div>
            <div className="small-card">
              <div className="small-card-value">{overview.inProgress?.breakdown?.addedMidSprint ?? 0}</div>
              <div className="small-card-label">Added mid-sprint</div>
            </div>
          </div>
        </div>

        {/* To Do Card — incomplete issues not currently in progress */}
        <div className="metric-column">
          <div className="metric-card metric-card-todo">
            <div className="metric-card-accent"></div>
            <div className="card-content">
              <h2 className="card-title">To Do</h2>
              <div className="card-value">{overview.toDo?.total ?? toDoIssues.length}</div>
              <p className="card-subtitle">Issues not yet started</p>
            </div>
          </div>
          <div className="small-cards">
            <div className="small-card">
              <div className="small-card-value">{overview.toDo?.breakdown?.fromLastSprint ?? 0}</div>
              <div className="small-card-label">From last sprint</div>
            </div>
            <div className="small-card">
              <div className="small-card-value">{overview.toDo?.breakdown?.plannedAtStart ?? 0}</div>
              <div className="small-card-label">Planned at start</div>
            </div>
            <div className="small-card">
              <div className="small-card-value">{overview.toDo?.breakdown?.addedMidSprint ?? 0}</div>
              <div className="small-card-label">Added mid-sprint</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sprint Status Detail Section */}
      <div className="status-detail-section">
        {/* Wrap heading + divider — negative margin-bottom pulls the first card up to 4px clearance */}
        <div className="status-detail-header">
          <h2 className="status-detail-title">Sprint Status Detail</h2>
          <hr className="section-divider" />
        </div>

        {/* Complete Issues Table — always shown */}
        <div className="detail-card detail-card-complete">
          <div className="detail-header">
            <span className="detail-badge detail-badge-complete">{completeIssues.length}</span>
            <h3 className="detail-title">Complete</h3>
          </div>
          <table className="detail-table">
            <thead>
              <tr><th>Key</th><th>Summary</th><th>Status</th></tr>
            </thead>
            <tbody>
              {completeIssues.length === 0 ? (
                <tr><td colSpan={3} className="empty-category-cell">No issues in this category</td></tr>
              ) : (
                completeIssues.map((issue: any) => (
                  <tr key={issue.key} className="clickable-row" onClick={() => openIssueModal(issue.key)}>
                    <td><span className="detail-key">{issue.key}</span></td>
                    <td>{issue.summary}</td>
                    <td><span className={`status-pill ${getStatusPillClass(issue.status || '')}`}>{issue.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* In Progress Issues Table — always shown */}
        <div className="detail-card detail-card-inprogress">
          <div className="detail-header">
            <span className="detail-badge detail-badge-inprogress">{inProgressIssues.length}</span>
            <h3 className="detail-title">In Progress</h3>
          </div>
          <table className="detail-table">
            <thead>
              <tr><th>Key</th><th>Summary</th><th>Status</th></tr>
            </thead>
            <tbody>
              {inProgressIssues.length === 0 ? (
                <tr><td colSpan={3} className="empty-category-cell">No issues in this category</td></tr>
              ) : (
                inProgressIssues.map((issue: any) => (
                  <tr key={issue.key} className="clickable-row" onClick={() => openIssueModal(issue.key)}>
                    <td><span className="detail-key">{issue.key}</span></td>
                    <td>{issue.summary}</td>
                    <td><span className={`status-pill ${getStatusPillClass(issue.status || '')}`}>{issue.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* To Do Issues Table — always shown */}
        <div className="detail-card detail-card-todo">
          <div className="detail-header">
            <span className="detail-badge detail-badge-todo">{toDoIssues.length}</span>
            <h3 className="detail-title">To Do</h3>
          </div>
          <table className="detail-table">
            <thead>
              <tr><th>Key</th><th>Summary</th><th>Status</th></tr>
            </thead>
            <tbody>
              {toDoIssues.length === 0 ? (
                <tr><td colSpan={3} className="empty-category-cell">No issues in this category</td></tr>
              ) : (
                toDoIssues.map((issue: any) => (
                  <tr key={issue.key} className="clickable-row" onClick={() => openIssueModal(issue.key)}>
                    <td><span className="detail-key">{issue.key}</span></td>
                    <td>{issue.summary}</td>
                    <td><span className={`status-pill ${getStatusPillClass(issue.status || '')}`}>{issue.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SprintReportPage;
