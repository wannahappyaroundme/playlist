import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePlaylists } from '../hooks/usePlaylists';
import { thumbnailUrl } from '../lib/youtube';
import { getSong, exportAll, importAll } from '../lib/storage';
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from '../lib/colors';
import AppBackground from '../components/AppBackground';

const EMPTY_BOX = 'aspect-square rounded-xl bg-white/5';

// 곡 추출색(accent)으로 카드 전체를 같은 색상의 '밝게→어둡게' 그라데이션으로 칠한다.
// 추출색이 어두워도 채도를 끌어올려 '플레이리스트'처럼 또렷한 색이 보이게 하고,
// 아래쪽은 충분히 어둡게 둬서 흰 제목이 읽히도록 한다.
function cardGradient(accent: string): string {
  const [h, s] = rgbToHsl(...hexToRgb(accent));
  const sat = Math.max(s, 0.62);
  const top = rgbToHex(...hslToRgb(h, sat, 0.5));
  const bottom = rgbToHex(...hslToRgb(h, Math.max(s, 0.5), 0.16));
  return `linear-gradient(160deg, ${top} 0%, ${bottom} 100%)`;
}

function CoverThumb({ id, playlistId }: { id?: string; playlistId: string }) {
  if (!id) {
    return <div data-testid={`gallery-cover-empty-${playlistId}`} className={EMPTY_BOX} />;
  }
  return (
    <img
      data-testid={`gallery-cover-${playlistId}`}
      src={thumbnailUrl(id, 'mqdefault')}
      alt=""
      loading="lazy"
      className={`${EMPTY_BOX} object-cover`}
      // one-shot fallback to a neutral box if the thumbnail fails to load
      onError={(e) => {
        const el = e.currentTarget;
        if (el.dataset.fallback === 'done') return;
        el.dataset.fallback = 'done';
        el.removeAttribute('src');
      }}
    />
  );
}

export default function Gallery() {
  const { playlists, create, remove, refresh } = usePlaylists();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNew = () => {
    const title = '새 플레이리스트';
    const p = create(title);
    navigate(`/edit/${p.id}`);
  };

  const handleDelete = (id: string, title: string) => {
    if (!window.confirm(`"${title}" 플레이리스트를 삭제할까요?`)) return;
    if (!window.confirm('정말 삭제할까요? 되돌릴 수 없어요.')) return;
    remove(id);
  };

  // 백업 내보내기: 현재 데이터를 .json 파일로 다운로드한다(Blob + 임시 anchor).
  const handleExport = () => {
    try {
      const json = exportAll();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `yejin-playlist-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.alert('내보내기에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  // 백업 가져오기: 숨긴 file input → 텍스트로 읽어 importAll → 목록 새로고침.
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 골라도 onChange가 또 뜨도록 초기화
    if (!file) return;
    try {
      const text = await file.text();
      const { songs, playlists: plCount } = importAll(text);
      refresh();
      window.alert(`가져오기 완료: 곡 ${songs}개, 플레이리스트 ${plCount}개를 불러왔어요.`);
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : '가져오기에 실패했어요. 올바른 백업 파일인지 확인해 주세요.';
      window.alert(msg);
    }
  };

  return (
    <div className="min-h-screen px-6 py-10 text-white">
      <AppBackground />
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Yejin Playlist</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur hover:bg-white/20"
          >
            내보내기
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur hover:bg-white/20"
          >
            가져오기
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            aria-label="백업 파일 가져오기"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleNew}
            className="rounded-full bg-white/15 px-5 py-2 text-sm backdrop-blur hover:bg-white/25"
          >
            새 플레이리스트
          </button>
        </div>
      </header>

      {playlists.length === 0 ? (
        <div className="mt-28 text-center text-white/75">
          <p className="text-3xl font-semibold text-white sm:text-4xl">아직 플레이리스트가 없어요.</p>
          <p className="mt-5 text-lg sm:text-xl">위의 “새 플레이리스트” 버튼으로 시작하세요.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {playlists.map((p) => {
            const coverId = p.coverVideoId ?? p.songIds[0];
            // 직접 고른 색(p.color)이 있으면 우선, 없으면 대표곡 추출색으로 카드를 물들인다.
            const baseColor = p.color ?? (coverId ? getSong(coverId)?.colors.accent : undefined);
            const cardStyle = baseColor
              ? { backgroundImage: cardGradient(baseColor) }
              : undefined;
            return (
            <li key={p.id}>
              <div
                style={cardStyle}
                className={
                  'rounded-2xl p-4 backdrop-blur transition ' +
                  (baseColor ? 'ring-1 ring-white/10' : 'bg-white/10')
                }
              >
                <Link to={`/p/${p.id}`} className="block transition hover:opacity-90">
                  <CoverThumb id={coverId} playlistId={p.id} />
                </Link>
                {/* 제목 옆 편집, 곡수 옆 삭제 */}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium drop-shadow">{p.title}</p>
                  <Link
                    to={`/edit/${p.id}`}
                    className="shrink-0 rounded-md bg-black/25 px-2 py-0.5 text-xs text-white/85 transition hover:bg-black/45"
                  >
                    편집
                  </Link>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-white/80">{p.songIds.length}곡</p>
                  <button
                    type="button"
                    aria-label={`${p.title} 삭제`}
                    onClick={() => handleDelete(p.id, p.title)}
                    className="shrink-0 rounded-md bg-black/25 px-2 py-0.5 text-xs text-white/85 transition hover:bg-red-500/55 hover:text-white"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <footer className="mt-16 flex items-center justify-center gap-3 text-xs text-white/40">
        <Link to="/terms" className="hover:text-white/70">이용약관</Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacy" className="hover:text-white/70">개인정보처리방침</Link>
      </footer>
    </div>
  );
}
