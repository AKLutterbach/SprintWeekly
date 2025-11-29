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

  // Debug logging to understand metric counts
  console.log('Report Data:', {
    overview,
    issues,
    committedTotal: overview.committed.total,
    completedTotal: overview.completed.total,
    incompleteTotal: overview.incomplete.total,
    completedIssuesCount: issues?.completed?.length,
    uncompletedIssuesCount: issues?.uncompleted?.length
  });

  // Categorize issues correctly based on backend data structure
  // committed = all issues in the sprint (completed + uncompleted)
  // complete = issues that were completed
  // incomplete = issues that remain uncompleted
  const committedIssues = [...(issues?.completed || []), ...(issues?.uncompleted || [])];
  const completeIssues = issues?.completed || [];
  const incompleteIssues = issues?.uncompleted || [];

  /**
   * Opens the issue in a Jira modal dialog using ViewIssueModal from @forge/jira-bridge.
   * When the modal is closed, refreshes the report data to reflect any changes.
   */
  const openIssueModal = async (issueKey: string): Promise<void> => {
    console.log('Opening ViewIssueModal for', issueKey);

    const modal = new ViewIssueModal({
      context: { issueKey },          // MUST be the key, e.g. "SPRIN-1"
      onClose: async () => {
        console.log('ViewIssueModal closed');
        // Refresh the report data when dialog closes
        if (onRefresh) {
          console.log('Refreshing report data...');
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
      
      // Build the metrics object structure expected by the export resolver
      const metrics = {
        committedAtStart: overview.committed.breakdown.plannedAtStart,
        committedCarryover: overview.committed.breakdown.fromLastSprint,
        addedMidSprint: overview.committed.breakdown.addedMidSprint,
        completed: overview.completed.total,
        incompleteCarryover: overview.incomplete.total,
        totalIssues: overview.committed.total,
        committedIssues: overview.committed.total,
        completedIssues: overview.completed.total
      };
      
      // Call the export.report resolver with proper structure
      const exportRequest = {
        format: 'pdf',
        reportData: {
          requestId: `export-${Date.now()}`,
          generatedAt: new Date().toISOString(),
          scope: { type: 'sprint', id: data.sprintId?.toString() || '' },
          metrics: metrics,
          issues: issues || {
            completed: [],
            uncompleted: [],
            carryoverBlockers: []
          }
        },
        sprintName: data.sprintName || '',
        reportTitle: data.projectName ? `${data.projectName} Sprint Report` : 'Sprint Report',
        startDate: data.startDate,
        endDate: data.endDate
      };
      
      console.log('Exporting PDF with:', exportRequest);
      
      const response: any = await invoke('export.report', exportRequest);
      
      console.log('Export response:', response);
      console.log('Response type:', typeof response);
      console.log('Response keys:', Object.keys(response || {}));
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Check if we have the PDF data
      const pdfData = response.base64 || response.pdf || response.data;
      
      if (!pdfData) {
        console.error('No PDF data in response:', response);
        throw new Error('No PDF data received from server');
      }
      
      console.log('PDF data length:', pdfData.length);
      
      // Convert base64 to blob and download
      const byteCharacters = atob(pdfData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      console.log('Blob created, size:', blob.size);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sprint-report-${data.sprintName || 'report'}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('PDF download triggered');
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to export PDF: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sprint-report-page">
      <div className="report-header">
        <div className="header-content">
          <div className="header-text">
            <h1 className="report-title">Sprint Status Overview</h1>
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

      <div className="metrics-container">
        {/* Committed Card */}
        <div className="metric-column">
          <div className="metric-card metric-card-committed">
            <div className="card-content">
              <h2 className="card-title">Committed</h2>
              <div className="card-value">{overview.committed.total}</div>
              <p className="card-subtitle">Issues that were committed to this sprint</p>
            </div>
          </div>
          
          <div className="connector-line"></div>
          
          <div className="small-cards">
            <div className="small-card">
              <div className="small-card-value">{overview.committed.breakdown.fromLastSprint}</div>
              <div className="small-card-label">From last sprint</div>
            </div>
            <div className="small-card">
              <div className="small-card-value">{overview.committed.breakdown.plannedAtStart}</div>
              <div className="small-card-label">Planned at start</div>
            </div>
            <div className="small-card">
              <div className="small-card-value">{overview.committed.breakdown.addedMidSprint}</div>
              <div className="small-card-label">Added mid-sprint</div>
            </div>
          </div>
        </div>

        {/* Complete Card */}
        <div className="metric-column">
          <div className="metric-card metric-card-complete">
            <div className="card-content">
              <h2 className="card-title">Complete</h2>
              <div className="card-value">{overview.completed.total}</div>
              <p className="card-subtitle">Issues finished by the end of the sprint</p>
            </div>
          </div>
          
          <div className="connector-line"></div>
          
          <div className="small-cards">
            <div className="small-card">
              <div className="small-card-value">{overview.completed.breakdown.fromLastSprint}</div>
              <div className="small-card-label">Carried from last sprint</div>
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

        {/* Incomplete Card */}
        <div className="metric-column">
          <div className="metric-card metric-card-incomplete">
            <div className="card-content">
              <h2 className="card-title">Incomplete</h2>
              <div className="card-value">{overview.incomplete.total}</div>
              <p className="card-subtitle">Issues unfinished by the end of this sprint</p>
            </div>
          </div>
          
          <div className="connector-line"></div>
          
          <div className="small-cards">
            <div className="small-card">
              <div className="small-card-value">{overview.incomplete.breakdown.fromLastSprint}</div>
              <div className="small-card-label">Carried from last sprint</div>
            </div>
            <div className="small-card">
              <div className="small-card-value">{overview.incomplete.breakdown.plannedAtStart}</div>
              <div className="small-card-label">Planned at start</div>
            </div>
            <div className="small-card">
              <div className="small-card-value">{overview.incomplete.breakdown.addedMidSprint}</div>
              <div className="small-card-label">Added mid-sprint</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sprint Status Detail Section */}
      <div className="status-detail-section">
        <h2 className="status-detail-title">Sprint Status Detail</h2>
        
        {/* Committed Issues */}
        {committedIssues.length > 0 && (
          <div className="detail-card detail-card-committed">
            <div className="detail-header">
              <span className="detail-badge">{committedIssues.length}</span>
              <h3 className="detail-title">Committed</h3>
            </div>
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Summary</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {committedIssues.map((issue) => (
                  <tr 
                    key={issue.key}
                    className="clickable-row"
                    onClick={() => openIssueModal(issue.key)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="detail-key">
                        {issue.key}
                      </span>
                    </td>
                    <td>{issue.summary}</td>
                    <td>{issue.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Complete Issues */}
        {completeIssues.length > 0 && (
          <div className="detail-card detail-card-complete">
            <div className="detail-header">
              <span className="detail-badge">{completeIssues.length}</span>
              <h3 className="detail-title">Complete</h3>
            </div>
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Summary</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {completeIssues.map((issue) => (
                  <tr 
                    key={issue.key}
                    className="clickable-row"
                    onClick={() => openIssueModal(issue.key)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="detail-key">
                        {issue.key}
                      </span>
                    </td>
                    <td>{issue.summary}</td>
                    <td>{issue.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Incomplete Issues */}
        {incompleteIssues.length > 0 && (
          <div className="detail-card detail-card-incomplete">
            <div className="detail-header">
              <span className="detail-badge">{incompleteIssues.length}</span>
              <h3 className="detail-title">Incomplete</h3>
            </div>
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Summary</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {incompleteIssues.map((issue) => (
                  <tr 
                    key={issue.key}
                    className="clickable-row"
                    onClick={() => openIssueModal(issue.key)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="detail-key">
                        {issue.key}
                      </span>
                    </td>
                    <td>{issue.summary}</td>
                    <td>{issue.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SprintReportPage;
