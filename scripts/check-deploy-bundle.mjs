import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const key = process.env.OPENAI_API_KEY;
let count = 0;
function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) check(path);
    else if (entry.isFile()) {
      const content = readFileSync(path);
      if ((key && content.includes(Buffer.from(key))) || /sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/.test(content.toString('utf8'))) throw new Error(`배포 파일에 서버 키가 포함됨: ${path}`);
      if (/^\.env(?:\.|$)|^\.dev\.vars/.test(entry.name)) throw new Error(`배포 파일에 환경 파일이 포함됨: ${path}`);
      count++;
    }
  }
}
check('.open-next');
console.log(`배포 파일 ${count}개 검사 완료: ${key ? '기존 서버 키 및 키 패턴' : '서버 키 패턴·환경 파일'} 미포함`);
