export const PROTOCOL_VERSION = 'abdominal-intake-demo-3';
export const MAX_ANSWER_TURNS = 40;
export const SESSION_DURATION_MS = 15 * 60 * 1000;
export const SCOPE_QUESTION = '말씀하신 것은 성인 본인의 현재 증상인가요?';
export const PROTOCOL_REVIEW = { status: 'not_reviewed', reviewer: null, reviewed_at: null } as const;
export const fields = {
  chief_complaint: '가장 불편한 증상', location: '불편한 위치', onset: '시작 시점',
  pattern: '지속·반복 양상', severity_function: '일상생활 영향', medications: '복용약', concern: '걱정하는 점',
  rf_chest_discomfort: '현재 가슴 통증·압박감', rf_breathing_difficulty: '현재 새롭거나 악화된 호흡곤란',
  rf_fainting: '이번 증상 중 쓰러짐', rf_sudden_or_severe_abdominal_pain: '갑작스럽거나 심한 복통',
  rf_vomiting_blood: '이번 증상 중 피 섞인 구토', rf_black_tarry_stool: '이번 증상 중 검고 끈적한 변',
  character: '증상의 느낌', meal_relation: '식사와의 관계', vomiting: '구토', fever: '열', cold_sweat: '식은땀',
  medical_history: '과거 병력', weight_change: '체중 변화', patient_belief: '사용자의 생각',
  pain_severity: '통증 강도 (NRS 0–10)', duration: '한 번의 통증 지속시간', relieving_factors: '완화 요인',
  nausea: '오심', past_surgical_history: '수술력', drug_allergies: '약물 알레르기',
  improving: '증상 호전 여부', water_tolerance: '물 섭취 가능 여부', pregnancy_possible: '임신 또는 임신 가능성',
  rf_abdominal_touch: '배를 만질 때 심한 통증', rf_bloody_stool: '이번 증상 중 혈변',
  rf_cannot_urinate: '소변이 전혀 나오지 않음', rf_cannot_pass: '대변과 방귀가 모두 나오지 않음',
  diabetes: '당뇨병 병력', diarrhea: '설사', urinary_pain: '배뇨통', weight_loss: '의도하지 않은 체중 감소',
} as const;
export type FieldId = keyof typeof fields;
export const fieldIds = Object.keys(fields) as FieldId[];
export const riskFields: FieldId[] = ['rf_chest_discomfort', 'rf_breathing_difficulty', 'rf_fainting', 'rf_sudden_or_severe_abdominal_pain', 'rf_vomiting_blood', 'rf_black_tarry_stool'];
export const requiredFields: FieldId[] = ['chief_complaint', ...riskFields, 'location', 'onset', 'pattern', 'severity_function', 'medications', 'concern'];
export const questions: Partial<Record<FieldId, string>> = {
  chief_complaint: '오늘 어디가 가장 불편하세요?',
  location: '가장 불편한 곳을 손으로 짚는다면 어디인가요?', onset: '언제부터 불편하셨나요?',
  pattern: '계속 불편한가요, 아니면 괜찮아졌다 다시 불편해지나요?',
  severity_function: '지금 불편함이 일상생활을 얼마나 방해하나요?',
  medications: '요즘 드시는 약이 있나요? 이름을 모르셔도 괜찮아요.', concern: '이 증상 때문에 특히 걱정되는 점이 있으세요?',
  rf_chest_discomfort: '지금 가슴에 통증이나 꽉 누르는 느낌이 있나요?',
  rf_breathing_difficulty: '지금 새롭게 숨쉬기 어렵거나 평소보다 숨쉬기가 힘들어졌나요?',
  rf_fainting: '이번 증상이 생긴 뒤 정신을 잃거나 쓰러진 적이 있나요?',
  rf_sudden_or_severe_abdominal_pain: '이번 배의 통증이 매우 갑작스럽게 시작했거나 견디기 어려울 만큼 심한가요?',
  rf_vomiting_blood: '이번 증상 중 피나 커피 찌꺼기 같은 것을 토한 적이 있나요?',
  rf_black_tarry_stool: '이번 증상 중 검고 끈적한 변을 본 적이 있나요?',
  vomiting: '이번 증상 중 구토를 한 적이 있나요?',
  character: '배가 어떻게 아픈가요? 쓰리거나 쥐어짜는 느낌처럼 설명해 주세요.',
  pain_severity: '지금 배의 통증이 0부터 10 중 어느 정도인가요? 0은 통증 없음, 10은 견디기 어려운 통증이에요.',
  duration: '통증이 한 번 생기면 보통 얼마나 오래 가나요?',
  meal_relation: '식사하거나 움직이면 통증이 어떻게 달라지나요?',
  relieving_factors: '쉬거나 자세를 바꾸는 등 통증을 줄여주는 것이 있나요?',
  nausea: '이번 증상 중 메스꺼움을 느꼈나요?', fever: '이번 증상 중 열이 났나요?',
  past_surgical_history: '수술받은 적이 있나요? 있다면 어떤 수술인지 말씀해 주세요.',
  medical_history: '진단받은 질환이나 치료 중인 병이 있나요? 없다면 없다고 말씀해 주세요.',
  drug_allergies: '약물 알레르기가 있나요? 있다면 약 이름과 어떤 반응이 있었는지 말씀해 주세요.',
  improving: '증상이 시작했을 때보다 지금은 나아지고 있나요?',
  water_tolerance: '지금 물을 마시고 토하지 않고 유지할 수 있나요?',
  pregnancy_possible: '현재 임신 중이거나 임신 가능성이 있나요? 해당하지 않으면 아니오를 선택해 주세요.',
  rf_abdominal_touch: '배를 가볍게 만져도 심하게 아픈가요? 확인하려고 일부러 누르지는 마세요.',
  rf_bloody_stool: '이번 증상 중 변에 피가 섞여 나온 적이 있나요?',
  rf_cannot_urinate: '소변이 마려운데 전혀 나오지 않나요?',
  rf_cannot_pass: '지금 대변과 방귀가 모두 전혀 나오지 않나요?',
  diabetes: '당뇨병을 진단받은 적이 있나요?', diarrhea: '이번 증상 중 설사를 했나요?',
  urinary_pain: '이번 증상 중 소변볼 때 통증이 있나요?', weight_loss: '최근 일부러 빼지 않았는데 체중이 줄었나요?',
};
export const ABDOMINAL_CPX_ID = 'cpx-21-acute-abdominal-pain';
export const abdominalRiskFields: FieldId[] = [...riskFields, 'rf_abdominal_touch', 'rf_bloody_stool', 'rf_cannot_urinate', 'rf_cannot_pass'];
export const abdominalRequiredFields: FieldId[] = [
  'chief_complaint', ...abdominalRiskFields, 'location', 'onset', 'character', 'pain_severity', 'pattern',
  'duration', 'meal_relation', 'relieving_factors', 'severity_function', 'nausea', 'vomiting', 'fever',
  'diarrhea', 'urinary_pain', 'weight_loss', 'improving', 'water_tolerance', 'pregnancy_possible',
  'diabetes', 'medical_history', 'past_surgical_history', 'medications', 'drug_allergies', 'concern',
];
export const isAbdominal = (state: { selected_cpx_id: string | null }) => state.selected_cpx_id === ABDOMINAL_CPX_ID;
export const riskFieldsFor = (state: { selected_cpx_id: string | null }) => isAbdominal(state) ? abdominalRiskFields : riskFields;
export const requiredFieldsFor = (state: { selected_cpx_id: string | null }) => isAbdominal(state) ? abdominalRequiredFields : requiredFields;
export const detailFields: FieldId[] = ['medications', 'medical_history', 'past_surgical_history', 'drug_allergies'];
export const yesNoFields: FieldId[] = [...abdominalRiskFields, 'nausea', 'vomiting', 'fever', 'diarrhea', 'urinary_pain', 'weight_loss', 'improving', 'water_tolerance', 'pregnancy_possible', 'diabetes', ...detailFields];
export const positiveAnswer = (field: FieldId) => field === 'improving' ? '증상이 나아지고 있다고 응답'
  : field === 'water_tolerance' ? '물을 마시고 유지할 수 있다고 응답' : `${fields[field]} 있다고 응답`;
