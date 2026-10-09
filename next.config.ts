import type { NextConfig } from 'next';
const config: NextConfig = {
  // 비교 검증 서버가 개발 서버의 빌드 파일을 공유하지 않도록 한다.
  distDir: process.env.CAREFRAME_DIST_DIR || '.next',
};
export default config;
