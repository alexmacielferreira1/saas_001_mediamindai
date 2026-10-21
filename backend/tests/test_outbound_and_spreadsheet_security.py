import csv
import io

import pytest
from app.clips.analysis import RemoteAnalysisAdapter
from app.clips.contracts import TranscriptSegment, TranscriptWord
from app.clips.transcription import RemoteTranscriptionAdapter, TranscriptionUnavailable
from app.core.config import Settings, get_settings
from app.security import outbound
from app.security.outbound import (
    OutboundUrlRejected,
    is_public_address,
    validate_outbound_url,
)
from app.security.outbound import resolve_host as real_resolve_host
from app.security.spreadsheet import neutralize_formula, rows_to_safe_csv, safe_csv_row
from pydantic import ValidationError


@pytest.mark.parametrize(
    "url",
    [
        "ftp://api.example.test/v1",
        "file:///etc/passwd",
        "gopher://api.example.test",
        "http://user:pass@api.example.test/v1",
        "http://127.0.0.1:11434/v1",
        "http://[::1]/v1",
        "http://[::ffff:127.0.0.1]/v1",
        "http://10.0.0.5/v1",
        "http://172.16.1.1/v1",
        "http://192.168.0.10/v1",
        "http://169.254.169.254/latest/meta-data/",
        "http://100.64.0.1/v1",
        "http://0.0.0.0/v1",
        "http://224.0.0.1/v1",
        "http://localhost:8000/v1",
        "http://api.localhost/v1",
        "http://metadata.google.internal/computeMetadata/v1/",
        "http://printer.local/v1",
        "http://api.example.test:99999/v1",
        "http:///v1",
    ],
)
def test_internal_or_unsafe_destinations_are_rejected(url):
    with pytest.raises(OutboundUrlRejected):
        validate_outbound_url(url)


def test_public_destination_is_allowed():
    assert validate_outbound_url("https://api.example.test/v1") == "https://api.example.test/v1"
    assert validate_outbound_url("https://8.8.8.8/v1") == "https://8.8.8.8/v1"


def test_hostname_resolving_to_private_address_is_rejected(monkeypatch):
    monkeypatch.setattr(outbound, "resolve_host", lambda host, port: ["93.184.216.34", "10.1.1.1"])

    with pytest.raises(OutboundUrlRejected):
        validate_outbound_url("https://rebind.example.test/v1")


def test_unresolvable_or_empty_resolution_fails_closed(monkeypatch):
    with pytest.raises(OutboundUrlRejected):
        validate_outbound_url("https://does-not-exist.example.com/v1")
    monkeypatch.setattr(outbound, "resolve_host", lambda host, port: [])
    with pytest.raises(OutboundUrlRejected):
        validate_outbound_url("https://empty.example.test/v1")


def test_resolve_host_returns_every_resolved_address(monkeypatch):
    monkeypatch.setattr(
        outbound.socket,
        "getaddrinfo",
        lambda host, port, type: [
            (2, 1, 6, "", ("93.184.216.34", port)),
            (10, 1, 6, "", ("::1", port, 0, 0)),
        ],
    )

    assert real_resolve_host("api.example.com", 443) == ["93.184.216.34", "::1"]


def test_ipv6_scoped_and_public_addresses():
    assert is_public_address("2606:4700:4700::1111")
    assert not is_public_address("fe80::1%eth0")


def test_private_networks_can_be_enabled_only_outside_production(monkeypatch):
    monkeypatch.setenv("OUTBOUND_ALLOW_PRIVATE_NETWORKS", "true")
    get_settings.cache_clear()
    try:
        assert validate_outbound_url("http://127.0.0.1:11434/v1")
        with pytest.raises(OutboundUrlRejected):
            validate_outbound_url("file:///etc/passwd")
    finally:
        monkeypatch.delenv("OUTBOUND_ALLOW_PRIVATE_NETWORKS")
        get_settings.cache_clear()

    with pytest.raises(ValidationError, match="OUTBOUND_ALLOW_PRIVATE_NETWORKS"):
        Settings(
            _env_file=None,
            environment="production",
            session_cookie_secure=True,
            frontend_url="https://mediamind.example.com",
            hub_admin_token="token",
            outbound_allow_private_networks=True,
        )


def segments():
    return [
        TranscriptSegment(
            start=0, end=1, text="oi", words=[TranscriptWord(start=0, end=1, text="oi")]
        )
    ]


def test_clip_analysis_never_calls_internal_ai_endpoint(monkeypatch):
    calls = []
    monkeypatch.setattr("app.clips.analysis.httpx.post", lambda *a, **k: calls.append(a))
    adapter = RemoteAnalysisAdapter(
        {"provider": "compatible", "base_url": "http://169.254.169.254/v1", "model": "m"},
        "secret-key",
    )

    with pytest.raises(TranscriptionUnavailable, match="não é permitido"):
        adapter.suggest(segments(), minimum=15, maximum=60)

    assert calls == []


def test_clip_transcription_never_calls_internal_ai_endpoint(monkeypatch, tmp_path):
    calls = []
    monkeypatch.setattr("app.clips.transcription.httpx.post", lambda *a, **k: calls.append(a))
    source = tmp_path / "media.mp4"
    source.write_bytes(b"0")
    adapter = RemoteTranscriptionAdapter(
        {"provider": "compatible", "base_url": "http://127.0.0.1:8000/v1"}, "secret-key"
    )

    with pytest.raises(TranscriptionUnavailable, match="não é permitido"):
        adapter.transcribe(source)

    assert calls == []


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ('=HYPERLINK("http://x")', '\'=HYPERLINK("http://x")'),
        ("+1+1", "'+1+1"),
        ("-2+3", "'-2+3"),
        ("@SUM(A1)", "'@SUM(A1)"),
        ("\tcmd", "'\tcmd"),
        ("\rcmd", "'\rcmd"),
        ("texto normal", "texto normal"),
        ("", ""),
        (12, 12),
        (-3.5, -3.5),
        (None, None),
    ],
)
def test_neutralize_formula(value, expected):
    assert neutralize_formula(value) == expected


def test_rows_to_safe_csv_neutralizes_every_cell():
    content = rows_to_safe_csv(
        ["model", "cost"],
        [{"model": "=cmd|'/c calc'!A0", "cost": 1.5, "ignored": "=x"}],
    )

    rows = list(csv.DictReader(io.StringIO(content)))
    assert rows == [{"model": "'=cmd|'/c calc'!A0", "cost": "1.5"}]
    assert safe_csv_row({"a": "@x"}) == {"a": "'@x"}
