import type { NextConfig } from 'next';
const config: NextConfig = {
  // 비교 검증 서버가 개발 서버의 빌드 파일을 공유하지 않도록 한다.
  distDir: process.env.CAREFRAME_DIST_DIR || '.next',
  // Workers에서는 정적 로고·캐릭터를 별도 이미지 변환 서비스 없이 제공한다.
  images: { unoptimized: process.env.CAREFRAME_WORKER_BUILD === '1' },
};
export default config;
