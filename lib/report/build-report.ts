import { fields, statusLabels, URGENT_TEXT, GENERAL_TEXT, LIMITED_TEXT } from '@/data/protocol';
import type { InterviewState } from '@/lib/contracts';
export function buildReport(s: InterviewState) {
  return {
    title: s.safety.latched ? '긴급 안내로 중단된 사전 문진 자료' : s.completion === 'complete' ? '사용자 진술 기반 사전 문진 자료' : '미완료 사전 문진 자료',
    revision: s.revision, confirmed: s.confirmed_revision === s.revision,
    nextAction: s.safety.latched ? URGENT_TEXT : s.completion === 'complete' ? GENERAL_TEXT : LIMITED_TEXT,
    rows: s.facts.map(f => ({ ...f, label: fields[f.field_id], statusLabel: statusLabels[f.status] })),
    contextual: s.contextual_facts.map(f => ({ ...f, label: fields[f.field_id], statusLabel: statusLabels[f.status] })),
    corrections: s.turns.filter(t => t.replaces_turn_id).map(t => ({ before: s.turns.find(x => x.id === t.replaces_turn_id)!, after: t })),
    stopReason: s.stop_reason,
  };
}
