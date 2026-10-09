import { mkdir, writeFile } from 'node:fs/promises';
import { fixtures } from '../data/fixtures';
import { initialState } from '../lib/interview/engine';
import { responseSchema, type InterviewState, type Turn } from '../lib/contracts';
const base = process.env.EVALUATION_BASE_URL || 'http://127.0.0.1:3000';
const results: Array<Record<string, unknown>> = [];
function assertCase(id: string, s: InterviewState, kind: string) {
  const f=(field:string)=>s.facts.find(x=>x.field_id===field)!;
  const check=(condition:boolean,message:string)=>{if(!condition)throw new Error(message);};
  if (id==='T01') { check(kind==='review'&&s.completion==='complete','일반 흐름 완료 실패');check(!s.asked_question_ids.includes('q_onset'),'이미 말한 시작 시점 재질문');check(f('fever').status==='not_assessed','미언급 열 생성'); }
  if (id==='T02'||id==='T03') check(kind==='urgent_help'&&s.safety.latched,'위험 중단 실패');
  if (id==='T04') check(f('rf_black_tarry_stool').status==='unclear'&&kind==='clarify','불명확 변 명확화 실패');
  if (id==='T05') {check(f('vomiting').status==='denied','구토 부정 실패');check(f('medications').status==='unknown'&&f('medications').value===null,'약 모름 실패');check(f('rf_fainting').status==='not_assessed','부정 범위 확대');}
  if (id==='T06') {check(!s.safety.latched,'타인 과거 위험 과잉 발동');check(f('rf_fainting').status==='not_assessed','본인 실신 생성');check(f('rf_chest_discomfort').status==='denied','현재 부정 누락');}
  if (id==='T07') check(s.completion==='partial'&&s.facts.filter(x=>x.status==='not_assessed').length>0,'미완료 정보 조작');
  if (id==='T08') check(['unknown','unclear'].includes(f('medications').status)&&f('medications').value===null,'약 추측 생성');
  if (id==='T09') check(/사흘|3일/.test(f('onset').value||'')&&f('onset').evidence.some(e=>e.quote.includes('사흘'))&&f('onset').evidence.every(e=>e.turn_id===s.turns.at(-1)?.id)&&s.superseded_facts.length>0,'정정 반영 실패');
  if (id==='T10') check(kind==='out_of_scope'&&f('location').status!=='reported','발목 범위 처리 실패');
  if (id==='T11') check(s.facts.every(x=>x.status==='not_assessed')&&!/처방|정상/.test(kind),'입력 명령 실행/사실 생성');
  if (id==='T12') check(!s.safety.latched&&f('rf_breathing_difficulty').status==='denied'&&f('rf_fainting').status==='not_assessed','부정 위험 과잉 발동');
}
async function request(state: InterviewState, event: 'answer'|'correct'|'end', utterance: Turn|null, target: string|null) {
  const request_id=crypto.randomUUID();
  const res=await fetch(`${base}/api/turn`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({request_id,event,expected_revision:state.revision,state,utterance,target_turn_id:target}),signal:AbortSignal.timeout(20000)});
  const json=await res.json(); if(!res.ok)throw new Error(`${res.status}: ${json.error?.code}`);
  return responseSchema.parse(json);
}
const health=await fetch(`${base}/api/health`).then(r=>r.json());
const model = health.extract_model;
if(!health.api_configured)throw new Error('API 설정 없음: 실제 평가를 실행하지 않았습니다.');
const run_id=new Date().toISOString();
for(const c of fixtures){
  let s=initialState(crypto.randomUUID());let kind='';const start=performance.now();
  try{
    for(const [i,part] of c.steps.entries()){
      if(part.question){s.last_question_id=part.question;if(!s.asked_question_ids.includes(part.question))s.asked_question_ids.push(part.question);}
      const target=part.target!==undefined?s.turns[part.target].id:null;
      const t:Turn={id:crypto.randomUUID(),role:'user',origin:'typed',provider_item_id:null,previous_item_id:null,text:part.text,final:true,prompted_question_id:part.event==='correct'?null:part.question||s.last_question_id,replaces_turn_id:target,created_at:new Date().toISOString()};
      const r=await request(s,part.event||'answer',t,target);s=r.state;kind=r.next_action.kind;
    }
    if(c.id==='T07'){const r=await request(s,'end',null,null);s=r.state;kind=r.next_action.kind;}
    assertCase(c.id,s,kind);
    results.push({case_id:c.id,run_id,commit:null,model,expected:c.label,actual:{state:s,next_kind:kind},pass:true,failure_notes:null,elapsed_ms:Math.round(performance.now()-start)});
    console.log(`${c.id}: PASS`);
  }catch(e){results.push({case_id:c.id,run_id,commit:null,model,expected:c.label,actual:{state:s,next_kind:kind},pass:false,failure_notes:e instanceof Error?e.message:'error'});console.log(`${c.id}: FAIL ${e instanceof Error?e.message:'error'}`);}
}
await mkdir('evaluation',{recursive:true});await writeFile('evaluation/results.json',JSON.stringify(results,null,2)+'\n');
const passed=results.filter(r=>r.pass).length;
await writeFile('evaluation/summary.md',`# 실제 API 회귀 평가\n\n실행: ${run_id}\n모델: ${model}\n가상 scripted 사례: ${passed}/${results.length} 통과.\n\n각 사례의 JSON에는 실제 API 상태와 실패 사유를 기록했다. 개발자가 이미 본 회귀 증례이며 임상 검증/독립 holdout이 아니다. T05 등의 독립 의미 테스트는 질문 맥락을 준비해 실행한다. 실제 마이크 시험은 미실행. 의미 정확성의 의료진 수동 검토는 미완료.\n`);
process.exitCode=passed===results.length?0:1;
