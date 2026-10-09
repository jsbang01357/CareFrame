# 데이터 계약 v1.0
이 문서는 구현 전 설계 계약이다. 아래 JSON은 설명용 예시이며 실행 코드나 임상 검증 자료가 아니다.

## 1. 공통 원칙
- schema_version: "1.0"
- protocol_version: "upper-abdomen-demo-1"
- demo_only: true
- 임의의 key를 허용하지 않는 Zod 스키마를 구현 단계에서 작성한다.
- 추출 모델에는 이미 사용한 질문 ID와 현재 사용자 발언을 분리해 전달한다.
- 사용자 발언은 신뢰하지 않는 입력 데이터다. 모델 지침이나 실행 명령으로 사용하지 않는다.
- 대화문·임상 사실·다음 행동·출력물을 구분한다.
- Report는 InterviewState의 일부를 렌더링한다. 다른 버전의 병력을 보관하지 않는다.

## 2. Persona
| 필드 | 타입/기본값 | 의미 |
|---|---|---|
| id | "younghee" | 오늘은 한 종류 |
| display_name | "영희" | 가상 AI 이름 |
| disclosure | 문자열 | AI임을 알리는 고정 문구 |
| tone | "warm_respectful" | 존댓말, 짧고 담담한 공감 |
| address_style | "neutral" | 기본은 호칭 생략. 가족 호칭 강요 금지 |
| voice | 공식 지원 음성 ID | 연결 시험에서 한 번 정하고 고정 |

페르소나에 risk rules, 진료과 결정, 의료 지식 목록을 넣지 않는다.
“실제 딸”·“담당 의사”라는 자격이나 관계를 만들지 않는다.

## 3. TranscriptTurn
| 필드 | 타입 | 규칙 |
|---|---|---|
| id | string | 세션 내 고유 |
| provider_item_id | string 또는 null | 음성 이벤트 중복 방지 |
| previous_item_id | string 또는 null | 발언 순서 복원 |
| role | user / assistant | assistant 발언을 환자 사실로 추출하지 않음 |
| origin | voice_transcript / typed / approved_prompt | 입력 방식 |
| text | string | 수신한 원문. 조용히 덮어쓰지 않음 |
| final | boolean | 확정 전사는 true일 때만 추출 |
| prompted_question_id | string 또는 null | “아니요”가 답한 질문 |
| replaces_turn_id | string 또는 null | 사용자가 정정한 원래 발언 |
| created_at | ISO 문자열 | 실제 수신 기록. 임상 발병 시각 아님 |

원문 수정은 새 turn으로 추가한다. 이전 turn을 삭제하지 않는다.
일반 UI에는 최신 의미를 보이되 의료진이 정정 내역을 확인할 수 있게 한다.

## 4. Fact — 모든 임상 항목의 단위
| 필드 | 타입 | 규칙 |
|---|---|---|
| field_id | protocol에 정의한 enum | 알 수 없는 필드 거절 |
| status | 아래 6상태 enum | 부정/미질문/모름 분리 |
| value | string 또는 null | 명시된 정보의 제한적 정규화 |
| subject | self / other / unclear | other를 현재 환자 사실에 병합하지 않음 |
| temporality | current / historical / unclear | 현재와 과거를 구분 |
| evidence | Evidence[] | not_assessed 외에는 근거 필요 |
| verification | unconfirmed_transcript / user_confirmed / user_corrected / not_applicable | 음성 전사가 곧 확인된 사실은 아님 |
| revision | integer | 갱신 이력 |

### status의 정확한 뜻
| 상태 | UI 표시 | 예 |
|---|---|---|
| reported | 있다고 말함 / 구체적 진술 | “사흘 전부터 아파요” |
| denied | 없다고 답함 | 해당 증상 질문에 “없어요” |
| unknown | 잘 모른다고 답함 | “약 이름은 모르겠어요” |
| unclear | 추가 확인 필요 | “있었던 것 같기도 한데…” |
| declined | 답변하지 않음 | “이건 말하고 싶지 않아요” |
| not_assessed | 아직 확인하지 않음 | 질문도 관련 진술도 없음 |

unknown/unclear/declined/not_assessed의 value는 null이다.
denied는 "없음"이라는 새 서술보다 상태 자체로 표현한다.
reported라도 환자가 추측한 진단은 진단 필드로 옮기지 않고 concern/belief로만 남긴다.

