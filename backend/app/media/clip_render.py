"""Optional render instructions for a single exported clip (ClipsFree).

The browser sends them under ``properties["clip_render"]``. Every field is
validated here and turned into FFmpeg arguments that this module builds itself;
user text only ever reaches FFmpeg inside an ASS subtitle file, escaped so it
cannot carry override tags. Without ``clip_render`` the historical export
(``scale=1280:720``) is preserved for every other caller.
"""

import re
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app.core.errors import PublicError

ASPECT_SIZES = {"16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1080, 1080)}
ASPECT_RATIOS = {"16:9": (16, 9), "9:16": (9, 16), "1:1": (1, 1)}
DEFAULT_SIZE = (1280, 720)
SUBTITLE_FILENAME = "captions.ass"
ALIGNMENT = {"bottom": 2, "center": 5, "top": 8}
HEX_COLOR = r"^#[0-9a-fA-F]{6}$"


class TimedRange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: float = Field(ge=0, le=24 * 60 * 60)
    end: float = Field(gt=0, le=24 * 60 * 60)

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end <= self.start:
            raise ValueError("O fim deve ser posterior ao início.")
        return self


class RenderWord(TimedRange):
    text: str = Field(min_length=1, max_length=200)


class RenderCaption(TimedRange):
    text: str = Field(min_length=1, max_length=1000)
    position: Literal["top", "center", "bottom"] = "bottom"
    words: list[RenderWord] = Field(default_factory=list, max_length=400)


class RenderTitle(TimedRange):
    text: str = Field(min_length=1, max_length=300)


class CaptionStyle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    font_size: int = Field(default=64, ge=16, le=200)
    color: str = Field(default="#FFFFFF", pattern=HEX_COLOR)
    highlight_color: str = Field(default="#FFD400", pattern=HEX_COLOR)
    outline_color: str = Field(default="#000000", pattern=HEX_COLOR)
    box: bool = False
    uppercase: bool = False
    karaoke: bool = False
    max_chars: int = Field(default=28, ge=8, le=80)
    keywords: list[str] = Field(default_factory=list, max_length=50)


class ClipRenderOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    aspect: Literal["16:9", "9:16", "1:1"] | None = None
    fit: Literal["fill", "fit"] = "fill"
    focus_x: float = Field(default=0.5, ge=0, le=1)
    captions: list[RenderCaption] = Field(default_factory=list, max_length=2000)
    titles: list[RenderTitle] = Field(default_factory=list, max_length=50)
    skip: list[TimedRange] = Field(default_factory=list, max_length=200)
    caption_style: CaptionStyle = Field(default_factory=CaptionStyle)


def parse_render_options(properties: dict) -> ClipRenderOptions | None:
    raw = (properties or {}).get("clip_render")
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise PublicError(
            422, "INVALID_EXPORT_OPTIONS", "As opções de exportação do corte são inválidas."
        )
    try:
        return ClipRenderOptions.model_validate(raw)
    except ValidationError as error:
        raise PublicError(
            422, "INVALID_EXPORT_OPTIONS", "As opções de exportação do corte são inválidas."
        ) from error


def output_size(options: ClipRenderOptions | None) -> tuple[int, int]:
    if options is None or options.aspect is None:
        return DEFAULT_SIZE
    return ASPECT_SIZES[options.aspect]


def merged_skip_ranges(
    options: ClipRenderOptions | None, duration: float
) -> list[tuple[float, float]]:
    """Clamp removed ranges to the clip and merge overlaps."""
    if options is None:
        return []
    ranges = sorted(
        (max(0.0, item.start), min(duration, item.end))
        for item in options.skip
        if item.start < duration
    )
    merged: list[tuple[float, float]] = []
    for start, end in ranges:
        if end <= start:
            continue
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    removed = sum(end - start for start, end in merged)
    if duration - removed < 0.1:
        raise PublicError(
            422, "EXPORT_EMPTY", "Os cortes internos removem todo o trecho selecionado."
        )
    return merged


def _number(value: float) -> str:
    return f"{value:.3f}".rstrip("0").rstrip(".") or "0"


def build_video_filter(
    options: ClipRenderOptions | None,
    *,
    speed: float,
    duration: float,
    subtitles: bool,
) -> str:
    width, height = output_size(options)
    if options is None or options.aspect is None:
        parts = [f"scale={width}:{height}"]
    elif options.fit == "fit":
        parts = [
            f"scale={width}:{height}:force_original_aspect_ratio=decrease",
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black",
            "setsar=1",
        ]
    else:
        num, den = ASPECT_RATIOS[options.aspect]
        crop_w = f"min(iw\\,ih*{num}/{den})"
        crop_h = f"min(ih\\,iw*{den}/{num})"
        parts = [
            f"crop={crop_w}:{crop_h}:(iw-ow)*{_number(options.focus_x)}:(ih-oh)/2",
            f"scale={width}:{height}",
            "setsar=1",
        ]
    if subtitles:
        parts.append(f"subtitles={SUBTITLE_FILENAME}")
    skip = select_expression(options, speed=speed, duration=duration)
    if skip:
        parts.extend([f"select=not({skip})", "setpts=N/FRAME_RATE/TB"])
    return ",".join(parts)


def build_audio_filter(options: ClipRenderOptions | None, *, speed: float, duration: float):
    skip = select_expression(options, speed=speed, duration=duration)
    return f"aselect=not({skip}),asetpts=N/SR/TB" if skip else None


def select_expression(options: ClipRenderOptions | None, *, speed: float, duration: float) -> str:
    ranges = merged_skip_ranges(options, duration)
    return "+".join(
        f"between(t\\,{_number(start / speed)}\\,{_number(end / speed)})" for start, end in ranges
    )


def needs_subtitles(options: ClipRenderOptions | None) -> bool:
    return bool(options and (options.captions or options.titles))


# ---------------------------------------------------------------------------
# ASS generation
# ---------------------------------------------------------------------------


def ass_color(hex_color: str, alpha: int = 0) -> str:
    red, green, blue = hex_color[1:3], hex_color[3:5], hex_color[5:7]
    return f"&H{alpha:02X}{blue}{green}{red}".upper()


def ass_time(seconds: float) -> str:
    centis = max(0, round(seconds * 100))
    hours, rest = divmod(centis, 360000)
    minutes, rest = divmod(rest, 6000)
    secs, centis = divmod(rest, 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"


def ass_escape(text: str) -> str:
    """Neutralise characters that ASS treats as override syntax."""
    return text.replace("\\", "＼").replace("{", "｛").replace("}", "｝").replace("\r", "").strip()


def _normalise_token(word: str) -> str:
    return re.sub(r"[^\w]+", "", word.casefold())


def wrap_lines(words: list[str], max_chars: int) -> list[list[int]]:
    """Greedy word wrap returning word indexes for each line."""
    lines: list[list[int]] = []
    current: list[int] = []
    length = 0
    for index, word in enumerate(words):
        extra = len(word) + (1 if current else 0)
        if current and length + extra > max_chars:
            lines.append(current)
            current, length = [], 0
            extra = len(word)
        current.append(index)
        length += extra
    if current:
        lines.append(current)
    return lines


def _render_tokens(
    tokens: list[str],
    style: CaptionStyle,
    *,
    active: int | None = None,
) -> str:
    """Join tokens with explicit line breaks, colouring keywords and the active word."""
    keywords = {_normalise_token(item) for item in style.keywords if _normalise_token(item)}
    highlight = ass_color(style.highlight_color)
    base = ass_color(style.color)
    rendered_lines = []
    for line in _manual_line_groups(tokens, style.max_chars):
        pieces = []
        for index in line:
            token = ass_escape(tokens[index])
            if not token:
                continue
            emphasise = index == active or _normalise_token(tokens[index]) in keywords
            pieces.append(f"{{\\c{highlight}}}{token}{{\\c{base}}}" if emphasise else token)
        if pieces:
            rendered_lines.append(" ".join(pieces))
    return "\\N".join(rendered_lines)


def _manual_line_groups(tokens: list[str], max_chars: int) -> list[list[int]]:
    """Respect explicit line breaks (token "\\n") and wrap each block."""
    groups: list[list[int]] = []
    block: list[int] = []
    for index, token in enumerate(tokens):
        if token == "\n":
            groups.extend(_wrap_block(tokens, block, max_chars))
            block = []
        else:
            block.append(index)
    groups.extend(_wrap_block(tokens, block, max_chars))
    return groups


def _wrap_block(tokens: list[str], block: list[int], max_chars: int) -> list[list[int]]:
    if not block:
        return []
    return [[block[i] for i in line] for line in wrap_lines([tokens[i] for i in block], max_chars)]


def _tokenise(text: str, uppercase: bool) -> list[str]:
    value = text.upper() if uppercase else text
    tokens: list[str] = []
    for line_index, line in enumerate(value.replace("\r", "").split("\n")):
        if line_index:
            tokens.append("\n")
        tokens.extend(part for part in line.split() if part)
    return tokens


def caption_events(
    caption: RenderCaption, style: CaptionStyle, *, speed: float, duration: float
) -> list[str]:
    start = caption.start
    end = min(caption.end, duration)
    if end <= start:
        return []
    alignment = f"{{\\an{ALIGNMENT[caption.position]}}}"
    tokens = _tokenise(caption.text, style.uppercase)
    if not tokens:
        return []
    word_tokens = [token for token in tokens if token != "\n"]
    timed = [word for word in caption.words if word.end > start and word.start < end]
    if style.karaoke and timed and len(timed) == len(word_tokens):
        events = []
        token_index = [index for index, token in enumerate(tokens) if token != "\n"]
        first = max(start, timed[0].start)
        if first > start:
            events.append(_dialogue(start, first, alignment + _render_tokens(tokens, style), speed))
        for position, word in enumerate(timed):
            word_start = max(start, word.start)
            word_end = timed[position + 1].start if position + 1 < len(timed) else end
            word_end = min(end, max(word_end, word.end))
            if word_end <= word_start:
                continue
            text = _render_tokens(tokens, style, active=token_index[position])
            events.append(_dialogue(word_start, word_end, alignment + text, speed))
        return events
    return [_dialogue(start, end, alignment + _render_tokens(tokens, style), speed)]


def _dialogue(start: float, end: float, text: str, speed: float, style: str = "Caption") -> str:
    return f"Dialogue: 0,{ass_time(start / speed)},{ass_time(end / speed)},{style},,0,0,0,,{text}"


def build_ass(options: ClipRenderOptions, *, speed: float, duration: float) -> str:
    width, height = output_size(options)
    style = options.caption_style
    scale = width / 1080
    font_size = max(10, round(style.font_size * scale))
    margin_v = round(height * (0.14 if options.aspect == "9:16" else 0.08))
    margin_h = round(width * 0.06)
    border_style, outline, back = (
        (3, 8, ass_color("#000000", 0x60)) if style.box else (1, 4, "&H00000000")
    )
    caption_style = (
        f"Style: Caption,Arial,{font_size},{ass_color(style.color)},{ass_color(style.color)},"
        f"{ass_color(style.outline_color)},{back},-1,0,0,0,100,100,0,0,{border_style},"
        f"{outline},0,2,{margin_h},{margin_h},{margin_v},1"
    )
    title_style = (
        f"Style: Title,Arial,{round(font_size * 1.1)},"
        f"{ass_color('#FFFFFF')},{ass_color('#FFFFFF')},"
        f"{ass_color('#000000')},{ass_color('#000000', 0x40)},-1,0,0,0,100,100,0,0,3,10,0,8,"
        f"{margin_h},{margin_h},{round(height * 0.06)},1"
    )
    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {width}",
        f"PlayResY: {height}",
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        caption_style,
        title_style,
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for title in options.titles:
        end = min(title.end, duration)
        text = ass_escape(title.text).replace("\n", "\\N")
        if end > title.start and text:
            lines.append(_dialogue(title.start, end, text, speed, "Title"))
    for caption in sorted(options.captions, key=lambda item: item.start):
        lines.extend(caption_events(caption, style, speed=speed, duration=duration))
    return "\n".join(lines) + "\n"


def write_subtitles(
    options: ClipRenderOptions, directory: Path, *, speed: float, duration: float
) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / SUBTITLE_FILENAME
    path.write_text(build_ass(options, speed=speed, duration=duration), encoding="utf-8")
    return path
