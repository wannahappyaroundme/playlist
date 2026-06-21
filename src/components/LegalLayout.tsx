import { Link } from 'react-router-dom';
import AppBackground from './AppBackground';

interface LegalLayoutProps {
  title: string;
  updated: string;
  children: React.ReactNode;
}

/**
 * 이용약관·개인정보처리방침 등 정적 문서 페이지의 공용 레이아웃.
 * 배경 + 뒤로가기 + 제목/시행일 + 본문(읽기 좋은 너비).
 */
export default function LegalLayout({ title, updated, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen px-6 py-10 text-white">
      <AppBackground />
      <div className="mx-auto max-w-xl sm:max-w-2xl">
        <Link to="/" className="text-sm text-white/60 hover:text-white">← 홈으로</Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-xs text-white/50">시행일 {updated}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/90">{children}</div>
        <p className="mt-12 text-xs text-white/40">Yejin Playlist · 개인·비영리 프로젝트</p>
      </div>
    </div>
  );
}

/** 문서 내 섹션(소제목 + 내용). */
export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-white">{heading}</h2>
      <div className="space-y-2 text-white/80">{children}</div>
    </section>
  );
}