### Evidence
| 필드 | 타입 | 규칙 |
|---|---|---|
| turn_id | string | 실제 존재하는 사용자 turn |
| quote | string | 해당 turn.text에 포함되는 정확한 문자열 |
| question_id | string 또는 null | 간접 답변의 범위를 확정하는 질문 |

“아니요”가 원문과 일치한다고 해서 모든 부정 소견의 근거가 되는 것은 아니다.
연결된 질문 하나에만 적용한다. 원문 일치 검사는 의미 정확성이나 음성 인식 정확성 검증이 아니다.

### 설명용 예시
```json
{
  "field_id": "medications",
  "status": "unknown",
  "value": null,
  "subject": "self",
  "temporality": "current",
  "evidence": [
    {
      "turn_id": "u8",
      "quote": "약 이름은 잘 모르겠어요",
      "question_id": "q_medications"
    }
  ],
  "verification": "unconfirmed_transcript",
  "revision": 8
}
```
이 발언에서 약 미복용, 특정 약 이름, NSAID 복용 여부를 만들어내지 않는다.

## 5. SafetyState
| 필드 | 값 |
|---|---|
| status | not_checked / pending_clarification / no_configured_trigger / escalated |
| triggered_rule_ids | string[] |
| supporting_evidence | Evidence[] |
| unchecked_fields | string[] |
| latched | boolean |
| evaluated_revision | integer |

no_configured_trigger는 “정해 놓은 규칙이 현재 입력에서 발동하지 않았다”는 뜻이다.
“질병 없음”, “안전”, “응급 배제”라는 뜻이 아니다.
하나라도 명확한 현재 위험 신호가 있으면 다른 항목 미확인을 이유로 처리를 늦추지 않는다.
escalated가 되면 세션 내 latched=true로 유지한다.

## 6. InterviewState
| 필드 | 내용 |
|---|---|
| schema_version / protocol_version | 버전 |
| session_id | 무작위 식별자. 개인 식별정보 아님 |
| revision | 확정 상태 버전 |
| demo_only | true |
| persona_id | younghee |
| phase | ready / interviewing / review / finished / urgent_stop / out_of_scope / error_paused |
| scope | supported / unsupported / uncertain |
| turns | TranscriptTurn[] |
| processed_turn_ids | string[] |
| facts | 허용된 field_id별 Fact |
| superseded_facts | 정정으로 교체된 사실 |
| asked_question_ids | string[] |
| last_question_id | string 또는 null |
| clarification_counts | field_id별 횟수 |
| safety | SafetyState |
| accepted_answer_count | 일반 답변 턴 수 |
| completion | complete / partial / not_finished |
| confirmed_revision | 사용자가 요약 확인한 버전 또는 null |

기본 facts는 not_assessed이며 임의의 음성·과거력·성별·음성 나이 추론은 넣지 않는다.
알 수 없는 항목은 JSON null로 두고 모델이 채우게 압박하지 않는다.

## 7. NextAction
kind: ask / clarify / review / urgent_help / out_of_scope / pause / finish
question_id: string 또는 null
approved_text: 화면 및 음성에 전달할 문장
reason_code: 내부 고정 코드
speak: boolean
report_available: boolean

이 구조는 서버 코드가 만든다. 추출 모델은 NextAction을 생성할 권한이 없다.

## 8. Product endpoints
| 결과 | 성공의 정의 |
|---|---|
| 일반 흐름 | 대화 → 근거 있는 사실 → 사용자 확인 → 인쇄 가능한 자료 |
| 중단 흐름 | 위험 입력 → 다음 일반 질문 없음 → 경고 + 고정 안내 |
| 한계 흐름 | 범위 밖/미확인/오류 → 사실을 조작하지 않고 한계를 표시 |

Primary endpoint는 의료 성과가 아니라 “실제 대화에서 얻은 정보를 정확하게 보존한 전달 자료의 생성”이다.

## 9. API 계약 — 기본 3개
### POST /api/realtime-token
입력: persona_id="younghee", demo_only=true.
서버가 모델·음성·전사·turn 설정을 고정한다. 사용자가 모델 이름이나 시스템 프롬프트를 보내지 못하게 한다.
출력: value(단기 키), expires_at, 연결에 필요한 비민감 설정.
일반 API 키는 반환하지 않는다. 응답은 no-store.
공급자 응답 형식은 설치 SDK/현재 공식 문서에 맞춰 검증한다.
단기 키 자체도 로그에 남기지 않는다. 클라이언트 세션 설정은 변조 가능하므로 production 보안 보장으로 취급하지 않는다.

