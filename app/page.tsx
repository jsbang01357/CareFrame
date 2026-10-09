'use client';
import { useEffect, useRef, useState } from 'react';
import { fields, statusLabels, questions, questionField } from '@/data/protocol';
import { fixtures, fixtureExtraction } from '@/data/fixtures';
import { initialState, firstAction, transition } from '@/lib/interview/engine';
import { responseSchema, type InterviewState, type NextAction, type Turn, type TurnRequest } from '@/lib/contracts';
import type { VoiceController, VoiceStatus } from '@/lib/voice/controller';
import { ReportView } from '@/components/ReportView';
import { buildReport } from '@/lib/report/build-report';
interface Health { api_configured: boolean; fixture_enabled: boolean; protocol_reviewed: boolean }
const voiceLabels: Record<VoiceStatus, string> = { disconnected: '음성 연결 꺼짐', connecting: '음성 연결 중', listening: '듣는 중', processing: '전사 확인 중', speaking: '말하는 중', paused: '마이크 일시정지' };
const uuid = () => crypto.randomUUID();
export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [state, setState] = useState<InterviewState | null>(null);
  const [next, setNext] = useState<NextAction>(firstAction());
  const [fixture, setFixture] = useState(false);
  const [caseId, setCaseId] = useState('T01'); const [step, setStep] = useState(0);
  const [consent, setConsent] = useState([false, false, false]);
  const [input, setInput] = useState(''); const [busy, setBusy] = useState(false); const [slow, setSlow] = useState(false);
  const [error, setError] = useState(''); const [pendingText, setPendingText] = useState('');
  const [correction, setCorrection] = useState<Turn | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('disconnected'); const [voicePaused, setVoicePaused] = useState(false);
  const [ending, setEnding] = useState(false); const [statusNote, setStatusNote] = useState('');
  const stateRef = useRef<InterviewState | null>(null); const busyRef = useRef(false); const voiceRef = useRef<VoiceController | null>(null);
  const fixtureRef = useRef(false); const abortRef = useRef<AbortController | null>(null); const failedRef = useRef<TurnRequest | null>(null);
  const sessionEpoch = useRef(0); const lastActive = useRef(0); const started = useRef(0); const nextRef = useRef(next);
  const [showReport, setShowReport] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | null>(null);
  const urgentAudio = useRef<HTMLAudioElement | null>(null);
  const scenario = fixtures.find(c => c.id === caseId)!;
  const apply = (s: InterviewState, a: NextAction) => {
    const wasUrgent = stateRef.current?.safety.latched;
    setCopyStatus(null);
    stateRef.current = s; setState(s); nextRef.current = a; setNext(a);
    if (a.kind === 'urgent_help') {
      voiceRef.current?.close(); voiceRef.current = null; setShowReport(false);
      if (!fixtureRef.current && !wasUrgent) {
        const audio = new Audio('/audio/urgent-help.mp3');
        urgentAudio.current = audio;
        void audio.play().catch(() => setStatusNote('고정 안내 음성은 준비되지 않았거나 재생할 수 없습니다. 화면 안내를 읽어 주세요.'));
      }
    }
    if (['review','out_of_scope','finish'].includes(a.kind)) { setShowReport(true); voiceRef.current?.close(); voiceRef.current = null; }
  };
  useEffect(() => {
    void fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setError('앱 설정 상태를 확인하지 못했습니다.'));
    const close = () => { sessionEpoch.current++; abortRef.current?.abort(); voiceRef.current?.close(); urgentAudio.current?.pause(); };
    window.addEventListener('pagehide', close);
    return () => { close(); window.removeEventListener('pagehide', close); };
  }, []);
  useEffect(() => {
    if (!state) return;
    const timer = setInterval(() => {
      if (!stateRef.current || ['finished','urgent_stop','out_of_scope','review'].includes(stateRef.current.phase)) return;
      if (Date.now() - started.current > 8 * 60 * 1000 && !busyRef.current) {
        voiceRef.current?.close(); voiceRef.current = null;
        stateRef.current.stop_reason = 'session_limit';
        void end().then(() => setStatusNote('8분 세션 상한으로 자료를 정리했습니다.'));
      } else if (voiceRef.current && Date.now() - lastActive.current > 90000) {
        voiceRef.current?.pause(true); setVoicePaused(true); setStatusNote('90초 동안 입력이 없어 마이크를 일시정지했어요.');
      }
    }, 1000);
    return () => clearInterval(timer);
    // 세션별 타이머. 상태는 ref에서 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.session_id]);
  async function submit(event: TurnRequest['event'], turn: Turn | null, target: string | null = null, retry?: TurnRequest): Promise<void> {
    if (busyRef.current || !stateRef.current) return;
    busyRef.current = true; setBusy(true); setSlow(false); setError(''); lastActive.current = Date.now();
    setPendingText(turn?.text || '');
    const epoch = sessionEpoch.current;
    const request = retry || { request_id: uuid(), event, expected_revision: stateRef.current.revision, state: structuredClone(stateRef.current), utterance: turn, target_turn_id: target };
    const controller = new AbortController(); abortRef.current = controller;
    const slowTimer = setTimeout(() => setSlow(true), 8000); const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('/api/turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: controller.signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || '문진 처리에 실패했습니다.');
      const result = responseSchema.parse(json);
      if (epoch !== sessionEpoch.current) return;
      if (result.request_id !== request.request_id || result.base_revision !== stateRef.current?.revision || result.state.session_id !== stateRef.current.session_id) throw new Error('오래된 응답을 적용하지 않았습니다.');
      apply(result.state, result.next_action); failedRef.current = null; setPendingText(''); setInput(''); setCorrection(null);
      if (result.next_action.speak) voiceRef.current?.speak(result.next_action.approved_text);
    } catch (e) {
      if (epoch !== sessionEpoch.current) return;
      failedRef.current = request;
      setError(e instanceof Error && e.name !== 'AbortError' ? e.message : '처리가 취소되었거나 시간이 초과되었습니다. 원문은 아래에 남아 있어요.');
      voiceRef.current?.pause(true); setVoicePaused(true);
    } finally { clearTimeout(slowTimer); clearTimeout(timeout); if (epoch === sessionEpoch.current) { busyRef.current = false; setBusy(false); setSlow(false); } }
  }
  function makeTurn(text: string, origin: Turn['origin'], providerId: string | null = null, prev: string | null = null, q: string | null = stateRef.current?.last_question_id || null, replaces: string | null = null): Turn {
    return { id: uuid(), text, role: 'user', origin, provider_item_id: providerId, previous_item_id: prev, final: true, prompted_question_id: q, replaces_turn_id: replaces, created_at: new Date().toISOString() };
  }
  async function start(withVoice: boolean, development = false) {
    sessionEpoch.current++; voiceRef.current?.close(); failedRef.current = null; setError(''); setPendingText('');
    fixtureRef.current = development; setFixture(development); setStep(0); setShowReport(false); setStatusNote('');
    const s = initialState(uuid()); apply(s, firstAction()); started.current = lastActive.current = Date.now();
    if (!withVoice) return;
    try {
      const { VoiceController } = await import('@/lib/voice/controller');
      const voice = new VoiceController({ status: setVoiceStatus, error: setError,
        questionId: () => stateRef.current?.last_question_id || null,
        delivery: status => {
          const s = stateRef.current; if (!s) return;
          const d = s.deliveries.at(-1); if (d) d.status = status;
        },
        transcript: async item => {
          const s = stateRef.current;
          if (!s || ['review','finished','out_of_scope','urgent_stop'].includes(s.phase)) return false;
          if (!item.text.trim()) return true;
          // 대기 중 질문이 바뀌었으면 간접 부정 답변의 질문 연결을 비워 둔다.
          const q = item.questionId === s.last_question_id ? item.questionId : null;
          await submit('answer', makeTurn(item.text, 'voice_transcript', item.id, item.previousId, q));
          return failedRef.current === null;
        },
      }); voiceRef.current = voice;
      await voice.connect(); voice.speak(firstAction().approved_text);
    } catch (e) { voiceRef.current?.close(); voiceRef.current = null; setError(e instanceof Error ? e.message : '마이크 연결에 실패했습니다. 글로 답할 수 있어요.'); }
  }
  function sendText() {
    if (!input.trim() || busy) return;
    voiceRef.current?.interrupt(); voiceRef.current?.pause(true); setVoicePaused(true);
    const turn = makeTurn(input.trim(), 'typed', null, null, correction ? null : stateRef.current?.last_question_id || null, correction?.id || null);
    void submit(correction ? 'correct' : 'answer', turn, correction?.id || null);
  }
  async function end() {
    setEnding(true); voiceRef.current?.pause(true);
    const deadline = Date.now() + 5000;
    while ((busyRef.current || voiceRef.current?.hasPending) && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
    voiceRef.current?.close(); voiceRef.current = null;
    if (busyRef.current) { abortRef.current?.abort(); setError('마지막 발언 처리 중입니다. 처리가 멈춘 뒤 다시 정리해 주세요.'); setEnding(false); return; }
    if (failedRef.current) {
      if (stateRef.current) stateRef.current.stop_reason = 'input_error';
      setStatusNote('처리하지 못한 발언은 자료에 포함되지 않습니다. 원문을 확인해 주세요.');
    }
    if (fixtureRef.current) { const s = stateRef.current!; apply(...asTuple(transition({ request_id: uuid(), event: 'end', expected_revision: s.revision, state: s, utterance: null, target_turn_id: null }))); }
    else await submit('end', null);
    setEnding(false);
  }
  function asTuple(r: { state: InterviewState; next_action: NextAction }): [InterviewState, NextAction] { return [r.state, r.next_action]; }
  function fixtureStep() {
    const part = scenario.steps[step]; if (!part || !stateRef.current) return;
    const s = structuredClone(stateRef.current);
    // 독립 규칙 확인 증례는 준비된 질문 맥락을 명시한다.
    if (part.question) { s.last_question_id = part.question; if (!s.asked_question_ids.includes(part.question)) s.asked_question_ids.push(part.question); }
    const target = part.target !== undefined ? s.turns[part.target]?.id || null : null;
    const t = makeTurn(part.text, 'typed', null, null, part.event === 'correct' ? null : part.question || s.last_question_id, target);
    try { const r = transition({ request_id: uuid(), event: part.event || 'answer', expected_revision: s.revision, state: s, utterance: t, target_turn_id: target }, fixtureExtraction(part, t)); apply(r.state, r.next_action); setStep(step + 1); }
    catch (e) { setError(e instanceof Error ? e.message : '개발용 증례 오류'); }
  }
  function reset() { sessionEpoch.current++; abortRef.current?.abort(); voiceRef.current?.close(); urgentAudio.current?.pause(); urgentAudio.current = null; voiceRef.current = null; stateRef.current = null; setState(null); setBusy(false); busyRef.current = false; setError(''); setInput(''); setCorrection(null); setPendingText(''); setVoicePaused(false); failedRef.current = null; }
  function evidence(id: string) { setShowReport(false); setTimeout(() => document.getElementById(`turn-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 20); }
  async function confirm() {
    if (fixture) { const s = stateRef.current!; apply(...asTuple(transition({ request_id: uuid(), event: 'confirm', expected_revision: s.revision, state: s, utterance: null, target_turn_id: null }))); }
    else await submit('confirm', null);
  }
  async function copyEmr() {
    if (!stateRef.current) return;
    try { await navigator.clipboard.writeText(buildReport(stateRef.current, fixtureRef.current).emrText); setCopyStatus('copied'); }
    catch { setCopyStatus('failed'); }
  }
  const ended = state && ['review','finished','urgent_stop','out_of_scope'].includes(state.phase);
  return <>
    <header className="site-header"><a className="brand" href="/" aria-label="CareFrame 시작"><span className="brand-icon">c<span>f</span></span><span>CareFrame<small>영희 · AI 건강 길잡이</small></span></a><span className="demo-tag">가상 증례 시연용</span></header>
    <main>
      {!state ? <section className="landing">
        <div className="intro"><span className="eyebrow">TALK EASILY. SHARE CLEARLY.</span><h1>어디가 불편하세요?<br/><span>함께 정리해 볼게요.</span></h1><p className="intro-copy">말로 편하게 이야기하고,<br/>진료 때 전달할 내용을 차근차근 준비해요.</p><div className="intro-persona"><span className="persona-icon">영</span><div><strong>안녕하세요, 영희예요.</strong><p>저는 AI 건강 길잡이예요. 증상을 듣고 정리하는 일을 도와드려요.</p></div></div><div className="intro-points"><span>01 <strong>편하게 이야기</strong></span><span>02 <strong>원문으로 확인</strong></span><span>03 <strong>진료 준비 자료</strong></span></div></div>
        <div className="start-card"><span className="eyebrow">대화 시작 전</span><h2>먼저 확인해 주세요</h2><p>현재는 <strong>성인 본인의 상복부·명치 불편감</strong> 경로만 지원하는 데모예요.</p><div className="scope-note">진단·처방을 제공하지 않으며, 응급질환을 배제할 수 없어요. 임상 프로토콜 검토 미완료.</div><div className="consents">{['음성·텍스트가 AI 및 외부 API로 처리됨을 이해해요.', '실제 개인정보나 실제 환자 정보를 입력하지 않을게요.', '성인 본인의 증상을 가정한 가상 시나리오예요.'].map((label,i) => <label key={label}><input type="checkbox" checked={consent[i]} onChange={e => setConsent(consent.map((v,j) => j === i ? e.target.checked : v))}/><span>{label}</span></label>)}</div><button className="primary large" disabled={!consent.every(Boolean)} onClick={() => void start(true)}>음성으로 대화 시작 <span>↗</span></button><button className="secondary large" disabled={!consent.every(Boolean)} onClick={() => void start(false)}>글로 이야기하기</button><p className="config-note">{health ? health.api_configured ? 'API 키 설정됨 · 모델 접근/음성 동작은 별도 확인 필요' : 'API 키 미설정 · 실제 대화는 서버 설정 후 이용 가능' : '앱 설정을 확인하고 있어요…'}</p><details className="development"><summary>개발용 고정 증례 살펴보기</summary><p>추출 API와 음성 없이 고정된 사실 후보로 상태·화면을 확인합니다. 실제 API 시험 결과가 아닙니다.</p><select value={caseId} onChange={e => setCaseId(e.target.value)}>{fixtures.map(c => <option key={c.id} value={c.id}>{c.id} · {c.label}</option>)}</select><button className="secondary" onClick={() => void start(false, true)}>고정 증례 열기</button></details></div>
      </section> : <>
        <div className="session-top"><div><span className="eyebrow">{showReport ? '의료진용 Pre-Visit Clinical Note' : '함께 정리하는 중'}</span><h1>{state.safety.latched ? '지금은 도움 요청이 먼저예요.' : showReport ? '환자 보고 내용을 확인해 주세요.' : '천천히 말씀해 주세요.'}</h1></div><button className="text-button" disabled={busy || ending} onClick={reset}>새 대화</button></div>
        <div className="session-notice">{fixture ? '개발용 고정 사실 후보 · 음성/추출 API 미사용' : 'AI 사전문진 · 자동 전사 수정 가능'} <span>성인 상복부 불편감만 지원 · 임상 프로토콜 검토 미완료</span></div>
        {error && <div role="alert" className="error-box"><strong>처리를 완료하지 못했어요</strong><p>{error}</p>{pendingText && <blockquote>처리 대기 원문: {pendingText}</blockquote>}{failedRef.current && !busy && <div className="button-row"><button className="secondary" onClick={() => void submit(failedRef.current!.event, failedRef.current!.utterance, failedRef.current!.target_turn_id, failedRef.current!)}>같은 요청 재시도</button><button className="text-button" onClick={() => { const f=failedRef.current!; setInput(f.utterance?.text || ''); setCorrection(f.event === 'correct' ? state.turns.find(t=>t.id===f.target_turn_id) || null : null); }}>글로 확인·수정</button></div>}</div>}
        {statusNote && <p role="status" className="status-note">{statusNote}</p>}
        {state.safety.latched && <section className="urgent-card" role="alert"><span className="eyebrow">문진 중단 · 긴급 도움 안내</span><h2>문진을 기다리지 마세요.</h2><p>{next.approved_text}</p><a className="urgent-call" href="tel:119">119에 연락하기 ↗</a><small>자동 신고 기능은 없습니다. 번호를 직접 확인하고 도움을 요청하세요.</small><button className="secondary" onClick={() => setShowReport(true)}>지금까지의 자료 보기</button></section>}
        {showReport ? <><div className="report-toolbar"><button className="text-button" onClick={() => setShowReport(false)}>← 문진으로 돌아가기</button><div className="button-row">{state.confirmed_revision !== state.revision && state.phase !== 'finished' && <button className="secondary" disabled={busy} onClick={() => void confirm()}>이 버전의 내용 확인</button>}<button className="secondary" onClick={() => void copyEmr()}>EMR용 텍스트 복사</button><button className="primary" onClick={() => window.print()}>A4 인쇄 / PDF 저장</button></div></div><ReportView state={state} fixture={fixture} onEvidence={evidence} copyStatus={copyStatus}/></> : <div className="interview-grid">
          <section className="conversation-panel"><div className="persona-row"><span className="persona-icon">영</span><div><strong>영희</strong><span>AI 건강 길잡이</span></div><span className={`voice-status ${voiceStatus === 'listening' ? 'active' : ''}`} role="status">{fixture ? '고정 증례' : voiceLabels[voiceStatus]}</span></div>
            {!state.safety.latched && <div className="question-box"><span className="eyebrow">{ended ? '정리 안내' : '지금 확인하는 내용'}</span><h2>{next.approved_text}</h2></div>}
            {busy && <p role="status" className="processing"><span className="spinner"/>{slow ? '말씀하신 내용을 확인하고 있어요. 취소할 수 있어요.' : '말씀하신 내용을 확인하는 중…'}<button className="text-button" onClick={() => abortRef.current?.abort()}>취소</button></p>}
            {fixture ? <div className="fixture-input"><strong>{caseId} · {scenario.label}</strong><p>이 입력의 사실 후보는 미리 작성되어 있습니다.</p>{scenario.steps[step] && !state.safety.latched ? <><blockquote>{scenario.steps[step].text}</blockquote><button className="primary" onClick={fixtureStep}>준비된 발언 반영 ({step+1}/{scenario.steps.length})</button></> : <p>준비된 발언을 모두 반영했어요. 지금까지의 자료를 확인하세요.</p>}</div> : <div className="text-input"><label htmlFor="answer">{correction ? '전사 정정 · 전체 대체 문장' : '글로 답하기'}</label>{correction && <p>이전 발언: “{correction.text}” <button className="text-button" onClick={() => { setCorrection(null); setInput(''); }}>정정 취소</button></p>}<textarea id="answer" value={input} maxLength={2000} disabled={busy || (Boolean(ended) && !correction)} onChange={e => setInput(e.target.value)} placeholder="떠오르는 그대로 말씀해 주세요."/><button className="primary" disabled={busy || !input.trim() || (Boolean(ended) && !correction)} onClick={sendText}>{correction ? '정정 반영' : '답변 보내기'} →</button></div>}
            <div className="conversation-actions">{!fixture && voiceRef.current && <button className="secondary" disabled={busy} onClick={() => { const pause = !voicePaused; voiceRef.current?.pause(pause); setVoicePaused(pause); lastActive.current = Date.now(); }}>{voicePaused ? '마이크 다시 켜기' : '마이크 일시정지'}</button>}{ended ? <button className="secondary" onClick={() => setShowReport(true)}>의료진용 문진표 보기</button> : <button className="secondary" disabled={busy || ending} onClick={() => void end()}>{ending ? '마지막 발언 확인 중…' : '지금까지 정리하고 종료'}</button>}</div>
            <p className="storage-note">새로고침하면 기록이 사라져요. 필요한 자료는 인쇄해 주세요.</p>
          </section>
          <aside className="history-panel"><div className="history-title"><h2>지금까지 들은 내용</h2><span>버전 {state.revision}</span></div><div className="fact-list">{state.facts.filter(f => f.status !== 'not_assessed').map(f => <div className="fact-item" key={f.field_id}><span>{fields[f.field_id]}</span><strong>{f.value || statusLabels[f.status]}</strong>{f.evidence.map((e,i) => <button className="evidence-link" key={i} onClick={() => evidence(e.turn_id)}>원문 확인 ↗</button>)}</div>)}{state.facts.every(f=>f.status==='not_assessed') && <p className="muted">말씀하신 내용이 확인되면 여기에 채워져요.</p>}</div><details className="unassessed"><summary>아직 확인하지 못한 항목 ({state.facts.filter(f=>f.status==='not_assessed').length})</summary>{state.facts.filter(f=>f.status==='not_assessed').map(f=><p key={f.field_id}>{fields[f.field_id]} · 미확인</p>)}</details><div className="transcript-title"><h3>대화 원문</h3><small>자동 전사는 사실 확인이 필요해요</small></div>{state.turns.map(t => <div className={`transcript ${state.turns.some(x=>x.replaces_turn_id===t.id) ? 'superseded' : ''}`} id={`turn-${t.id}`} key={t.id}><small>{t.origin==='voice_transcript' ? '자동 전사 · 수정 가능' : t.replaces_turn_id ? '사용자 정정' : '텍스트 진술'} · {t.id.slice(0,8)}</small>{t.prompted_question_id && <p className="prompt-context">질문: {questions[questionField(t.prompted_question_id)!] || '지원 범위 확인'}</p>}<p>{t.text}</p>{!fixture && !state.turns.some(x=>x.replaces_turn_id===t.id) && <button disabled={busy} className="text-button" onClick={() => { setCorrection(t); setInput(t.text); setShowReport(false); voiceRef.current?.pause(true); }}>이 발언 정정</button>}</div>)}</aside>
        </div>}
      </>}
      {!state && error && <div role="alert" className="error-box">{error}</div>}
    </main><footer className="site-footer"><span>CareFrame</span><p>대화는 편안하게, 기록은 확인 가능하게.</p><small>가상 증례 시연 전용 · 진단·처방·의료적 안전 보증을 제공하지 않습니다.</small></footer>
  </>;
}
