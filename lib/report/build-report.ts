import { URGENT_TEXT, GENERAL_TEXT, LIMITED_TEXT } from '@/data/protocol';
import type { InterviewState } from '@/lib/contracts';
import { buildClinicalNote, toEmrText } from './clinical-note';
import { buildCareGuidance } from '@/lib/interview/care-guidance';

export function buildReport(state: InterviewState, fixture = false) {
  const note = buildClinicalNote(state, fixture);
  return {
    ...note,
    emrText: toEmrText(note),
    careGuidance: buildCareGuidance(state),
    nextAction: buildCareGuidance(state).text,
    rows: state.facts,
    contextual: state.contextual_facts,
    corrections: state.turns.filter(t => t.replaces_turn_id).map(after => ({ before: state.turns.find(x => x.id === after.replaces_turn_id)!, after })),
    stopReason: state.stop_reason,
  };
}
