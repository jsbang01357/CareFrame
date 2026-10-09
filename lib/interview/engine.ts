import { fields, fieldIds, riskFields, requiredFields, questions, questionId, PROTOCOL_VERSION, SCOPE_QUESTION, MAX_ANSWER_TURNS, URGENT_TEXT, GENERAL_TEXT, LIMITED_TEXT } from '@/data/protocol';
import type { FieldId } from '@/data/protocol';
import type { Candidate, Demographics, Fact, Extraction, InterviewState, NextAction, TurnRequest } from '@/lib/contracts';
import { personaNames, type PersonaId } from '@/lib/persona';
import { validateCandidates, validateStateEvidence } from './validate-evidence';
import { riskFieldsFor, requiredFieldsFor } from '@/data/protocol';
import { closingText } from './care-guidance';
export function emptyFact(field_id: FieldId): Fact {
  return { field_id, status: 'not_assessed', value: null, subject: 'self', temporality: 'current', evidence: [], verification: 'not_applicable', revision: 0 };
}
export function initialState(session_id: string, demographics: Demographics = { age: null, sex: null }, selected_cpx_id: string | null = null, selected_topic_text: string | null = null, personaId: PersonaId = 'younghee'): InterviewState {
  return { schema_version: '1.3', protocol_version: PROTOCOL_VERSION, session_id, revision: 0, demo_only: true, persona_id: personaId, demographics, selected_cpx_id, selected_topic_text, phase: 'interviewing', scope: 'uncertain', turns: [], processed_turn_ids: [], facts: fieldIds.map(emptyFact), superseded_facts: [], contextual_facts: [], asked_question_ids: ['q_chief_complaint'], last_question_id: 'q_chief_complaint', deliveries: [{ question_id: 'q_chief_complaint', revision: 0, status: 'shown' }], clarification_counts: {}, safety: { status: 'not_checked', triggered_rule_ids: [], supporting_evidence: [], unchecked_fields: [...riskFieldsFor({ selected_cpx_id })], latched: false, evaluated_revision: 0 }, accepted_answer_count: 0, completion: 'not_finished', confirmed_revision: null, stop_reason: null };
}
const action = (kind: NextAction['kind'], approved_text: string, reason_code: string, question_id: string | null = null): NextAction => ({ kind, approved_text, reason_code, question_id, speak: kind !== 'pause' && kind !== 'urgent_help', report_available: !['ask', 'clarify'].includes(kind) });
export const firstAction = (topic?: string, personaId: PersonaId = 'younghee') => {
  const name = personaNames[personaId];
  return action('ask', topic
    ? `안녕하세요, AI 건강 길잡이 ${name}예요. 선택하신 ‘${topic}’과 관련해 오늘 가장 불편한 점을 말씀해 주세요. 다른 증상이라면 편하게 정정해 주세요.`
    : `안녕하세요, AI 건강 길잡이 ${name}예요. 오늘 어디가 가장 불편하세요?`, 'start', 'q_chief_complaint');
};
export function evaluateSafety(s: InterviewState) {
  if (s.safety.latched) { s.phase = 'urgent_stop'; return; }
  const risks = riskFieldsFor(s);
  const active = s.facts.filter(f => risks.includes(f.field_id));
  const selfTriggers = active.filter(f => f.status === 'reported' && f.subject === 'self' && f.temporality === 'current');
  const otherTriggers = s.contextual_facts.filter(f => risks.includes(f.field_id) && f.status === 'reported' && f.subject === 'other' && f.temporality === 'current');
  const triggers = [...selfTriggers, ...otherTriggers];
  // 타인의 현재 위험은 도움 안내를 우선하되 본인 facts에는 합치지 않는다.
  const unchecked = active.filter(f => !['reported', 'denied'].includes(f.status)).map(f => f.field_id);
  s.safety = { status: triggers.length ? 'escalated' : unchecked.length ? 'pending_clarification' : 'no_configured_trigger', triggered_rule_ids: triggers.map(f => `${f.subject === 'other' ? 'R3' : 'R1'}:${f.field_id}`), supporting_evidence: triggers.flatMap(f => f.evidence), unchecked_fields: unchecked, latched: triggers.length > 0, evaluated_revision: s.revision };
  const diabetes = s.facts.find(f => f.field_id === 'diabetes');
  const vomiting = s.facts.find(f => f.field_id === 'vomiting');
  if (diabetes?.status === 'reported' && vomiting?.status === 'reported') {
    s.safety.latched = true; s.safety.status = 'escalated'; s.safety.triggered_rule_ids.push('R4:diabetes_vomiting');
    s.safety.supporting_evidence.push(...diabetes.evidence, ...vomiting.evidence);
  }
  if (s.safety.latched) { s.phase = 'urgent_stop'; s.stop_reason = 'configured_risk'; s.completion = 'partial'; }
}
function complete(s: InterviewState) {
  return s.stop_reason !== 'input_error' && s.scope === 'supported' && requiredFieldsFor(s).every(id => ['reported','denied'].includes(s.facts.find(f => f.field_id === id)!.status));
}
export function chooseNext(s: InterviewState): NextAction {
  if (s.safety.latched) return action('urgent_help', URGENT_TEXT, 'configured_risk');
  if (s.phase === 'finished') return action('finish', closingText(s), 'confirmed');
  if (s.scope === 'unsupported') { s.phase = 'out_of_scope'; s.completion = 'partial'; s.stop_reason = 'unsupported'; return action('out_of_scope', LIMITED_TEXT, 'unsupported'); }
  if (s.phase === 'review' || s.accepted_answer_count >= MAX_ANSWER_TURNS) {
    s.phase = 'review'; s.completion = complete(s) ? 'complete' : 'partial';
    s.stop_reason ??= s.accepted_answer_count >= MAX_ANSWER_TURNS ? 'turn_limit' : 'user_end';
    return action('review', closingText(s), s.stop_reason);
  }
  const risks = riskFieldsFor(s);
  const unclearRisk = risks.find(id => s.facts.find(f => f.field_id === id)?.status === 'unclear' && !s.clarification_counts[id]);
  if (unclearRisk) {
    s.clarification_counts[unclearRisk] = 1;
    return action('clarify', `${fields[unclearRisk]}에 대해 조금 더 정확히 말씀해 주실 수 있나요? 잘 모르시면 모른다고 말씀해 주세요.`, `clarify:${unclearRisk}`, questionId(unclearRisk));
  }
  if (s.scope === 'uncertain') {
    if (s.asked_question_ids.includes('q_scope')) { s.phase = 'review'; s.completion = 'partial'; s.stop_reason = 'scope_uncertain'; return action('review', LIMITED_TEXT, 'scope_uncertain'); }
    return action('clarify', SCOPE_QUESTION, 'scope_uncertain', 'q_scope');
  }
  const order = [...risks, ...requiredFieldsFor(s).filter(f => !risks.includes(f))];
  for (const id of order) {
    const f = s.facts.find(f => f.field_id === id)!;
    if (f.status === 'unclear' && !s.clarification_counts[id]) {
      s.clarification_counts[id] = 1;
      return action('clarify', `${fields[id]}에 대해 조금 더 정확히 말씀해 주실 수 있나요? 잘 모르시면 모른다고 말씀해 주세요.`, `clarify:${id}`, questionId(id));
    }
    if (f.status === 'not_assessed') return action('ask', questions[id]!, `missing:${id}`, questionId(id));
  }
  s.phase = 'review'; s.completion = complete(s) ? 'complete' : 'partial'; s.stop_reason = 'questions_exhausted';
  return action('review', closingText(s), 'questions_exhausted');
}
function recordAction(s: InterviewState, a: NextAction) {
  s.last_question_id = a.question_id;
  if (a.question_id) {
    if (!s.asked_question_ids.includes(a.question_id)) s.asked_question_ids.push(a.question_id);
    s.deliveries.push({ question_id: a.question_id, revision: s.revision, status: 'shown' });
  }
}
export function transition(req: TurnRequest, extracted?: Extraction): { state: InterviewState; next_action: NextAction } {
  if (req.expected_revision !== req.state.revision) throw new Error('revision_conflict');
  validateStateEvidence(req.state);
  const s = structuredClone(req.state);
  const turn = req.utterance;
  if (turn && (s.processed_turn_ids.includes(turn.id) || (turn.provider_item_id && s.turns.some(t => t.provider_item_id === turn.provider_item_id)))) return { state: s, next_action: action('pause', '이미 처리한 발언입니다.', 'duplicate') };
  if (req.event === 'answer' && (['review','finished','out_of_scope','urgent_stop'].includes(s.phase) || s.accepted_answer_count >= MAX_ANSWER_TURNS)) throw new Error('session_closed');
  if (req.event === 'answer' || req.event === 'correct') {
    if (!turn || !turn.final || turn.role !== 'user' || !extracted) throw new Error('invalid_turn');
    if (req.event === 'answer' && turn.prompted_question_id !== null && turn.prompted_question_id !== s.last_question_id) throw new Error('question_conflict');
    if (req.event === 'correct' && (turn.replaces_turn_id !== req.target_turn_id || turn.prompted_question_id !== null)) throw new Error('invalid_correction');
    validateCandidates(extracted, turn);
    if (req.event === 'correct') {
      const original = s.turns.find(t => t.id === req.target_turn_id && t.role === 'user');
      if (!original || s.turns.some(t => t.replaces_turn_id === original.id)) throw new Error('invalid_correction');
      for (let i = 0; i < s.facts.length; i++) {
        const old = s.facts[i]; const evidence = old.evidence.filter(e => e.turn_id !== original.id);
        if (evidence.length !== old.evidence.length) {
          s.superseded_facts.push(old);
          s.facts[i] = evidence.length ? { ...old, evidence, revision: s.revision + 1 } : emptyFact(old.field_id);
        }
      }
      s.contextual_facts = s.contextual_facts.filter(f => !f.evidence.some(e => e.turn_id === original.id));
      if (!s.safety.latched) { s.phase = 'interviewing'; s.stop_reason = null; }
    } else s.accepted_answer_count++;
    s.turns.push(turn); s.processed_turn_ids.push(turn.id); s.confirmed_revision = null;
    if (req.event === 'answer' && extracted.scope_signal !== 'uncertain') s.scope = extracted.scope_signal;
    if (req.event === 'correct') s.scope = extracted.scope_signal;
    for (const c of extracted.facts) merge(s, c, req.event === 'correct' ? 'user_corrected' : turn.origin === 'typed' ? 'user_confirmed' : 'unconfirmed_transcript');
  }
  if (req.event === 'end') { if (!s.safety.latched) s.phase = 'review'; s.stop_reason ??= 'user_end'; }
  if (req.event === 'confirm') {
    if (!['review','urgent_stop','out_of_scope'].includes(s.phase)) throw new Error('not_reviewing');
    s.confirmed_revision = s.revision + 1;
    s.facts = s.facts.map(f => f.status === 'not_assessed' ? f : { ...f, verification: 'user_confirmed' });
    if (!s.safety.latched) s.phase = 'finished';
  }
  s.revision++;
  evaluateSafety(s);
  const a = chooseNext(s); recordAction(s, a);
  return { state: s, next_action: a };
}
function merge(s: InterviewState, c: Candidate, verification: Fact['verification']) {
  const f: Fact = { ...c, verification, revision: s.revision + 1 };
  if (c.subject !== 'self' || c.temporality !== 'current') { s.contextual_facts.push(f); return; }
  const i = s.facts.findIndex(x => x.field_id === c.field_id); const old = s.facts[i];
  if (old.status !== 'not_assessed' && (old.status !== c.status || old.value !== c.value)) {
    s.superseded_facts.push(old);
    // 명확한 현재 위험 신호는 확인 질문을 기다리지 않는다.
    if (!(riskFieldsFor(s).includes(c.field_id) && c.status === 'reported') && old.status !== 'unclear') {
      s.facts[i] = { ...f, status: 'unclear', value: null, evidence: [...old.evidence, ...c.evidence] }; return;
    }
  }
  s.facts[i] = f;
}
