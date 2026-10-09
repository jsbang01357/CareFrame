# CPX 카탈로그 참고자료와 출처 정책

## 데이터 구조

- 주제별 파일은 독립된 HL7 FHIR R4 `Questionnaire` 리소스다. 그룹별 문항, `linkId`, CareFrame 내부 `field_id`를 두고 답변 기록 규칙은 `answer-contract.json`에 분리했다. FHIR `QuestionnaireResponse` 전송 매핑은 아직 정의하지 않았다.
- 공식 문서: [FHIR R4 Questionnaire](https://hl7.org/fhir/R4/questionnaire.html), [FHIR R4 QuestionnaireResponse](https://hl7.org/fhir/R4/questionnaireresponse.html).

## 공개 사례 참고

- [OSCE Tutor](https://github.com/NafisSam/osce-tutor)는 임상 스테이션별 JSON 파일 구성만 참고했다. README는 교재를 사례 출처로 언급하며, 여기서는 사례 문구를 가져오지 않았다.
- [Virtual Standardized Patient Simulator](https://github.com/igembitsky/virtual-standardized-patient)는 앱 코드와 사례 콘텐츠의 라이선스가 다를 수 있음을 확인하는 참고로만 사용했다.
- 48개 주제명은 사용자가 제공했다. 가슴통증·두통·복통은 `CPX schema`의 로컬 문서에서 문진 질문을 정리했고, 나머지 45개는 해당 CPX 원문이 제공되지 않아 질문 골격을 새로 작성했다. 외부 공개 전에는 원문 자료의 권리와 개별 콘텐츠 라이선스를 확인한다.

## 현재 상태

모든 카탈로그는 임상 검토 전·비활성 상태이며 현재 앱과 연결되지 않았다. 임상 검토, 안전 분기, 응답 정책, 필드 매핑 전에는 활성화하지 않는다.
