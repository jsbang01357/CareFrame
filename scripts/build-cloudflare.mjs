import { constants, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// OpenNext는 .next를 사용한다. 실행 중인 로컬 서버와 .env.local을 빌드에서 분리한다.
const root = process.cwd();
const directory = mkdtempSync(join(tmpdir(), 'careframe-build-'));
for (const path of ['app', 'components', 'lib', 'data', 'public', 'pictures', 'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'next-env.d.ts', 'open-next.config.ts', 'wrangler.jsonc']) {
  cpSync(join(root, path), join(directory, path), { recursive: true });
}
// 외부 경로를 가리키는 symlink는 Next standalone 파일 추적에서 누락된다.
cpSync(join(root, 'node_modules'), join(directory, 'node_modules'), { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
// Next 16.4 호환 수정: upstream PR #1356. 설치 원본은 건드리지 않는다.
// https://github.com/opennextjs/opennextjs-cloudflare/pull/1356
const manifestPlugin = join(directory, 'node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/load-manifest.js');
const manifestSource = readFileSync(manifestPlugin, 'utf8');
const manifestGlob = '**/{*-manifest,required-server-files,prefetch-hints}.json';
if (manifestSource.includes(manifestGlob)) {
  writeFileSync(manifestPlugin, manifestSource.replace(manifestGlob, '**/{*-manifest,required-server-files,prefetch-hints,preview-props}.json'));
} else if (!manifestSource.includes('prefetch-hints,preview-props')) {
  throw new Error('OpenNext manifest 수집 방식이 변경됐습니다. Next 16.4 호환 수정을 검토하세요.');
}
const env = { ...process.env, CAREFRAME_WORKER_BUILD: '1', WRANGLER_SEND_METRICS: 'false' };
delete env.CAREFRAME_DIST_DIR;
delete env.OPENAI_API_KEY;
const result = spawnSync(join(directory, 'node_modules/.bin/opennextjs-cloudflare'), ['build'], {
  cwd: directory, env, stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
cpSync(join(directory, '.open-next'), join(root, '.open-next'), { recursive: true });
// 사용자 승인: 성공한 격리 빌드의 임시 복사본만 정리한다. 실패본은 진단용으로 보존한다.
rmSync(directory, { recursive: true });
console.log('로컬 서버와 분리한 Workers 빌드 완료 · 임시 복사본 정리 완료');
