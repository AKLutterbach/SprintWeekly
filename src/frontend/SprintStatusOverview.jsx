import React from 'react';
import { Box, Stack, Inline, Text } from '@forge/react';
import { view } from '@forge/bridge';

// Using Atlassian design tokens (closest match to PDF colors)
// Note: Forge UI Kit xcss ONLY supports design tokens, not custom RGB/hex colors
const COLORS = {
  // Large card borders - using lightest available color tokens
  committedBorder: 'color.background.discovery',      // Light blue
  completeBorder: 'color.background.success',         // Light green
  incompleteBorder: 'color.background.warning',       // Light orange
  
  // Large card fills
  cardFill: 'color.background.neutral.subtle',        // Light gray
  
  // Small card styling
  smallCardBorder: 'color.border',                    // Gray border
  smallCardFill: 'color.background.neutral.subtle',   // Light gray
  
  // Text colors
  textPrimary: 'color.text',                          // Black text
  textSecondary: 'color.text.subtle',                 // Dark gray
  textSubtle: 'color.text.subtlest'                   // Light gray
};

/**
 * MetricGroup - Displays a large metric card with three breakdown cards underneath
 * 
 * @param {Object} props
 * @param {string} props.title - Main metric title (e.g., "Committed")
 * @param {number} props.totalValue - Total count for this metric
 * @param {string} props.totalSubtitle - Description of the metric
 * @param {Array} props.breakdown - Array of { label: string, value: number }
 * @param {string} props.jql - JQL query for drill-down on the main card
 * @param {string} props.borderColor - CSS color string for the card border  
 * @param {string} props.fillColor - CSS color string for the card background
 * @param {Function} props.onCardClick - Optional click handler for large card
 * @param {Function} props.onBreakdownClick - Optional click handler for breakdown cards
 */
