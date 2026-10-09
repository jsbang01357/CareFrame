import type { Metadata } from 'next';
import './globals.css';
import './ui-overrides.css';
export const metadata: Metadata = { title: 'CareFrame · AI 건강 길잡이', description: '대화는 편안하게, 기록은 확인 가능하게. 가상 증례용 AI 사전문진 데모.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ko"><body>{children}</body></html>; }
