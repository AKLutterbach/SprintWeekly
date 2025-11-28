export interface SprintStatusBreakdown {
  fromLastSprint: number;
  plannedAtStart: number;
  addedMidSprint: number;
}

export interface SprintStatusCategory {
  total: number;
  breakdown: SprintStatusBreakdown;
}

export interface SprintStatusOverviewData {
  committed: SprintStatusCategory;
  completed: SprintStatusCategory;
  incomplete: SprintStatusCategory;
}

export interface SprintReportData {
  overview: SprintStatusOverviewData;
  projectKey: string;
  sprintId?: number;
  sprintName?: string;
  startDate?: string;
  endDate?: string;
}
