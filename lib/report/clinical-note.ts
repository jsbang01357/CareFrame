import { fields, riskFields, statusLabels, type FieldId } from '@/data/protocol';
import type { Fact, InterviewState } from '@/lib/contracts';

export type FactStatus = Fact['status'];
export type ReportedBy = 'patient' | 'caregiver';
export interface ClinicalFact {
  field: string;
  label: string;
  value: string | null;
  status: FactStatus;
  sourceTurnId: string | null;
  sourceQuote: string | null;
  sources: Array<{ sourceTurnId: string; sourceQuote: string }>;
  reportedBy: ReportedBy;
}
export interface ClinicalNote {
  title: 'Pre-Visit Clinical Note';
  section: 'S — Subjective';
  demographics: { age: number | null; sex: string | null };
  interviewMode: '음성' | '텍스트' | '음성·텍스트' | '미확인';
  chiefComplaint: ClinicalFact;
  hpiSummary: string;
  hpi: {
    onset: ClinicalFact; location: ClinicalFact; character: ClinicalFact;
    severity: ClinicalFact; duration: ClinicalFact; aggravating: ClinicalFact;
    relieving: ClinicalFact; dailyFunction: ClinicalFact;
  };
  associatedSymptoms: ClinicalFact[];
  redFlags: ClinicalFact[];
  history: {
    pastMedical: ClinicalFact; pastSurgical: ClinicalFact;
    medications: ClinicalFact; allergies: ClinicalFact; familyHistory: ClinicalFact;
  };
  patientConcerns: ClinicalFact[];
  missingInformation: string[];
  redFlagsComplete: boolean;
  patientNextAction: string;
  objective: string;
  assessment: string;
  plan: string;
  revision: number;
  confirmed: boolean;
  fixture: boolean;
}

const NOT_ASSESSED: FactStatus = 'not_assessed';
function makeFact(state: InterviewState, field: FieldId | string, label: string, source?: Fact): ClinicalFact {
  const found = source || state.facts.find(f => f.field_id === field);
  const evidence = found?.evidence || [];
  const turns = new Map(state.turns.map(t => [t.id, t]));
  const sources = evidence.flatMap(e => {
    const turn = turns.get(e.turn_id);
    return turn && !state.turns.some(t => t.replaces_turn_id === turn.id)
      ? [{ sourceTurnId: e.turn_id, sourceQuote: e.quote }]
      : [];
  });
  return {
    field, label, value: found?.status === 'reported' ? found.value : null,
    status: found?.status || NOT_ASSESSED,
    sourceTurnId: sources[0]?.sourceTurnId || null,
    sourceQuote: sources[0]?.sourceQuote || null,
    sources,
    reportedBy: 'patient',
  };
}
function extra(state: InterviewState, field: string, label: string): ClinicalFact {
  return makeFact(state, field, label);
}
function listMissing(note: Omit<ClinicalNote, 'missingInformation'>) {
  const all = [
    note.chiefComplaint, ...Object.values(note.hpi), ...note.associatedSymptoms,
    ...note.redFlags, ...Object.values(note.history), ...note.patientConcerns,
  ];
  // Demographics and fields outside the current intake remain visibly unassessed.
  const missing = all
    .filter(f => !['reported', 'denied'].includes(f.status))
    .map(f => `${f.label} (${statusLabels[f.status]})`);
  if (note.demographics.age === null) missing.unshift('연령');
  if (note.demographics.sex === null) missing.unshift('성별');
  return [...new Set(missing)];
}

