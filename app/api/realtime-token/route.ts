import OpenAI from 'openai';
import { z } from 'zod';
import { failure, HttpError, json, readBody, sameOrigin } from '@/lib/server';
import { personaIds, personaNames } from '@/lib/persona';
export const runtime = 'nodejs';
const input = z.object({ persona_id: z.enum(personaIds), demo_only: z.literal(true) }).strict();
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const parsed = input.safeParse(await readBody(req, 1024));
    if (!parsed.success) throw new HttpError(400, 'invalid_request', '잘못된 음성 연결 요청입니다.');
    if (!process.env.OPENAI_API_KEY) throw new Error('missing_api_key');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 14000 });
    const model = process.env.REALTIME_MODEL || 'gpt-realtime-2.1';
    const transcriptionModel = process.env.REALTIME_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';
    const voice = parsed.data.persona_id === 'cheolsu'
      ? process.env.REALTIME_VOICE_CHEOLSU || 'ash'
      : process.env.REALTIME_VOICE || 'marin';
    const token = await client.realtime.clientSecrets.create({
      expires_after: { anchor: 'created_at', seconds: 60 },
      session: { type: 'realtime', model,
        instructions: `당신은 가상 증례 데모의 AI 건강 길잡이 ${personaNames[parsed.data.persona_id]}입니다. 서버가 response instructions에 준 승인 문장만 한국어로 그대로 읽습니다. 사용자에게 자발적으로 답하지 않습니다. 진단, 처방, 약 추천, 안심 판단, 질문 추가를 하지 않습니다.`,
        audio: { input: { transcription: { model: transcriptionModel, language: 'ko' }, turn_detection: { type: 'server_vad', create_response: false, interrupt_response: false } }, output: { voice } },
      },
    }, { signal: AbortSignal.any([req.signal, AbortSignal.timeout(14500)]) });
    if (!token.value || !token.expires_at) throw new Error('invalid_token');
    return json({ value: token.value, expires_at: token.expires_at, model, transcription_model: transcriptionModel, voice });
  } catch (e) { return failure(e); }
}
