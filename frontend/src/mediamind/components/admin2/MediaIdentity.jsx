import { useEffect, useState } from 'react';

export function MediaIdentity({ src, alt, initials = '—', kind = 'avatar', className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const shape = kind === 'thumbnail' ? 'aspect-video rounded-xl' : 'aspect-square rounded-full';
  const sizing = kind === 'thumbnail' ? 'w-full' : 'h-10 w-10 shrink-0';
  const shared = `${sizing} ${shape} overflow-hidden bg-slate-800 ${className}`;

  if (!src || failed) {
    return (
      <span className={`${shared} inline-flex items-center justify-center text-xs font-semibold text-slate-300`} aria-label={alt || undefined}>
        {initials}
      </span>
    );
  }

  return <img src={src} alt={alt} onError={() => setFailed(true)} className={`${shared} object-cover`} />;
}
