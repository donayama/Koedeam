from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path


def convert(input_path: Path, output_path: Path, sample_rate: int, channels: int) -> int:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        print("ERROR: ffmpeg is not found on PATH.")
        return 2

    if not input_path.exists():
        print(f"ERROR: input file does not exist: {input_path}")
        return 2

    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(input_path),
        "-ac",
        str(channels),
        "-ar",
        str(sample_rate),
        "-c:a",
        "pcm_s16le",
        str(output_path),
    ]
    print("Running:", " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr)
        print("ERROR: conversion failed.")
        return proc.returncode

    print(f"OK: {input_path} -> {output_path}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert MP3 audio fixture to WAV for local tests")
    parser.add_argument("--input", required=True, help="Input mp3 path")
    parser.add_argument("--output", required=True, help="Output wav path")
    parser.add_argument("--sample-rate", type=int, default=16000, help="Output sample rate (default: 16000)")
    parser.add_argument("--channels", type=int, default=1, help="Output channels (default: 1)")
    args = parser.parse_args()

    return convert(
        input_path=Path(args.input),
        output_path=Path(args.output),
        sample_rate=args.sample_rate,
        channels=args.channels,
    )


if __name__ == "__main__":
    raise SystemExit(main())
