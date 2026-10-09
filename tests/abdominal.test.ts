import { describe, expect, it } from 'vitest';
import { ABDOMINAL_CPX_ID, abdominalRequiredFields, abdominalRiskFields, yesNoFields, questionField, MAX_ANSWER_TURNS, type FieldId } from '@/data/protocol';
import { initialState, transition, chooseNext, evaluateSafety } from '@/lib/interview/engine';
import { directAnswer } from '@/lib/interview/extract';
import { buildCareGuidance } from '@/lib/interview/care-guidance';
import { stateSchema, type InterviewState, type Turn } from '@/lib/contracts';
import { buildReport } from '@/lib/report/build-report';
import { draftIsCurrent, reviewedEmrText } from '@/lib/report/clinician-review';
import { validateStateEvidence } from '@/lib/interview/validate-evidence';

const turn = (state: InterviewState, text: string): Turn => ({id: `u${state.revision}`, role:'user', origin:'typed', text, final:true, prompted_question_id:state.last_question_id, provider_item_id:null,previous_item_id:null,replaces_turn_id:null,created_at:'2026-10-09T00:00:00Z'});
const values: Partial<Record<FieldId, string>> = {
  chief_complaint:'배가 조금 아파요',location:'배',onset:'오늘 아침',character:'묵직함',pain_severity:'2/10',
  pattern:'한 번만 불편했다가 좋아졌어요',duration:'5분',meal_relation:'식사와 관계없음',relieving_factors:'쉬면 나아짐',
  severity_function:'일상생활 가능',medications:'복용약 없음',medical_history:'진단받은 병 없음',past_surgical_history:'수술 없음',drug_allergies:'약물 알레르기 없음',concern:'기록을 확인하고 싶어요',
};
function completeAbdominal() {
  let state = initialState('abdominal', { age:30,sex:'female' }, ABDOMINAL_CPX_ID);
  while (state.phase === 'interviewing') {
    const field = questionField(state.last_question_id)!;
    const text = yesNoFields.includes(field) ? ['improving','water_tolerance'].includes(field) ? '네' : '아니요' : values[field]!;
    expect(text).toBeTruthy();
    const input = turn(state,text);
    const extracted = directAnswer(input) || {facts:[{field_id:field,status:(['medications','medical_history','past_surgical_history','drug_allergies'].includes(field) ? 'denied' : 'reported') as 'denied' | 'reported',value:['medications','medical_history','past_surgical_history','drug_allergies'].includes(field) ? null : text,subject:'self' as const,temporality:'current' as const,evidence:[{turn_id:input.id,quote:text,question_id:input.prompted_question_id}]}],scope_signal:field === 'chief_complaint' ? 'supported' as const : 'uncertain' as const,scope_evidence:field === 'chief_complaint' ? [{turn_id:input.id,quote:text,question_id:null}] : [],needs_rephrase:false};
    state = transition({request_id:input.id,event:'answer',state,expected_revision:state.revision,utterance:input,target_turn_id:null},extracted).state;
    stateSchema.parse(state); validateStateEvidence(state);
    expect(state.accepted_answer_count).toBeLessThanOrEqual(MAX_ANSWER_TURNS);
  }
  return state;
}
describe('복통 실행 문진과 행동 안내', () => {
  it('개별 필드 답변만으로 전체 경로를 마치고 통증·지속시간·알레르기를 기록한다', () => {
    const state = completeAbdominal();
    expect(state.completion).toBe('complete');
    expect(state.accepted_answer_count).toBe(abdominalRequiredFields.length);
    expect(buildReport(state).hpi.severity.value).toBe('2/10');
    expect(buildReport(state).hpi.duration.value).toBe('5분');
    expect(state.asked_question_ids).toContain('q_drug_allergies');
    expect(buildCareGuidance(state).level).toBe('observe');
  });
  it('호전·가벼운 통증·필요 항목 부정이 모두 확인돼야 관찰 안내', () => {
    const state = completeAbdominal();
    for (const field of ['medications','medical_history'] as FieldId[]) { const f = state.facts.find(x=>x.field_id===field)!; f.status='denied';f.value=null; }
    expect(buildCareGuidance(state).level).toBe('observe');
    for (const field of abdominalRiskFields) {
      const uncertain = structuredClone(state); const f=uncertain.facts.find(x=>x.field_id===field)!;f.status='unknown';f.value=null;
      expect(buildCareGuidance(uncertain).level).toBe('visit');
    }
    const missing = structuredClone(state); missing.facts.find(x=>x.field_id==='improving')!.status='not_assessed';
    expect(buildCareGuidance(missing).level).toBe('visit');
    const illness = structuredClone(state); illness.facts.find(x=>x.field_id==='medical_history')!.status='reported';
    expect(buildCareGuidance(illness).level).toBe('visit');
    const high = structuredClone(state);high.facts.find(x=>x.field_id==='pain_severity')!.value='8/10';
    expect(buildCareGuidance(high).level).toBe('visit');
    const recurrent = structuredClone(state);recurrent.facts.find(x=>x.field_id==='pattern')!.value='반복되는 통증';
    expect(buildCareGuidance(recurrent).level).toBe('visit');
  });
  it.each(['rf_abdominal_touch','rf_bloody_stool','rf_cannot_urinate','rf_cannot_pass'] as FieldId[])('추가 위험 항목 %s에 즉시 중단', field => {
    const state = initialState('emergency',undefined,ABDOMINAL_CPX_ID);state.scope='supported';state.last_question_id=`q_${field}`;
    const input=turn(state,'네');const extracted=directAnswer(input)!;
    const result=transition({request_id:'urgent',event:'answer',state,expected_revision:0,utterance:input,target_turn_id:null},extracted);
    expect(result.next_action.kind).toBe('urgent_help');
    expect(buildCareGuidance(result.state).level).toBe('emergency');
  });
  it('당뇨병과 현재 구토를 함께 보고하면 긴급 안내', () => {
    const state=initialState('diabetes',undefined,ABDOMINAL_CPX_ID);
    for(const id of ['diabetes','vomiting'] as FieldId[]) { const f=state.facts.find(x=>x.field_id===id)!;f.status='reported';f.value='있음'; }
    evaluateSafety(state);expect(state.safety.triggered_rule_ids).toContain('R4:diabetes_vomiting');
    expect(buildCareGuidance(state).level).toBe('emergency');
  });
  it('클릭 긍정은 현재 질문 하나에만 연결', () => {
    const state=initialState('click',undefined,ABDOMINAL_CPX_ID);state.last_question_id='q_nausea';
    const result=directAnswer(turn(state,'네'))!;
    expect(result.facts).toHaveLength(1);expect(result.facts[0].field_id).toBe('nausea');
    expect(result.facts[0].evidence[0].question_id).toBe('q_nausea');
    state.last_question_id='q_pain_severity';expect(directAnswer(turn(state,'11/10'))).toBeNull();
    expect(directAnswer(turn(state,'3/10'))!.facts[0].value).toBe('3/10');
  });
  it('확보한 병력은 다시 묻지 않고 미질문은 부정으로 바꾸지 않음', () => {
    const state=initialState('skip',undefined,ABDOMINAL_CPX_ID);state.scope='supported';
    for(const id of [...abdominalRiskFields,'chief_complaint','location','onset'] as FieldId[]) { const f=state.facts.find(x=>x.field_id===id)!;f.status=abdominalRiskFields.includes(id)?'denied':'reported';f.value=f.status==='reported'?'응답':null; }
    expect(chooseNext(state).question_id).toBe('q_character');
    expect(state.facts.find(x=>x.field_id==='drug_allergies')!.status).toBe('not_assessed');
  });
  it('환자 원문이 바뀌면 의료진 검토 복사를 무효화', () => {
    const state=completeAbdominal();const draft={sessionId:state.session_id,sourceRevision:state.revision,text:buildReport(state).emrText,reviewed:true};
    expect(draftIsCurrent(draft,state)).toBe(true);expect(reviewedEmrText(draft,state)).toContain('검토 완료');
    const changed={...state,revision:state.revision+1};expect(draftIsCurrent(draft,changed)).toBe(false);
    expect(()=>reviewedEmrText(draft,changed)).toThrow('원문 기록이 바뀌었습니다');
    expect(draftIsCurrent(draft,{...state,session_id:'new'})).toBe(false);
  });
  it('복용약이 있다는 클릭만으로 약 정보를 확정하지 않고 상세를 확인', () => {
    const state=initialState('medication',undefined,ABDOMINAL_CPX_ID);state.scope='supported';
    for(const id of abdominalRequiredFields) { const f=state.facts.find(x=>x.field_id===id)!;f.status='denied';f.value=null; }
    state.facts.find(x=>x.field_id==='medications')!.status='not_assessed';state.last_question_id='q_medications';
    const input=turn(state,'네');const extracted=directAnswer(input)!;
    expect(extracted.facts[0]).toMatchObject({status:'unclear',value:null});
    // 선택된 값의 상세 확인은 기존 질문 ID를 사용하며 약 이름을 만들지 않는다.
    expect(chooseNext({...state,facts:state.facts.map(f=>f.field_id==='medications'?{...f,status:'unclear' as const,value:null}:f)}).kind).toBe('clarify');
  });
});
