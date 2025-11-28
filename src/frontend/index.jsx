import React, { useState, useEffect } from 'react';
import ForgeReconciler, { 
  Text, 
  Button, 
  Stack, 
  Heading, 
  Textfield,
  SectionMessage,
  Spinner,
  Inline,
  Box,
  DynamicTable,
  Lozenge,
  Select,
  DatePicker,
  Toggle,
  Label
} from '@forge/react';
import { invoke } from '@forge/bridge';
import SprintStatusOverview from './SprintStatusOverview';

// MetricTile component - unified styling with rounded corners and centered content
const MetricTile = ({ label, value, subtitle }) => (
  <Box 
    padding="space.300" 
    backgroundColor="color.background.neutral"
    xcss={{
      borderRadius: '20px',
      minWidth: '180px',
      textAlign: 'center'
    }}
  >
    <Stack space="space.150" alignInline="center">
      <Text color="color.text.subtlest" size="medium" weight="semibold">{label}</Text>
      <Heading size="xxlarge">{String(value)}</Heading>
      {subtitle && (
        <Text color="color.text.subtlest" size="small">{subtitle}</Text>
      )}
    </Stack>
  </Box>
);

// IssueListCard component - polished card with colored count badges
const IssueListCard = ({ title, issues, count, countColor }) => {
  // Determine Lozenge appearance based on countColor
  let lozengeAppearance = 'default';
  if (countColor === 'blue') lozengeAppearance = 'inprogress';
  else if (countColor === 'green') lozengeAppearance = 'success';
  else if (countColor === 'orange') lozengeAppearance = 'moved';
  else if (countColor === 'red') lozengeAppearance = 'removed';
  
  // Calculate badge count
  const badgeCount = count || (issues?.length || 0);
  
  // If no issues, show friendly empty state
  if (!issues || issues.length === 0) {
    return (
      <Box padding="space.300" backgroundColor="color.background.neutral.subtle">
        <Stack space="space.200">
          <Inline space="space.150" alignBlock="center">
            <Heading size="medium">{title}</Heading>
            <Lozenge appearance={lozengeAppearance}>{badgeCount}</Lozenge>
          </Inline>
          <Text color="color.text.subtlest" align="center">No issues in this category</Text>
        </Stack>
      </Box>
    );
  }

  // Prepare table rows for DynamicTable
  const rows = issues.map((issue, index) => ({
    key: issue.key || `issue-${index}`,
    cells: [
      {
        key: 'key',
        content: <Text>{issue.key}</Text>
      },
      {
        key: 'summary',
        content: <Text>{issue.summary || issue.fields?.summary || 'No summary'}</Text>
      },
      {
        key: 'status',
        content: issue.status ? (
          <Lozenge appearance="default">{issue.status}</Lozenge>
        ) : (
          <Text>-</Text>
        )
      }
    ]
  }));

  const head = {
    cells: [
      { key: 'key', content: 'Key', width: 15 },
      { key: 'summary', content: 'Summary', width: 60 },
      { key: 'status', content: 'Status', width: 25 }
    ]
  };

  return (
    <Box padding="space.300" backgroundColor="color.background.neutral.subtle">
      <Stack space="space.200">
        <Inline space="space.150" alignBlock="center">
          <Heading size="medium">{title}</Heading>
          <Lozenge appearance={lozengeAppearance}>{badgeCount}</Lozenge>
        </Inline>
        <DynamicTable head={head} rows={rows} />
      </Stack>
    </Box>
  );
};

