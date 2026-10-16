/** ClipsFree interchange export. Generates a basic FCPXML 1.10 with one source clip.
 * Media must be relinked in the target editor: browser blob URLs are intentionally omitted.
 * No effects, typography or caption animation are represented.
 */
const escapeXml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const frames = (seconds, fps) => Math.max(0, Math.round(Number(seconds || 0) * fps));

export function createClipFcpxml({ title, filename, start, end, fps = 30 }) {
  const first = frames(start, fps);
  const duration = Math.max(1, frames(end, fps) - first);
  const sourceName = (filename || "RELINK_SOURCE.mp4").split(/[\\/]/).pop();
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
    <format id="r1" name="FFVideoFormat1080p30" frameDuration="1/${fps}s" width="1920" height="1080"/>
    <asset id="r2" name="${escapeXml(sourceName)}" start="0s" hasVideo="1" hasAudio="1" format="r1"/>
  </resources>
  <library><event name="ClipsFree"><project name="${escapeXml(title || "Corte")}">
    <sequence format="r1" duration="${duration}/${fps}s" tcStart="0s" tcFormat="NDF">
      <spine><asset-clip name="${escapeXml(title || sourceName)}" ref="r2" offset="0s" start="${first}/${fps}s" duration="${duration}/${fps}s"/></spine>
    </sequence>
  </project></event></library>
</fcpxml>`;
}

export function downloadClipFcpxml(options) {
  const xml = createClipFcpxml(options);
  const file = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `clipsfree-${String(options.title || "corte").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60)}.fcpxml`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