export const questionId = (field: FieldId) => `q_${field}`;
export function questionField(id: string | null): FieldId | undefined {
  return fieldIds.find(f => questionId(f) === id && questions[f]);
}
export const URGENT_TEXT = '말씀하신 내용에는 지금 바로 의료진의 평가가 필요한 위험 신호가 있습니다. 119에 연락해 도움을 요청하는 일을 미루지 마세요. 직접 운전하지 마세요.';
export const GENERAL_TEXT = '말씀하신 내용을 진료 때 보여드릴 수 있게 정리했어요. 증상이 지속되거나 반복되면 의료기관에 문의해 진료를 받으세요. 이 대화만으로 응급질환을 배제할 수는 없어요.';
export const LIMITED_TEXT = '현재 준비된 문진 범위나 확인된 정보만으로는 다음 행동을 충분히 판단하기 어렵습니다. 확인한 내용만 정리하고 의료기관에 문의해 안내받으세요. 심한 증상이나 호흡곤란·쓰러짐 등이 있으면 대화를 기다리지 말고 긴급 도움을 요청하세요.';
export const statusLabels = { reported: '말씀하신 내용', denied: '없다고 답함', unknown: '잘 모름', unclear: '추가 확인 필요', declined: '답변하지 않음', not_assessed: '아직 확인하지 않음' } as const;
