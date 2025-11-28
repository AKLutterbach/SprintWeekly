import React, { useState, useEffect } from 'react';
import ForgeReconciler, { 
  Text, 
  Heading,
  Box,
  Stack,
  Inline,
  Button,
  Select,
  Spinner,
  SectionMessage,
  DatePicker,
  Toggle,
  Badge,
  ButtonGroup
} from '@forge/react';
import { invoke } from '@forge/bridge';

/**
 * Sprint Weekly - UI Kit Version
 * 
 * This version uses ONLY @forge/react components (UI Kit).
 * The PDF export (via backend resolver) provides the exact styled version.
 */

const App = () => {
  const [loading, setLoading] = useState(false);
  const [statusMetrics, setStatusMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [exportingPDF, setExportingPDF] = useState(false);
  
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

  const exportPDF = async () => {
    if (!statusMetrics) return;
    
    setExportingPDF(true);
    try {
      const sprint = sprints.find(s => s.id === selectedSprint);
      const response = await invoke('exportSprintReport', {
        projectKey: selectedProject,
        sprintId: selectedSprint,
        sprintName: sprint?.name || 'Sprint',
        startDate: sprint?.startDate?.split('T')[0],
        endDate: sprint?.endDate?.split('T')[0],
        statusMetrics
      });
      
      if (response && response.pdfBase64) {
        // Download the PDF
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${response.pdfBase64}`;
        link.download = `Sprint_Report_${selectedProject}_${sprint?.name || 'Report'}.pdf`;
        link.click();
      }
    } catch (e) {
      console.error('Error exporting PDF:', e);
      setError(e.message || 'Failed to export PDF');
    } finally {
      setExportingPDF(false);
    }
  };

  const canGenerate = selectedProject && (useSprintMode ? selectedSprint : (manualStartDate && manualEndDate));

  return (
    <Stack space="medium">
      <Box padding="medium">
        <Heading size="large">Sprint Weekly - Status Overview</Heading>
      </Box>

      {error && (
        <SectionMessage appearance="error" title="Error">
          <Text>{error}</Text>
        </SectionMessage>
      )}

      <Box padding="medium" backgroundColor="neutral">
        <Stack space="medium">
          {/* Project Selection */}
          <Inline space="medium" alignBlock="center">
            <Box>
              <Text weight="bold">Project:</Text>
            </Box>
            <Select
              value={selectedProject || ''}
              onChange={(value) => setSelectedProject(value)}
              isDisabled={loadingProjects}
            >
              <option value="">Select Project...</option>
              {projects.map(p => (
                <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
              ))}
            </Select>
            
            <Toggle
              label="Use Sprint Mode"
              isChecked={useSprintMode}
              onChange={(value) => setUseSprintMode(value)}
            />
          </Inline>

          {/* Sprint or Date Selection */}
          {useSprintMode ? (
            <Inline space="medium" alignBlock="center">
              <Box>
                <Text weight="bold">Sprint:</Text>
              </Box>
              <Select
                value={selectedSprint?.toString() || ''}
                onChange={(value) => setSelectedSprint(parseInt(value))}
                isDisabled={loadingSprints || !selectedProject}
              >
                <option value="">Select Sprint...</option>
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.state})
                  </option>
                ))}
              </Select>
            </Inline>
          ) : (
            <Inline space="medium" alignBlock="center">
              <Box>
                <Text weight="bold">Start Date:</Text>
              </Box>
              <DatePicker
                value={manualStartDate}
                onChange={(value) => setManualStartDate(value)}
              />
              <Box>
                <Text weight="bold">End Date:</Text>
              </Box>
              <DatePicker
                value={manualEndDate}
                onChange={(value) => setManualEndDate(value)}
              />
            </Inline>
          )}

          {/* Action Buttons */}
          <ButtonGroup>
            <Button
              appearance="primary"
              onClick={generateReport}
              isDisabled={!canGenerate || loading}
            >
              {loading ? 'Loading...' : 'Generate Report'}
            </Button>
            
            {statusMetrics && (
              <Button
                onClick={exportPDF}
                isDisabled={exportingPDF}
              >
                {exportingPDF ? 'Exporting...' : 'Export PDF'}
              </Button>
            )}
          </ButtonGroup>
        </Stack>
      </Box>

      {loading && (
        <Box padding="large" xcss={{ textAlign: 'center' }}>
          <Spinner size="large" label="Loading sprint data..." />
        </Box>
      )}

      {statusMetrics && !loading && (
        <StatusMetricsDisplay data={statusMetrics} />
      )}
    </Stack>
  );
};

/**
 * Component to display status metrics using UI Kit components
 */
const StatusMetricsDisplay = ({ data }) => {
  if (!data || !data.byStatus) {
    return null;
  }

  const committed = data.byStatus.committed || { total: 0, issues: [] };
  const complete = data.byStatus.complete || { total: 0, issues: [] };
  const incomplete = data.byStatus.incomplete || { total: 0, issues: [] };

  return (
    <Stack space="medium">
      <Heading size="medium">Sprint Status Overview</Heading>
      
      {/* Main Status Cards */}
      <Inline space="medium" spread="space-between">
        <MetricCard 
          title="Committed" 
          value={committed.total}
          description="Issues that were committed to this sprint"
          appearance="inprogress"
        />
        <MetricCard 
          title="Complete" 
          value={complete.total}
          description="Issues finished by the end of the sprint"
          appearance="success"
        />
        <MetricCard 
          title="Incomplete" 
          value={incomplete.total}
          description="Issues unfinished by the end of this sprint"
          appearance="warning"
        />
      </Inline>

      {/* Issue Details */}
      <Stack space="medium">
        <Heading size="small">Sprint Status Detail</Heading>
        
        {committed.issues.length > 0 && (
          <IssueSection title="Committed" issues={committed.issues} appearance="inprogress" />
        )}
        
        {complete.issues.length > 0 && (
          <IssueSection title="Complete" issues={complete.issues} appearance="success" />
        )}
        
        {incomplete.issues.length > 0 && (
          <IssueSection title="Incomplete" issues={incomplete.issues} appearance="warning" />
        )}
      </Stack>
    </Stack>
  );
};

/**
 * Metric card component
 */
const MetricCard = ({ title, value, description, appearance }) => (
  <Box padding="medium" backgroundColor={appearance} xcss={{ borderRadius: '8px', flex: 1 }}>
    <Stack space="small" alignInline="center">
      <Heading size="small">{title}</Heading>
      <Heading size="xlarge">{value}</Heading>
      <Text size="small">{description}</Text>
    </Stack>
  </Box>
);

/**
 * Issue section component
 */
const IssueSection = ({ title, issues, appearance }) => (
  <Box padding="medium" backgroundColor="neutral">
    <Stack space="small">
      <Inline space="small" alignBlock="center">
        <Badge appearance={appearance}>{title}</Badge>
        <Text weight="bold">{issues.length} issues</Text>
      </Inline>
      
      <Stack space="small">
        {issues.map((issue) => (
          <Inline key={issue.key} space="medium" spread="space-between">
            <Text weight="bold">{issue.key}</Text>
            <Text>{issue.summary}</Text>
            <Badge>{issue.status}</Badge>
          </Inline>
        ))}
      </Stack>
    </Stack>
  </Box>
);

// Render with ForgeReconciler for native mode
ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
