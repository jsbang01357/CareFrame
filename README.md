# CareFrame · 영희

한국어 음성 또는 텍스트로 가상 증상을 이야기하고, 원문 근거와 미확인 항목이 구분된 사전 문진 자료를 인쇄하는 Next.js 앱이다.

현재 지원 범위는 성인 본인의 상복부·명치 불편감 경로다. 가상 증례 시연 전용이며 임상 프로토콜 검토 미완료다. 진단·처방·응급질환 배제·의료적 안전 보증을 제공하지 않는다.

## 실행

Node.js 22 이상에서 다음 명령을 실행한다.

```sh
npm ci
npm run dev
```

브라우저에서 `http://127.0.0.1:3000`을 연다. 음성은 마이크 권한과 WebRTC가 필요하며 발표 환경은 Chrome을 우선한다.

`.env.example`의 환경변수 이름을 참고해 `.env.local`에 서버 API 키를 설정한다. 실제 키를 채팅·Git·클라이언트 코드에 넣지 않는다. `APP_ORIGIN`을 설정하는 경우 브라우저가 사용하는 origin과 정확히 일치시킨다.

| 변수 | 용도 |
|---|---|
| OPENAI_API_KEY | 서버 전용 일반 키 |
| REALTIME_MODEL | 기본 gpt-realtime-2.1 |
| REALTIME_TRANSCRIPTION_MODEL | 기본 gpt-4o-mini-transcribe. VAD 호환 후보로 선택 |
| REALTIME_VOICE | 기본 marin |
| EXTRACT_MODEL | 기본 gpt-4.1 |
| APP_ORIGIN | 선택. 배포 시 허용할 앱 origin |

`gpt-live-transcribe` 전사용 세션의 VAD 제약 때문에 기본 전사 모델을 handoff 후보에서 변경했다. 세션 내부 호환성은 실제 음성 검증에서 확인한다.

## 사용

1. AI 처리/가상 증례 고지를 확인하고 음성 또는 텍스트를 시작한다.
2. 현재 질문에 답한다. 음성 자동 응답은 꺼져 있으며 서버가 승인한 문장만 재생 요청한다.
3. 수집된 항목에서 원문을 확인한다. 전사 정정은 원래 문장 전체를 대체하며 이전 원문은 이력에 남는다.
4. 종료·내용 확인 후 브라우저 인쇄로 문진표를 출력한다. 미확인 항목은 정상·없음으로 바꾸지 않는다.

개발용 고정 증례는 시작 화면 하단에 별도로 있다. 고정된 사실 후보를 엔진에 넣는 UI 확인 기능이며 실제 음성·추출 API 성능을 의미하지 않는다. 실제 API 실패를 이 모드로 자동 전환하지 않는다.

## 검증

```sh
npm test
npm run typecheck
npm run build
npm run evaluate:live
npm run prepare:audio
```

실제 API 평가는 로컬 서버와 API 설정이 있어야 하며 유료 API를 호출한다. `prepare:audio`는 고정 긴급 안내 MP3를 실제 TTS API로 생성한다. 안내 문구의 임상 검토와 음성 내용 수동 확인은 별도로 필요하다.

테스트는 순수 상태/규칙, 서버 경계, 가짜 음성 transport를 구분한다. 실제 API 결과는 `evaluation/results.json`과 `evaluation/summary.md`, 실제 마이크 확인 상태는 `evaluation/voice-checks.md`에 남긴다. 결과 파일의 가상 증례는 개발자가 이미 본 회귀 자료이며 임상 검증이나 독립 holdout이 아니다.

## 구조

- `lib/interview/`: 사실 후보 추출, 원문 검증, 결정적 상태·질문·위험 처리.
- `lib/voice/`: 단일 입력 큐, 자동 응답 억제, 끼어들기, 마이크 수명 관리.
- `lib/report/`: 현재 InterviewState를 출력 자료로 변환. 추가 LLM 요약 없음.
- `app/api/`: stateless 서버 경로. 일반 키를 브라우저로 반환하지 않음.
- `data/protocol.ts`: 문진 항목·질문·고정 안내. 검토 상태 미완료.
- `data/cpx-qna-catalog.json`: CPX 급성 복통·가슴 통증 원문의 병력청취 질문을 정리한 초안(163문항). 환자 답변 대본은 원본에 없어 포함하지 않았다. 현재 실행 문진과는 연결되지 않았으며, 임상 검토와 필드 매핑이 필요하다.
- `CareFrame_Codex_Handoff_v1/`: 전달받은 설계 원문 보존.
- `planning/PROJECT_DESIGN.md`: 구현 설계 및 v1.1 보완사항.

상태는 브라우저 메모리에만 있다. 새로고침 시 삭제되며 DB/로그인/세션 맵/localStorage는 없다. Responses의 store=false와 앱의 무저장은 공급자 측 보존이 없다는 뜻이 아니다.

## 배포 전 남은 확인

실제 음성 V01~V03, 최종 고정 안내 음성 수동 확인, 임상 프로토콜 검토자·일시·버전 기록, 인쇄 용지 검토, 호스팅·사용 예산·요청 접근 제한 확인이 필요하다. 공개 배포는 아직 하지 않았다. Next.js 서버 route가 있으므로 정적 export만으로 배포할 수 없다.
