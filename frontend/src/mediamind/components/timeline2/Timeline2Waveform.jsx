import { useEffect, useState } from 'react';
import { loadWaveform, sliceWaveform } from '../../lib/timeline2Waveform';

const BAR_STEP = 3;

/**
 * Waveform of the clip's visible source window, decoded from the real audio with Web Audio.
 * Renders nothing while loading or when the browser/file cannot be decoded (no fake waveform).
 */
export default function Timeline2Waveform({ src, sourceIn = 0, sourceSpan = 0, width = 0, loader = loadWaveform }) {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    let active = true;
    setSummary(null);
    if (!src) return undefined;
    Promise.resolve()
      .then(() => loader(src))
      .then((result) => { if (active) setSummary(result); })
      .catch(() => { if (active) setSummary(null); });
    return () => { active = false; };
  }, [src, loader]);
  const bars = Math.min(4000, Math.floor(Math.max(0, width) / BAR_STEP));
  const peaks = summary ? sliceWaveform(summary, sourceIn, sourceIn + sourceSpan, bars) : [];
  if (!peaks.length) return null;
  const path = peaks.map((peak, index) => {
    const height = Math.max(0.5, peak * 18);
    return `M${(index * BAR_STEP) + 1} ${20 - height}V${20 + height}`;
  }).join('');
  return (
    <svg data-testid="timeline2-waveform" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-60" viewBox={`0 0 ${Math.max(1, bars * BAR_STEP)} 40`} preserveAspectRatio="none">
      <path d={path} stroke="currentColor" strokeWidth="1.5" className="text-emerald-100" />
    </svg>
  );
}
