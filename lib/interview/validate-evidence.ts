import { questionField } from '@/data/protocol';
import type { Candidate, Extraction, InterviewState, Turn } from '@/lib/contracts';
export class EvidenceError extends Error {}
const indirect = /^(아니요|아뇨|없어요|없습니다|네|예|응|있어요|몰라요|모르겠어요)[.!?\s]*$/;
export const isIndirectQuote = (quote: string) => indirect.test(quote.trim());
export function validateCandidates(result: Extraction, utterance: Turn) {
  for (const f of result.facts) validateCandidate(f, utterance);
  for (const e of result.scope_evidence) {
    if (e.turn_id !== utterance.id || !utterance.text.includes(e.quote)) throw new EvidenceError('범위 근거 불일치');
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
