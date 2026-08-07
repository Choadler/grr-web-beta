"""Create optimized gallery variants without modifying the original R2 objects."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageOps


NPX = Path(r"C:\Program Files\nodejs\npx.cmd")
BUCKET = "grr-gallery"
DATABASE = "grr-scoring"


def run(*args: str, capture: bool = False) -> str:
    environment = os.environ.copy()
    environment["PATH"] = rf"C:\Program Files\nodejs;{environment.get('PATH', '')}"
    result = subprocess.run(
        [str(NPX), "wrangler@latest", *args],
        check=True,
        text=True,
        capture_output=capture,
        env=environment,
    )
    return result.stdout if capture else ""


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def make_variant(source: Path, destination: Path, bounds: tuple[int, int], quality: int) -> None:
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        if image.mode != "RGB":
            background = Image.new("RGB", image.size, "black")
            if "A" in image.getbands():
                background.paste(image, mask=image.getchannel("A"))
            else:
                background.paste(image.convert("RGB"))
            image = background
        else:
            image = image.copy()
        image.thumbnail(bounds, Image.Resampling.LANCZOS)
        image.save(destination, "WEBP", quality=quality, method=6)


def main() -> None:
    query = (
        "SELECT id,league,object_key,file_size FROM gallery_photos "
        "WHERE optimized_object_key IS NULL OR thumbnail_object_key IS NULL "
        "ORDER BY submitted_at;"
    )
    payload = json.loads(
        run(
            "d1",
            "execute",
            DATABASE,
            "--remote",
            "--json",
            "--command",
            query,
            capture=True,
        )
    )
    photos = payload[0]["results"]
    print(f"Backfilling {len(photos)} gallery photos.", flush=True)

    original_total = display_total = thumbnail_total = 0
    with tempfile.TemporaryDirectory(prefix="grr-gallery-backfill-") as temp_name:
        temp = Path(temp_name)
        for index, photo in enumerate(photos, start=1):
            photo_id = photo["id"]
            league = photo["league"]
            original_key = photo["object_key"]
            display_key = f"gallery/{league}/{photo_id}-display.webp"
            thumbnail_key = f"gallery/{league}/{photo_id}-thumbnail.webp"
            original = temp / f"{photo_id}-original"
            display = temp / f"{photo_id}-display.webp"
            thumbnail = temp / f"{photo_id}-thumbnail.webp"
            verified_display = temp / f"{photo_id}-display-verified.webp"
            verified_thumbnail = temp / f"{photo_id}-thumbnail-verified.webp"

            print(f"[{index}/{len(photos)}] {original_key}", flush=True)
            run("r2", "object", "get", f"{BUCKET}/{original_key}", "--remote", "--file", str(original))
            make_variant(original, display, (3840, 2160), 86)
            make_variant(original, thumbnail, (1200, 800), 78)

            run(
                "r2", "object", "put", f"{BUCKET}/{display_key}", "--remote", "--file", str(display),
                "--content-type", "image/webp", "--cache-control", "public, max-age=86400", "--force",
            )
            run(
                "r2", "object", "put", f"{BUCKET}/{thumbnail_key}", "--remote", "--file", str(thumbnail),
                "--content-type", "image/webp", "--cache-control", "public, max-age=86400", "--force",
            )
            run("r2", "object", "get", f"{BUCKET}/{display_key}", "--remote", "--file", str(verified_display))
            run("r2", "object", "get", f"{BUCKET}/{thumbnail_key}", "--remote", "--file", str(verified_thumbnail))
            if digest(display) != digest(verified_display) or digest(thumbnail) != digest(verified_thumbnail):
                raise RuntimeError(f"R2 verification failed for {photo_id}; database was not changed.")

            display_size = display.stat().st_size
            thumbnail_size = thumbnail.stat().st_size
            update = (
                "UPDATE gallery_photos SET "
                f"optimized_object_key={sql_literal(display_key)},optimized_file_size={display_size},"
                f"thumbnail_object_key={sql_literal(thumbnail_key)},thumbnail_file_size={thumbnail_size} "
                f"WHERE id={sql_literal(photo_id)} AND object_key={sql_literal(original_key)};"
            )
            run("d1", "execute", DATABASE, "--remote", "--command", update)
            original_total += int(photo["file_size"])
            display_total += display_size
            thumbnail_total += thumbnail_size

            for path in (original, display, thumbnail, verified_display, verified_thumbnail):
                path.unlink(missing_ok=True)

    print(
        "Complete: "
        f"originals={original_total / 1024 / 1024:.1f} MiB, "
        f"display={display_total / 1024 / 1024:.1f} MiB, "
        f"thumbnails={thumbnail_total / 1024 / 1024:.1f} MiB. "
        "Original objects were preserved.",
        flush=True,
    )


if __name__ == "__main__":
    main()