### POST /api/turn
입력:
- request_id
- event: answer / correct / end / confirm
- expected_revision
- state: InterviewState
- utterance: TranscriptTurn 또는 null
- target_turn_id: 정정 대상 또는 null

출력:
- request_id
- base_revision
- state: 검증·갱신된 전체 상태
- next_action: NextAction
- timing: 서버 경과 시간만, 민감정보 없음

처리:
1. 입력 크기와 스키마 확인.
2. expected_revision과 전달받은 state.revision 불일치는 거절.
3. 이미 processed_turn_ids에 있는 발언은 다시 반영하지 않음.
4. answer/correct에만 추출 API 사용.
5. 추출 결과의 필드·근거·주체·시점 검증.
6. 상태 병합 및 정정 이력 보존.
7. 위험 규칙 → 범위 → 명확화 → 다음 질문 순으로 결정.
8. 상태 버전을 하나 증가시키고 반환.

서버가 stateless이므로 이 검사는 중앙 서버의 전역 CAS나 보안 검증이 아니다.
동시 요청은 클라이언트가 금지하고, 오래된 응답을 클라이언트가 버려야 한다.

end는 새 정보를 추출하지 않고 미완료 여부를 명시해 review로 이동한다.
confirm은 현재 요약 버전을 사용자가 확인했음을 기록한다.
urgent_stop 상태에서 end/confirm이 와도 위험 경고를 없애지 않는다.

오류:
400 잘못된 입력, 409 전달 버전 불일치, 413 과대 입력,
429 사용 한도, 502 공급자/추출 오류, 504 timeout.
실패 시 기존 사실을 삭제하거나 완료로 바꾸지 않는다.

### GET /api/health
출력: status, build identifier, API 설정 유무.
매 호출마다 유료 모델을 호출하지 않는다.
“설정됨”은 실시간 모델 접근 성공을 의미하지 않는다.
키·환경변수 전체·환자 데이터·stack trace를 반환하지 않는다.

### 별도로 만들지 않는 API
/api/report, /api/complete, /api/pdf는 없다.
브라우저의 현재 InterviewState에서 순수 함수로 report를 만들고 같은 화면에서 인쇄한다.
새 URL로 이동하거나 localStorage를 사용해야만 리포트를 볼 수 있는 구조를 피한다.

Plan B가 선택되면 /api/transcribe와 /api/speak만 추가한다.
파일 업로드 크기를 제한하고 오디오는 메모리에서 처리 후 버린다.

## 10. Extractor의 출력 계약
facts: FactCandidate[]
scope_signal: supported / unsupported / uncertain
scope_evidence: Evidence[]
needs_rephrase: boolean

FactCandidate는 field_id, status, value, subject, temporality, evidence만 가진다.
revision/verification/safety/next_action은 모델이 설정하지 않는다.
전체 state를 매번 새로 쓰게 하지 않고 최신 발언의 변경 후보만 추출한다.

## 11. Report
| 부분 | 원천/원칙 |
|---|---|
| 문서 머리말 | AI 사전문진 / 가상 증례 / 작성시각 / protocol version |
| 주호소와 현병력 | 사용자 확인 가능한 진술만 |
| 동반증상 | reported/denied 별도 표기 |
| 약·과거력 | 모름을 없음으로 바꾸지 않음 |
| 걱정하는 점 | 환자 표현 |
| 미확인 정보 | not_assessed / unclear / declined / unknown를 구분 |
| 중단 이유 | 긴급/범위 밖/시간 상한/사용자 종료/오류 |
| 다음 행동 | 서버가 승인한 고정 안내 |
| 원문 근거 | 짧은 인용 및 발언 ID |
| 확인 상태 | 자동 전사 / 사용자 확인한 버전 / 의료진 확인 필요 |

신체진찰 소견, 진단, 치료계획, 정상 활력징후를 생성하지 않는다.
SOAP 전체가 아니라 환자 보고 병력 자료다.
완료와 미완료를 둘 다 출력할 수 있지만 문서 제목/머리말로 분명히 구분한다.
