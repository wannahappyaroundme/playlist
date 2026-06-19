const ID_RE = /^[A-Za-z0-9_-]{11}$/;

function isValidId(id: string | null | undefined): id is string {
  return !!id && ID_RE.test(id);
}

export function parseVideoId(input: string): string | null {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;

  // raw 11-char id
  if (isValidId(raw)) return raw;

  // try URL parsing
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return isValidId(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    // watch?v=<id>
    const v = url.searchParams.get('v');
    if (isValidId(v)) return v;

    // /embed/<id> or /shorts/<id>
    const segs = url.pathname.split('/').filter(Boolean);
    if ((segs[0] === 'embed' || segs[0] === 'shorts') && isValidId(segs[1])) {
      return segs[1];
    }
  }

  return null;
}
