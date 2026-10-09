# CareFrame 호스팅 검증 · 2026-10-09

- URL: https://careframe.jisong.dev
- 플랫폼: Cloudflare Workers / OpenNext 1.20.9 / Next.js 16.4.0
- Worker: `careframe`
- 배포 버전: `755f19dc-5981-4da8-b096-d30c2685960d`
- 서버 키: 사용자 명시 승인 후 `OPENAI_API_KEY` secret 등록. 값은 기록·출력하지 않음.

## 실제 도메인 확인

| 확인 | 결과 |
|---|---|
| HTTPS·시작 화면·로고·캐릭터 이미지 | 정상 |
| `/api/health` | 200, api_configured=true, fixture_enabled=false |
| 타 Origin의 음성 토큰 요청 | 403 |
| 영희 음성 토큰 | 200, gpt-realtime-2.1 / marin |
| 철수 음성 토큰 | 200, gpt-realtime-2.1 / ash |
| 30세 여성 가상 명치 통증 답변 추출 | 200, revision=1, chief_complaint=reported |
| 다음 질문 | q_rf_chest_discomfort |
| 문진 종료·마지막 사실 요약 | 200, 요약 생성 |

공개 DNS(1.1.1.1)는 Cloudflare 주소를 반환하고 브라우저에서도 실제 도메인 접속이 성공했다. 당시 로컬 Node/OS DNS는 이전 NXDOMAIN을 유지해 HTTP 검증에는 공개 DNS에서 확인한 IP를 사용했다. TLS 인증서 검증과 요청 hostname은 그대로 유지했다. 단기 음성 토큰 값은 출력하지 않았다.

## 빌드 및 회귀

- 로컬 개발 서버와 환경 파일을 분리한 임시 디렉터리에서 프로덕션 빌드 성공.
- 배포 번들 1540개 파일에 기존 서버 키 값이 없음을 검사.
- 타입 검사, Workers dry-run 통과. Worker 시작 20ms, gzip 약 1.8MiB.
- 최신 전체 회귀: 84개 중 75개 통과, 9개 실패. 위험 신호 후 문진 계속 정책과 기존 즉시 종료 기대의 불일치이며 이 호스팅 작업에서 변경하지 않았다. 음성 transport 회귀 31개는 통과했다.
- 업로드만으로 완료 판정하지 않았다. 초기 배포는 `preview-props.json` 미수집으로 1101이 발생했다. [OpenNext upstream PR #1356](https://github.com/opennextjs/opennextjs-cloudflare/pull/1356)의 manifest glob 수정만 임시 dependency 복사본에 적용하고 재배포하여 실제 API 응답까지 확인했다.

## 검증 한계

가상 증례에 대한 HTTP/API와 브라우저 화면 검증이다. 실제 마이크 입력·WebRTC 오디오 재생·마지막 안내 청취, A4/PDF 실물, 의료진·임상 검토는 수행하지 않았다. `protocol_reviewed=false`, `voice_verified=false` 표시를 유지했다. 브라우저 메모리에만 보관하는 문진 기록은 새로고침하면 사라진다. 사용 예산·요청 접근 제한은 추가 운영 검토가 필요하다.

화면 증거: `screenshots/hosting.jpg`.
