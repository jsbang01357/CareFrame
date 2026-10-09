# 외부 구성 요소

패키지 버전은 package-lock.json으로 고정한다.

| 패키지 | 버전 | 라이선스 |
|---|---|---|
| @openai/agents | 0.20.0 | MIT |
| next | 16.4.0 | MIT |
| openai | 7.30.1 | Apache-2.0 |
| react | 19.3.0 | MIT |
| react-dom | 19.3.0 | MIT |
| zod | 4.6.5 | MIT |

OpenAI API는 음성/전사/사실 구조화에 사용한다. 고정 긴급 안내는 OpenAI TTS로 생성했으며 public/audio/NOTICE.md에 생성 정보를 기록한다. 폰트는 Google Fonts의 Noto Sans KR을 불러오고 미지원 환경은 시스템 폰트로 표시한다.

원문 자료의 출처는 CareFrame_Codex_Handoff_v1/planning/SOURCES_AND_DISCLOSURE.md를 참고한다. 제3자 임상 자료 전체나 공식 CPX 채점표를 코드에 복제하지 않았다.
