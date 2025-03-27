# Docker 이미지 분석 백엔드 API 명세서

## 기본 정보
- 기본 URL: `http://localhost:3001/api`
- 응답 형식: JSON

## 인증
현재 버전에서는 인증이 필요하지 않습니다. 추후 업데이트에서 추가될 예정입니다.

## API 엔드포인트

### 1. 도커 이미지 분석 요청

이미지 분석 작업을 요청하고 작업 ID를 반환합니다.

- URL: `/docker/analyze`
- 메서드: `POST`
- 요청 본문:
  ```json
  {
    "imageUrl": "string" // 도커 이미지 URL (예: nginx:latest)
  }
  ```
- 성공 응답 (200 OK):
  ```json
  {
    "jobId": "string", // 작업 ID
    "imageUrl": "string", // 요청한 도커 이미지 URL
    "status": "PENDING", // 작업 상태 (PENDING, PROCESSING, COMPLETED, FAILED)
    "createdAt": "string" // 작업 생성 시간 (ISO8601 형식)
  }
  ```
- 오류 응답 (400 Bad Request):
  ```json
  {
    "error": "이미지 URL이 필요합니다"
  }
  ```

### 2. 분석 작업 상태 확인

작업 ID로 분석 작업 상태를 확인합니다.

- URL: `/docker/status/:jobId`
- 메서드: `GET`
- 경로 매개변수:
  - `jobId`: 작업 ID
- 성공 응답 (200 OK) - 진행 중:
  ```json
  {
    "jobId": "string",
    "imageUrl": "string",
    "status": "PROCESSING", // PENDING 또는 PROCESSING
    "createdAt": "string"
  }
  ```
- 성공 응답 (200 OK) - 완료:
  ```json
  {
    "jobId": "string",
    "imageUrl": "string",
    "status": "COMPLETED",
    "createdAt": "string",
    "completedAt": "string", // 작업 완료 시간
    "result": {
      "id": "string",
      "imageUrl": "string",
      "timestamp": "string",
      "vulnerabilities": [
        {
          "id": "string", // CVE ID
          "severity": "HIGH", // HIGH, MEDIUM, LOW
          "description": "string"
        }
      ],
      "summary": {
        "high": 0, // 높은 심각도 취약점 수
        "medium": 0, // 중간 심각도 취약점 수
        "low": 0, // 낮은 심각도 취약점 수
        "total": 0 // 총 취약점 수
      },
      "rawOutput": "string" // 분석 결과 원본 텍스트
    }
  }
  ```
- 성공 응답 (200 OK) - 실패:
  ```json
  {
    "jobId": "string",
    "imageUrl": "string",
    "status": "FAILED",
    "createdAt": "string",
    "error": "string" // 실패 원인
  }
  ```
- 오류 응답 (404 Not Found):
  ```json
  {
    "error": "요청한 작업을 찾을 수 없습니다"
  }
  ```

### 3. 분석 결과 기록 조회

이전 분석 결과 목록을 조회합니다.

- URL: `/docker/history`
- 메서드: `GET`
- 쿼리 매개변수:
  - `limit`: 결과 제한 개수 (기본값: 10)
  - `offset`: 페이지 오프셋 (기본값: 0)
- 성공 응답 (200 OK):
  ```json
  {
    "results": [ 
      // 분석 결과 객체 배열
    ],
    "total": 0, // 전체 결과 개수
    "limit": 10, // 현재 페이지 크기
    "offset": 0 // 현재 오프셋
  }
  ```

### 4. 특정 분석 결과 조회

특정 분석 결과를 ID로 조회합니다.

- URL: `/docker/results/:resultId`
- 메서드: `GET`
- 경로 매개변수:
  - `resultId`: 결과 ID
- 성공 응답 (200 OK):
  ```json
  {
    // 분석 결과 객체
  }
  ```
- 오류 응답 (404 Not Found):
  ```json
  {
    "error": "요청한 분석 결과를 찾을 수 없습니다"
  }
  ```

## 상태 코드

- 200 OK: 요청 성공
- 400 Bad Request: 잘못된 요청 형식
- 404 Not Found: 리소스를 찾을 수 없음
- 500 Internal Server Error: 서버 내부 오류 