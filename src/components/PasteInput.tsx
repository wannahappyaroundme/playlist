import { useState } from 'react';
import type { Song } from '../types';
import { useSongResolver } from '../hooks/useSongResolver';
import { parseVideoId } from '../lib/youtube';
import LoadingOverlay from './LoadingOverlay';

interface PasteInputProps {
  /** 해석에 성공한 곡들을 '붙여넣은 순서대로' 한 번에 넘긴다(여러 곡 일괄 추가). */
  onAdd(songs: Song[]): void;
}

// 한 번에 동시에 해석할 곡 수 한도(LRCLIB 레이트리밋·기기 부담 고려; SharedView와 동일값).
const ADD_CONCURRENCY = 3;

export default function PasteInput({ onAdd }: PasteInputProps) {
  const { resolve, resolving } = useSongResolver();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  // 일괄 추가 진행도(해석 끝난 곡 수 / 전체). total>1일 때만 버튼에 'n/total'을 보여준다.
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function handleAdd() {
    const lines = value
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return;

    setBusy(true);
    setErrors([]);
    const newErrors: string[] = [];

    // 1) 파싱 + 배치 내 중복 제거(붙여넣은 순서 유지).
    const seen = new Set<string>();
    const items: { id: string; line: string }[] = [];
    for (const line of lines) {
      const id = parseVideoId(line);
      if (!id) {
        newErrors.push(`링크를 인식하지 못했어요: ${line}`);
        continue;
      }
      if (seen.has(id)) {
        newErrors.push(`이미 추가한 곡이에요(중복): ${line}`);
        continue;
      }
      seen.add(id);
      items.push({ id, line });
    }

    // 2) 동시성 한도로 병렬 해석하되, 결과를 인덱스에 채워 '붙여넣은 순서'를 유지한다.
    const total = items.length;
    setProgress({ done: 0, total });
    const results: (Song | null)[] = new Array(total).fill(null);
    let cursor = 0;
    let done = 0;
    const worker = async () => {
      while (true) {
        const i = cursor;
        cursor += 1;
        if (i >= total) return;
        const { id, line } = items[i];
        try {
          const song = await resolve(id);
          // 가사 비주얼라이저이므로 가사 없는 곡은 추가하지 않고 다른 링크를 권한다.
          if (song.lyrics.type === 'none') {
            newErrors.push(`이 링크는 가사를 찾을 수 없어요 — 다른 유튜브 링크를 넣어주세요: ${line}`);
          } else {
            results[i] = song;
          }
        } catch (err) {
          // 메타/타임아웃은 일시적일 수 있어 재시도 안내, 그 외(재생불가/차단)는 단정적 안내.
          const code = (err as { code?: unknown })?.code;
          const msg =
            code === 'meta'
              ? '영상 정보를 못 읽었어요 — 잠시 후 다시 시도해 주세요'
              : '재생할 수 없는 영상이에요';
          newErrors.push(`${msg}: ${line}`);
        } finally {
          done += 1;
          setProgress({ done, total });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(ADD_CONCURRENCY, total) }, () => worker()));

    // 3) 성공한 곡들을 '순서대로' 한 번에 추가한다 — 곡마다 onAdd를 부르던 옛 방식은
    //    React stale-closure로 마지막 곡만 남는 버그가 있었다.
    const songs = results.filter((s): s is Song => s !== null);
    if (songs.length > 0) onAdd(songs);

    setErrors(newErrors);
    if (songs.length > 0 && newErrors.length === 0) setValue('');
    setBusy(false);
  }

  const disabled = busy || resolving;
  const buttonLabel = busy
    ? progress.total > 1
      ? `추가 중 ${progress.done}/${progress.total}`
      : '추가 중…'
    : '곡 추가';

  return (
    <div className="flex flex-col gap-2">
      <LoadingOverlay show={busy} />
      <textarea
        aria-label="youtube links"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="YouTube 링크를 한 줄에 하나씩 붙여넣으세요 — 여러 개를 한 번에 추가할 수 있어요"
        className="w-full resize-none rounded-xl bg-white/5 p-3 text-sm text-white placeholder-white/60 outline-none ring-1 ring-white/10 focus:ring-white/30"
      />
      <button
        type="button"
        aria-label="add"
        onClick={handleAdd}
        disabled={disabled}
        className="self-end rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition disabled:opacity-50"
      >
        {buttonLabel}
      </button>
      {errors.length > 0 ? (
        <ul data-testid="paste-error" className="space-y-1 text-xs text-rose-300">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
