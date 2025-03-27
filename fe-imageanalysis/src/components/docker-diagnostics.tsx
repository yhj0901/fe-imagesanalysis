"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  Terminal,
  Clock,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  requestDockerAnalysis,
  checkAnalysisStatus,
  getAnalysisResults,
  getAnalysisResultById,
} from "@/lib/actions";
import { DockerAnalysisResult, AnalysisJob, AnalysisStatus } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

export function DockerDiagnostics() {
  const [imageUrl, setImageUrl] = useState("");
  const [currentJob, setCurrentJob] = useState<AnalysisJob | null>(null);
  const [results, setResults] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<
    DockerAnalysisResult[]
  >([]);
  const [selectedAnalysis, setSelectedAnalysis] =
    useState<DockerAnalysisResult | null>(null);
  const [currentTab, setCurrentTab] = useState<string>("scan");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // 분석 결과 목록 로드
  const loadAnalysisResults = async () => {
    setLoadingHistory(true);
    try {
      const results = await getAnalysisResults();
      setAnalysisResults(results);
    } catch (err) {
      console.error("분석 결과 로드 실패:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 특정 분석 결과 로드
  const loadAnalysisDetail = async (id: string) => {
    try {
      const result = await getAnalysisResultById(id);
      if (result) {
        setSelectedAnalysis(result);
        setCurrentTab("detail");
      }
    } catch (err) {
      console.error("분석 상세 정보 로드 실패:", err);
    }
  };

  // 컴포넌트 마운트시 결과 목록 로드
  useEffect(() => {
    loadAnalysisResults();

    // 컴포넌트가 언마운트될 때 폴링 중지
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  // 작업 상태 폴링 시작
  const startPolling = (jobId: string) => {
    // 이전 폴링이 있으면 중지
    if (pollInterval) {
      clearInterval(pollInterval);
    }

    // 2초마다 작업 상태 확인
    const interval = setInterval(async () => {
      try {
        const job = await checkAnalysisStatus(jobId);
        setCurrentJob(job);

        // 작업이 완료되거나 실패한 경우 폴링 중지
        if (job.status === "COMPLETED" || job.status === "FAILED") {
          clearInterval(interval);
          setPollInterval(null);

          if (job.status === "COMPLETED" && job.result) {
            setResults(job.result.rawOutput);
            await loadAnalysisResults(); // 결과 목록 새로고침
          } else if (job.status === "FAILED" && job.error) {
            setError(job.error);
          }
        }
      } catch (err) {
        console.error("작업 상태 확인 실패:", err);
      }
    }, 2000);

    setPollInterval(interval);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    setCurrentJob(null);
    setSelectedAnalysis(null);

    try {
      if (!imageUrl) {
        throw new Error("Docker 이미지 URL이 필요합니다");
      }

      // 분석 작업 요청
      const job = await requestDockerAnalysis(imageUrl);
      setCurrentJob(job);

      // 작업 상태 폴링 시작
      startPolling(job.jobId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다"
      );
      setLoading(false);
    }
  };

  // 작업 상태에 따른 UI 표시
  const renderJobStatus = () => {
    if (!currentJob) return null;

    const getStatusIcon = (status: AnalysisStatus) => {
      switch (status) {
        case "PENDING":
          return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
        case "PROCESSING":
          return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
        case "COMPLETED":
          return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case "FAILED":
          return <XCircle className="h-4 w-4 text-red-500" />;
      }
    };

    const getStatusText = (status: AnalysisStatus) => {
      switch (status) {
        case "PENDING":
          return "대기 중";
        case "PROCESSING":
          return "분석 중";
        case "COMPLETED":
          return "완료됨";
        case "FAILED":
          return "실패";
      }
    };

    const getProgress = (status: AnalysisStatus) => {
      switch (status) {
        case "PENDING":
          return 25;
        case "PROCESSING":
          return 60;
        case "COMPLETED":
          return 100;
        case "FAILED":
          return 100;
      }
    };

    return (
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">작업 상태</CardTitle>
          {getStatusIcon(currentJob.status)}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{currentJob.imageUrl}</span>
            <Badge>{getStatusText(currentJob.status)}</Badge>
          </div>

          <Progress value={getProgress(currentJob.status)} />

          <div className="text-xs text-muted-foreground">
            {currentJob.status === "PENDING" &&
              "Docker 이미지 다운로드 대기 중..."}
            {currentJob.status === "PROCESSING" && "Docker 이미지 스캔 중..."}
            {currentJob.status === "COMPLETED" &&
              `분석 완료됨 (${new Date(
                currentJob.completedAt || ""
              ).toLocaleString()})`}
            {currentJob.status === "FAILED" && `오류: ${currentJob.error}`}
          </div>
        </CardContent>
        {currentJob.status === "COMPLETED" && results && (
          <CardFooter>
            <Button size="sm" onClick={() => setCurrentTab("history")}>
              결과 기록 보기
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  };

  const renderSeverityBadge = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return <Badge variant="destructive">높음</Badge>;
      case "MEDIUM":
        return <Badge variant="warning">중간</Badge>;
      case "LOW":
        return <Badge>낮음</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scan">스캔</TabsTrigger>
          <TabsTrigger value="history">기록</TabsTrigger>
          <TabsTrigger value="detail" disabled={!selectedAnalysis}>
            상세 정보
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Docker Image 진단</CardTitle>
              <CardDescription>
                Docker 이미지 URL을 입력하고 진단 명령을 실행하여 분석합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="image-url">Docker Image URL</Label>
                  <Input
                    id="image-url"
                    placeholder="e.g., nginx:latest, ubuntu:20.04"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    disabled={
                      loading ||
                      currentJob?.status === "PROCESSING" ||
                      currentJob?.status === "PENDING"
                    }
                  />
                </div>

                <Button
                  type="submit"
                  disabled={
                    loading ||
                    !imageUrl ||
                    currentJob?.status === "PROCESSING" ||
                    currentJob?.status === "PENDING"
                  }
                  className="w-full"
                >
                  {loading ||
                  currentJob?.status === "PROCESSING" ||
                  currentJob?.status === "PENDING"
                    ? "분석 중..."
                    : "Run Diagnostic"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>오류</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {renderJobStatus()}

          {results && !currentJob && (
            <Card className="mt-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">결과</CardTitle>
                <Terminal className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-md overflow-auto max-h-[400px] text-sm">
                  {results}
                </pre>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(results);
                  }}
                  className="text-xs"
                >
                  클립보드에 복사
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>분석 기록</CardTitle>
              <CardDescription>
                이전에 실행한 모든 Docker 이미지 분석 결과입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex justify-center p-4">로딩 중...</div>
              ) : analysisResults.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground">
                  분석 기록이 없습니다. Docker 이미지를 스캔해보세요.
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {analysisResults.map((result) => (
                      <Card
                        key={result.id}
                        className="cursor-pointer hover:bg-accent/5"
                        onClick={() => loadAnalysisDetail(result.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-medium">{result.imageUrl}</h4>
                              <div className="flex items-center text-sm text-muted-foreground mt-1">
                                <Clock className="h-3 w-3 mr-1" />
                                <span>
                                  {new Date(result.timestamp).toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {result.summary.high > 0 && (
                                <Badge variant="destructive">
                                  {result.summary.high} 높음
                                </Badge>
                              )}
                              {result.summary.medium > 0 && (
                                <Badge variant="warning">
                                  {result.summary.medium} 중간
                                </Badge>
                              )}
                              {result.summary.low > 0 && (
                                <Badge>{result.summary.low} 낮음</Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                onClick={loadAnalysisResults}
                disabled={loadingHistory}
              >
                새로고침
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="detail" className="mt-4">
          {selectedAnalysis && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>{selectedAnalysis.imageUrl}</CardTitle>
                    <CardDescription>
                      {new Date(selectedAnalysis.timestamp).toLocaleString()}
                    </CardDescription>
                  </div>
                  <Shield className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">요약</h3>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      총 {selectedAnalysis.summary.total}개 취약점
                    </Badge>
                    {selectedAnalysis.summary.high > 0 && (
                      <Badge variant="destructive">
                        {selectedAnalysis.summary.high} 높음
                      </Badge>
                    )}
                    {selectedAnalysis.summary.medium > 0 && (
                      <Badge variant="warning">
                        {selectedAnalysis.summary.medium} 중간
                      </Badge>
                    )}
                    {selectedAnalysis.summary.low > 0 && (
                      <Badge>{selectedAnalysis.summary.low} 낮음</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">취약점 목록</h3>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {selectedAnalysis.vulnerabilities.map((vuln) => (
                        <div key={vuln.id} className="border rounded-md p-3">
                          <div className="flex justify-between items-center">
                            <div className="font-medium">{vuln.id}</div>
                            {renderSeverityBadge(vuln.severity)}
                          </div>
                          <div className="text-sm mt-1">{vuln.description}</div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">원본 출력</h3>
                  <pre className="bg-muted p-3 rounded-md overflow-auto text-xs max-h-[200px]">
                    {selectedAnalysis.rawOutput}
                  </pre>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentTab("history")}
                >
                  목록으로 돌아가기
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedAnalysis.rawOutput);
                  }}
                >
                  클립보드에 복사
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