export function buildClinicalNote(state: InterviewState, fixture = false): ClinicalNote {
  const fact = (field: FieldId, label: string = fields[field]) => makeFact(state, field, label);
  const nausea = extra(state, 'nausea', '오심');
  const duration = extra(state, 'duration', '통증 지속시간');
  const severity = extra(state, 'pain_severity', '통증 강도 (NRS 0–10)');
  const relieving = extra(state, 'relieving_factors', '완화 요인');
  const pastSurgical = extra(state, 'past_surgical_history', '수술력');
  const allergies = extra(state, 'drug_allergies', '약물 알레르기');
  const familyHistory = extra(state, 'family_history', '가족력');
  const chiefComplaint = fact('chief_complaint', '주호소');
  const hpi = {
    onset: fact('onset'), location: fact('location'), character: fact('character'),
    severity, duration, aggravating: fact('meal_relation', '악화 요인 · 식사 관계'),
    relieving, dailyFunction: fact('severity_function', '일상생활 영향'),
  };
  const hpiSummary = [
    hpi.onset.status === 'reported' ? `${hpi.onset.value} 시작` : null,
    hpi.location.status === 'reported' ? `${hpi.location.value} 부위` : null,
    hpi.character.status === 'reported' ? `${hpi.character.value} 양상` : null,
    hpi.aggravating.status === 'reported' ? `악화 요인: ${hpi.aggravating.value}` : null,
    hpi.relieving.status === 'reported' ? `완화 요인: ${hpi.relieving.value}` : null,
  ].filter(Boolean).join(' · ') || factValue(chiefComplaint);
  const note = {
    title: 'Pre-Visit Clinical Note' as const,
    section: 'S — Subjective' as const,
    demographics: { age: null, sex: null },
    interviewMode: (() => {
      const modes = new Set(state.turns.filter(t => t.role === 'user').map(t => t.origin === 'voice_transcript' ? '음성' : '텍스트'));
      return modes.size > 1 ? '음성·텍스트' : [...modes][0] || '미확인';
    })() as ClinicalNote['interviewMode'],
    chiefComplaint, hpi, hpiSummary,
    associatedSymptoms: [nausea, fact('vomiting'), fact('rf_black_tarry_stool', '흑색변'), fact('fever'), fact('cold_sweat')],
    redFlags: riskFields.map(id => fact(id)),
    history: {
      pastMedical: fact('medical_history', '과거력'), pastSurgical,
      medications: fact('medications'), allergies, familyHistory,
    },
    patientConcerns: [fact('concern'), fact('patient_belief')],
    redFlagsComplete: state.facts.filter(f => riskFields.includes(f.field_id)).every(f => ['reported', 'denied'].includes(f.status)),
    patientNextAction: state.safety.latched
      ? '위험 신호로 문진을 중단했습니다. 화면의 긴급 안내를 확인하세요.'
      : state.completion === 'complete'
        ? '수집한 내용을 의료진에게 보여 주세요. 이 기록만으로 응급질환을 배제할 수 없습니다.'
        : '미완료 항목이 있습니다. 의료진에게 확인하고 필요한 진료 안내를 받으세요.',
    objective: '신체진찰 미시행. 활력징후·검사값은 이 문진에서 수집하지 않았습니다.',
    assessment: '의료진 평가 전 — AI가 진단하지 않았습니다.',
    plan: '의료진 확인 필요 — AI가 치료 계획을 생성하지 않았습니다.',
    revision: state.revision,
    confirmed: state.confirmed_revision === state.revision,
    fixture,
  };
  return { ...note, missingInformation: listMissing(note) };
}

function factValue(fact: ClinicalFact, compact = false) {
  if (fact.status === 'reported') return compact ? ` (+) ${fact.value}` : fact.value || statusLabels.reported;
  if (fact.status === 'denied') return compact ? ' (−)' : '없다고 응답';
  return statusLabels[fact.status];
}
function emrLine(label: string, fact: ClinicalFact) {
  const quote = fact.sourceQuote ? ` — 원문: “${fact.sourceQuote}”` : '';
  return `${label}: ${factValue(fact, true)}${quote}`;
}
export function toEmrText(note: ClinicalNote) {
  const h = note.hpi;
  const lines = [
    '[AI Pre-Visit History — Unverified]',
    `Patient: age ${note.demographics.age ?? '미확인'} / sex ${note.demographics.sex ?? '미확인'} · 환자 자가응답 · AI 구조화 · ${note.interviewMode}`,
    `CC: ${factValue(note.chiefComplaint)}${note.chiefComplaint.sourceQuote ? ` — “${note.chiefComplaint.sourceQuote}”` : ''}`,
    '', 'HPI:',
    note.hpiSummary,
    emrLine('Onset', h.onset), emrLine('Location', h.location), emrLine('Character', h.character),
    emrLine('Severity', h.severity), emrLine('Episode duration', h.duration),
    emrLine('Aggravating / meal relation', h.aggravating), emrLine('Relieving factors', h.relieving),
    emrLine('Daily function', h.dailyFunction),
    '', 'Pertinent ROS:',
    ...note.associatedSymptoms.map(f => emrLine(f.label, f)),
    '', 'Relevant History:',
    emrLine('PMHx', note.history.pastMedical), emrLine('PSHx', note.history.pastSurgical),
    emrLine('Medication', note.history.medications), emrLine('Drug allergy', note.history.allergies),
    emrLine('Family history', note.history.familyHistory),
    '', 'Red Flags:',
    ...note.redFlags.map(f => emrLine(f.label, f)),
    `Red-flag review: ${note.redFlagsComplete ? 'listed items assessed' : 'not fully assessed; clinician confirmation required'}`,
    `Missing information: ${note.missingInformation.length ? note.missingInformation.join(', ') : '기록된 미확인 항목 없음'}`,
    '', `Patient next step: ${note.patientNextAction}`,
    `O: ${note.objective}`,
    `A: ${note.assessment}`,
    `P: ${note.plan}`,
    '', '* 환자 자가응답을 AI가 구조화한 초안입니다. 원문과 상태를 확인하고 의료진이 검증해야 합니다.',
    '* 미확인·잘 모름·불명확·응답 거부는 서로 구분되며, 정상 또는 음성으로 간주하지 않습니다.',
    note.fixture ? '* 개발용 고정 사실 후보로 생성한 가상 시연 자료입니다.' : '',
  ];
  return lines.filter((line, i) => line || lines[i - 1] !== '').join('\n').trim();
}
