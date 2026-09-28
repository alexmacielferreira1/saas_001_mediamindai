// Cross-platform media validation without external executables.
import fs from "node:fs";
import { ALL_FORMATS, FilePathSource, Input } from "mediabunny";
import { rules } from "./policy.mjs";

const validationErrors = new Set(["O arquivo não contém um vídeo válido."]);

const issueMessages = [
	[1, "a duração deve ficar entre 3 segundos e 15 minutos"],
	[2, "o vídeo deve usar H.264 ou HEVC"],
	[4, "o áudio deve usar AAC"],
	[8, "a taxa de quadros deve ficar entre 23 e 60 FPS"],
	[16, "a largura não pode ultrapassar 1920 pixels"],
	[32, "o bitrate do vídeo não pode ultrapassar 25 Mbps"],
	[64, "o áudio deve usar 48 kHz"],
	[128, "o bitrate do áudio não pode ultrapassar 128 kbps"],
	[256, "o arquivo não pode ultrapassar 1 GB"],
	[512, "a proporção do vídeo deve ficar entre 0,01:1 e 10:1"],
	[1024, "o áudio deve ter 1 ou 2 canais"],
	[2048, "o átomo moov deve vir antes dos dados do vídeo (fast start)"],
	[4096, "o MP4 não pode conter listas de edição"],
];

async function readBox(handle, offset, boundary) {
	const header = Buffer.alloc(16);
	const { bytesRead } = await handle.read(header, 0, 16, offset);
	if (bytesRead < 8) return null;
	let size = header.readUInt32BE(0);
	const type = header.toString("ascii", 4, 8);
	let headerSize = 8;
	if (size === 1) {
		if (bytesRead < 16) return null;
		const extended = header.readBigUInt64BE(8);
		if (extended > BigInt(Number.MAX_SAFE_INTEGER)) return null;
		size = Number(extended);
		headerSize = 16;
	} else if (size === 0) {
		size = boundary - offset;
	}
	if (size < headerSize || offset + size > boundary) return null;
	return {
		type,
		start: offset,
		contentStart: offset + headerSize,
		end: offset + size,
	};
}

async function containsEditList(handle, start, end, depth = 0) {
	let offset = start;
	while (offset + 8 <= end) {
		const box = await readBox(handle, offset, end);
		if (!box) throw new Error("O arquivo MP4 possui uma estrutura inválida.");
		if (box.type === "edts") return true;
		if (depth < 3 && ["moov", "trak"].includes(box.type)) {
			if (await containsEditList(handle, box.contentStart, box.end, depth + 1))
				return true;
		}
		offset = box.end;
	}
	return false;
}

async function inspectMp4Structure(file) {
	const handle = await fs.promises.open(file, "r");
	try {
		const size = (await handle.stat()).size;
		let offset = 0;
		let moov = null;
		let mdat = null;
		while (offset + 8 <= size) {
			const box = await readBox(handle, offset, size);
			if (!box) throw new Error("O arquivo MP4 possui uma estrutura inválida.");
			if (box.type === "moov" && !moov) moov = box;
			if (box.type === "mdat" && !mdat) mdat = box;
			offset = box.end;
		}
		if (!moov || !mdat)
			throw new Error("O arquivo MP4 não contém os blocos moov e mdat.");
		return {
			fastStart: moov.start < mdat.start,
			noEditLists: !(await containsEditList(
				handle,
				moov.contentStart,
				moov.end,
			)),
		};
	} finally {
		await handle.close();
	}
}

export async function probeMedia(file, kind) {
	const input = new Input({
		formats: ALL_FORMATS,
		source: new FilePathSource(file),
	});

	try {
		const [duration, mimeType, video, audio] = await Promise.all([
			input.computeDuration(),
			input.getMimeType(),
			input.getPrimaryVideoTrack(),
			input.getPrimaryAudioTrack(),
		]);

		if (!video || !Number.isFinite(duration) || duration <= 0) {
			throw new Error("O arquivo não contém um vídeo válido.");
		}

		const videoCodec = video.codec;
		const audioCodec = audio?.codec ?? null;
		let reelProfile;
		if (kind === "export") {
			if (!mimeType.startsWith("video/mp4")) {
				throw new Error(
					"Vídeo incompatível com Reels: o arquivo deve ser MP4.",
				);
			}
			const [videoStats, audioStats, structure, codecString] =
				await Promise.all([
					video.computePacketStats(),
					audio?.computePacketStats(),
					inspectMp4Structure(file),
					video.getCodecParameterString(),
				]);
			const issues = Number(
				rules().reel_media_profile_issues(
					duration,
					videoCodec === "avc" ? 1 : videoCodec === "hevc" ? 2 : 0,
					!audio ? 0 : audioCodec === "aac" ? 1 : 2,
					videoStats.averagePacketRate,
					video.displayWidth,
					video.displayHeight,
					videoStats.averageBitrate,
					audio?.sampleRate ?? 0,
					audio?.numberOfChannels ?? 0,
					audioStats?.averageBitrate ?? 0,
					fs.statSync(file).size,
					Number(structure.fastStart),
					Number(structure.noEditLists),
				),
			);
			if (issues) {
				const reasons = issueMessages
					.filter(([flag]) => issues & flag)
					.map(([, message]) => message);
				throw new Error(
					"Vídeo incompatível com Reels: " + reasons.join("; ") + ".",
				);
			}
			reelProfile = {
				compatible: true,
				fps: videoStats.averagePacketRate,
				videoBitrate: videoStats.averageBitrate,
				codecString,
				audioSampleRate: audio?.sampleRate ?? null,
				audioChannels: audio?.numberOfChannels ?? null,
				audioBitrate: audioStats?.averageBitrate ?? null,
				fastStart: structure.fastStart,
				noEditLists: structure.noEditLists,
			};
		}

		return {
			duration,
			width: video.displayWidth,
			height: video.displayHeight,
			codec: videoCodec === "avc" ? "h264" : videoCodec,
			reelProfile,
		};
	} catch (error) {
		if (
			error instanceof Error &&
			(validationErrors.has(error.message) ||
				error.message.startsWith("Vídeo incompatível com Reels:"))
		)
			throw error;
		throw new Error(
			"Não foi possível validar o vídeo. Confira se o arquivo está íntegro e em um formato compatível.",
		);
	} finally {
		input.dispose();
	}
}
