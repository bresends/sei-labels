export type ProcessStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface ProcessInfo {
  number: string;
  status: ProcessStatus;
  errorMessage?: string;
  timestamp?: Date;
}

export interface ProcessingResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  processes: ProcessInfo[];
  startTime: Date;
  endTime?: Date;
}
