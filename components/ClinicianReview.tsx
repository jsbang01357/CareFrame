'use client';
import { useState } from 'react';
import type { InterviewState } from '@/lib/contracts';
import { buildReport } from '@/lib/report/build-report';
import type { ClinicalFact } from '@/lib/report/clinical-note';
import { draftIsCurrent, reviewedEmrText, type ClinicianDraft } from '@/lib/report/clinician-review';
import { statusLabels } from '@/data/protocol';
import { ReportView } from './ReportView';

export function ClinicianReview({ state, fixture, onCorrect }: {
  state: InterviewState; fixture: boolean; onCorrect: (id: string) => void;
}) {
  const report = buildReport(state, fixture);
  const [draft, setDraft] = useState<ClinicianDraft>(() => ({ sessionId: state.session_id, sourceRevision: state.revision, text: report.emrText, reviewed: false }));
  const [selected, setSelected] = useState<ClinicalFact | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const current = draftIsCurrent(draft, state);
  const all = [report.chiefComplaint, ...Object.values(report.hpi), ...report.associatedSymptoms, ...Object.values(report.history), ...report.redFlags];
  const unique = [...new Map(all.map(f => [f.field, f])).values()];
  const shownFact = unique.find(f => f.field === selected?.field);
  const sourceTurns = shownFact?.sources.map(source => ({ ...source, turn: state.turns.find(t => t.id === source.sourceTurnId) })) || [];
  const value = (fact: ClinicalFact) => fact.status === 'reported' ? fact.value : fact.status === 'denied' ? '없음 (환자 부정)' : statusLabels[fact.status];
  const factButton = (fact: ClinicalFact) => <button type="button" className={`review-fact status-${fact.status}`} key={fact.field} onClick={() => setSelected(fact)} aria-pressed={selected?.field === fact.field}><span>{fact.label}</span><strong>{value(fact)}</strong><small>{fact.sources.length ? '원문 확인 ↗' : '근거 미수집'}</small></button>;
  async function copy() {
    try { await navigator.clipboard.writeText(reviewedEmrText(draft, state)); setCopyStatus('현재 편집본을 복사했어요.'); }
    catch { setCopyStatus('자동 복사하지 못했어요. 아래 편집 내용을 직접 선택해 복사해 주세요.'); }
  }
  return <section className="clinical-review">
    <div className="review-screen">
      <div className="review-header"><div><span className="eyebrow">CLINICIAN REVIEW</span><h2>진료 전에 확인할 병력</h2><p>{report.demographics.age ?? '연령 미확인'}세 · {report.demographics.sex ?? '성별 미확인'} · 환자 자가응답 · 기록 v{state.revision}</p></div><span className={`review-badge${current && draft.reviewed ? ' reviewed' : ''}`}>{!current ? '원문 변경 · 재검토 필요' : draft.reviewed ? '검토 완료 · 데모' : '의료진 확인 전'}</span></div>
      {fixture && <p className="fixture-banner">개발용 고정 후보 · 실제 음성/추출 API 결과가 아닙니다.</p>}
      <div className="review-layout">
        <div className="review-summary">
          <section className="review-cc"><span className="eyebrow">CC · 주호소</span><h3>{value(report.chiefComplaint)}</h3><p>{report.hpiSummary}</p><button className="text-button" onClick={() => setSelected(report.chiefComplaint)}>주호소 원문 확인 ↗</button></section>
          <section><h3>HPI · 현병력</h3><div className="review-facts">{Object.values(report.hpi).map(factButton)}</div></section>
          <section><h3>관련 증상 · ROS</h3><div className="review-facts">{report.associatedSymptoms.filter(f => f.status !== 'not_assessed').map(factButton)}</div></section>
          <section><h3>관련 병력</h3><div className="review-facts">{Object.values(report.history).map(factButton)}</div></section>
          <section className="review-missing"><h3>추가 확인할 정보</h3><p>{report.missingInformation.join(' · ') || '기록된 미확인 항목 없음'}</p><details><summary>위험 항목별 응답 보기</summary><div className="review-facts">{report.redFlags.map(factButton)}</div></details></section>
        </div>
        <aside className="review-evidence" aria-label="선택한 기록의 원문 근거"><span className="eyebrow">SOURCE EVIDENCE</span><h3>{shownFact?.label || '기록을 누르면 원문이 열려요'}</h3>{shownFact ? sourceTurns.length ? sourceTurns.map((source, i) => <div key={`${source.sourceTurnId}-${i}`}><blockquote>“{source.sourceQuote}”</blockquote><p className="muted">전체 응답: {source.turn?.text}</p><small>{source.turn?.origin === 'voice_transcript' ? '자동 음성 전사' : '환자 텍스트·클릭 응답'} · {source.sourceTurnId.slice(0, 8)}</small>{source.turn && <button className="secondary" onClick={() => onCorrect(source.sourceTurnId)}>환자 발언 정정</button>}</div>) : <p>이 항목은 아직 확인하지 않았습니다. 부정 소견으로 간주하지 마세요.</p> : <p>환자 보고·부정·잘 모름·미확인을 구분하고, 필요한 기록의 실제 발언을 확인하세요.</p>}</aside>
      </div>
      <section className="review-editor"><div className="review-editor-heading"><div><h3>EMR에 옮길 병력 초안</h3><p>의료진의 수정은 아래 편집본에만 반영됩니다. 환자 발언 원본은 유지됩니다.</p></div><span>원본 v{draft.sourceRevision}</span></div>
        {!current && <p role="alert" className="error-box">환자 기록이 변경되어 이전 검토가 만료됐어요. 수정해 둔 내용은 보존되어 있지만 복사·인쇄는 현재 원문을 다시 불러온 뒤 이용할 수 있어요.</p>}
        <label htmlFor="clinician-note">의료진 편집본</label><textarea id="clinician-note" value={draft.text} onChange={e => { setDraft({ ...draft, text: e.target.value, reviewed: false }); setCopyStatus(''); }}/>
        <div className="button-row"><button className="secondary" onClick={() => { setDraft({sessionId: state.session_id, sourceRevision: state.revision, text: report.emrText, reviewed: false}); setCopyStatus(''); }}>현재 기록으로 다시 불러오기</button><button className="secondary" disabled={!current || !draft.text.trim()} onClick={() => setDraft({ ...draft, reviewed: true })}>의료진 검토 완료 (데모)</button><button className="primary" disabled={!current || !draft.text.trim()} onClick={() => void copy()}>EMR용 텍스트 복사</button><button className="secondary" disabled={!current || !draft.text.trim()} onClick={() => window.print()}>A4 인쇄 / PDF 저장</button></div>{copyStatus && <p role="status">{copyStatus}</p>}
      </section>
      <details className="review-original"><summary>환자 자가응답 원본 문진표와 정정 이력</summary><ReportView state={state} fixture={fixture} onEvidence={id => { const fact = unique.find(f => f.sources.some(s => s.sourceTurnId === id)); setSelected(fact || null); }} copyStatus={null}/></details>
    </div>
    <article className="review-print"><h1>Pre-Visit Clinical Note</h1><p>가상 증례 · S — Subjective · 확정 의무기록 아님</p><pre>{current ? reviewedEmrText(draft, state) : '원문이 변경되어 다시 검토해야 합니다.'}</pre></article>
  </section>;
}
