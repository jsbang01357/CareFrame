import { fields, isAbdominal, riskFieldsFor, URGENT_TEXT, GENERAL_TEXT, LIMITED_TEXT, type FieldId } from '@/data/protocol';
import type { InterviewState } from '@/lib/contracts';

export interface CareGuidance {
  level: 'emergency' | 'visit' | 'observe';
  title: string;
  text: string;
  reasons: string[];
  warning: string;
}
// 가상 복통 데모의 보수적 행동 안내. 임상 검증된 응급도 분류나 진단이 아니다.
export function buildCareGuidance(state: InterviewState): CareGuidance {
  const fact = (id: FieldId) => state.facts.find(f => f.field_id === id);
  const reported = (id: FieldId) => fact(id)?.status === 'reported';
  const denied = (id: FieldId) => fact(id)?.status === 'denied';
  const warning = '갑자기 심해지는 복통, 가슴 통증, 숨쉬기 어려움, 쓰러짐, 피를 토하거나 혈변·검고 끈적한 변이 있으면 기다리지 말고 응급 도움을 받으세요. 이 안내로 응급질환을 배제할 수 없습니다.';
  if (state.safety.latched) return {
    level: 'emergency', title: '지금 응급 도움을 받으세요',
    text: '지금은 쉬면서 기다리지 말고 119에 연락하거나 즉시 응급실 평가를 받으세요. 직접 운전하지 마세요.',
    reasons: state.safety.triggered_rule_ids.map(id => {
      if (id === 'R4:diabetes_vomiting') return '당뇨병 병력과 이번 구토를 함께 보고함';
      return fields[id.split(':').at(-1) as FieldId] || '설정된 위험 신호';
    }), warning,
  };
  if (!isAbdominal(state)) return { level: 'visit', title: '병원에서 증상을 확인받으세요', text: state.completion === 'complete' ? GENERAL_TEXT : LIMITED_TEXT, reasons: ['복통 전용 행동 안내 범위 밖'], warning };
  const unassessedRisk = riskFieldsFor(state).filter(id => !denied(id));
  const unresolved = ['pain_severity', 'improving', 'water_tolerance', 'pregnancy_possible', 'diabetes', 'medical_history', 'medications', 'fever', 'vomiting', 'diarrhea', 'urinary_pain', 'weight_loss'] as FieldId[];
  const missing = unresolved.filter(id => !['reported', 'denied'].includes(fact(id)?.status || 'not_assessed'));
  const severityValue = fact('pain_severity')?.value || '';
  const severity = /^(?:통증 강도(?:는)?\s*)?(10|[0-9])(?:\s*(?:\/\s*10|점)(?:이라고 응답)?)?$/.exec(severityValue.trim());
  const score = severity ? Number(severity[1]) : null;
  const location = fact('location')?.value || '';
  const canObserve = state.scope === 'supported' && state.completion === 'complete' && !unassessedRisk.length && !missing.length
    && /배|복부|명치|심와부/.test(location) && score !== null && score <= 3
    && reported('improving') && reported('water_tolerance')
    && ['pregnancy_possible', 'diabetes', 'medical_history', 'medications', 'fever', 'vomiting', 'diarrhea', 'urinary_pain', 'weight_loss'].every(id => denied(id as FieldId));
  if (canObserve) return {
    level: 'observe', title: '잠시 쉬면서 증상 변화를 관찰하세요',
    text: '통증이 가볍고 나아지고 있다고 답하셨어요. 우선 잠시 쉬면서 물을 조금씩 마시고 상태를 관찰하세요. 통증이 계속되거나 다시 생기면 병원에서 진료를 받으세요. 악화되거나 위험 증상이 생기면 기다리지 마세요.',
    reasons: ['가벼운 통증으로 응답', '증상이 나아지고 있다고 응답', '물 섭취가 가능하며 열거한 위험 항목을 부정함'], warning,
  };
  const reasons = [
    unassessedRisk.length ? `위험 항목 미확인·불명확: ${unassessedRisk.map(id => fields[id]).join(', ')}` : null,
    state.completion !== 'complete' ? '미완료 문진 또는 미확인 병력' : null,
    missing.length ? `추가 확인 필요: ${missing.map(id => fields[id]).join(', ')}` : null,
    reported('pregnancy_possible') ? '임신 또는 임신 가능성을 보고함' : null,
    !reported('improving') ? '증상 호전이 확인되지 않음' : null,
    denied('water_tolerance') ? '물 섭취 유지가 어렵다고 응답' : null,
    ...(['fever', 'vomiting', 'diarrhea', 'urinary_pain', 'weight_loss', 'medical_history'] as FieldId[]).filter(reported).map(id => `${fields[id]} 보고`),
  ].filter((x): x is string => Boolean(x));
  return {
    level: 'visit', title: '오늘 의료기관에 문의해 진료를 받으세요',
    text: '쉬면서 지켜보라는 안내만 드리기에는 확인이 필요한 내용이 있어요. 오늘 병원에 문의해 증상을 설명하고 진료 안내를 받으세요. 지금까지의 문진표를 함께 보여 주세요. 통증이 심해지거나 위험 증상이 나타나면 응급실로 가거나 119에 도움을 요청하세요.',
    reasons: reasons.length ? reasons : ['현재 정보만으로 휴식·관찰 조건을 충분히 확인하지 못함'], warning,
  };
}

export function closingText(state: InterviewState) {
  if (state.safety.latched) return URGENT_TEXT;
  return buildCareGuidance(state).text;
}
