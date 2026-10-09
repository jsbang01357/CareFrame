import { spawnSync } from 'node:child_process';

// 값은 명령 인자·로그·배포 파일로 보내지 않고 Wrangler 표준 입력으로만 전달한다.
process.loadEnvFile('.env.local');
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY가 .env.local에 필요합니다.');
const result = spawnSync('node_modules/.bin/wrangler', ['secret', 'put', 'OPENAI_API_KEY'], {
  input: process.env.OPENAI_API_KEY,
  stdio: ['pipe', 'inherit', 'inherit'],
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
