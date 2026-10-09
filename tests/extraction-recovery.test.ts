import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState, transition } from '@/lib/interview/engine';
import { extractionSchema, responseSchema, type Extraction, type Turn } from '@/lib/contracts';
import { retainValidCandidates, validateCandidates, validateStateEvidence } from '@/lib/interview/validate-evidence';
const model = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock('openai', () => ({ default: class { responses = { parse: model.parse }; } }));
import { extract } from '@/lib/interview/extract';
import { POST } from '@/app/api/turn/route';
const turn = (id = 'u1'): Turn => ({ id, role: 'user', origin: 'voice_transcript', text: '배 쪽이 좀 이상한데 설명하기 어려워요.', final: true, provider_item_id: id, previous_item_id: null, prompted_question_id: 'q_chief_complaint', replaces_turn_id: null, created_at: new Date().toISOString() });
const wire = { facts: [], scope_signal: 'supported', scope_evidence: [{ quote: '원문에 없는 성인 본인 증상' }], needs_rephrase: true };
const candidate: Extraction = { facts: [], scope_signal: 'supported', scope_evidence: [{ turn_id: 'u1', quote: '원문에 없는 인용', question_id: null }], needs_rephrase: true };
afterEach(() => { vi.unstubAllEnvs(); model.parse.mockReset(); });
describe('해석 실패 답변 원문 보존과 문진 지속', () => {
 it('범위 근거가 틀려도 원문을 저장하고 기존 지원 범위를 유지', () => {
  const t = turn(); const state = initialState('s'); state.scope = 'supported';
  const cleaned = retainValidCandidates(candidate, t);
  validateCandidates(cleaned, t);
  const result = transition({request_id:'r',event:'answer',expected_revision:0,state,utterance:t,target_turn_id:null},cleaned);
  expect(result.state.turns[0]).toEqual(t); expect(result.state.scope).toBe('supported');
  expect(result.state.facts.find(f => f.field_id === 'chief_complaint')).toMatchObject({status:'unclear',value:null});
  expect(result.state.phase).toBe('interviewing'); expect(result.next_action.kind).toBe('ask');
  validateStateEvidence(result.state);
 });
 it('틀린 후보만 제외하고 원문에 있는 증상과 위험 신호는 반영', () => {
  const t = {...turn(),text:'배가 아프고 지금 숨이 차요.'};
  const valid = {field_id:'rf_breathing_difficulty' as const,status:'reported' as const,value:'숨이 차요',subject:'self' as const,temporality:'current' as const,evidence:[{turn_id:t.id,quote:'지금 숨이 차요',question_id:null}]};
  const invalid = {...valid,field_id:'medications' as const,value:'추정 약물',evidence:[{turn_id:t.id,quote:'약 먹어요',question_id:null}]};
  const cleaned = retainValidCandidates({...candidate,facts:[valid,invalid]},t);
  expect(cleaned.facts).toEqual([valid]);expect(cleaned.scope_signal).toBe('uncertain');
  validateCandidates(cleaned,t);
  const state=initialState('s');state.scope='supported';
  const result=transition({request_id:'r',event:'answer',expected_revision:0,state,utterance:t,target_turn_id:null},cleaned);
  expect(result.state.safety.latched).toBe(true);expect(result.state.turns[0].text).toBe(t.text);
 });
 it('다시 설명한 답변도 해석이 안 되면 원문을 누적하고 다른 질문으로 진행', () => {
  let state=initialState('s');state.scope='supported';state.last_question_id='q_rf_chest_discomfort';
  const first={...turn(),prompted_question_id:state.last_question_id};state=transition({request_id:'r1',event:'answer',expected_revision:0,state,utterance:first,target_turn_id:null},retainValidCandidates(candidate,first)).state;
  const second={...turn('u2'),prompted_question_id:state.last_question_id};
  const result=transition({request_id:'r2',event:'answer',expected_revision:state.revision,state,utterance:second,target_turn_id:null},retainValidCandidates(candidate,second));
  expect(result.state.turns.map(t=>t.id)).toEqual(['u1','u2']);expect(result.next_action.question_id).not.toBe('q_rf_chest_discomfort');
  expect(result.next_action.kind).toBe('ask');
 });
 it('API는 근거 불일치를 502 오류 대신 원문 보존 성공으로 반환', async () => {
  vi.stubEnv('OPENAI_API_KEY','test-key');vi.stubEnv('APP_ORIGIN','http://127.0.0.1:3000');
  model.parse.mockResolvedValue({output_parsed:wire});
  const state=initialState('s');state.scope='supported';const t=turn();
  const response=await POST(new Request('http://127.0.0.1:3000/api/turn',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:3000'},body:JSON.stringify({request_id:'r',event:'answer',expected_revision:0,state,utterance:t,target_turn_id:null})}));
  expect(response.status).toBe(200);
  const result=responseSchema.parse(await response.json());expect(result.state.turns[0].text).toBe(t.text);expect(result.state.stop_reason).not.toBe('input_error');
  expect(model.parse).toHaveBeenCalledTimes(1);
  const followup={...turn('u2'),text:'아니요',prompted_question_id:result.state.last_question_id};
  const continued=await POST(new Request('http://127.0.0.1:3000/api/turn',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:3000'},body:JSON.stringify({request_id:'r2',event:'answer',expected_revision:result.state.revision,state:result.state,utterance:followup,target_turn_id:null})}));
  expect(continued.status).toBe(200);expect(responseSchema.parse(await continued.json()).state.turns).toHaveLength(2);
 });
 it('모델이 해석을 거절해도 원문만 기록 가능한 결과를 반환', async () => {
  vi.stubEnv('OPENAI_API_KEY','test-key');model.parse.mockResolvedValue({output_parsed:null});
  const t=turn();const result=await extract(t,initialState('s'),new AbortController().signal);
  validateCandidates(result,t);expect(result.facts[0].status).toBe('unclear');
 });
 it('모델 출력 형식이 깨진 경우에도 원문을 보존', async () => {
  vi.stubEnv('OPENAI_API_KEY','test-key');
  model.parse.mockImplementation(async()=>extractionSchema.parse({}));
  const t=turn();const result=await extract(t,initialState('s'),new AbortController().signal);
  expect(result.facts[0].evidence[0].quote).toBe(t.text);validateCandidates(result,t);
 });
 it('실제 통신·한도 오류는 해석 불확실성과 구분', async () => {
  vi.stubEnv('OPENAI_API_KEY','test-key');const error=Object.assign(new Error('rate limit'),{status:429});model.parse.mockRejectedValue(error);
  await expect(extract(turn(),initialState('s'),new AbortController().signal)).rejects.toBe(error);
 });
});
