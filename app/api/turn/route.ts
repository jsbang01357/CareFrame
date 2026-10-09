import { requestSchema, responseSchema } from '@/lib/contracts';
import { MAX_ANSWER_TURNS } from '@/data/protocol';
import { extract } from '@/lib/interview/extract';
import { transition } from '@/lib/interview/engine';
import { validateStateEvidence } from '@/lib/interview/validate-evidence';
import { failure, HttpError, json, readBody, sameOrigin } from '@/lib/server';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  const start = performance.now();
  try {
    sameOrigin(req);
    const parsed = requestSchema.safeParse(await readBody(req));
    if (!parsed.success) throw new HttpError(400, 'invalid_request', '문진 요청 형식이 맞지 않습니다.');
    const body = parsed.data;
    if (body.expected_revision !== body.state.revision) throw new HttpError(409, 'revision_conflict', '기록 버전이 달라졌습니다. 현재 기록에서 다시 시도해 주세요.');
    try { validateStateEvidence(body.state); } catch { throw new HttpError(400, 'invalid_evidence', '기록의 원문 근거를 확인할 수 없습니다.'); }
    const isInput = body.event === 'answer' || body.event === 'correct';
    if (isInput && (!body.utterance || body.utterance.role !== 'user' || !body.utterance.final)) throw new HttpError(400, 'invalid_turn', '확정된 사용자 발언이 필요합니다.');
    if (isInput && body.event === 'answer' && (body.state.accepted_answer_count >= MAX_ANSWER_TURNS || ['finished','review','out_of_scope'].includes(body.state.phase))) throw new HttpError(400, 'session_closed', '새 답변을 받을 수 없는 상태입니다.');
    const duplicate = body.utterance && (body.state.processed_turn_ids.includes(body.utterance.id) || (body.utterance.provider_item_id && body.state.turns.some(t => t.provider_item_id === body.utterance!.provider_item_id)));
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(14500)]);
    const extracted = isInput && !duplicate ? await extract(body.utterance!, body.state, signal) : undefined;
    const result = transition(body, extracted);
    return json(responseSchema.parse({ request_id: body.request_id, base_revision: body.expected_revision, ...result, timing: { server_ms: performance.now() - start } }));
  } catch (e) { return failure(e); }
}
