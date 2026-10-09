import { describe, expect, it } from 'vitest';
import { directAnswer } from '@/lib/interview/extract';
import type { Turn } from '@/lib/contracts';
import { initialState, transition } from '@/lib/interview/engine';
import { validateCandidates } from '@/lib/interview/validate-evidence';
const turn = (text: string, question: string): Turn => ({ id: 't', role: 'user', origin: 'typed', text, final: true, prompted_question_id: question, provider_item_id: null, previous_item_id: null, replaces_turn_id: null, created_at: '2026-10-09T00:00:00Z' });
describe('질문에 연결된 짧은 답변', () => {
  it('부정 답변을 현재 질문 한 항목에만 적용한다', () => {
    const result = directAnswer(turn('아니요.', 'q_rf_chest_discomfort'))!;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toMatchObject({ field_id: 'rf_chest_discomfort', status: 'denied', value: null });
  });
  it('열린 질문의 아니요를 사실 부정으로 해석하지 않는다', () => {
    expect(directAnswer(turn('아니요', 'q_chief_complaint'))).toBeNull();
  });
  it('모른다는 답변을 위험 없음으로 바꾸지 않는다', () => {
    expect(directAnswer(turn('잘 모르겠어요', 'q_rf_black_tarry_stool'))!.facts[0].status).toBe('unknown');
  });
  it.each(['네.', '예', '맞아요', '네, 맞아요.'])('범위 확인 질문의 %s 뒤 문진을 계속한다', text => {
    const state = initialState('scope-test');
    const first = turn('배가 불편해요', 'q_chief_complaint');
    const start = transition({ request_id:'start',event:'answer',expected_revision:0,state,utterance:first,target_turn_id:null }, { facts:[],scope_signal:'uncertain',scope_evidence:[],needs_rephrase:false });
    expect(start.next_action.question_id).toBe('q_scope');
    const answer = { ...turn(text, 'q_scope'), id:'scope-answer', origin:'voice_transcript' as const };
    const extracted = directAnswer(answer);
    expect(extracted).not.toBeNull();
    validateCandidates(extracted!, answer);
    const result = transition({request_id:'scope',event:'answer',expected_revision:start.state.revision,state:start.state,utterance:answer,target_turn_id:null},extracted!);
    expect(result.state.scope).toBe('supported');
    expect(result.next_action).toMatchObject({kind:'ask',question_id:'q_rf_chest_discomfort'});
    expect(result.state.facts.every(f => f.status === 'not_assessed')).toBe(true);
  });
  it('범위 질문의 아니요와 모름을 지원 범위로 확정하지 않는다', () => {
    expect(directAnswer(turn('아니요', 'q_scope'))?.scope_signal).toBe('unsupported');
    expect(directAnswer(turn('잘 모르겠어요', 'q_scope'))?.scope_signal).toBe('uncertain');
    expect(directAnswer(turn('네', 'q_rf_chest_discomfort'))?.scope_signal).not.toBe('supported');
    expect(directAnswer({...turn('네', 'q_scope'),prompted_question_id:null})).toBeNull();
    expect(directAnswer(turn('네, 그런데 저는 미성년자예요', 'q_scope'))).toBeNull();
  });
  it('다른 질문의 네를 범위 확인 근거로 사용할 수 없다', () => {
    const result = directAnswer(turn('네', 'q_scope'))!;
    expect(() => validateCandidates(result, turn('네', 'q_rf_chest_discomfort'))).toThrow();
    expect(() => validateCandidates({...result,scope_evidence:result.scope_evidence.map(e => ({...e,question_id:null}))}, turn('네', 'q_scope'))).toThrow();
  });
});