const MetricGroup = ({ title, totalValue, totalSubtitle, breakdown, jql, borderColor, fillColor, onCardClick, onBreakdownClick }) => {
  const handleLargeCardClick = () => {
    if (onCardClick) {
      onCardClick(jql, title);
    }
  };

  return (
  <Stack space="space.200" alignInline="center">
    {/* Large top card with colored background */}
    <Box
      onClick={handleLargeCardClick}
      backgroundColor={borderColor}
      xcss={{
        borderRadius: 'border.radius.200',
        textAlign: 'center',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 'space.025',
        cursor: jql ? 'pointer' : 'default'
      }}
    >
      {/* Inner white card */}
      <Box
        backgroundColor={fillColor}
        xcss={{
          borderRadius: 'border.radius.100',
          width: '100%',
          padding: 'space.300',
          minHeight: '120px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
      <Stack space="space.100" alignInline="center">
        <Text 
          weight="bold" 
          xcss={{ 
            color: COLORS.textSecondary,
            fontSize: '11pt'
          }}
        >
          {title}
        </Text>
        <Text xcss={{ 
          fontSize: '24pt', 
          fontWeight: 'normal',
          color: COLORS.textPrimary,
          lineHeight: '1'
        }}>
          {String(totalValue)}
        </Text>
        <Box xcss={{ maxWidth: '90%' }}>
          <Text 
            size="small" 
            align="center"
            xcss={{ 
              color: COLORS.textSubtle,
              fontSize: '8pt'
            }}
          >
            {totalSubtitle}
          </Text>
        </Box>
      </Stack>
      </Box>
    </Box>
    
    {/* Connector lines */}
    <Box xcss={{ width: '100%', height: '0px', position: 'relative', marginTop: '11px', marginBottom: '11px' }}>
      {/* Vertical line from center of big card */}
      <Box xcss={{
        position: 'absolute',
        bottom: '0',
        left: '50%',
        width: '1px',
        height: '11px',
        backgroundColor: '#dcdcdc',
        transform: 'translateX(-50%)'
      }} />
      
      {/* Horizontal connector bar */}
      <Box xcss={{
        position: 'absolute',
        bottom: '-11px',
        left: '16.66%',
        right: '16.66%',
        height: '1px',
        backgroundColor: '#dcdcdc'
      }} />
      
      {/* Three vertical lines down to small cards */}
      <Box xcss={{
        position: 'absolute',
        top: '-11px',
        left: '16.66%',
        width: '1px',
        height: '11px',
        backgroundColor: '#dcdcdc'
      }} />
      <Box xcss={{
        position: 'absolute',
        top: '-11px',
        left: '50%',
        width: '1px',
        height: '11px',
        backgroundColor: '#dcdcdc',
        transform: 'translateX(-50%)'
      }} />
      <Box xcss={{
        position: 'absolute',
        top: '-11px',
        right: '16.66%',
        width: '1px',
        height: '11px',
        backgroundColor: '#dcdcdc'
      }} />
    </Box>
    
    {/* Three small breakdown cards */}
    <Inline space="space.100" spread="space-between" alignBlock="stretch">
      {breakdown.map((item, index) => {
        const handleBreakdownClick = () => {
          if (onBreakdownClick && item.jql) {
            onBreakdownClick(item.jql, `${title} - ${item.label}`);
          }
        };

        return (
        <Box 
          key={index}
          xcss={{ flex: '1 1 0', minWidth: '0' }}
        >
          <Box
            onClick={handleBreakdownClick}
            backgroundColor={COLORS.smallCardFill}
            xcss={{
              borderRadius: 'border.radius.100',
              minHeight: '60px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: 'space.150',
              borderWidth: 'border.width',
              borderStyle: 'solid',
              borderColor: COLORS.smallCardBorder,
              cursor: item.jql ? 'pointer' : 'default'
            }}
          >
            <Stack space="space.050" alignInline="center">
              <Text 
                xcss={{
                  fontSize: '12pt',
                  fontWeight: 'normal',
                  color: COLORS.textPrimary
                }}
              >
                {String(item.value)}
              </Text>
              <Text 
                align="center"
                xcss={{
                  fontSize: '7pt',
                  color: COLORS.textSecondary
                }}
              >
                {item.label}
              </Text>
            </Stack>
          </Box>
        </Box>
        );
      })}  
    </Inline>
  </Stack>
  );
};

/**
 * SprintStatusOverview - Main component showing three metric groups
 * 
 * This component displays a responsive 3-column layout with:
 * - Committed issues (left column)
 * - Completed issues (middle column)
 * - Incomplete issues (right column)
 * 
 * Each column contains:
 * - A large primary card showing the total count
 * - Connector lines
 * - Three smaller cards showing the breakdown by origin
 * 
 * @param {Object} props
 * @param {Object} props.data - Sprint status metrics data
 * @param {Object} props.data.committed - Committed issues data
 * @param {number} props.data.committed.total - Total committed issues
 * @param {Object} props.data.committed.breakdown - Origin breakdown for committed issues
 * @param {Object} props.data.completed - Completed issues data
 * @param {number} props.data.completed.total - Total completed issues
 * @param {Object} props.data.completed.breakdown - Origin breakdown for completed issues
 * @param {Object} props.data.incomplete - Incomplete issues data
 * @param {number} props.data.incomplete.total - Total incomplete issues
 * @param {Object} props.data.incomplete.breakdown - Origin breakdown for incomplete issues
 * @param {Object} props.labels - Optional custom labels for localization
 * @param {string} props.projectKey - Project key for JQL generation
 * @param {number} props.sprintId - Sprint ID for JQL generation
 * @param {string} props.startDate - Start date for manual date mode
 * @param {string} props.endDate - End date for manual date mode
 * @param {boolean} props.useSprintMode - Whether using sprint mode or manual dates
 */
export const SprintStatusOverview = ({ data, labels = {}, projectKey, sprintId, startDate, endDate, useSprintMode }) => {
  // Default labels that can be overridden for localization
  const defaultLabels = {
    committedTitle: "Committed",
    committedSubtitle: "Issues the team committed to this sprint",
    completedTitle: "Completed",
    completedSubtitle: "Issues finished by the end of this sprint",
    incompleteTitle: "Incomplete",
    incompleteSubtitle: "Issues not finished by the end of this sprint",
    fromLastSprint: "From last sprint",
    plannedAtStart: "Planned at start",
    addedMidSprint: "Added mid-sprint"
  };

  const l = { ...defaultLabels, ...labels };

  // Build base JQL based on mode
  const baseJQL = useSprintMode && sprintId
    ? `project = "${projectKey}" AND sprint = ${sprintId}`
    : `project = "${projectKey}" AND created >= "${startDate}" AND created <= "${endDate}"`;

  // Click handler to open JQL in new Jira search tab
  const handleCardClick = async (jql, cardTitle) => {
    if (!jql) return;
    
    try {
      console.log(`Opening JQL for ${cardTitle}:`, jql);
      // Use view API to open Jira issue search
      await view.open(`/issues/?jql=${encodeURIComponent(jql)}`);
    } catch (error) {
      console.error('Failed to open JQL drill-down:', error);
    }
  };

  // Prepare breakdown arrays with JQL for each metric group
  const committedBreakdown = [
    { 
      label: l.fromLastSprint, 
      value: data.committed.breakdown.fromLastSprint,
      jql: `${baseJQL} AND created < "${startDate}"`
    },
    { 
      label: l.plannedAtStart, 
      value: data.committed.breakdown.plannedAtStart,
      jql: `${baseJQL} AND created >= "${startDate}" AND created <= "${startDate}"`
    },
    { 
      label: l.addedMidSprint, 
      value: data.committed.breakdown.addedMidSprint,
      jql: `${baseJQL} AND created > "${startDate}"`
    }
  ];

  const completedBreakdown = [
    { 
      label: l.fromLastSprint, 
      value: data.completed.breakdown.fromLastSprint,
      jql: `${baseJQL} AND status = Done AND created < "${startDate}"`
    },
    { 
      label: l.plannedAtStart, 
      value: data.completed.breakdown.plannedAtStart,
      jql: `${baseJQL} AND status = Done AND created >= "${startDate}" AND created <= "${startDate}"`
    },
    { 
      label: l.addedMidSprint, 
      value: data.completed.breakdown.addedMidSprint,
      jql: `${baseJQL} AND status = Done AND created > "${startDate}"`
    }
  ];

  const incompleteBreakdown = [
    { 
      label: l.fromLastSprint, 
      value: data.incomplete.breakdown.fromLastSprint,
      jql: `${baseJQL} AND status != Done AND created < "${startDate}"`
    },
    { 
      label: l.plannedAtStart, 
      value: data.incomplete.breakdown.plannedAtStart,
      jql: `${baseJQL} AND status != Done AND created >= "${startDate}" AND created <= "${startDate}"`
    },
    { 
      label: l.addedMidSprint, 
      value: data.incomplete.breakdown.addedMidSprint,
      jql: `${baseJQL} AND status != Done AND created > "${startDate}"`
    }
  ];

  return (
    <Box padding="space.200">
      <Inline space="space.300" alignBlock="start">
        {/* Committed Column */}
        <Box xcss={{ flex: '1 1 0', minWidth: '0' }}>
          <MetricGroup
            title={l.committedTitle}
            totalValue={data.committed.total}
            totalSubtitle={l.committedSubtitle}
            breakdown={committedBreakdown}
            jql={baseJQL}
            borderColor={COLORS.committedBorder}
            fillColor={COLORS.cardFill}
            onCardClick={handleCardClick}
            onBreakdownClick={handleCardClick}
          />
        </Box>

        {/* Completed Column */}
        <Box xcss={{ flex: '1 1 0', minWidth: '0' }}>
          <MetricGroup
            title={l.completedTitle}
            totalValue={data.completed.total}
            totalSubtitle={l.completedSubtitle}
            breakdown={completedBreakdown}
            jql={`${baseJQL} AND status = Done`}
            borderColor={COLORS.completeBorder}
            fillColor={COLORS.cardFill}
            onCardClick={handleCardClick}
            onBreakdownClick={handleCardClick}
          />
        </Box>

        {/* Incomplete Column */}
        <Box xcss={{ flex: '1 1 0', minWidth: '0' }}>
          <MetricGroup
            title={l.incompleteTitle}
            totalValue={data.incomplete.total}
            totalSubtitle={l.incompleteSubtitle}
            breakdown={incompleteBreakdown}
            jql={`${baseJQL} AND status != Done`}
            borderColor={COLORS.incompleteBorder}
            fillColor={COLORS.cardFill}
            onCardClick={handleCardClick}
            onBreakdownClick={handleCardClick}
          />
        </Box>
      </Inline>
    </Box>
  );
};

export default SprintStatusOverview;
