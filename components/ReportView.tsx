import type { InterviewState } from '@/lib/contracts';
import { buildReport } from '@/lib/report/build-report';
const stopLabels: Record<string, string> = { configured_risk: '설정된 위험 신호로 중단', unsupported: '지원 범위 밖', user_end: '사용자가 종료함', turn_limit: '12턴 상한', questions_exhausted: '준비된 질문 종료', scope_uncertain: '지원 범위 불명확', session_limit: '세션 시간 상한', input_error: '입력 처리 오류' };
export function ReportView({ state, fixture, onEvidence }: { state: InterviewState; fixture: boolean; onEvidence: (id: string) => void }) {
  const r = buildReport(state);
  return <article className="report">
    <div className="report-heading"><div><span className="eyebrow">CARE FRAME / PRE-VISIT NOTE</span><h2>{r.title}</h2></div><span className="note-badge">가상 증례</span></div>
    <p className="report-disclosure">사용자 진술을 정리한 AI 사전 문진 자료입니다. 자동 전사 오류가 있을 수 있으며 의료진 확인이 필요합니다. 임상 프로토콜 검토 미완료.</p>
    {fixture && <p className="fixture-banner">개발용 고정 사실 후보 · 실제 음성/추출 API 결과가 아닙니다.</p>}
    <div className="report-meta"><span>프로토콜 {state.protocol_version}</span><span>기록 버전 {r.revision}</span><span>{r.confirmed ? '사용자가 현재 내용을 확인함' : '사용자 확인 전'}</span></div>
    <section className={state.safety.latched ? 'next-box urgent' : 'next-box'}><h3>다음 행동</h3><p>{r.nextAction}</p>{r.stopReason && <small>종료 이유: {stopLabels[r.stopReason] || r.stopReason}</small>}</section>
    <table><thead><tr><th>항목</th><th>진술·확인 상태</th><th>원문 근거</th></tr></thead><tbody>{r.rows.map(f => <tr key={f.field_id}><th scope="row">{f.label}</th><td>{f.value || f.statusLabel}<small>{f.status === 'reported' ? f.verification === 'unconfirmed_transcript' ? '자동 전사 · 확인 필요' : '사용자 진술' : ''}</small></td><td>{f.evidence.length ? f.evidence.map((e, i) => <button key={i} className="quote-button" onClick={() => onEvidence(e.turn_id)}>“{e.quote}” <small>{e.turn_id.slice(0,8)}</small></button>) : <span className="muted">관련 진술 없음</span>}</td></tr>)}</tbody></table>
    {r.contextual.length > 0 && <section><h3>타인·과거·불명확 문맥 — 현재 본인 증상과 분리</h3>{r.contextual.map((f, i) => <p key={i}>{f.label}: {f.value || f.statusLabel} ({f.subject === 'other' ? '타인' : f.subject === 'unclear' ? '주체 불명확' : '본인'}, {f.temporality === 'historical' ? '과거' : f.temporality === 'unclear' ? '시점 불명확' : '현재'})<br/>{f.evidence.map(e => `“${e.quote}”`).join(' / ')}</p>)}</section>}
    {r.corrections.length > 0 && <section><h3>정정 이력</h3>{r.corrections.map(c => <p key={c.after.id}><del>{c.before?.text}</del><br/><strong>정정: {c.after.text}</strong></p>)}</section>}
    <footer className="report-footer">CareFrame · 영희 / 가상 증례 시연용 / 진단·처방·신체진찰 자료가 아닙니다.</footer>
  </article>;
}
