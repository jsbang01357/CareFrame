import { json } from '@/lib/server';
export const runtime = 'nodejs';
export function GET() {
  return json({ status: 'ok', build: 'careframe-0.1.0', api_configured: Boolean(process.env.OPENAI_API_KEY), extract_model: process.env.EXTRACT_MODEL || 'gpt-4.1', fixture_enabled: process.env.ENABLE_FIXTURES === 'true', protocol_reviewed: process.env.PROTOCOL_REVIEWED === 'true', voice_verified: false });
}
