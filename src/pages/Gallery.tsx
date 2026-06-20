import { Link, useNavigate } from 'react-router-dom';
import { usePlaylists } from '../hooks/usePlaylists';
import { thumbnailUrl } from '../lib/youtube';
import AppBackground from '../components/AppBackground';

const EMPTY_BOX = 'aspect-square rounded-xl bg-white/5';

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
  const { playlists, create, remove } = usePlaylists();
  const navigate = useNavigate();

  const handleNew = () => {
    const title = '새 플레이리스트';
    const p = create(title);
    navigate(`/edit/${p.id}`);
  };

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`"${title}" 플레이리스트를 삭제할까요?`)) {
      remove(id);
    }
  };

  return (
    <div className="min-h-screen px-6 py-10 text-white">
      <AppBackground />
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Yejin Playlist</h1>
        <button
          type="button"
          onClick={handleNew}
          className="rounded-full bg-white/15 px-5 py-2 text-sm backdrop-blur hover:bg-white/25"
        >
          새 플레이리스트
        </button>
      </header>

      {playlists.length === 0 ? (
        <div className="mt-24 text-center text-white/60">
          <p className="text-lg">아직 플레이리스트가 없어요.</p>
          <p className="mt-2 text-sm">위의 “새 플레이리스트” 버튼으로 시작하세요.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {playlists.map((p) => (
            <li key={p.id}>
              <Link
                to={`/p/${p.id}`}
                className="block rounded-2xl bg-white/10 p-4 backdrop-blur transition hover:bg-white/15"
              >
                <CoverThumb id={p.coverVideoId ?? p.songIds[0]} playlistId={p.id} />
                <p className="mt-3 truncate text-sm font-medium">{p.title}</p>
                <p className="mt-1 text-xs text-white/50">{p.songIds.length}곡</p>
              </Link>
              <div className="mt-1 flex items-center justify-between">
                <Link to={`/edit/${p.id}`} className="text-xs text-white/40 hover:text-white/70">
                  편집
                </Link>
                <button
                  type="button"
                  aria-label={`${p.title} 삭제`}
                  onClick={() => handleDelete(p.id, p.title)}
                  className="text-xs text-white/40 transition hover:text-red-300"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
