from hashlib import sha256
from pathlib import Path
from uuid import uuid4

import pytest
from app.core.errors import PublicError
from app.creative.storage import store_creative_export
from app.media.storage import LocalMediaStorage


def test_derived_media_is_atomic_and_uses_only_the_filename(tmp_path):
    storage = LocalMediaStorage(tmp_path / "media")
    source = tmp_path / "source.bin"
    content = b"media" * 250000
    source.write_bytes(content)
    tenant, asset = uuid4(), uuid4()
    result = storage.save_derived(
        tenant, asset, source, filename="../export.bin", mime_type="application/octet-stream"
    )
    destination = storage.resolve(result.relative_key)
    assert destination.read_bytes() == content
    assert destination.name == "export.bin"
    assert result.size == len(content)
    assert result.sha256 == sha256(content).hexdigest()
    assert not list(storage.root.rglob("*.part"))
    storage.delete_asset(tenant, asset)
    assert not storage.asset_root(tenant, asset).exists()
    storage.delete_asset(tenant, asset)


def test_derived_media_failure_removes_incomplete_asset(tmp_path):
    storage = LocalMediaStorage(tmp_path / "media")
    storage.root.mkdir()
    tenant, asset = uuid4(), uuid4()
    with pytest.raises(FileNotFoundError):
        storage.save_derived(
            tenant, asset, tmp_path / "missing", filename="export.bin", mime_type="video/mp4"
        )
    assert list(storage.root.iterdir()) == []


def test_media_resolution_rejects_paths_outside_storage(tmp_path):
    storage = LocalMediaStorage(tmp_path / "media")
    for key in ("../private.txt", str(tmp_path / "private.txt"), "."):
        with pytest.raises(PublicError):
            storage.resolve_local(key)


def test_cleanup_preserves_nonempty_parent(tmp_path):
    root = tmp_path / "media"
    child = root / "asset"
    child.mkdir(parents=True)
    (child / "keep.txt").write_text("keep")
    LocalMediaStorage._remove_empty_parents(child, root)
    assert (child / "keep.txt").read_text() == "keep"


def test_creative_export_failure_cleans_temporary_file(tmp_path, monkeypatch):
    def fail_replace(self, target):
        raise OSError("simulated disk failure")

    monkeypatch.setattr(Path, "replace", fail_replace)
    tenant = uuid4()
    with pytest.raises(OSError, match="simulated disk failure"):
        store_creative_export(tmp_path, tenant, b"archive")
    assert list((tmp_path / str(tenant)).iterdir()) == []
