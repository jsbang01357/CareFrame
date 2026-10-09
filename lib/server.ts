import { NextResponse } from 'next/server';
import { EvidenceError } from '@/lib/interview/validate-evidence';
export class HttpError extends Error { constructor(public status: number, public code: string, public userMessage: string) { super(code); } }
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const url = new URL(req.url);
  const expected = process.env.APP_ORIGIN || `${url.protocol}//${req.headers.get('host') || url.host}`;
  if (!origin || origin !== expected) throw new HttpError(403, 'origin_rejected', '같은 앱 화면에서 다시 시도해 주세요.');
}
export async function readBody(req: Request, max = 128 * 1024) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(400, 'invalid_content_type', '잘못된 요청 형식입니다.');
  if (Number(req.headers.get('content-length') || 0) > max) throw new HttpError(413, 'too_large', '입력 크기가 너무 큽니다.');
  const reader = req.body?.getReader(); if (!reader) throw new HttpError(400, 'empty_body', '요청 내용이 없습니다.');
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > max) { await reader.cancel(); throw new HttpError(413, 'too_large', '입력 크기가 너무 큽니다.'); } chunks.push(value); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'invalid_json', '요청 내용을 읽을 수 없습니다.'); }
}
export const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export function failure(error: unknown) {
  if (error instanceof HttpError) return json({ error: { code: error.code, message: error.userMessage } }, error.status);
  if (error instanceof EvidenceError) return json({ error: { code: 'evidence_rejected', message: `원문 근거를 검증하지 못했습니다 (${error.message}). 기존 기록은 유지됩니다.` } }, 502);
  if (error instanceof Error && error.message === 'missing_api_key') return json({ error: { code: 'missing_api_key', message: '서버 API 키가 설정되지 않았습니다. 실제 API 연결이 필요합니다.' } }, 503);
  const status = (error as { status?: number })?.status;
  if (status === 429) return json({ error: { code: 'provider_limit', message: 'API 사용 한도에 도달했습니다. 잠시 멈추고 사용 설정을 확인해 주세요.' } }, 429);
  if (status === 401 || status === 403) return json({ error: { code: 'provider_permission', message: 'API 접근 권한을 확인해야 합니다.' } }, 502);
  if (error instanceof Error && ['TimeoutError','AbortError','APIConnectionTimeoutError'].includes(error.name)) return json({ error: { code: 'timeout', message: '처리 시간이 초과되었습니다. 원문을 확인하고 다시 시도해 주세요.' } }, 504);
  return json({ error: { code: 'processing_failed', message: '응답을 검증하지 못했습니다. 기존 기록은 유지됩니다. 원문을 확인하고 다시 시도해 주세요.' } }, 502);
}