// Main App component
const App = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  
  // Project and sprint state
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingSprints, setLoadingSprints] = useState(false);
  
  // Date mode state - start with sprint mode (Date Mode OFF)
  const [useSprintDates, setUseSprintDates] = useState(true);
  const [manualStartDate, setManualStartDate] = useState('');
  const [manualEndDate, setManualEndDate] = useState('');

  // Export report function
  const exportReport = async (format) => {
    if (!report) return;
    
    setExporting(true);
    try {
      const sprintName = sprints.find(s => s.id === selectedSprint)?.name || selectedProject;
      const currentProjectName = projects.find(p => p.key === selectedProject)?.name || 'Project';
      const reportTitle = useSprintDates 
        ? `${currentProjectName} Sprint Report`
        : `${currentProjectName} Progress Report`;
      
      // Get date range for reporting period
      let startDate, endDate;
      if (useSprintDates) {
        const sprint = sprints.find(s => s.id === selectedSprint);
        startDate = sprint?.startDate?.split('T')[0];
        endDate = sprint?.endDate?.split('T')[0];
      } else {
        startDate = manualStartDate;
        endDate = manualEndDate;
      }
      
      const response = await invoke('export.report', {
        format,
        reportData: report,
        sprintName,
        reportTitle,
        startDate,
        endDate
      });
      
      if (response && response.success && response.data) {
        // Decode base64 and trigger download
        const binaryString = atob(response.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { 
          type: format === 'pdf' ? 'application/pdf' : 'text/csv' 
        });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError(response?.error || 'Export failed');
      }
    } catch (e) {
      console.error('Export error:', e);
      setError(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // Load projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoadingProjects(true);
        const response = await invoke('getProjects');
        if (response && response.projects) {
          setProjects(response.projects);
          // Auto-select first project if available
          if (response.projects.length > 0) {
            setSelectedProject(response.projects[0].key);
          }
        }
      } catch (e) {
        console.error('Error loading projects:', e);
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
          // Auto-select first active or most recent sprint
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
    setReport(null);
    
    try {
      // Determine date range based on mode
      let startDate, endDate;
      
      if (useSprintDates) {
        // Get dates from selected sprint
        const sprint = sprints.find(s => s.id === selectedSprint);
        if (!sprint) {
          setError('Please select a sprint');
          setLoading(false);
          return;
        }
        startDate = sprint.startDate ? sprint.startDate.split('T')[0] : null;
        endDate = sprint.endDate ? sprint.endDate.split('T')[0] : null;
        
        if (!startDate || !endDate) {
          setError('Selected sprint does not have valid dates');
          setLoading(false);
          return;
        }
      } else {
        // Use manual dates
        if (!manualStartDate || !manualEndDate) {
          setError('Please select start and end dates');
          setLoading(false);
          return;
        }
        startDate = manualStartDate;
        endDate = manualEndDate;
      }
      
      const payload = {
        requestId: 'report-' + Date.now(),
        scope: { type: 'project', id: selectedProject },
        window: { type: 'calendar', start: startDate, end: endDate },
        metrics: ['throughput', 'velocity', 'carryover'],
        sprintId: useSprintDates ? selectedSprint : null,
        useSprintMode: useSprintDates
      };
      
      const response = await invoke('report.build', payload);
      
      if (response && response.payload) {
        setReport(response.payload);
      } else {
        setError('No data returned from report generation');
      }
    } catch (e) {
      console.error('Error generating report:', e);
      setError(e.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  // Extract metrics and issue lists from report
  const metrics = report?.metrics || {};
  const completedIssues = report?.issues?.completed || [];
  const uncompletedIssues = report?.issues?.uncompleted || [];
  const carryoverBlockers = report?.issues?.carryoverBlockers || [];
  
  // Combine all issues for "Committed" section (matching PDF export)
  const allCommittedIssues = [...completedIssues, ...uncompletedIssues, ...(carryoverBlockers || [])];
  
  // Compute sprint status metrics for the new overview component
  // Ensure breakdowns always add up to totals by using actual counts
  const sprintStatusData = report ? {
    committed: {
      total: metrics.committedAtStart || 0,
      breakdown: {
        fromLastSprint: metrics.committedCarryover || 0,
        addedMidSprint: metrics.addedMidSprint || 0,
        // plannedAtStart is the remainder to ensure sum equals total
        plannedAtStart: Math.max(0, (metrics.committedAtStart || 0) - (metrics.committedCarryover || 0) - (metrics.addedMidSprint || 0))
      }
    },
    completed: {
      total: metrics.completed || 0,
      breakdown: (() => {
        const total = metrics.completed || 0;
        const committed = metrics.committedAtStart || 0;
        const carryover = metrics.committedCarryover || 0;
        const added = metrics.addedMidSprint || 0;
        
        // Proportionally distribute completed issues based on committed breakdown
        // If we have committed data, use proportions; otherwise split evenly
        if (committed > 0) {
          const carryoverPct = carryover / committed;
          const addedPct = added / committed;
          const plannedPct = Math.max(0, 1 - carryoverPct - addedPct);
          
          const fromLastSprint = Math.round(total * carryoverPct);
          const addedMidSprint = Math.round(total * addedPct);
          const plannedAtStart = Math.max(0, total - fromLastSprint - addedMidSprint);
          
          return { fromLastSprint, plannedAtStart, addedMidSprint };
        } else {
          // No committed data, distribute evenly or put all in planned
          return { fromLastSprint: 0, plannedAtStart: total, addedMidSprint: 0 };
        }
      })()
    },
    incomplete: {
      total: metrics.incompleteCarryover || 0,
      breakdown: (() => {
        const total = metrics.incompleteCarryover || 0;
        const committed = metrics.committedAtStart || 0;
        const completed = metrics.completed || 0;
        const carryover = metrics.committedCarryover || 0;
        const added = metrics.addedMidSprint || 0;
        
        // Incomplete = Committed - Completed
        // Apply same proportions as committed breakdown
        if (committed > 0) {
          const carryoverPct = carryover / committed;
          const addedPct = added / committed;
          const plannedPct = Math.max(0, 1 - carryoverPct - addedPct);
          
          const fromLastSprint = Math.round(total * carryoverPct);
          const addedMidSprint = Math.round(total * addedPct);
          const plannedAtStart = Math.max(0, total - fromLastSprint - addedMidSprint);
          
          return { fromLastSprint, plannedAtStart, addedMidSprint };
        } else {
          return { fromLastSprint: 0, plannedAtStart: total, addedMidSprint: 0 };
        }
      })()
    }
  } : null;

  // Prepare project options for Select
  const projectOptions = projects.map(p => ({
    label: p.name,
    value: p.key
  }));

  // Prepare sprint options for Select
  const sprintOptions = sprints.map(s => ({
    label: `${s.name} (${s.state})`,
    value: s.id
  }));

  // Get current project name for dynamic title
  const currentProjectName = projects.find(p => p.key === selectedProject)?.name || 'Project';
  
  // Determine report title based on date mode
  const reportTitle = useSprintDates 
    ? `${currentProjectName} Sprint Report`
    : `${currentProjectName} Progress Report`;

  return (
    <Box padding="space.400">
      <Stack space="space.400">
        {/* Report Customization Section */}
        <Box 
          padding="space.300" 
          backgroundColor="color.background.neutral"
          xcss={{
            borderRadius: '8px',
            border: '2px solid',
            borderColor: 'color.border.bold'
          }}
        >
          <Stack space="space.200">
            <Heading size="medium">Report Customization</Heading>
            
            {/* Controls */}
            <Inline space="space.200" shouldWrap alignBlock="center">
              {/* Project selector */}
              <Box>
                <Label labelFor="project-select">Project</Label>
                <Select
                  inputId="project-select"
                  options={projectOptions}
                  value={projectOptions.find(opt => opt.value === selectedProject)}
                  onChange={(option) => setSelectedProject(option.value)}
                  isLoading={loadingProjects}
                  placeholder="Select project..."
                />
              </Box>

              {/* Sprint selector */}
              <Box>
                <Label labelFor="sprint-select">Sprint</Label>
                <Select
                  inputId="sprint-select"
                  options={sprintOptions}
                  value={sprintOptions.find(opt => opt.value === selectedSprint)}
                  onChange={(option) => setSelectedSprint(option.value)}
                  isLoading={loadingSprints}
                  isDisabled={!selectedProject || sprints.length === 0}
                  placeholder={!selectedProject ? "Select project first..." : "Select sprint..."}
                />
              </Box>

              {/* Date mode toggle */}
              <Box>
                <Label labelFor="date-mode-toggle">Date Mode</Label>
                <Toggle
                  id="date-mode-toggle"
                  isChecked={!useSprintDates}
                  onChange={() => setUseSprintDates(!useSprintDates)}
                />
              </Box>

              {/* Manual date inputs - only show when not using sprint dates */}
              {!useSprintDates && (
                <>
                  <Box>
                    <Label labelFor="start-date">Start Date</Label>
                    <DatePicker
                      inputId="start-date"
                      value={manualStartDate}
                      onChange={setManualStartDate}
                      dateFormat="YYYY-MM-DD"
                      placeholder="YYYY-MM-DD"
                    />
                  </Box>
                  <Box>
                    <Label labelFor="end-date">End Date</Label>
                    <DatePicker
                      inputId="end-date"
                      value={manualEndDate}
                      onChange={setManualEndDate}
                      dateFormat="YYYY-MM-DD"
                      placeholder="YYYY-MM-DD"
                    />
                  </Box>
                </>
              )}
            </Inline>

            {/* Action buttons row */}
            <Inline space="space.150" shouldWrap>
              {/* Generate button */}
              <Button 
                onClick={generateReport}
                appearance="primary"
                isDisabled={loading || !selectedProject || (useSprintDates && !selectedSprint) || (!useSprintDates && (!manualStartDate || !manualEndDate))}
              >
                Generate Report
              </Button>

              {/* Export buttons - only show when report exists */}
              {report && (
                <>
                  <Button 
                    onClick={() => exportReport('pdf')}
                    appearance="default"
                    isDisabled={exporting}
                  >
                    Export PDF
                  </Button>
                  <Button 
                    onClick={() => exportReport('csv')}
                    appearance="default"
                    isDisabled={exporting}
                  >
                    Export CSV
                  </Button>
                </>
              )}
            </Inline>
          </Stack>
        </Box>

        {/* Exporting State */}
        {exporting && (
          <Box padding="space.200" backgroundColor="color.background.information.bold">
            <Inline space="space.100" alignBlock="center">
              <Spinner size="small" />
              <Text color="color.text.inverse">Generating export...</Text>
            </Inline>
          </Box>
        )}

        {/* Loading State */}
        {loading && (
          <Box padding="space.400" backgroundColor="color.background.neutral.subtle">
            <Stack space="space.200" alignInline="center">
              <Spinner size="large" />
              <Text>Analyzing sprint data...</Text>
            </Stack>
          </Box>
        )}

        {/* Error State */}
        {error && (
          <SectionMessage appearance="error" title="Error">
            <Text>{error}</Text>
          </SectionMessage>
        )}

        {/* Report Results */}
        {report && report.metrics && (
          <Stack space="space.400">
            {/* Report Header - Title on left, metadata on right */}
            <Box xcss={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'space.300' }}>
              <Stack space="space.075">
                <Heading size="large">{reportTitle}</Heading>
                <Text color="color.text.subtlest" size="medium">
                  {sprints.find(s => s.id === selectedSprint)?.name || selectedProject}
                </Text>
              </Stack>
              <Stack space="space.050" alignInline="end" xcss={{ flexShrink: 0, textAlign: 'right' }}>
                <Text color="color.text.subtlest" size="small">
                  Reporting period:
                </Text>
                <Text color="color.text.subtlest" size="small">
                  {(() => {
                    const start = useSprintDates 
                      ? sprints.find(s => s.id === selectedSprint)?.startDate?.split('T')[0]
                      : manualStartDate;
                    const end = useSprintDates 
                      ? sprints.find(s => s.id === selectedSprint)?.endDate?.split('T')[0]
                      : manualEndDate;
                    const formatDate = (dateStr) => {
                      if (!dateStr) return '';
                      const date = new Date(dateStr + 'T00:00:00');
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    };
                    return `${formatDate(start)} - ${formatDate(end)}`;
                  })()}
                </Text>
              </Stack>
            </Box>
            
            {/* Sprint Status Overview - New 3-column layout */}
            {sprintStatusData && (
              <SprintStatusOverview 
                data={sprintStatusData}
                projectKey={selectedProject}
                sprintId={selectedSprint}
                startDate={useSprintDates ? (sprints.find(s => s.id === selectedSprint)?.startDate?.split('T')[0]) : manualStartDate}
                endDate={useSprintDates ? (sprints.find(s => s.id === selectedSprint)?.endDate?.split('T')[0]) : manualEndDate}
                useSprintMode={useSprintDates}
              />
            )}
            
            {/* OLD OVERVIEW METRICS CARD - Commented out for easy restoration
            Uncomment this section to restore the original 5-tile metric layout */}
            {/* <Box padding="space.300" backgroundColor="color.background.neutral.subtle">
              <Stack space="space.300">
                <Heading size="medium">Overview</Heading>
                <Inline space="space.200" shouldWrap alignBlock="stretch">
                  <MetricTile 
                    label="Committed at Start"
                    value={metrics.committedAtStart || 0}
                    subtitle="Initial commitment"
                  />
                  <MetricTile 
                    label="Committed Carryover"
                    value={metrics.committedCarryover || 0}
                    subtitle="From previous sprint"
                  />
                  <MetricTile 
                    label="Added Mid-sprint"
                    value={metrics.addedMidSprint || 0}
                    subtitle="Added during sprint"
                  />
                  <MetricTile 
                    label="Completed"
                    value={metrics.completed || 0}
                    subtitle="Finished in Done status"
                  />
                  <MetricTile 
                    label="Incomplete Carryover"
                    value={metrics.incompleteCarryover || 0}
                    subtitle="Not done, carrying over"
                  />
                </Inline>
              </Stack>
            </Box> */}

            {/* Issue Lists Section */}
            <Stack space="space.300">
              <Heading size="medium">Sprint Status Detail</Heading>
              
              <IssueListCard 
                title="Committed"
                issues={allCommittedIssues}
                count={metrics.committedAtStart || 0}
                countColor="blue"
              />
              
              <IssueListCard 
                title="Complete"
                issues={completedIssues}
                count={metrics.completed || metrics.throughput || 0}
                countColor="green"
              />
              
              <IssueListCard 
                title="Incomplete"
                issues={uncompletedIssues}
                count={metrics.incompleteCarryover || metrics.carryoverIssues || 0}
                countColor="orange"
              />
            </Stack>

            {/* Footer - matching PDF footer */}
            <Box xcss={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'space.200', borderTop: '1px solid', borderColor: 'color.border' }}>
              <Text color="color.text.subtlest" size="small">
                Generated {new Date().toLocaleString('en-US', { 
                  month: '2-digit', 
                  day: '2-digit', 
                  year: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })} by Sprint Weekly for Jira
              </Text>
            </Box>
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
