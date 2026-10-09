# CareFrame · 영희

한국어 음성 또는 텍스트로 가상 증상을 이야기하고, 원문 근거와 미확인 항목이 구분된 Pre-Visit Clinical Note를 인쇄하거나 EMR 붙여넣기 텍스트로 복사하는 Next.js 앱이다.

시작 화면에서 환자가 먼저 주호소를 고른다. CPX 48개 가운데 38개 증상 주제는 첫 질문과 Clinical Note에 반영하고, 목록에 없는 증상도 직접 입력할 수 있다. 10개 상담 주제는 아직 선택할 수 없다. 세부 CPX 질문은 모두 임상 검토 전이라 실행하지 않고 공통 문진으로 이어간다. 부위가 명치·상복부가 아니라는 이유로 문진을 종료하지 않는다. 성인 가상 증례의 나이·성별을 받으며, 답변은 최대 24회, 세션은 최대 15분으로 제한한다. 위험 신호·사용자 종료·명시적인 소아/타인 요청은 별도로 처리한다. 임상 프로토콜 검토 미완료이며 진단·처방·응급질환 배제·의료적 안전 보증을 제공하지 않는다.

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

1. 환자가 가장 불편한 증상이나 부위를 고르고 성인 가상 증례의 나이·성별을 입력한다. 상담 주제는 아직 열리지 않는다.
2. AI 처리/가상 증례 고지를 확인하고 음성 또는 텍스트를 시작한다. 선택한 CPX 주제는 방향 표시와 첫 질문에만 쓰며, 실제 증상은 환자의 말로 확인한다.
3. 공통 문진 질문에 답한다. 음성 자동 응답은 꺼져 있으며 서버가 승인한 문장만 재생 요청한다.
4. 수집된 항목에서 원문을 확인한다. 전사 정정은 원래 문장 전체를 대체하며 이전 원문은 이력에 남는다.
5. 종료 후 의료진용 `Pre-Visit Clinical Note`에서 S(Subjective), 환자 선택 주제, 원문 근거를 확인한다. `EMR용 텍스트 복사` 또는 `A4 인쇄 / PDF 저장`을 선택한다. 미확인 항목은 정상·없음으로 바꾸지 않는다.
6. O에는 신체진찰·자가측정 미시행을, A/P에는 의료진 확인 전임을 표시한다. AI는 진단과 치료계획을 생성하지 않는다. NRS·통증 지속시간·완화 요인·수술력·약물 알레르기·가족력은 현재 미확인으로 남는다.

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
- `lib/report/`: 하나의 InterviewState에서 SOAP-S 임상 노트와 EMR 복사용 텍스트를 결정적으로 생성. 추가 LLM 요약 없음.
- Clinical note는 age/sex, NRS, episode duration, relieving factors, PSHx, allergy, family history를 현재 질문이 수집하지 않으므로 미확인으로 출력한다. 이 항목을 음성/정상으로 바꾸지 않는다.
- 복사용 텍스트는 검토 화면에서 사용자가 버튼을 눌러 복사한다. 외부 EMR에 자동 전송하지 않는다.
- `app/api/`: stateless 서버 경로. 일반 키를 브라우저로 반환하지 않음.
- `data/protocol.ts`: 문진 항목·질문·고정 안내. 검토 상태 미완료.
- `data/qna-catalogs/index.json`: CPX 48개 주제 인덱스. 시작 화면의 주호소 선택에 연결되어 있다. 가슴통증·두통·복통은 원문 기반 초안, 나머지 45개는 질문 골격이며 모두 임상 검토 전이다. 상담 주제는 비활성이고, CPX 문항은 현재 공통 문진 실행 흐름에 사용하지 않는다. 구조 참고와 출처 정책은 `data/qna-catalogs/REFERENCES.md`에 있다.
- `data/cpx-catalog.ts`: 48개 인덱스 조회와 선택 가능한 증상 주제 검증.
- `CareFrame_Codex_Handoff_v1/`: 전달받은 설계 원문 보존.
- `planning/PROJECT_DESIGN.md`: 구현 설계 및 v1.1 보완사항.

상태는 브라우저 메모리에만 있다. 주호소 선택과 나이·성별을 포함한 세션은 새로고침 시 삭제되며 DB/로그인/세션 맵/localStorage는 없다. 나이·성별·주호소 선택은 추출 모델에 보내지 않는다. Responses의 store=false와 앱의 무저장은 공급자 측 보존이 없다는 뜻이 아니다.

## 배포 전 남은 확인

실제 음성 V01~V03, 최종 고정 안내 음성 수동 확인, 임상 프로토콜 검토자·일시·버전 기록, 인쇄 용지 검토, 호스팅·사용 예산·요청 접근 제한 확인이 필요하다. 공개 배포는 아직 하지 않았다. Next.js 서버 route가 있으므로 정적 export만으로 배포할 수 없다.
