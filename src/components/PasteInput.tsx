import { useState } from 'react';
import type { Song } from '../types';
import { useSongResolver } from '../hooks/useSongResolver';
import { parseVideoId } from '../lib/youtube';

interface PasteInputProps {
  onAdd(song: Song): void;
}

export default function PasteInput({ onAdd }: PasteInputProps) {
  const { resolve, resolving } = useSongResolver();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleAdd() {
    const lines = value
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return;

    setBusy(true);
    const newErrors: string[] = [];
    let addedAny = false;

    for (const line of lines) {
      const id = parseVideoId(line);
      if (!id) {
        newErrors.push(`링크를 인식하지 못했어요: ${line}`);
        continue;
      }
      try {
        const song = await resolve(id);
        onAdd(song);
        addedAny = true;
      } catch (err) {
        // 메타/타임아웃은 일시적일 수 있어 재시도 안내, 그 외(재생 불가/차단)는 단정적 안내.
        const code = (err as { code?: unknown })?.code;
        const msg =
          code === 'meta'
            ? '영상 정보를 못 읽었어요 — 잠시 후 다시 시도해 주세요'
            : '재생할 수 없는 영상이에요';
        newErrors.push(`${msg}: ${line}`);
      }
    }

    setErrors(newErrors);
    if (addedAny && newErrors.length === 0) setValue('');
    setBusy(false);
  }

  const disabled = busy || resolving;

  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="youtube links"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="YouTube 링크를 붙여넣으세요 (여러 줄 가능)"
        className="w-full resize-none rounded-xl bg-white/5 p-3 text-sm text-white placeholder-white/40 outline-none ring-1 ring-white/10 focus:ring-white/30"
      />
      <button
        type="button"
        aria-label="add"
        onClick={handleAdd}
        disabled={disabled}
        className="self-end rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition disabled:opacity-50"
      >
        {disabled ? '추가 중…' : '곡 추가'}
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
