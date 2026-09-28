/**
 * What to tell someone whose video this computer cannot decode.
 *
 * Phones record in HEVC ("alta eficiência") by default, and Chrome on Windows only
 * decodes it when the machine has hardware support plus Microsoft's HEVC extension. The
 * editor used to fail deep in the pipeline with an English "Video codec not supported for
 * decoding", after the person had already waited through an edit.
 */
const CODEC_LABELS: Record<string, string> = {
	hevc: "HEVC (H.265)",
	av1: "AV1",
	vp9: "VP9",
	vp8: "VP8",
	avc: "H.264",
};

export function codecLabel({ codec }: { codec: string | null | undefined }) {
	if (!codec) return "o codec deste vídeo";
	return CODEC_LABELS[codec] ?? codec.toUpperCase();
}

export function unsupportedCodecMessage({
	codec,
}: {
	codec: string | null | undefined;
}) {
	const label = codecLabel({ codec });
	const conversion =
		"Converta para MP4 em H.264 (no celular, grave em “Mais compatível” em vez de “Alta eficiência”) e envie de novo.";
	return codec === "hevc"
		? `Este vídeo está em ${label}, que este computador não consegue decodificar. ${conversion}`
		: `Este vídeo usa ${label}, que este computador não consegue decodificar. ${conversion}`;
}
