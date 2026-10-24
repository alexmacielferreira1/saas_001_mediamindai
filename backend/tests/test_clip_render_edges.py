from app.media import clip_render


def options(**values):
    return clip_render.parse_render_options({"clip_render": values})


def dialogues(value, *, duration=10, speed=1):
    ass = clip_render.build_ass(value, speed=speed, duration=duration)
    return [line for line in ass.splitlines() if line.startswith("Dialogue")]


def test_captions_and_titles_outside_the_clip_or_blank_are_not_rendered():
    value = options(
        captions=[
            {"start": 12, "end": 14, "text": "depois do fim"},
            {"start": 1, "end": 2, "text": "   "},
            {"start": 2, "end": 3, "text": "visível"},
        ],
        titles=[
            {"start": 11, "end": 13, "text": "título fora"},
            {"start": 0, "end": 2, "text": "{}"},
        ],
    )

    lines = dialogues(value)

    assert len(lines) == 2
    assert lines[0].endswith("Title,,0,0,0,,｛｝")
    assert "visível" in lines[1]
    assert "depois do fim" not in "\n".join(lines)
    assert "título fora" not in "\n".join(lines)


def test_karaoke_starting_on_first_word_has_no_lead_in_event():
    value = options(
        captions=[
            {
                "start": 0,
                "end": 2,
                "text": "Olá mundo",
                "words": [
                    {"start": 0, "end": 0.8, "text": "Olá"},
                    {"start": 1.0, "end": 1.8, "text": "mundo"},
                ],
            }
        ],
        caption_style={"karaoke": True},
    )

    lines = dialogues(value)

    assert len(lines) == 2
    assert lines[0].startswith("Dialogue: 0,0:00:00.00,0:00:01.00")
    assert lines[1].startswith("Dialogue: 0,0:00:01.00,0:00:02.00")


def test_blank_lines_in_caption_text_do_not_create_empty_rows():
    value = options(captions=[{"start": 0, "end": 2, "text": "um\n\ndois"}])

    assert dialogues(value)[0].endswith("um\\Ndois")


def test_wrap_lines_of_no_words_is_empty():
    assert clip_render.wrap_lines([], 10) == []


def test_defensive_guards_ignore_ranges_and_tokens_that_bypass_validation():
    # Valores montados sem validação (model_construct) não podem gerar filtro ou evento vazio.
    degenerate = clip_render.TimedRange.model_construct(start=4.0, end=4.0)
    value = clip_render.ClipRenderOptions.model_construct(skip=[degenerate])
    assert clip_render.merged_skip_ranges(value, 10) == []

    style = clip_render.CaptionStyle()
    assert clip_render._render_tokens(["", "\n", ""], style) == ""

    # Palavra com fim antes do início (só possível sem validação) não gera evento próprio.
    caption = clip_render.RenderCaption.model_construct(
        start=0.0,
        end=2.0,
        text="a b",
        position="bottom",
        words=[
            clip_render.RenderWord.model_construct(start=1.5, end=1.0, text="a"),
            clip_render.RenderWord.model_construct(start=0.2, end=0.3, text="b"),
        ],
    )
    karaoke = clip_render.CaptionStyle(karaoke=True)
    events = clip_render.caption_events(caption, karaoke, speed=1, duration=10)
    assert len(events) == 2
    assert events[0].startswith("Dialogue: 0,0:00:00.00,0:00:01.50")
    assert events[1].startswith("Dialogue: 0,0:00:00.20,0:00:02.00")
