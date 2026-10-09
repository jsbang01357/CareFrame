'use client';
import type { CareGuidance } from '@/lib/interview/care-guidance';
export function CareGuidanceView({ guidance }: { guidance: CareGuidance }) {
  return <section className={`care-guidance care-guidance--${guidance.level}`} aria-label="환자 다음 행동 안내">
    <span className="eyebrow">문진 후 다음 행동</span><h2>{guidance.title}</h2><p>{guidance.text}</p>
    <details><summary>이렇게 안내한 이유</summary><ul>{guidance.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></details>
    <p className="care-warning">{guidance.warning}</p>
    <small>가상 증례용 안내 · 임상 검토 전 · 진단이나 치료 계획이 아닙니다.</small>
  </section>;
}
