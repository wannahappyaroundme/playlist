import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrShareProps {
  url: string;
}

export default function QrShare({ url }: QrShareProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 256, color: { dark: '#0a0a0a', light: '#ffffff' } })
      .then((d) => {
        if (alive) setDataUrl(d);
      })
      .catch(() => {
        if (alive) setDataUrl('');
      });
    return () => {
      alive = false;
    };
  }, [url]);

  async function handleShare() {
    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    if (canShare) {
      try {
        await navigator.share({ title: 'Yejin Playlist', url });
        return;
      } catch {
        // user cancelled or failed → fall through to copy
      }
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {dataUrl ? (
        <img src={dataUrl} alt="share QR code" className="h-44 w-44 rounded-xl bg-white p-2" />
      ) : (
        <div className="flex h-44 w-44 items-center justify-center rounded-xl bg-white/5 text-xs text-white/40">
          QR 생성 중…
        </div>
      )}
      <button
        type="button"
        aria-label="share"
        onClick={handleShare}
        className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition active:scale-95"
      >
        {copied ? '복사됨!' : '공유하기'}
      </button>
    </div>
  );
}
