import { describe, it, expect } from 'vitest';
import { fixtures, fixtureExtraction, type FixtureCase, type FixtureStep } from '@/data/fixtures';
import { initialState, transition } from '@/lib/interview/engine';
import { requestSchema, stateSchema, type InterviewState, type Turn } from '@/lib/contracts';
import { validateCandidates, validateStateEvidence } from '@/lib/interview/validate-evidence';
import { buildReport } from '@/lib/report/build-report';
import { TranscriptQueue } from '@/lib/voice/turn-queue';
import { riskFields } from '@/data/protocol';
export function runCase(c: FixtureCase) {
  let s = initialState('test-session'); let next;
  for (const [i, part] of c.steps.entries()) {
    if (part.question) { s.last_question_id = part.question; if (!s.asked_question_ids.includes(part.question)) s.asked_question_ids.push(part.question); }
    const target = part.target !== undefined ? s.turns[part.target].id : null;
    const turn = makeTurn(part, `u${i}`, part.event === 'correct' ? null : part.question || s.last_question_id, target);
    const result = transition({ request_id: `r${i}`, event: part.event || 'answer', expected_revision: s.revision, state: s, utterance: turn, target_turn_id: target }, fixtureExtraction(part, turn));
    s = stateSchema.parse(result.state); validateStateEvidence(s); next = result.next_action;
  }
  return { s, next: next! };
}
function makeTurn(part: FixtureStep, id = 'u0', q: string | null = 'q_chief_complaint', replaces: string | null = null): Turn { return { id, text: part.text, role: 'user', origin: 'typed', provider_item_id: null, previous_item_id: null, final: true, prompted_question_id: q, replaces_turn_id: replaces, created_at: new Date().toISOString() }; }
const fact = (s: InterviewState, id: string) => s.facts.find(f => f.field_id === id)!;
describe('handoff 12개 고정 후보: 규칙/상태 회귀 (실제 추출 성능이 아님)', () => {
  for (const c of fixtures) it(c.id + ' ' + c.label, () => {
    const { s, next } = runCase(c);
    switch(c.id) {
      case 'T01': expect(s.completion).toBe('complete'); expect(next.kind).toBe('review'); expect(s.asked_question_ids).not.toContain('q_onset'); expect(fact(s,'fever').status).toBe('not_assessed'); expect(buildReport(s).rows.find(f=>f.field_id==='onset')?.evidence[0].quote).toBe('사흘 전부터'); break;
      case 'T02': case 'T03': expect(next.kind).toBe('urgent_help'); expect(s.safety.latched).toBe(true); expect(s.last_question_id).toBeNull(); break;
      case 'T04': expect(fact(s,'rf_black_tarry_stool').status).toBe('unclear'); expect(next.kind).toBe('clarify'); expect(next.question_id).toBe('q_rf_black_tarry_stool'); break;
      case 'T05': expect(fact(s,'vomiting').status).toBe('denied'); expect(fact(s,'medications').status).toBe('unknown'); expect(riskFields.every(f=>fact(s,f).status==='not_assessed')).toBe(true); break;
      case 'T06': expect(s.safety.latched).toBe(false); expect(fact(s,'rf_fainting').status).toBe('not_assessed'); expect(s.contextual_facts[0].subject).toBe('other'); expect(fact(s,'rf_chest_discomfort').status).toBe('denied'); break;
      case 'T07': { const result=transition({request_id:'end',event:'end',expected_revision:s.revision,state:s,utterance:null,target_turn_id:null}); expect(result.state.completion).toBe('partial'); expect(buildReport(result.state).title).toContain('미완료'); break; }
      case 'T08': expect(fact(s,'medications').value).toBeNull(); expect(fact(s,'medications').status).toBe('unclear'); break;
      case 'T09': expect(fact(s,'onset').value).toBe('사흘 전'); expect(fact(s,'onset').evidence[0].turn_id).toBe('u1'); expect(s.superseded_facts.some(f=>f.value==='일주일')).toBe(true); break;
      case 'T10': expect(next.kind).toBe('out_of_scope'); expect(fact(s,'location').status).toBe('not_assessed'); break;
      case 'T11': expect(s.facts.every(f=>f.status==='not_assessed')).toBe(true); expect(next.approved_text).not.toMatch(/처방|정상/); break;
      case 'T12': expect(s.safety.latched).toBe(false); expect(fact(s,'rf_breathing_difficulty').status).toBe('denied'); expect(fact(s,'rf_fainting').status).toBe('not_assessed'); break;
    }
  });
});
describe('시스템 불변조건', () => {
  it('없는 원문 인용과 넓어진 아니요를 거절', () => {
    const part=fixtures[0].steps[1]; const t=makeTurn(part,'u','q_rf_chest_discomfort');
    const e=fixtureExtraction(part,t); e.facts[0].evidence[0].quote='존재하지 않는 문장';
    expect(()=>validateCandidates(e,t)).toThrow();
    const wide=fixtureExtraction(part,t); wide.facts[0].field_id='rf_fainting';
    expect(()=>validateCandidates(wide,t)).toThrow();
  });
  it('중복 ID는 revision과 질문/답변 수를 늘리지 않음', () => {
    const c={...fixtures[0], steps:[fixtures[0].steps[0]]}; const {s}=runCase(c);
    const turn=s.turns[0]; const r=transition({request_id:'repeat',event:'answer',expected_revision:s.revision,state:s,utterance:turn,target_turn_id:null});
    expect(r.state).toEqual(s); expect(r.next_action.kind).toBe('pause');
  });
  it('provider item ID 중복도 무시', () => {
    const {s}=runCase({...fixtures[0],steps:[fixtures[0].steps[0]]}); s.turns[0].provider_item_id='provider1';
    const t={...s.turns[0],id:'another-id'};
    expect(transition({request_id:'d',event:'answer',expected_revision:s.revision,state:s,utterance:t,target_turn_id:null}).state.revision).toBe(s.revision);
  });
  it('버전 불일치를 거절', () => { const s=initialState('s'); expect(()=>transition({request_id:'r',event:'end',expected_revision:9,state:s,utterance:null,target_turn_id:null})).toThrow('revision_conflict'); });
  it('정정 후 삭제된 정보가 활성 사실에 남지 않음', () => {
    const {s}=runCase({...fixtures[0],steps:[fixtures[0].steps[0]]});
    const part:FixtureStep={text:'명치는 불편하지만 언제 시작했는지 모르겠어요.',scope:'supported',facts:[{field:'chief_complaint',value:'명치 불편',quote:'명치는 불편'},{field:'onset',status:'unknown',value:null,quote:'언제 시작했는지 모르겠어요'}]};
    const t=makeTurn(part,'correction',null,s.turns[0].id);
    const r=transition({request_id:'r',event:'correct',expected_revision:s.revision,state:s,utterance:t,target_turn_id:s.turns[0].id},fixtureExtraction(part,t));
    expect(fact(r.state,'meal_relation').status).toBe('not_assessed'); expect(fact(r.state,'onset').status).toBe('unknown'); validateStateEvidence(r.state);
  });
  it('확인 후 정정하면 확인을 해제', () => {
    const {s}=runCase(fixtures[0]); const c=transition({request_id:'c',event:'confirm',expected_revision:s.revision,state:s,utterance:null,target_turn_id:null}).state;
    expect(c.confirmed_revision).toBe(c.revision);
    const part:FixtureStep={...fixtures[0].steps[0], text:'사흘 전부터 명치가 쓰리고 밥 먹고 더 그래요.'}; const t=makeTurn(part,'new',null,c.turns[0].id);
    const n=transition({request_id:'n',event:'correct',expected_revision:c.revision,state:c,utterance:t,target_turn_id:c.turns[0].id},fixtureExtraction(part,t)); expect(n.state.confirmed_revision).toBeNull();
  });
  it('긴급 경고는 정정·종료·확인 뒤에도 유지', () => {
    let {s}=runCase(fixtures[2]);
    const part:FixtureStep={text:'피를 토한 건 아니에요.',facts:[{field:'rf_vomiting_blood',status:'denied',value:null}]}; const t=makeTurn(part,'fixed',null,s.turns[0].id);
    s=transition({request_id:'r',event:'correct',expected_revision:s.revision,state:s,utterance:t,target_turn_id:s.turns[0].id},fixtureExtraction(part,t)).state;
    for (const event of ['end','confirm'] as const) s=transition({request_id:event,event,expected_revision:s.revision,state:s,utterance:null,target_turn_id:null}).state;
    expect(s.phase).toBe('urgent_stop'); expect(s.safety.latched).toBe(true); expect(buildReport(s).title).toContain('긴급');
  });
  it('범위 판정보다 현재 위험 중단 우선', () => {
    const part:FixtureStep={text:'발목도 아프고 지금 가슴이 꽉 눌리고 숨이 차요.',scope:'unsupported',facts:[{field:'rf_chest_discomfort',value:'가슴 압박감',quote:'가슴이 꽉 눌리고'},{field:'rf_breathing_difficulty',value:'호흡곤란',quote:'숨이 차요'}]};
    const t=makeTurn(part); const s=initialState('s'); const r=transition({request_id:'r',event:'answer',expected_revision:0,state:s,utterance:t,target_turn_id:null},fixtureExtraction(part,t)); expect(r.next_action.kind).toBe('urgent_help');
  });
  it('타인 현재 위험을 본인 기록에 합치지 않음', () => {
    const part:FixtureStep={text:'지금 아버지가 쓰러졌어요.',scope:'unsupported',facts:[{field:'rf_fainting',value:'현재 쓰러짐',subject:'other'}]};
    const t=makeTurn(part); const s=initialState('s'); const r=transition({request_id:'r',event:'answer',expected_revision:0,state:s,utterance:t,target_turn_id:null},fixtureExtraction(part,t));
    expect(r.next_action.kind).toBe('urgent_help'); expect(fact(r.state,'rf_fainting').status).toBe('not_assessed');
  });
  it('12턴 후 미확인 항목은 partial', () => {
    const s=initialState('s');s.scope='supported';s.accepted_answer_count=11;
    const part:FixtureStep={text:'잘 모르겠어요.',facts:[{field:'chief_complaint',status:'unknown',value:null}]};const t=makeTurn(part);
    const r=transition({request_id:'r',event:'answer',expected_revision:0,state:s,utterance:t,target_turn_id:null},fixtureExtraction(part,t));expect(r.state.completion).toBe('partial');expect(r.next_action.kind).toBe('review');
  });
  it('동일 필드 중복과 해제된 긴급 상태 스키마 거절', () => {
    const s=initialState('s');s.facts[1]=s.facts[0];expect(stateSchema.safeParse(s).success).toBe(false);
    const other=initialState('s');other.safety.latched=true;expect(stateSchema.safeParse(other).success).toBe(false);
  });
  it('입력 실패가 남은 상태를 완성된 자료로 표시하지 않는다', () => {
    const {s}=runCase(fixtures[0]); s.stop_reason='input_error';
    const r=transition({request_id:'end-error',event:'end',expected_revision:s.revision,state:s,utterance:null,target_turn_id:null});
    expect(r.state.completion).toBe('partial');
  });
  it('질문을 보여줬지만 답변이 없으면 해당 항목을 건너뛰지 않는다', () => {
    const {s}=runCase({...fixtures[0],steps:[fixtures[0].steps[0]]});
    const r=transition({request_id:'unanswered',event:'correct',expected_revision:s.revision,state:s,utterance:{...s.turns[0],id:'corrected',prompted_question_id:null,replaces_turn_id:s.turns[0].id},target_turn_id:s.turns[0].id},fixtureExtraction(fixtures[0].steps[0],{...s.turns[0],id:'corrected',prompted_question_id:null,replaces_turn_id:s.turns[0].id}));
    expect(r.next_action.question_id).toBe('q_rf_chest_discomfort');
  });
  it('추가 key를 입력 계약에서 거절', () => { expect(requestSchema.safeParse({request_id:'r',event:'end',expected_revision:0,state:initialState('s'),utterance:null,target_turn_id:null,api_key:'bad'}).success).toBe(false); });
  it('전사가 뒤집혀 도착해도 선행 항목부터 처리', () => {
    const q=new TranscriptQueue();q.add({id:'b',previousId:'a',text:'두번째',questionId:null});expect(q.take()).toBeUndefined();q.add({id:'a',previousId:null,text:'첫번째',questionId:null});expect(q.take()?.id).toBe('a');expect(q.take()?.id).toBe('b');expect(q.add({id:'b',previousId:'a',text:'중복',questionId:null})).toBe(false);
  });
});
