import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const m=vi.hoisted(()=>({handlers:new Map<string,(event:unknown)=>void>(),send:vi.fn(),interrupt:vi.fn(),close:vi.fn(),mute:vi.fn(),connect:vi.fn(),options:null as unknown}));
vi.mock('@openai/agents/realtime',()=>({
 RealtimeAgent:class{}, OpenAIRealtimeWebRTC:class{},
 RealtimeSession:class{transport={sendEvent:m.send};constructor(_:unknown,options:unknown){m.options=options;}on(event:string,cb:(e:unknown)=>void){m.handlers.set(event,cb);}connect=m.connect;interrupt=m.interrupt;close=m.close;mute=m.mute;},
}));
import { VoiceController } from '@/lib/voice/controller';
describe('음성 제어 불변조건 — 가짜 transport로 검증 (실제 음성 시험 아님)',()=>{
 let stop = vi.fn<() => void>(); let errors = vi.fn<(message: string) => void>(); let delivery = vi.fn<(status: string) => void>(); let transcript = vi.fn<(turn: unknown) => Promise<boolean>>();let voice:VoiceController;
 const emit=(e:unknown)=>m.handlers.get('transport_event')?.(e);
 beforeEach(()=>{
  vi.clearAllMocks();m.handlers.clear();m.connect.mockResolvedValue(undefined);
  stop=vi.fn<() => void>();errors=vi.fn<(message: string) => void>();delivery=vi.fn<(status: string) => void>();transcript=vi.fn<(turn: unknown) => Promise<boolean>>().mockResolvedValue(true);
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop}]})}});
  vi.stubGlobal('document',{createElement:()=>({autoplay:true,play:vi.fn().mockResolvedValue(undefined),pause:vi.fn(),srcObject:null})});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({value:'ek_test',model:'test',voice:'marin',transcription_model:'test-transcribe'})}));
  voice=new VoiceController({transcript: async t => Boolean(await transcript(t)),status:vi.fn(),error: message => { errors(message); },questionId:()=> 'q_chief_complaint',delivery: status => { delivery(status); }});
 });
 afterEach(()=>{voice.close();vi.useRealTimers();vi.unstubAllGlobals();});
 it('자동응답과 tracing을 끄고 승인 텍스트를 수동 재생',async()=>{
  await voice.connect();expect(m.options).toMatchObject({tracingDisabled:true,historyStoreAudio:false,config:{audio:{input:{turnDetection:{createResponse:false,interruptResponse:false}}}}});
  voice.speak('승인된 질문');expect(m.send.mock.calls[0][0]).toMatchObject({type:'response.create',response:{conversation:'none',input:[],instructions:expect.stringContaining('승인된 질문')}});
 });
 it('끼어들면 출력 취소, 완료로 기록하지 않고 질문 연결 비움',async()=>{
  await voice.connect();voice.speak('질문');emit({type:'response.created',response:{id:'r1',metadata:{generation:'1'}}});emit({type:'output_audio_buffer.started',response_id:'r1'});
  emit({type:'input_audio_buffer.speech_started',item_id:'u1'});emit({type:'input_audio_buffer.committed',item_id:'u1',previous_item_id:null});emit({type:'conversation.item.input_audio_transcription.completed',item_id:'u1',transcript:'아니요'});
  await Promise.resolve();expect(delivery).toHaveBeenCalledWith('interrupted');expect((transcript.mock.calls[0][0] as { questionId: string | null }).questionId).toBeNull();expect(m.interrupt).toHaveBeenCalled();
 });
 it('늦은 이전 음성 응답을 취소',async()=>{await voice.connect();voice.speak('질문');voice.interrupt();emit({type:'response.created',response:{id:'late',metadata:{generation:'1'}}});emit({type:'output_audio_buffer.started',response_id:'late'});expect(delivery).not.toHaveBeenCalledWith('playing');});
 it('실패한 발언 뒤 다음 음성 처리를 계속하지 않음',async()=>{
  await voice.connect();transcript.mockResolvedValue(false);emit({type:'conversation.item.input_audio_transcription.completed',item_id:'u1',transcript:'원문'});
  await Promise.resolve();await Promise.resolve();expect(stop).toHaveBeenCalled();expect(m.close).toHaveBeenCalled();
 });
 it('종료와 연결 오류에서 앱이 소유한 마이크 트랙 종료',async()=>{await voice.connect();voice.close();expect(stop).toHaveBeenCalled();});
 it('입력을 일시정지한 뒤에도 마지막 행동 안내를 읽고 늦은 전사를 무시',async()=>{
  await voice.connect();voice.pause(true);voice.finish('오늘 병원에서 확인받으세요.');
  expect(m.mute).toHaveBeenLastCalledWith(true);
  expect(m.send).toHaveBeenCalledWith(expect.objectContaining({type:'response.create',response:expect.objectContaining({instructions:expect.stringContaining('오늘 병원에서 확인받으세요.')})}));
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'late',transcript:'늦은 입력'});
  expect(transcript).not.toHaveBeenCalled();expect(m.close).not.toHaveBeenCalled();
 });
 it('이어 말한 답변의 전사를 기다린 뒤 최신 질문을 재생',async()=>{
  await voice.connect();
  transcript.mockImplementationOnce(async()=>{voice.speak('다음 질문');return true;});
  emit({type:'input_audio_buffer.speech_started',item_id:'u1'});
  emit({type:'input_audio_buffer.speech_stopped',item_id:'u1'});
  emit({type:'input_audio_buffer.speech_started',item_id:'u2'});
  emit({type:'input_audio_buffer.speech_stopped',item_id:'u2'});
  emit({type:'input_audio_buffer.committed',item_id:'u2',previous_item_id:'u1'});
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'u1',transcript:'첫 답변'});
  await vi.waitFor(()=>expect(transcript).toHaveBeenCalledTimes(1));
  expect(m.send).not.toHaveBeenCalled();
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'u2',transcript:''});
  await vi.waitFor(()=>expect(m.send).toHaveBeenCalledTimes(1));
  expect(transcript).toHaveBeenCalledTimes(1);
  expect(m.close).not.toHaveBeenCalled();
 });
 it('전사가 없는 앞선 대화 항목 때문에 사용자 답변을 막지 않는다',async()=>{
  await voice.connect();
  emit({type:'input_audio_buffer.committed',item_id:'u2',previous_item_id:'assistant1'});
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'u2',transcript:'두 번째 답변'});
  await vi.waitFor(()=>expect(transcript).toHaveBeenCalledTimes(1));
  emit({type:'conversation.item.added',item:{id:'assistant1',role:'assistant'}});
  await vi.waitFor(()=>expect(transcript).toHaveBeenCalledTimes(1));
  await vi.waitFor(()=>expect(voice.hasPending).toBe(false));
 });
 it('전사가 역순으로 오고 앞선 답변이 4초 넘게 늦어도 발언 순서를 유지한다',async()=>{
  await voice.connect();vi.useFakeTimers();
  emit({type:'input_audio_buffer.speech_started',item_id:'first'});
  emit({type:'input_audio_buffer.speech_stopped',item_id:'first'});
  emit({type:'input_audio_buffer.committed',item_id:'first',previous_item_id:'other-item'});
  emit({type:'input_audio_buffer.speech_started',item_id:'second'});
  emit({type:'input_audio_buffer.speech_stopped',item_id:'second'});
  emit({type:'input_audio_buffer.committed',item_id:'second',previous_item_id:'another-item'});
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'second',transcript:'두 번째 답변'});
  await vi.advanceTimersByTimeAsync(5000);
  expect(transcript).not.toHaveBeenCalled();expect(errors).not.toHaveBeenCalled();expect(m.close).not.toHaveBeenCalled();
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'first',transcript:'첫 답변'});
  await vi.advanceTimersByTimeAsync(0);
  expect(transcript.mock.calls.map(([turn])=>(turn as {id:string}).id)).toEqual(['first','second']);
  await vi.advanceTimersByTimeAsync(30000);
  expect(errors).not.toHaveBeenCalled();expect(voice.hasPending).toBe(false);
 });
 it('실제 앞선 음성 전사가 누락되면 뒤 답변을 임의로 처리하지 않는다',async()=>{
  await voice.connect();vi.useFakeTimers();
  emit({type:'input_audio_buffer.committed',item_id:'first',previous_item_id:null});
  emit({type:'input_audio_buffer.committed',item_id:'second',previous_item_id:'first'});
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'second',transcript:'뒤 답변'});
  await vi.advanceTimersByTimeAsync(30000);
  expect(transcript).not.toHaveBeenCalled();expect(errors).toHaveBeenCalledWith(expect.stringContaining('오래 지연'));
  expect(m.close).toHaveBeenCalled();
 });
 it('이전 질문의 늦은 음성 전사가 현재 질문 연결을 닫지 않음',async()=>{
  await voice.connect();voice.speak('첫 질문');
  emit({type:'response.created',response:{id:'r1',metadata:{generation:'1'}}});
  voice.interrupt();voice.speak('둘째 질문');
  emit({type:'response.created',response:{id:'r2',metadata:{generation:'3'}}});
  emit({type:'response.output_audio_transcript.done',response_id:'r1',transcript:'첫 질문'});
  expect(errors).not.toHaveBeenCalled();expect(m.close).not.toHaveBeenCalled();
  emit({type:'response.output_audio_transcript.done',response_id:'r2',transcript:'승인되지 않은 말'});
  expect(m.close).toHaveBeenCalled();
 });
 it('빈 전사를 건너뛰고 세 번째 이후 답변도 계속 처리',async()=>{
  await voice.connect();
  transcript.mockImplementation(async()=>{voice.speak('다음 질문');return true;});
  let previousId:string|null=null;
  for(const [i,text] of ['명치가 불편해요','아니요','','아니요','없어요'].entries()) {
   const id=`u${i}`;
   emit({type:'input_audio_buffer.speech_started',item_id:id});
   emit({type:'input_audio_buffer.speech_stopped',item_id:id});
   emit({type:'input_audio_buffer.committed',item_id:id,previous_item_id:previousId});
   emit({type:'conversation.item.input_audio_transcription.completed',item_id:id,transcript:text});
   await vi.waitFor(()=>expect(voice.hasPending).toBe(false));previousId=id;
  }
  // 빈 전사가 끊은 아직 재생 완료되지 않은 질문도 한 번 복구한다.
  expect(transcript).toHaveBeenCalledTimes(4);expect(m.send).toHaveBeenCalledTimes(5);
  expect(errors).not.toHaveBeenCalled();expect(m.close).not.toHaveBeenCalled();
 });
 it('일시정지나 종료 시 보류 질문을 재생하지 않음',async()=>{
  await voice.connect();
  emit({type:'input_audio_buffer.speech_started',item_id:'u1'});
  voice.speak('보류 질문');voice.pause(true);
  emit({type:'input_audio_buffer.speech_stopped',item_id:'u1'});
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'u1',transcript:''});
  await vi.waitFor(()=>expect(voice.hasPending).toBe(false));voice.pause(false);
  expect(m.send).not.toHaveBeenCalled();
  voice.close();voice.speak('종료 뒤 질문');expect(m.send).not.toHaveBeenCalled();
 });
 it('연결 실패에서 마이크 트랙 종료',async()=>{m.connect.mockRejectedValue(new Error('failed'));await expect(voice.connect()).rejects.toThrow();expect(stop).toHaveBeenCalled();});
 it('마이크 권한 거절을 통신 연결 실패와 구분',async()=>{
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new DOMException('denied','NotAllowedError'));
  await expect(voice.connect()).rejects.toThrow('마이크 연결 실패 (NotAllowedError)');
  expect(m.connect).not.toHaveBeenCalled();
 });
 it('마이크 API가 없는 환경에서는 안내하고 토큰 발급을 요청하지 않음',async()=>{
  vi.stubGlobal('navigator',{mediaDevices:undefined});
  await expect(voice.connect()).rejects.toThrow('브라우저의 마이크 기능');
  expect(fetch).not.toHaveBeenCalled();
 });
 it('SDK 오류의 코드만 표시하고 원문·키 등의 오류 상세는 노출하지 않음',async()=>{
  await voice.connect();m.handlers.get('error')?.({error:{error:{code:'invalid_session',message:'secret-detail'}}});
  expect(errors).toHaveBeenCalledWith(expect.stringContaining('invalid_session'));
  expect(errors.mock.calls[0][0]).not.toContain('secret-detail');
  expect(m.close).toHaveBeenCalled();expect(stop).toHaveBeenCalled();
 });
 it.each([
  {error:{code:'response_cancel_not_active'}},
  {error:{error:{code:'response_cancel_not_active'}}},
 ])('응답 완료 뒤 취소 오류에서도 마이크·연결을 유지하고 다음 질문 재생',async event=>{
  await voice.connect();voice.speak('첫 질문');
  emit({type:'response.created',response:{id:'r1',metadata:{generation:'1'}}});
  emit({type:'output_audio_buffer.started',response_id:'r1'});
  emit({type:'output_audio_buffer.stopped',response_id:'r1'});
  voice.pause(true);m.handlers.get('error')?.(event);
  expect(errors).not.toHaveBeenCalled();expect(m.close).not.toHaveBeenCalled();expect(stop).not.toHaveBeenCalled();
  voice.pause(false);voice.speak('다음 질문');
  emit({type:'response.created',response:{id:'r2',metadata:{generation:'3'}}});
  emit({type:'output_audio_buffer.started',response_id:'r2'});
  emit({type:'output_audio_buffer.stopped',response_id:'r2'});
  expect(m.send).toHaveBeenCalledTimes(2);expect(delivery).toHaveBeenLastCalledWith('completed');
 });
 it('페이지 종료 후 늦게 도착한 오류를 표시하지 않고 종료를 반복하지 않음',async()=>{
  await voice.connect();voice.close();
  m.handlers.get('error')?.({error:{error:{code:'invalid_session'}}});voice.close();
  expect(errors).not.toHaveBeenCalled();expect(m.close).toHaveBeenCalledTimes(1);expect(stop).toHaveBeenCalledTimes(1);
 });
 it('재생 중단 이벤트 뒤 보류된 다음 질문을 읽는다',async()=>{
  await voice.connect();voice.speak('첫 질문');
  emit({type:'response.created',response:{id:'r1',metadata:{generation:'1'}}});
  emit({type:'output_audio_buffer.started',response_id:'r1'});
  voice.speak('둘째 질문');expect(m.send).toHaveBeenCalledTimes(1);
  emit({type:'output_audio_buffer.cleared',response_id:'r1'});
  expect(m.send).toHaveBeenCalledTimes(2);
  expect(delivery).toHaveBeenLastCalledWith('interrupted');
  expect(m.close).not.toHaveBeenCalled();
 });
 it('잡음으로 질문이 끊겼다가 빈 전사가 오면 현재 질문을 다시 읽는다',async()=>{
  await voice.connect();voice.speak('현재 질문');
  emit({type:'response.created',response:{id:'r1',metadata:{generation:'1'}}});
  emit({type:'output_audio_buffer.started',response_id:'r1'});
  emit({type:'input_audio_buffer.speech_started',item_id:'noise'});
  emit({type:'input_audio_buffer.speech_stopped',item_id:'noise'});
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'noise',transcript:''});
  await vi.waitFor(()=>expect(voice.hasPending).toBe(false));
  expect(m.send).toHaveBeenCalledTimes(2);
  expect(m.send.mock.calls[1][0]).toMatchObject({type:'response.create',response:{instructions:expect.stringContaining('현재 질문')}});
  expect(transcript).not.toHaveBeenCalled();
 });
 it('이전 응답 생성 이벤트가 늦게 와도 새 질문 재생을 취소하지 않는다',async()=>{
  await voice.connect();voice.speak('첫 질문');voice.interrupt();voice.speak('새 질문');
  emit({type:'response.created',response:{id:'new',metadata:{generation:'3'}}});
  const cancellations=m.interrupt.mock.calls.length;
  emit({type:'response.created',response:{id:'old',metadata:{generation:'1'}}});
  emit({type:'output_audio_buffer.started',response_id:'old'});
  emit({type:'output_audio_buffer.cleared',response_id:'old'});
  emit({type:'output_audio_buffer.started',response_id:'new'});
  expect(m.interrupt).toHaveBeenCalledTimes(cancellations);
  expect(delivery).toHaveBeenLastCalledWith('playing');
 });
 it('질문 재생 완료 뒤 빈 잡음은 끝난 질문을 다시 읽지 않는다',async()=>{
  await voice.connect();voice.speak('현재 질문');
  emit({type:'response.created',response:{id:'r1',metadata:{generation:'1'}}});
  emit({type:'output_audio_buffer.started',response_id:'r1'});
  emit({type:'output_audio_buffer.stopped',response_id:'r1'});
  emit({type:'output_audio_buffer.cleared',response_id:'r1'});
  emit({type:'input_audio_buffer.speech_started',item_id:'noise'});
  emit({type:'input_audio_buffer.speech_stopped',item_id:'noise'});
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'noise',transcript:''});
  await vi.waitFor(()=>expect(voice.hasPending).toBe(false));
  expect(m.send).toHaveBeenCalledTimes(1);
 });
 it('다음 질문 생성 대기 중 이전 질문의 중단 이벤트를 무시한다',async()=>{
  await voice.connect();voice.speak('첫 질문');
  emit({type:'response.created',response:{id:'r1',metadata:{generation:'1'}}});
  emit({type:'output_audio_buffer.started',response_id:'r1'});
  voice.speak('새 질문');
  emit({type:'output_audio_buffer.stopped',response_id:'r1'});
  emit({type:'output_audio_buffer.cleared',response_id:'r1'});
  emit({type:'response.created',response:{id:'r2',metadata:{generation:'2'}}});
  emit({type:'output_audio_buffer.started',response_id:'r2'});
  expect(m.send).toHaveBeenCalledTimes(2);
  expect(delivery).toHaveBeenLastCalledWith('playing');
 });
 it('질문 중단 뒤 실제 답변이 오면 이전 질문 대신 새 질문을 읽는다',async()=>{
  await voice.connect();voice.speak('첫 질문');
  emit({type:'response.created',response:{id:'r1',metadata:{generation:'1'}}});
  emit({type:'output_audio_buffer.started',response_id:'r1'});
  transcript.mockImplementationOnce(async()=>{voice.speak('새 질문');return true;});
  emit({type:'input_audio_buffer.speech_started',item_id:'answer'});
  emit({type:'input_audio_buffer.speech_stopped',item_id:'answer'});
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'answer',transcript:'사흘 전부터요'});
  await vi.waitFor(()=>expect(voice.hasPending).toBe(false));
  expect(m.send).toHaveBeenCalledTimes(2);
  expect(m.send.mock.calls[1][0]).toMatchObject({type:'response.create',response:{instructions:expect.stringContaining('새 질문')}});
 });
 it('발언 종료 이벤트 없이 커밋·빈 전사가 와도 끊긴 질문을 복구한다',async()=>{
  await voice.connect();voice.speak('현재 질문');
  emit({type:'response.created',response:{id:'r1',metadata:{generation:'1'}}});
  emit({type:'output_audio_buffer.started',response_id:'r1'});
  emit({type:'input_audio_buffer.speech_started',item_id:'noise'});
  emit({type:'input_audio_buffer.committed',item_id:'noise',previous_item_id:null});
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'noise',transcript:''});
  await vi.waitFor(()=>expect(voice.hasPending).toBe(false));
  expect(m.send).toHaveBeenCalledTimes(2);
 });
 it('발언 종료·커밋 이벤트가 없어도 최종 전사 후 다음 질문을 읽는다',async()=>{
  await voice.connect();
  transcript.mockImplementationOnce(async()=>{voice.speak('다음 질문');return true;});
  emit({type:'input_audio_buffer.speech_started',item_id:'answer'});
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'answer',transcript:'사흘 전부터요'});
  await vi.waitFor(()=>expect(voice.hasPending).toBe(false));
  expect(m.send).toHaveBeenCalledTimes(1);
 });
 it('이전 발언의 최종 전사는 더 최근 발언의 말하는 상태를 해제하지 않는다',async()=>{
  await voice.connect();voice.speak('현재 질문');
  emit({type:'input_audio_buffer.speech_started',item_id:'first'});
  emit({type:'input_audio_buffer.speech_started',item_id:'second'});
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'first',transcript:''});
  await Promise.resolve();expect(m.send).toHaveBeenCalledTimes(1);
  emit({type:'conversation.item.input_audio_transcription.completed',item_id:'second',transcript:''});
  await vi.waitFor(()=>expect(voice.hasPending).toBe(false));
  expect(m.send).toHaveBeenCalledTimes(2);
 });
 it('재생 중단 이벤트 없이 응답 취소가 와도 보류한 다음 질문을 읽는다',async()=>{
  await voice.connect();voice.speak('현재 질문');
  emit({type:'response.created',response:{id:'r1',metadata:{generation:'1'}}});
  emit({type:'output_audio_buffer.started',response_id:'r1'});
  voice.speak('다음 질문');
  emit({type:'response.done',response:{id:'r1',status:'cancelled'}});
  emit({type:'output_audio_buffer.cleared',response_id:'r1'});
  expect(m.send).toHaveBeenCalledTimes(2);
  expect(m.send.mock.calls[1][0]).toMatchObject({type:'response.create',response:{instructions:expect.stringContaining('다음 질문')}});
  expect(m.close).not.toHaveBeenCalled();
 });
 it('음성 생성 실패는 무음 상태로 방치하지 않고 다시 연결하도록 안내한다',async()=>{
  await voice.connect();voice.speak('현재 질문');
  emit({type:'response.created',response:{id:'r1',metadata:{generation:'1'}}});
  emit({type:'response.done',response:{id:'r1',status:'failed'}});
  expect(errors).toHaveBeenCalledWith(expect.stringContaining('음성 다시 연결'));
  expect(m.close).toHaveBeenCalled();
 });
});
