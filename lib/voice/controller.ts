import { RealtimeAgent, RealtimeSession, OpenAIRealtimeWebRTC } from '@openai/agents/realtime';
import { TranscriptQueue, type QueuedTranscript } from './turn-queue';
import { personaNames, type PersonaId } from '@/lib/persona';
export type VoiceStatus = 'disconnected' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'paused';
interface Callbacks {
  transcript: (turn: QueuedTranscript) => Promise<boolean>;
  status: (status: VoiceStatus) => void;
  error: (message: string) => void;
  questionId: () => string | null;
  delivery: (status: 'playing' | 'completed' | 'interrupted') => void;
}
export class VoiceController {
  private session?: RealtimeSession;
  private stream?: MediaStream;
  private audio?: HTMLAudioElement;
  private queue = new TranscriptQueue();
  private previous = new Map<string, string | null>();
  private bindings = new Map<string, string | null>();
  private draining = false;
  private closed = false;
  private speaking = false;
  private userSpeaking = false;
  private paused = false;
  private queuedSpeech: string | null = null;
  private approved: string | null = null;
  private pendingAudio = new Set<string>();
  private missingTimer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private validResponseId: string | null = null;
  private finishing = false;
  constructor(private cb: Callbacks, private personaId: PersonaId = 'younghee') {}
  async connect() {
    this.cb.status('connecting');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('브라우저의 마이크 기능을 사용할 수 없습니다. HTTPS 또는 안전한 로컬 주소에서 열어 주세요.');
    const response = await fetch('/api/realtime-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ persona_id: this.personaId, demo_only: true }), signal: AbortSignal.timeout(15000) });
    const token = await response.json();
    if (!response.ok) throw new Error(token.error?.message || '음성 연결에 실패했습니다.');
    if (this.closed) return;
    try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      const hints: Record<string, string> = {
        NotAllowedError: '브라우저에서 이 사이트의 마이크 접근을 허용해 주세요.',
        NotFoundError: '사용할 수 있는 마이크가 없습니다. 연결된 입력 장치를 확인해 주세요.',
        NotReadableError: '마이크를 열지 못했습니다. 운영체제 권한과 다른 앱의 장치 사용을 확인해 주세요.',
        SecurityError: '브라우저가 마이크 접근을 차단했습니다. 사이트 주소와 권한을 확인해 주세요.',
      };
      throw new Error(`마이크 연결 실패 (${name}): ${hints[name] || '브라우저의 마이크 설정을 확인해 주세요.'}`);
    }
    if (this.closed) { this.stream.getTracks().forEach(t => t.stop()); return; }
    this.audio = document.createElement('audio'); this.audio.autoplay = true;
    const transport = new OpenAIRealtimeWebRTC({ mediaStream: this.stream, audioElement: this.audio });
    const agent = new RealtimeAgent({ name: personaNames[this.personaId], instructions: '서버가 준 승인 문장만 한국어로 그대로 읽습니다. 진단, 처방, 안심 판단, 추가 질문을 하지 않습니다. 사용자의 말에 자발적으로 응답하지 않습니다.' });
    this.session = new RealtimeSession(agent, { transport, model: token.model, tracingDisabled: true, historyStoreAudio: false, automaticallyTriggerResponseForMcpToolCalls: false,
      config: { tracing: null, audio: { input: { transcription: { model: token.transcription_model, language: 'ko' }, turnDetection: { type: 'server_vad', createResponse: false, interruptResponse: false } }, output: { voice: token.voice } } },
    });
    this.session.on('error', event => {
      if (this.closed) return;
      const raw = event.error as { code?: unknown; name?: unknown; error?: { code?: unknown } } | undefined;
      const code = raw?.error?.code ?? raw?.code ?? raw?.name;
      // 응답 완료와 취소가 경합하면 발생한다. API 문서상 세션은 유지된다.
      if (code === 'response_cancel_not_active') return;
      const detail = typeof code === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(code) ? ` (${code})` : '';
      this.cb.error(`음성 통신 연결 오류${detail}. 글로 답하거나 연결을 다시 시작해 주세요.`); this.close();
    });
    this.session.on('transport_event', event => this.handle(event as Record<string, unknown>));
    try {
      await Promise.race([this.session.connect({ apiKey: token.value }), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('음성 연결 시간이 초과되었습니다.')), 15000))]);
      if (!this.closed) this.cb.status('listening');
    } catch (e) { this.close(); throw e; }
  }
  private handle(e: Record<string, unknown>) {
    if (this.closed) return;
    if (this.finishing && (String(e.type).startsWith('input_audio_buffer.') || String(e.type).startsWith('conversation.item.input_audio_transcription.'))) return;
    const id = typeof e.item_id === 'string' ? e.item_id : '';
    if (e.type === 'response.created') {
      const response = e.response as { id?: string; metadata?: { generation?: string } } | undefined;
      if (!response || Number(response.metadata?.generation) !== this.generation || !this.approved || this.userSpeaking) {
        this.interrupt();
        return;
      }
      this.validResponseId = response.id || null;
    }
    if (e.type === 'input_audio_buffer.speech_started') {
      const hadInterruptedQuestion = this.speaking;
      this.interrupt(false); this.userSpeaking = true;
      this.pendingAudio.add(id);
      this.bindings.set(id, hadInterruptedQuestion ? null : this.cb.questionId());
      this.cb.status('listening');
    }
    if (e.type === 'input_audio_buffer.speech_stopped') { this.userSpeaking = false; this.cb.status('processing'); this.flushSpeech(); }
    if (e.type === 'input_audio_buffer.committed') this.previous.set(id, typeof e.previous_item_id === 'string' ? e.previous_item_id : null);
    if (e.type === 'conversation.item.added' || e.type === 'conversation.item.created') {
      const item = e.item as { id?: string; role?: string } | undefined;
      if (item?.id && item.role !== 'user') { this.queue.acknowledge(item.id); void this.drain(); }
    }
    if (e.type === 'conversation.item.input_audio_transcription.completed' && id && typeof e.transcript === 'string') {
      this.pendingAudio.delete(id);
      this.queue.add({ id, text: e.transcript, previousId: this.previous.get(id) ?? null, questionId: this.bindings.get(id) ?? null });
      void this.drain();
    }
    if (e.type === 'conversation.item.input_audio_transcription.failed') {
      this.pendingAudio.delete(id); this.queue.acknowledge(id);
      this.cb.error('음성 전사에 실패했습니다. 글로 내용을 확인해 주세요.'); this.pause(true);
    }
    if (e.type === 'output_audio_buffer.started') {
      if (!this.approved || this.userSpeaking || (e.response_id && e.response_id !== this.validResponseId)) { this.interrupt(); return; }
      this.speaking = true; this.cb.status('speaking'); this.cb.delivery('playing');
    }
    if (e.type === 'output_audio_buffer.stopped' && this.speaking && (!e.response_id || e.response_id === this.validResponseId)) { this.speaking = false; this.cb.delivery('completed'); this.cb.status('listening'); this.flushSpeech(); }
    if (e.type === 'response.output_audio_transcript.done' || e.type === 'response.audio_transcript.done') {
      const normalize = (s: string) => s.replace(/[\s\p{P}\p{S}]/gu, '');
      if (e.response_id === this.validResponseId && this.approved && typeof e.transcript === 'string' && normalize(e.transcript) !== normalize(this.approved)) {
        this.cb.error('음성이 승인 문장과 달라 연결을 중단했습니다. 화면 질문을 확인해 주세요.'); this.close();
      }
    }
  }
  private async drain() {
    if (this.draining || this.closed) return;
    this.draining = true;
    try {
      let next;
      while (!this.closed && (next = this.queue.take())) {
        // 잡음·무음의 빈 전사는 답변이나 입력 실패로 세지 않는다.
        if (!next.text.trim()) continue;
        if (!await this.cb.transcript(next)) {
          this.close();
          return;
        }
      }
      if (this.queue.size && !this.missingTimer) this.missingTimer = setTimeout(() => { this.cb.error('앞선 음성 전사를 확인하지 못했습니다. 글로 답해 주세요.'); this.close(); }, 4000);
      else if (!this.queue.size && this.missingTimer) { clearTimeout(this.missingTimer); this.missingTimer = undefined; }
    } catch { this.cb.error('음성 입력 처리가 중단됐습니다. 대기 중인 발언은 글로 확인해 주세요.'); this.close(); }
    finally { this.draining = false; this.flushSpeech(); }
  }
  speak(text: string) {
    if (!this.session || this.closed || this.paused) return;
    // 이어 말한 발언 처리 중에도 최신 승인 질문을 보존한다.
    this.queuedSpeech = text;
    this.flushSpeech();
  }
  finish(text: string) {
    // 입력을 멈추고 마지막 안내 음성은 재생한다.
    this.finishing = true;
    this.session?.mute(true);
    this.paused = false;
    this.userSpeaking = false;
    this.pendingAudio.clear(); this.queue.clear();
    this.speak(text);
  }
  private flushSpeech() {
    if (!this.session || this.closed || this.paused || this.speaking || this.draining || this.queue.size || this.userSpeaking || this.pendingAudio.size || !this.queuedSpeech) return;
    const text = this.queuedSpeech; this.queuedSpeech = null;
    this.approved = text;
    void this.audio?.play().catch(() => this.cb.error('음성 재생이 차단됐습니다. 화면 질문을 확인해 주세요.'));
    this.session.transport.sendEvent({ type: 'response.create', response: { conversation: 'none', input: [], output_modalities: ['audio'], instructions: `다음 승인 문장만 한국어로 그대로 읽고 아무것도 덧붙이지 마세요: ${text}`, metadata: { generation: String(++this.generation) } } });
  }
  interrupt(clearQueued = true) {
    if (clearQueued) this.queuedSpeech = null;
    this.generation++; this.approved = null; this.validResponseId = null;
    if (this.speaking) this.cb.delivery('interrupted');
    try { this.session?.interrupt(); } catch { /* 이미 닫힌 연결 */ }
    this.speaking = false;
    if (this.audio) { this.audio.pause(); this.audio.autoplay = true; }
  }
  pause(paused: boolean) { this.paused = paused; this.session?.mute(paused); this.cb.status(paused ? 'paused' : 'listening'); if (paused) this.interrupt(); else this.flushSpeech(); }
  get hasPending() { return this.pendingAudio.size > 0 || this.queue.size > 0 || this.draining; }
  get hasQueuedSpeech() { return this.queuedSpeech !== null; }
  close() {
    if (this.closed) return;
    this.closed = true; this.interrupt(); this.queue.clear();
    if (this.missingTimer) clearTimeout(this.missingTimer);
    this.session?.close(); this.stream?.getTracks().forEach(track => track.stop());
    if (this.audio) { this.audio.pause(); this.audio.srcObject = null; }
    this.session = undefined; this.stream = undefined; this.cb.status('disconnected');
  }
}
