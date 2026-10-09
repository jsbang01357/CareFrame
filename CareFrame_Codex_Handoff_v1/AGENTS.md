# Project instructions — Younghee
이 파일은 구현 에이전트용 설계 지침이다. 완성된 앱이나 검증 결과가 아니다.

## Mission
A small, honest, working voice-to-handoff prototype.
Success is an observable end-to-end interaction, not the number of features.

## Locked scope
영희 1명, 한국어, 성인 자기 증상, 상복부 불편감,
음성/텍스트 입력, 설정된 위험 신호 중단, 근거 연결 문진표, 인쇄.
그 외는 지원 범위 밖으로 처리한다. 긴급 신호 확인은 범위 판정보다 우선한다.

## Engineering constraints
- Next.js/TypeScript 단일 앱. 별도 FastAPI, DB, auth, vector store 금지.
- 문진 상태의 단일 기준은 InterviewState다. 음성 대화 history는 임상 상태가 아니다.
- 서버는 stateless. 요청마다 필요한 상태·증거를 전달한다.
- API route의 process-global Map을 영속 세션처럼 사용하지 않는다.
- 한 번에 한 개의 turn 요청만 처리한다. 중복 ID와 오래된 응답을 무시한다.
- 문자열·enum·출처를 검증하고, 실패 시 상태를 유지하며 오류를 보여준다.
- 실제 API 실패를 자동 mock으로 바꾸지 않는다.
- 일반 API 키, 음성, 환자 전사를 로그·분석도구·공개 저장소에 남기지 않는다.
- 공급자 저장 정책과 앱의 무저장을 혼동하지 않는다.
- 리포트는 기존 facts의 렌더링. 마지막 자유 생성 요약 호출 금지.
- optional 기능은 P0 통과 전 작성하지 않는다.

## Clinical and conversational constraints
- 실제 딸·의사·응급 감시 시스템이라고 주장하지 않는다.
- 진단명, 약 추천/용량/중단, “괜찮다/안전하다/응급 아니다” 결론 금지.
- not_assessed, unknown, unclear, denied를 분리한다.
- 현재/과거, 본인/타인, 환자 진술/AI 전사를 구분한다.
- 부정 답변은 해당 질문과 연결할 때만 해당 항목에 기록한다.
- 상대가 한 문장에 여러 정보를 말하면 수집할 수 있지만, 새 질문은 한 번에 하나.
- 위험 신호가 있으면 PDF나 나머지 문진을 기다리게 하지 않는다.
- 전사 오류가 가능하므로 “원문 근거 있음”을 “사실 정확함”으로 홍보하지 않는다.
- 임상 프로토콜 검토자·일시·버전과 미검증 한계를 문서화한다.

## Build policy
planning/BUILD_AND_DEMO.md의 시간 제한을 따른다.
한 명의 구현 에이전트가 메인 브랜치에서 일한다.
독립 리뷰 세션을 사용하더라도 코드를 동시에 수정시키지 않는다.
사용량 재설정이나 추가 크레딧이 무제한이라고 가정하지 않는다.
모든 앱 코드·설정·실행 테스트는 행사에서 허용된 Codex로 작성한다.

## Evidence policy
- 테스트 결과는 실제 실행 로그에서만 작성한다.
- 개발용 fixture, 실제 API 결과, 녹화 재생을 화면에서 구분한다.
- 개발에 쓴 12개 증례는 회귀테스트다. 외부 검증·임상시험·독립 holdout이라고 부르지 않는다.
- 녹화는 실제 앱 화면과 실제 출력만 사용한다. 생략·배속을 표시한다.
- source에서 지원하지 않는 54개 공식 CPX 목록을 임의로 만들어 넣지 않는다.
- 사전 설계 자료와 행사 당일 구현/수정 내역을 구분한다.

## End of each milestone
PROGRESS.md: done, executed checks, known failures, next 30 minutes.
실제 동작 확인 후 작은 commit. 실패를 숨기거나 history를 재작성하지 않는다.
