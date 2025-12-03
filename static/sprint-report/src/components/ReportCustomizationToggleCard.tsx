import React from 'react';
import './ReportCustomizationToggleCard.css';

interface ReportCustomizationToggleCardProps {
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Compact toggle card for report customization settings.
 * Replaces the old full-width banner with a card that sits in the main content column.
 */
const ReportCustomizationToggleCard: React.FC<ReportCustomizationToggleCardProps> = ({
  isExpanded,
  onToggle
}) => {
  return (
    <div
      className="rc-toggle-card"
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={isExpanded}
      aria-label={isExpanded ? 'Collapse report customization' : 'Expand report customization'}
    >
      {!isExpanded ? (
        <>
          <svg className="rc-toggle-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 15.5C13.933 15.5 15.5 13.933 15.5 12C15.5 10.067 13.933 8.5 12 8.5C10.067 8.5 8.5 10.067 8.5 12C8.5 13.933 10.067 15.5 12 15.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.82 12C20.82 12.71 20.71 13.4 20.52 14.06L22.55 15.62C22.73 15.76 22.78 16.03 22.66 16.24L20.73 19.76C20.61 19.97 20.35 20.05 20.13 19.97L17.75 19.03C17.23 19.43 16.66 19.76 16.04 20.01L15.65 22.54C15.62 22.77 15.42 22.94 15.18 22.94H11.32C11.08 22.94 10.88 22.77 10.85 22.54L10.46 20.01C9.84 19.76 9.27 19.43 8.75 19.03L6.37 19.97C6.15 20.05 5.89 19.97 5.77 19.76L3.84 16.24C3.72 16.03 3.77 15.76 3.95 15.62L5.98 14.06C5.79 13.4 5.68 12.71 5.68 12C5.68 11.29 5.79 10.6 5.98 9.94L3.95 8.38C3.77 8.24 3.72 7.97 3.84 7.76L5.77 4.24C5.89 4.03 6.15 3.95 6.37 4.03L8.75 4.97C9.27 4.57 9.84 4.24 10.46 3.99L10.85 1.46C10.88 1.23 11.08 1.06 11.32 1.06H15.18C15.42 1.06 15.62 1.23 15.65 1.46L16.04 3.99C16.66 4.24 17.23 4.57 17.75 4.97L20.13 4.03C20.35 3.95 20.61 4.03 20.73 4.24L22.66 7.76C22.78 7.97 22.73 8.24 22.55 8.38L20.52 9.94C20.71 10.6 20.82 11.29 20.82 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="rc-toggle-card-label">Customize Report</span>
          <svg className="rc-toggle-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </>
      ) : (
        <>
          <span className="rc-toggle-card-label">Hide</span>
          <svg className="rc-toggle-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 15L12 9L6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </>
      )}
    </div>
  );
};

export default ReportCustomizationToggleCard;
