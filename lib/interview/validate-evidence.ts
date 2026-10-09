import { questionField } from '@/data/protocol';
import type { Candidate, Extraction, InterviewState, Turn } from '@/lib/contracts';
export class EvidenceError extends Error {}
const indirect = /^(아니요|아뇨|아닙니다|없어요|없습니다|네|예|응|맞아요|(?:네|예)[,\s]+맞아요|있어요|몰라요|모르겠어요|잘 모르겠어요)[.!?\s]*$/;
export const isIndirectQuote = (quote: string) => indirect.test(quote.trim());
// 해석 실패는 사용자 입력 실패가 아니다. 원문은 엔진의 turns에 보존한다.
export function preserveRawAnswer(turn: Turn): Extraction {
  const field = questionField(turn.prompted_question_id);
  return {
    facts: field ? [{ field_id: field, status: 'unclear', value: null, subject: 'self', temporality: 'current', evidence: [{ turn_id: turn.id, quote: turn.text, question_id: turn.prompted_question_id }] }] : [],
    scope_signal: 'uncertain', scope_evidence: [], needs_rephrase: true,
  };
}
export function retainValidCandidates(result: Extraction, turn: Turn): Extraction {
  const facts = result.facts.filter(f => {
    try { validateCandidate(f, turn); return true; }
    catch (e) { if (!(e instanceof EvidenceError)) throw e; return false; }
  });
  let scope = { scope_signal: result.scope_signal, scope_evidence: result.scope_evidence };
  try { validateCandidates({ ...result, facts: [] }, turn); }
  catch (e) {
    if (!(e instanceof EvidenceError)) throw e;
    scope = { scope_signal: 'uncertain', scope_evidence: [] };
  }
  return { ...result, ...scope, facts: facts.length ? facts : preserveRawAnswer(turn).facts, needs_rephrase: result.needs_rephrase || facts.length !== result.facts.length || !facts.length };
}
export function validateCandidates(result: Extraction, utterance: Turn) {
  for (const f of result.facts) validateCandidate(f, utterance);
  for (const e of result.scope_evidence) {
    if (e.turn_id !== utterance.id || !utterance.text.includes(e.quote)) throw new EvidenceError('범위 근거 불일치');
    if (e.question_id !== null && e.question_id !== utterance.prompted_question_id) throw new EvidenceError('범위 질문 근거 불일치');
    if (isIndirectQuote(e.quote) && (e.question_id !== 'q_scope' || utterance.prompted_question_id !== 'q_scope')) throw new EvidenceError('간접 범위 답변 질문 불일치');
  }
  if (result.scope_signal !== 'uncertain' && !result.scope_evidence.length) throw new EvidenceError('범위 근거 없음');
}
function validateCandidate(f: Candidate, turn: Turn) {
  if (f.status === 'not_assessed') throw new EvidenceError('모델은 미질문 사실을 만들 수 없음');
  if (!f.evidence.length) throw new EvidenceError('근거 없음');
  if (f.status !== 'reported' && f.value !== null) throw new EvidenceError('불확실/부정 상태 값 오류');
  if (f.status === 'reported' && !f.value) throw new EvidenceError('진술 값 없음');
  for (const e of f.evidence) {
    if (turn.role !== 'user' || !turn.final || e.turn_id !== turn.id || !turn.text.includes(e.quote)) throw new EvidenceError('원문 근거 불일치');
    if (e.question_id !== null && e.question_id !== turn.prompted_question_id) throw new EvidenceError('질문 근거 불일치');
    if (indirect.test(e.quote.trim()) && (questionField(e.question_id) !== f.field_id || e.question_id !== turn.prompted_question_id)) throw new EvidenceError('간접 답변 범위 불일치');
  }
  if (f.field_id === 'medications' && f.status === 'reported' && f.evidence.some(e => /같아요|같긴|모르|기억.*안|기억.*않/.test(e.quote))) throw new EvidenceError('불확실한 약 정보 확정 금지');
}
export function validateStateEvidence(s: InterviewState) {
  const turns = new Map(s.turns.map(t => [t.id, t]));
  const replaced = new Set(s.turns.map(t => t.replaces_turn_id).filter(Boolean));
  for (const f of [...s.facts, ...s.contextual_facts]) {
    if (f.status === 'not_assessed') {
      if (f.value !== null || f.evidence.length) throw new EvidenceError('미질문 상태 오류');
      continue;
    }
    for (const e of f.evidence) {
      const t = turns.get(e.turn_id);
      if (!t || replaced.has(t.id)) throw new EvidenceError('존재하지 않거나 대체된 활성 근거');
      validateCandidate({ ...f, evidence: [e] }, t);
    }
    if (!f.evidence.length) throw new EvidenceError('활성 사실 근거 없음');
  }
  for (const e of s.safety.supporting_evidence) {
    const t = turns.get(e.turn_id);
    if (!t || t.role !== 'user' || !t.text.includes(e.quote)) throw new EvidenceError('위험 근거 오류');
  }
}
