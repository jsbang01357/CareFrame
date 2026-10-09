import { describe, expect, it } from 'vitest';
import { directAnswer } from '@/lib/interview/extract';
import type { Turn } from '@/lib/contracts';
const turn = (text: string, question: string): Turn => ({ id: 't', role: 'user', origin: 'typed', text, final: true, prompted_question_id: question, provider_item_id: null, previous_item_id: null, replaces_turn_id: null, created_at: '2026-10-09T00:00:00Z' });
describe('질문에 연결된 짧은 답변', () => {
  it('부정 답변을 현재 질문 한 항목에만 적용한다', () => {
    const result = directAnswer(turn('아니요.', 'q_rf_chest_discomfort'))!;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toMatchObject({ field_id: 'rf_chest_discomfort', status: 'denied', value: null });
  });
  it('열린 질문의 아니요를 사실 부정으로 해석하지 않는다', () => {
    expect(directAnswer(turn('아니요', 'q_chief_complaint'))).toBeNull();
  });
  it('모른다는 답변을 위험 없음으로 바꾸지 않는다', () => {
    expect(directAnswer(turn('잘 모르겠어요', 'q_rf_black_tarry_stool'))!.facts[0].status).toBe('unknown');
  });
});
