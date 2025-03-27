export interface Vulnerability {
  id: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
}

export interface DockerAnalysisResult {
  id: string;
  imageUrl: string;
  timestamp: string;
  vulnerabilities: Vulnerability[];
  summary: {
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  rawOutput: string;
}

export type AnalysisStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface AnalysisJob {
  jobId: string;
  imageUrl: string;
  status: AnalysisStatus;
  createdAt: string;
  completedAt?: string;
  result?: DockerAnalysisResult;
  error?: string;
}
