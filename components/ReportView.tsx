'use client';
import type { InterviewState } from '@/lib/contracts';
import { buildReport } from '@/lib/report/build-report';
import type { ClinicalFact } from '@/lib/report/clinical-note';

const statusText: Record<ClinicalFact['status'], string> = {
  reported: '환자 보고', denied: '환자 부정', unknown: '잘 모름', unclear: '불명확',
  declined: '응답 거부', not_assessed: '미확인',
};
const stopLabels: Record<string, string> = {
  configured_risk: '설정된 위험 신호로 중단', unsupported: '지원 범위 밖', user_end: '사용자가 종료함',
  turn_limit: '12턴 상한', questions_exhausted: '준비된 질문 종료', scope_uncertain: '지원 범위 불명확',
  session_limit: '세션 시간 상한', input_error: '입력 처리 오류',
};

function FactLine({ fact, onEvidence, compact = false }: { fact: ClinicalFact; onEvidence: (id: string) => void; compact?: boolean }) {
  const value = fact.status === 'reported' ? fact.value || '환자 보고' : statusText[fact.status];
  return <div className={`clinical-fact${compact ? ' compact' : ''}`}>
    <span className="clinical-fact-label">{fact.label}</span>
    <span className={`clinical-fact-value status-${fact.status}`}>{value}</span>
    {fact.sources.length > 0 && <span className="clinical-sources">{fact.sources.map((source, index) =>
      <button key={`${source.sourceTurnId}-${index}`} className="quote-button" onClick={() => onEvidence(source.sourceTurnId)}>
        원문: “{source.sourceQuote}” ↗
      </button>)}</span>}
  </div>;
}

