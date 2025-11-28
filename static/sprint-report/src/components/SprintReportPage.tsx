import React from 'react';
import type { SprintReportData } from '../types';
import './SprintReportPage.css';

interface SprintReportPageProps {
  data: SprintReportData;
}

/**
 * SprintReportPage - Custom UI Component
 * 
 * Renders the Sprint Status Overview with exact styling to match the PDF export.
 * Uses normal HTML/CSS with pastel colors, rounded corners, and thick colored borders.
 */
const SprintReportPage: React.FC<SprintReportPageProps> = ({ data }) => {
  const { overview } = data;

  return (
    <div className="sprint-report-page">
      <div className="report-header">
        <h1 className="report-title">Sprint Status Overview</h1>
        {data.sprintName && (
          <p className="sprint-name">{data.sprintName}</p>
        )}
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
              <div className="small-card-label">Carried from last sprint</div>
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
    </div>
  );
};

export default SprintReportPage;
