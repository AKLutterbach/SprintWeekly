/**
 * Type definitions for Sprint Status Overview component
 * 
 * These types define the structure of data needed to display
 * the sprint status breakdown by committed/completed/incomplete
 * and the origin of issues (from last sprint, planned, added mid-sprint).
 */

/**
 * OriginBreakdown - Shows where issues came from
 */
export type OriginBreakdown = {
  /** Issues that carried over from the previous sprint */
  fromLastSprint: number;
  
  /** Issues that were included in the sprint at the start (not from previous sprint) */
  plannedAtStart: number;
  
  /** Issues that were added after the sprint began */
  addedMidSprint: number;
};

/**
 * StatusData - Data for one status category (committed/completed/incomplete)
 */
export type StatusData = {
  /** Total count of issues in this status */
  total: number;
  
  /** Breakdown of issues by their origin */
  breakdown: OriginBreakdown;
};

/**
 * SprintStatusMetrics - Complete data structure for sprint status overview
 */
export type SprintStatusMetrics = {
  /** Issues the team committed to this sprint */
  committed: StatusData;
  
  /** Issues finished by the end of this sprint */
  completed: StatusData;
  
  /** Issues not finished by the end of this sprint */
  incomplete: StatusData;
};

/**
 * SprintStatusOverviewLabels - Optional custom labels for localization
 */
export type SprintStatusOverviewLabels = {
  committedTitle?: string;
  committedSubtitle?: string;
  completedTitle?: string;
  completedSubtitle?: string;
  incompleteTitle?: string;
  incompleteSubtitle?: string;
  fromLastSprint?: string;
  plannedAtStart?: string;
  addedMidSprint?: string;
};

/**
 * SprintStatusOverviewProps - Props for the SprintStatusOverview component
 */
export type SprintStatusOverviewProps = {
  /** Sprint status metrics data */
  data: SprintStatusMetrics;
  
  /** Optional custom labels for localization */
  labels?: SprintStatusOverviewLabels;
};
