import React from 'react';
import { normalize, tokenize } from '../lib/searchUtils';

// Destaca os ranges casados da query dentro de `text`, preservando acentos e
// casing originais. Como normalize é length-preserving (para texto pré-composto),
// os índices achados no texto normalizado valem 1:1 no original.
export default function Highlight({ text, query, className }) {
  const t = String(text ?? '');
  if (!query || !query.trim()) return <span className={className}>{t}</span>;

  const tokens = tokenize(query);
  const n = normalize(t);
  const ranges = [];
  for (const tok of tokens) {
    if (!tok) continue;
    let from = 0;
    let idx;
    while ((idx = n.indexOf(tok, from)) !== -1) {
      ranges.push([idx, idx + tok.length]);
      from = idx + tok.length;
    }
  }
  if (!ranges.length) return <span className={className}>{t}</span>;

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const r of ranges) {
    if (merged.length && r[0] <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r[1]);
    } else {
      merged.push([r[0], r[1]]);
    }
  }

  const parts = [];
  let pos = 0;
  for (let i = 0; i < merged.length; i++) {
    const [s, e] = merged[i];
    if (s > pos) parts.push(t.slice(pos, s));
    parts.push(
      <mark key={i} className="rounded bg-sky-500/30 px-0.5 text-sky-200">
        {t.slice(s, e)}
      </mark>
    );
    pos = e;
  }
  if (pos < t.length) parts.push(t.slice(pos));
  return <span className={className}>{parts}</span>;
}