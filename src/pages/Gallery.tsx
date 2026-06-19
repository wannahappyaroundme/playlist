import { Link, useNavigate } from 'react-router-dom';
import { usePlaylists } from '../hooks/usePlaylists';

export default function Gallery() {
  const { playlists, create } = usePlaylists();
  const navigate = useNavigate();

  const handleNew = () => {
    const title = '새 플레이리스트';
    const p = create(title);
    navigate(`/edit/${p.id}`);
  };

  return (
    <div className="min-h-screen px-6 py-10 text-white">
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
                <div className="aspect-square rounded-xl bg-white/5" />
                <p className="mt-3 truncate text-sm font-medium">{p.title}</p>
                <p className="mt-1 text-xs text-white/50">{p.songIds.length}곡</p>
              </Link>
              <Link to={`/edit/${p.id}`} className="mt-1 block text-xs text-white/40 hover:text-white/70">
                편집
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