export function ReportView({ state, fixture, onEvidence, copyStatus }: { state: InterviewState; fixture: boolean; onEvidence: (id: string) => void; copyStatus: 'copied' | 'failed' | null }) {
  const r = buildReport(state, fixture);
  return <article className="report clinical-note">
    <header className="report-heading">
      <div><span className="eyebrow">PRE-VISIT CLINICAL NOTE · S — SUBJECTIVE</span><h2>{r.title}</h2></div>
      <span className="note-badge">{fixture ? '가상 증례' : 'Patient-reported'}</span>
    </header>
    <p className="report-disclosure">AI 사전문진 기록 · 의료진 확인 전. 환자가 보고한 내용을 구조화했으며 확정 의무기록이 아닙니다.</p>
    {fixture && <p className="fixture-banner">개발용 고정 사실 후보 · 실제 음성/추출 API 결과가 아닙니다.</p>}
    <div className="clinical-meta">
      <span>환자: 연령 {r.demographics.age ?? '미확인'} · 성별 {r.demographics.sex ?? '미확인'}</span>
      <span>문진 방식: AI {r.interviewMode}</span>
      <span>기록 버전 {r.revision} · {r.confirmed ? '사용자 확인' : '사용자 확인 전'}</span>
    </div>

    <section className="clinical-section cc-section">
      <h3>CHIEF COMPLAINT (CC) <small>주호소</small></h3>
      <FactLine fact={r.chiefComplaint} onEvidence={onEvidence}/>
    </section>
    <section className="clinical-section">
      <h3>HISTORY OF PRESENT ILLNESS (HPI) <small>현병력</small></h3>
      <p className="hpi-summary">{r.hpiSummary}</p>
      <div className="clinical-grid">
        <FactLine fact={r.hpi.onset} onEvidence={onEvidence}/>
        <FactLine fact={r.hpi.location} onEvidence={onEvidence}/>
        <FactLine fact={r.hpi.character} onEvidence={onEvidence}/>
        <FactLine fact={r.hpi.severity} onEvidence={onEvidence}/>
        <FactLine fact={r.hpi.duration} onEvidence={onEvidence}/>
        <FactLine fact={r.hpi.aggravating} onEvidence={onEvidence}/>
        <FactLine fact={r.hpi.relieving} onEvidence={onEvidence}/>
        <FactLine fact={r.hpi.dailyFunction} onEvidence={onEvidence}/>
      </div>
    </section>
    <section className="clinical-section">
      <h3>PERTINENT ROS / ASSOCIATED SYMPTOMS <small>관련 증상</small></h3>
      <div className="clinical-grid clinical-grid-wide">{r.associatedSymptoms.map(f => <FactLine key={f.field} fact={f} onEvidence={onEvidence}/>)}</div>
    </section>
    <section className="clinical-section">
      <h3>RELEVANT HISTORY <small>관련 병력</small></h3>
      <div className="clinical-grid clinical-grid-wide">
        {Object.values(r.history).map(f => <FactLine key={f.field} fact={f} onEvidence={onEvidence}/>) }
      </div>
      {r.patientConcerns.some(f => f.status !== 'not_assessed') && <div className="concern-block"><strong>환자 우려·생각</strong>{r.patientConcerns.filter(f => f.status !== 'not_assessed').map(f => <FactLine key={f.field} fact={f} onEvidence={onEvidence} compact/>)}</div>}
    </section>
    <section className="clinical-section red-flag-section">
      <h3>RED FLAGS & MISSING INFORMATION <small>위험 신호 및 미확인 정보</small></h3>
      <p className={r.redFlagsComplete ? 'red-flag-summary' : 'red-flag-summary incomplete'}>
        {r.redFlagsComplete ? '아래 열거한 주요 위험 항목은 이번 문진에서 각각 확인했습니다.' : '주요 위험 항목이 모두 확인되지 않았습니다. 미확인·불명확·잘 모름 상태를 음성으로 간주하지 마세요.'}
      </p>
      <div className="clinical-grid clinical-grid-wide">{r.redFlags.map(f => <FactLine key={f.field} fact={f} onEvidence={onEvidence} compact/>)}</div>
      {r.missingInformation.length > 0 && <p className="missing-list"><strong>추가 확인 필요:</strong> {r.missingInformation.join(' · ')}</p>}
    </section>
    <section className="clinical-next-step"><strong>환자 안내</strong><p>{r.patientNextAction}</p>{state.stop_reason && <small>문진 종료: {stopLabels[state.stop_reason] || state.stop_reason}</small>}</section>
    <section className="soap-scope" aria-label="기록 범위">
      <div><strong>O — Objective</strong><span>{r.objective}</span></div>
      <div><strong>A — Assessment</strong><span>{r.assessment}</span></div>
      <div><strong>P — Plan</strong><span>{r.plan}</span></div>
    </section>
    {r.contextual.length > 0 && <section className="clinical-section contextual-section"><h3>타인·과거 병력 문맥 <small>현재 환자 증상과 분리</small></h3>{r.contextual.map((f, index) => <p key={`${f.field_id}-${index}`}>{f.field_id}: {f.value || statusText[f.status]} ({f.subject === 'other' ? '타인' : '주체 불명확'}, {f.temporality === 'historical' ? '과거' : '시점 불명확'}){f.evidence.map((e, i) => <button key={i} className="quote-button" onClick={() => onEvidence(e.turn_id)}>원문: “{e.quote}” ↗</button>)}</p>)}</section>}
    {r.corrections.length > 0 && <details className="correction-history"><summary>정정 원문 이력 보기 ({r.corrections.length})</summary>{r.corrections.map(c => <p key={c.after.id}><del>{c.before?.text}</del><br/><strong>정정: {c.after.text}</strong></p>)}</details>}
    <footer className="report-footer">환자 자가응답을 AI가 구조화한 자료입니다. 원문을 확인하고 의료진이 병력을 검증하세요. 진단·치료 계획·신체진찰 결과는 포함하지 않습니다.</footer>
    {copyStatus && <p role="status" className="copy-status">{copyStatus === 'copied' ? '현재 기록을 EMR 복사용 텍스트로 복사했어요.' : '자동 복사 권한이 없어 아래 텍스트를 선택해 복사해 주세요.'}</p>}
    {copyStatus === 'failed' && <textarea className="emr-fallback" aria-label="EMR 복사 텍스트" readOnly value={r.emrText}/>}
  </article>;
}
