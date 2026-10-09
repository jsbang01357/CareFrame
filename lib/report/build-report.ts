import { URGENT_TEXT, GENERAL_TEXT, LIMITED_TEXT } from '@/data/protocol';
import type { InterviewState } from '@/lib/contracts';
import { buildClinicalNote, toEmrText } from './clinical-note';

export function buildReport(state: InterviewState, fixture = false) {
  const note = buildClinicalNote(state, fixture);
  return {
    ...note,
    emrText: toEmrText(note),
    nextAction: state.safety.latched ? URGENT_TEXT : state.completion === 'complete' ? GENERAL_TEXT : LIMITED_TEXT,
    rows: state.facts,
    contextual: state.contextual_facts,
    corrections: state.turns.filter(t => t.replaces_turn_id).map(after => ({ before: state.turns.find(x => x.id === after.replaces_turn_id)!, after })),
    stopReason: state.stop_reason,
  };
}
