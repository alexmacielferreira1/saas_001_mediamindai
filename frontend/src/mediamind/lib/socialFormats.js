export const SOCIAL_FORMATS = [
  { id: "4:5", label: "Instagram / Facebook retrato", width: 1080, height: 1350, group: "Feed" },
  { id: "1:1", label: "Instagram / Facebook quadrado", width: 1080, height: 1080, group: "Feed" },
  { id: "9:16", label: "TikTok / Reels / Stories", width: 1080, height: 1920, group: "Vertical" },
  { id: "16:9", label: "YouTube / Facebook horizontal", width: 1920, height: 1080, group: "Vídeo" },
  { id: "1.91:1", label: "LinkedIn / Facebook link", width: 1200, height: 628, group: "Horizontal" },
  { id: "3:2", label: "LinkedIn / X horizontal", width: 1200, height: 800, group: "Horizontal" },
];

export function getSocialFormat(id) {
  if (typeof id === "string" && id.startsWith("custom:")) {
    const [, encodedLabel, size] = id.split(":");
    const [width, height] = (size || "").split("x").map(Number);
    if (width > 0 && height > 0) return { id, label: decodeURIComponent(encodedLabel || "Personalizado"), width, height, group: "Personalizado" };
  }
  return SOCIAL_FORMATS.find((item) => item.id === id) || SOCIAL_FORMATS[0];
}

export function socialFormatLabel(id) {
  const format = getSocialFormat(id);
  return `${format.label} · ${format.width} × ${format.height} (${format.id})`;
}
