import { randomUUID } from 'node:crypto';
import { initialState } from '../lib/interview/engine';
import { ABDOMINAL_CPX_ID } from '../data/protocol';
import { responseSchema } from '../lib/contracts';

const base = 'https://careframe.jisong.dev';
async function post(path: string, body: unknown, origin = base) {
  return fetch(base + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
}
const health = await fetch(base + '/api/health', { signal: AbortSignal.timeout(15000) });
const configuration = await health.json();
console.log('health', health.status, configuration);
if (!health.ok || !configuration.api_configured) throw new Error('배포 API 설정 확인 실패');
const rejected = await post('/api/realtime-token', {persona_id:'younghee',demo_only:true}, 'https://example.com');
console.log('외부 origin 차단', rejected.status);
if (rejected.status !== 403) throw new Error('Origin 차단 확인 실패');
for (const persona_id of ['younghee', 'cheolsu']) {
  const token = await post('/api/realtime-token', {persona_id,demo_only:true});
  const data = await token.json();
  console.log('음성 토큰', persona_id, token.status, token.ok ? {issued:Boolean(data.value),model:data.model,voice:data.voice} : {code:data.error?.code});
  if (!token.ok || !data.value) throw new Error('배포 음성 토큰 발급 실패');
}
let state = initialState(randomUUID(), {age:30,sex:'female'}, ABDOMINAL_CPX_ID);
const turn = {id:randomUUID(),role:'user' as const,origin:'typed' as const,text:'사흘 전부터 명치가 쓰리고 식후에 더 아파요. 통증은 3점이에요.',final:true,prompted_question_id:state.last_question_id,provider_item_id:null,previous_item_id:null,replaces_turn_id:null,created_at:new Date().toISOString()};
const answer = await post('/api/turn', {request_id:randomUUID(),event:'answer',expected_revision:state.revision,state,utterance:turn,target_turn_id:null});
const data = await answer.json();
if (!answer.ok) throw new Error(`배포 추출 API 실패: HTTP ${answer.status} ${data.error?.code}`);
const result = responseSchema.parse(data); state = result.state;
console.log('실제 가상 문진', answer.status, {revision:state.revision,chiefComplaint:state.facts.find(f=>f.field_id==='chief_complaint')?.status,nextQuestion:result.next_action.question_id});
if (state.revision !== 1 || state.facts.find(f=>f.field_id==='chief_complaint')?.status !== 'reported') throw new Error('배포 문진 상태 확인 실패');
const end = await post('/api/turn', {request_id:randomUUID(),event:'end',expected_revision:state.revision,state,utterance:null,target_turn_id:null});
if (!end.ok) throw new Error('배포 문진 종료 실패');
state = responseSchema.parse(await end.json()).state;
const summary = await post('/api/final-summary', {state});
const summaryData = await summary.json();
console.log('마지막 사실 요약', summary.status, {generated:Boolean(summaryData.summary),error:summaryData.error?.code});
if (!summary.ok || !summaryData.summary) throw new Error('배포 마지막 요약 실패');
console.log('실제 마이크·음성 재생은 이 HTTP 검증에 포함하지 않음');
