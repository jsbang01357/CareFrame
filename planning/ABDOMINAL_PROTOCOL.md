# 복통 실행 경로 · abdominal-intake-demo-3

## 범위와 출처

가상 성인 본인의 복통 사전문진이다. CPX 21번 복통의 병력 항목을 선별해 `data/protocol.ts` 실행 사전과 연결했다. 85개 전체 질문을 그대로 실행하거나 CPX 기반 응급도 분류로 검증한 것이 아니다. 원본 `data/qna-catalogs/21-acute-abdominal-pain.json`의 미검토·비활성 상태는 보존하며 별도 실행 경로의 검토 상태도 `not_reviewed`다.

| CPX 참고 항목 | 실행 필드 |
|---|---|
| chief_complaint | chief_complaint |
| onset_time / pain_location / pain_pattern | onset / location / pattern |
| episode_duration / pain_severity | duration / pain_severity |
| 통증 양상·악화·완화·기능 영향 | character / meal_relation / relieving_factors / severity_function |
| 동반 오심·구토·열·설사·배뇨통·체중 감소 | nausea / vomiting / fever / diarrhea / urinary_pain / weight_loss |
| 과거력·수술력·약·약물 알레르기 | medical_history / past_surgical_history / medications / drug_allergies |
| 임신 가능성·당뇨·환자 걱정 | pregnancy_possible / diabetes / concern |

복부 위험 질문과 호전·물 섭취는 환자 행동 안내를 위해 추가했다. 원문 인용과 질문 ID를 보존하고 이미 명시된 필드는 다시 묻지 않는다. 간접 긍정은 이진 질문 하나에만, NRS 숫자는 현재 NRS 질문에만 연결한다. 약·질환·수술·알레르기는 없음/모름을 클릭으로 답할 수 있다. 예를 선택하면 불명확 상태로 보존하고 상세 질문으로 이름과 내용을 확인한다. 존재한다는 클릭만으로 약 이름 등을 생성하지 않는다.

## 행동 안내

[NHS 복통 안내](https://www.nhs.uk/symptoms/stomach-ache/)의 즉시 도움 항목(갑작스럽거나 심한 통증, 만질 때 통증, 출혈, 소변/대변·가스 불가, 호흡곤란, 흉통, 쓰러짐, 당뇨와 구토)을 참고한다. 한국의 119·응급실로 표현한다. 이 참고자료는 우리 규칙의 정확도를 검증하지 않는다.

- 위험 보고: 일반 문진을 중단하고 119/응급실 안내. 기존 latched 상태는 정정 뒤에도 유지한다.
- 위험·핵심 정보 미확인, 문진 미완료, 호전 미확인, 관련 증상·병력 보고 등: 오늘 의료기관 문의·진료 안내. 악화 시 긴급 도움을 명시한다.
- 휴식·관찰: 모든 실행 위험 항목을 명시적으로 부정하고, 복부 위치·0–3점 NRS·일회성 통증·호전·물 섭취를 보고했으며 임신 가능성·당뇨·과거 질환·복용약·열·구토·설사·배뇨통·체중 감소가 부정이고 문진 완료인 경우만 제시한다. 반복·지속된 통증은 호전 중이어도 진료 안내로 보낸다. 이 0–3점과 항목 조합은 팀의 보수적 데모 조건이며 검증된 임상 기준이 아니다. 의료기관 방문이 불필요하다고 단정하지 않는다.

휴식·수분과 악화 시 재평가 문구는 [Plymouth NHS의 복통 안내](https://www.plymouthhospitals.nhs.uk/display-pil/pil-nonspecific-abdominal-pain-9124)를 참고했다. 해당 자료는 병원 평가 이후 환자 대상이므로 AI 문진이 그 평가를 대체한다고 해석하지 않는다. 임상 검토 전 실제 환자용 운영에 적용하지 않는다.

AI가 새 진단·약물·질환 확률을 만들어 행동을 정하지 않는다. 추출 결과를 검증한 후 동일 상태에서 코드가 고정 안내를 선택한다. 음성도 그 승인 문장을 읽는다. 미확인을 부정으로 채우지 않는다.

## 의료진 검토

환자 자가응답 원본과 의료진 편집본은 분리한다. 편집본은 원본 session ID·revision에 연결되며, 원본 변경 시 이전 검토를 만료하고 복사·인쇄를 막는다. 편집본 자체 수정 시 검토 완료도 해제한다. 검토자 인증·전자서명·실제 EMR 전송은 구현하지 않는다.

## 검증

`tests/abdominal.test.ts`: 전체 경로, 상태/근거, 위험 추가 항목, 당뇨+구토, 미확인 관찰 금지, 클릭·NRS 범위, 원본 변경 시 의료진 검토 무효화. `tests/voice.test.ts`: 마지막 안내 재생 시 입력 중단과 늦은 전사 무시. 실제 API·브라우저와 실제 마이크 시험은 별도 결과로 기록한다.
