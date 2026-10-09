import type { InterviewState } from '@/lib/contracts';
export interface ClinicianDraft { sessionId: string; sourceRevision: number; text: string; reviewed: boolean }
export function draftIsCurrent(draft: ClinicianDraft, state: InterviewState) {
  return draft.sessionId === state.session_id && draft.sourceRevision === state.revision;
}
export function reviewedEmrText(draft: ClinicianDraft, state: InterviewState) {
  if (!draftIsCurrent(draft, state)) throw new Error('원문 기록이 바뀌었습니다. 현재 버전으로 다시 검토해 주세요.');
  return `[의료진 ${draft.reviewed ? '검토 완료' : '편집 초안'} · 데모]\n원본 기록 버전: ${draft.sourceRevision}\n환자 자가응답 원본은 별도 보존됩니다. 검토자 인증·전자서명이 없는 가상 시연입니다.\n\n${draft.text}`;
}
