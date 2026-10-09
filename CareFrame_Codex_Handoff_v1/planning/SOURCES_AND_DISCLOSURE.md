# 출처와 공개 사항
확인 기준일: 2026-10-09
이 패키지는 ChatGPT와의 대화에 기반한 제품 기획·설계 자료다.
프로젝트 코드, API 연결, 테스트 실행 결과는 포함하지 않는다.
외부 AI 설계 지원의 행사 허용 범위는 운영진에게 확인하고 이용 내역을 공개한다.

## 자료의 성격
사용자 제공 전제: 1인 팀, 개발 7시간, 트랙 내 20팀, 상위 3위 목표.
제품·UX·데이터 구조·예제·시간 배분: 이번 작업에서 제안한 설계.
공식 출처로 확인한 것: 행사 규정, API 기능/제약, 공개 의료 안전 참고자료.
확인하지 않은 것: 계정별 API 접근, 크레딧 지급/한도 재설정,
실제 SDK 실행, 임상 타당성, 사용자 만족, 진료시간 단축, 수상 확률.

## S1. 행사 공식 안내
https://codex-community-korea.skysplit.chatgpt.site/hackathon/seoul-2026-10?referrer=luma
근거 범위: 심사 항목, 17:00 마감, 4분 1차 발표, Codex/빈 저장소/사전 작업 공개, 녹화 대비.
제품을 이렇게 만들면 수상한다는 근거는 아니다. 최종 현장 공지가 우선한다.

## S2. OpenAI Voice Agents Quickstart
https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/
근거 범위: 브라우저 RealtimeSession, WebRTC, 서버 발급 단기 인증키.

## S3. OpenAI Agents SDK — Building Voice Agents
https://openai.github.io/openai-agents-js/guides/voice-agents/build/
근거 범위: 입력 전사, 수동 응답 제어, 대화 중단, 전사 비동기성 및 한계.
SDK 설정은 현재 설치 버전의 타입과 일치하는지 실행 과정에서 확인한다.

## S4. OpenAI Realtime VAD / Client Secrets
https://developers.openai.com/api/docs/guides/realtime-vad
https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets
근거 범위: 응답 생성/중단 설정, 단기 키 발급. 완전한 의료 안전 보장은 아니다.

## S5. GPT-Realtime-2.1
https://developers.openai.com/api/docs/models/gpt-realtime-2.1
근거 범위: 실시간 음성 및 function calling. Structured Outputs 미지원.
현재 계정에서 해당 모델에 접근 가능한지는 별도 확인해야 한다.

## S6. Structured Outputs
https://developers.openai.com/api/docs/guides/structured-outputs
근거 범위: 구조화된 응답 형식. 형식 준수가 사실의 정확성을 보장하지 않음.

## S7. 추출/전사/음성 모델
https://developers.openai.com/api/docs/models/gpt-4.1-mini
https://developers.openai.com/api/docs/guides/realtime-transcription
https://developers.openai.com/ko-KR/api/docs/models/gpt-4o-mini-transcribe
https://developers.openai.com/api/docs/models/gpt-4o-mini-tts
근거 범위: 모델 기능과 사용 위치. 현재 계정 허용 여부나 한국어 임상 성능의 검증이 아님.

## S8. OpenAI Data controls
https://developers.openai.com/api/docs/guides/your-data
근거 범위: endpoint별 저장/로그 정책. store=false와 앱의 무저장을 zero retention으로 혼동하지 않는다.

## S9. NHS — Stomach ache
https://www.nhs.uk/symptoms/stomach-ache/
근거 범위: 심한/갑작스러운 복통, 출혈, 흉통, 호흡·의식 관련 문제의 긴급 평가 필요성.
영국의 신고번호/진료체계를 그대로 한국 서비스에 복사하지 않는다.
본 프로토콜의 전체 질문·규칙·민감도·특이도를 검증하는 자료가 아니다.

## S10. 질병관리청 국가건강정보포털 — 급성 심근경색증
https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6770
근거 범위: 위험 증상과 의심 시 119 도움 요청. 본 앱이 심근경색을 진단한다는 의미가 아니다.
기사·이미지·문구 전체를 복제하지 않는다. 해당 자료의 이용 조건을 확인한다.

## 이용·공개 원칙
- 문진 예문과 모의 환자는 이번 기획에서 자체 작성한 합성 자료다.
- 공식 CPX 채점표나 상업 교재의 내용을 복사하지 않았다.
- 위 문헌을 모델에 대량 수집/RAG로 넣는 작업은 이번 범위가 아니다.
- 모델/패키지/템플릿을 쓰면 명칭, 버전, 라이선스, 사용 범위를 기록한다.
- 환자 음성, 실명, 실제 병력을 허가 없이 수집·공개하지 않는다.
- 실제 사람이 연기한 녹화는 그 사람의 동의를 받고 합성 사례라고 표시한다.

## PREWORK.md에 넣을 공개 예시
“제품 범위와 구현 설계는 행사 전/초기 기획 과정에서 ChatGPT의 도움을 받아 정리했습니다.
자료 반영 시점과 범위는 커밋에 기록했습니다.
앱 코드·설정·테스트의 실제 구현은 [실제 사용 도구와 시간]에 수행했습니다.
제시된 모의 사례는 합성 자료이며 임상 검증 결과가 아닙니다.”

실제와 다른 부분은 반드시 고친다.
오늘 작성한 코드가 아니라면 오늘 작성한 것처럼 표현하지 않는다.
