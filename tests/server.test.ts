import { describe, it, expect } from 'vitest';
import { sameOrigin, readBody, failure } from '@/lib/server';
describe('서버 요청 경계', () => {
 it('Next 내부 localhost URL과 브라우저 Host 차이를 처리', () => { expect(()=>sameOrigin(new Request('http://localhost:3000/api/turn',{headers:{Host:'127.0.0.1:3000',Origin:'http://127.0.0.1:3000'}}))).not.toThrow(); });
 it('외부 origin과 origin 없는 요청 거절', () => { for(const origin of ['https://other.example','']) expect(()=>sameOrigin(new Request('http://localhost:3000/api/turn',{headers:{Host:'127.0.0.1:3000',...(origin?{Origin:origin}:{})}}))).toThrow(); });
 it('크기 제한과 잘못된 JSON 거절', async()=>{ const body=new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"text":"too big"}'});await expect(readBody(body,3)).rejects.toThrow(); });
 it('API 키 없음은 실제 실패이고 mock 성공이 아님', async()=>{ const r=failure(new Error('missing_api_key'));expect(r.status).toBe(503);expect((await r.json()).error.code).toBe('missing_api_key'); });
});
