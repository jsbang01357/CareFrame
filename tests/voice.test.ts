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
 afterEach(()=>{voice.close();vi.unstubAllGlobals();});
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
 it('연결 실패에서 마이크 트랙 종료',async()=>{m.connect.mockRejectedValue(new Error('failed'));await expect(voice.connect()).rejects.toThrow();expect(stop).toHaveBeenCalled();});
});
