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

export interface IssueDetail {
  key: string;
  summary: string;
  status: string;
}

export interface SprintReportData {
  overview: SprintStatusOverviewData;
  projectKey: string;
  projectName?: string;
  sprintId?: number;
  sprintName?: string;
  startDate?: string;
  endDate?: string;
  issues?: {
    completed: IssueDetail[];
    uncompleted: IssueDetail[];
    carryoverBlockers: IssueDetail[];
  };
}
