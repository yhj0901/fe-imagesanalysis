"use server";

import {
  DockerAnalysisResult,
  Vulnerability,
  AnalysisJob,
  AnalysisStatus,
} from "./types";

// 임시 저장소 (실제로는 데이터베이스를 사용해야 함)
const analysisResults: DockerAnalysisResult[] = [];

// 취약점 정보 파싱 함수
function parseVulnerabilities(output: string): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  const lines = output.split("\n");

  // 'VULNERABILITY        SEVERITY        DESCRIPTION' 라인 이후부터 파싱
  let foundHeader = false;

  for (const line of lines) {
    if (
      line.includes("VULNERABILITY") &&
      line.includes("SEVERITY") &&
      line.includes("DESCRIPTION")
    ) {
      foundHeader = true;
      continue;
    }

    if (foundHeader && line.includes("CVE-")) {
      const parts = line.split(/\s{2,}/);
      if (parts.length >= 3) {
        vulnerabilities.push({
          id: parts[0].trim(),
          severity: parts[1].trim() as "HIGH" | "MEDIUM" | "LOW",
          description: parts[2].trim(),
        });
      }
    }
  }

  return vulnerabilities;
}

// 백엔드 API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// 도커 이미지 분석 요청 - 비동기 처리
export async function requestDockerAnalysis(
  imageUrl: string
): Promise<AnalysisJob> {
  try {
    // 백엔드 API에 분석 요청을 보내고 작업 ID를 받음
    const response = await fetch(`${API_URL}/docker/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "분석 요청 중 오류가 발생했습니다");
    }

    const job = await response.json();
    return job as AnalysisJob;
  } catch (error) {
    console.error("Docker 이미지 분석 요청 실패:", error);

    // 개발 환경에서 테스트용 시뮬레이션 데이터
    if (process.env.NODE_ENV === "development") {
      console.log("개발 환경에서 시뮬레이션된 작업 생성");
      const mockJob: AnalysisJob = {
        jobId: Date.now().toString(),
        imageUrl,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      };
      return mockJob;
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : "Docker 이미지 분석 요청 중 오류가 발생했습니다. 다시 시도해주세요."
    );
  }
}

// 분석 작업 상태 확인
export async function checkAnalysisStatus(jobId: string): Promise<AnalysisJob> {
  try {
    // 백엔드 API에서 작업 상태 확인
    const response = await fetch(`${API_URL}/docker/status/${jobId}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "작업 상태 확인 중 오류가 발생했습니다");
    }

    const job = await response.json();

    // 분석이 완료되었고 결과가 있으면 로컬에도 저장
    if (job.status === "COMPLETED" && job.result) {
      await saveAnalysisResult(job.result.imageUrl, job.result.rawOutput);
    }

    return job as AnalysisJob;
  } catch (error) {
    console.error("작업 상태 확인 실패:", error);

    // 개발 환경에서 테스트용 시뮬레이션 데이터
    if (process.env.NODE_ENV === "development") {
      console.log("개발 환경에서 시뮬레이션된 상태 응답");
      // 무작위로 상태 변경 시뮬레이션
      const statuses: AnalysisStatus[] = [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
      ];
      const randomStatus =
        statuses[Math.floor(Math.random() * statuses.length)];

      const mockJob: AnalysisJob = {
        jobId,
        imageUrl: "simulated-image:latest",
        status: randomStatus,
        createdAt: new Date(Date.now() - 60000).toISOString(),
      };

      // COMPLETED 상태일 경우 시뮬레이션 결과 추가
      if (randomStatus === "COMPLETED") {
        mockJob.completedAt = new Date().toISOString();
        const output = `Security Scan for simulated-image:latest:\n\nScanning image...\n\nVULNERABILITY        SEVERITY        DESCRIPTION\nCVE-2021-44906      HIGH            OpenSSL - Remote code execution vulnerability\nCVE-2022-32149      MEDIUM          libtiff - Heap-based buffer overflow\nCVE-2022-37434      LOW             zlib - Memory corruption\n\nFound 3 vulnerabilities\n- 1 high severity\n- 1 medium severity\n- 1 low severity\n\nRecommendation: Update to the latest version or apply security patches.`;

        // 결과 파싱 및 저장
        const vulnerabilities = parseVulnerabilities(output);
        const summary = {
          high: vulnerabilities.filter((v) => v.severity === "HIGH").length,
          medium: vulnerabilities.filter((v) => v.severity === "MEDIUM").length,
          low: vulnerabilities.filter((v) => v.severity === "LOW").length,
          total: vulnerabilities.length,
        };

        mockJob.result = {
          id: jobId,
          imageUrl: "simulated-image:latest",
          timestamp: mockJob.completedAt,
          vulnerabilities,
          summary,
          rawOutput: output,
        };

        // 로컬 저장소에도 저장
        await saveAnalysisResult(
          mockJob.result.imageUrl,
          mockJob.result.rawOutput
        );
      } else if (randomStatus === "FAILED") {
        mockJob.error = "이미지를 불러올 수 없습니다";
      }

      return mockJob;
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : "작업 상태 확인 중 오류가 발생했습니다. 다시 시도해주세요."
    );
  }
}

// 분석 결과 저장 (로컬 저장소용)
export async function saveAnalysisResult(
  imageUrl: string,
  output: string
): Promise<DockerAnalysisResult> {
  const vulnerabilities = parseVulnerabilities(output);

  // 요약 정보 계산
  const summary = {
    high: vulnerabilities.filter((v) => v.severity === "HIGH").length,
    medium: vulnerabilities.filter((v) => v.severity === "MEDIUM").length,
    low: vulnerabilities.filter((v) => v.severity === "LOW").length,
    total: vulnerabilities.length,
  };

  const result: DockerAnalysisResult = {
    id: Date.now().toString(),
    imageUrl,
    timestamp: new Date().toISOString(),
    vulnerabilities,
    summary,
    rawOutput: output,
  };

  // 동일한 이미지 URL로 이미 분석된 결과가 있는지 확인
  const existingIndex = analysisResults.findIndex(
    (r) => r.imageUrl === imageUrl
  );

  if (existingIndex !== -1) {
    // 기존 결과 업데이트
    analysisResults[existingIndex] = result;
  } else {
    // 새 결과 추가
    analysisResults.push(result);
  }

  return result;
}

// 모든 분석 결과 가져오기
export async function getAnalysisResults(): Promise<DockerAnalysisResult[]> {
  // 최신 결과가 위로 오도록 정렬
  return [...analysisResults].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// 특정 분석 결과 가져오기
export async function getAnalysisResultById(
  id: string
): Promise<DockerAnalysisResult | null> {
  return analysisResults.find((result) => result.id === id) || null;
}
