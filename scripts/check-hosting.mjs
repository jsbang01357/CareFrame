// 배포 직후 무료 서버 상태만 확인한다. 음성 토큰·유료 모델 요청은 하지 않는다.
const url = 'https://careframe.jisong.dev/api/health';
for (let attempt = 1; attempt <= 6; attempt++) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    const health = await response.json();
    if (!response.ok || health.status !== 'ok' || !health.api_configured || health.fixture_enabled) throw new Error('서버 API 설정 또는 응답 확인 실패');
    console.log(`CareFrame HTTPS·API 정상: HTTP ${response.status}`);
    process.exit(0);
  } catch (error) {
    if (attempt === 6) throw error;
    console.log(`배포 상태 확인 재시도 ${attempt}/6`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
