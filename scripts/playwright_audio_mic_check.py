from __future__ import annotations

import argparse
import json
import math
import struct
import tempfile
import wave
from pathlib import Path
from typing import List
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


def make_sine_wav(path: Path, duration_ms: int = 1800, sample_rate: int = 16000) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    total = max(1, int(sample_rate * (duration_ms / 1000.0)))
    freq = 440.0
    amp = 0.18
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(total):
            val = int(32767 * amp * math.sin(2.0 * math.pi * freq * (i / sample_rate)))
            frames.extend(struct.pack("<h", val))
        wf.writeframes(bytes(frames))


def origin_of(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def run(base_url: str, wav_path: Path | None, timeout_ms: int, trace_path: Path, allow_no_recognition: bool) -> int:
    wav_local = wav_path
    temp_dir: tempfile.TemporaryDirectory[str] | None = None
    if wav_local is None:
        temp_dir = tempfile.TemporaryDirectory()
        wav_local = Path(temp_dir.name) / "fake_mic.wav"
        make_sine_wav(wav_local)

    failures: List[str] = []
    warnings: List[str] = []
    report = {
        "base_url": base_url,
        "wav": str(wav_local),
        "observed_titles": [],
        "observed_inputs": [],
        "mic_labels": [],
        "page_errors": [],
        "console_errors": [],
        "attempted_start": False,
        "progress_observed": False,
        "editor_changed": False,
        "initial_editor_value": "",
        "final_editor_value": "",
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                f"--use-file-for-fake-audio-capture={wav_local.resolve()}",
            ],
        )
        context = browser.new_context(viewport={"width": 1100, "height": 700})
        context.grant_permissions(["microphone"], origin=origin_of(base_url))
        context.tracing.start(screenshots=True, snapshots=True, sources=True)
        page = context.new_page()

        page.on("pageerror", lambda e: report["page_errors"].append(str(e)))
        page.on("console", lambda m: report["console_errors"].append(m.text) if m.type == "error" else None)

        page.goto(base_url, wait_until="networkidle")
        initial_value = page.evaluate("() => document.getElementById('editor')?.value || ''")
        report["initial_editor_value"] = initial_value
        page.click("#btnMic")

        steps = max(1, timeout_ms // 200)
        for _ in range(steps):
            snap = page.evaluate(
                """() => ({
                  title: document.getElementById('statusInput')?.title || '',
                  input: document.getElementById('statusInput')?.textContent || '',
                  mic: document.getElementById('btnMic')?.textContent || '',
                  value: document.getElementById('editor')?.value || ''
                })"""
            )
            report["observed_titles"].append(snap["title"])
            report["observed_inputs"].append(snap["input"])
            report["mic_labels"].append(snap["mic"])
            if "voice-session:PERMISSION_WAIT" in snap["title"]:
                report["attempted_start"] = True
            if (
                "voice-session:RUNNING" in snap["title"]
                or "voice-session:RESTART_WAIT" in snap["title"]
                or "VOICE:LOCKED" in snap["input"]
            ):
                report["progress_observed"] = True
            if snap["value"] != initial_value:
                report["editor_changed"] = True
            page.wait_for_timeout(200)

        report["final_editor_value"] = page.evaluate("() => document.getElementById('editor')?.value || ''")

        trace_path.parent.mkdir(parents=True, exist_ok=True)
        context.tracing.stop(path=str(trace_path))
        browser.close()

    if report["page_errors"]:
        failures.append("page error occurred")
    if not report["attempted_start"]:
        failures.append("voice start attempt was not observed (PERMISSION_WAIT missing)")
    recognition_observed = bool(report["progress_observed"] or report["editor_changed"])
    if not recognition_observed:
        msg = "recognition evidence not observed (RUNNING/LOCKED or editor change missing)"
        if allow_no_recognition:
            warnings.append(msg)
        else:
            failures.append(msg)

    print("== Playwright Audio Mic Check (Chromium optional) ==")
    print(json.dumps(report, ensure_ascii=True))
    print(f"trace: {trace_path}")
    if warnings:
        print("Warnings:")
        for w in warnings:
            print(f"- {w}")
    if failures:
        print("Failures:")
        for f in failures:
            print(f"- {f}")
        if temp_dir:
            temp_dir.cleanup()
        return 1

    print("PASS: fake microphone input did not crash and voice flow started.")
    if temp_dir:
        temp_dir.cleanup()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Optional Chromium fake-microphone WAV check")
    parser.add_argument("--url", default="http://localhost:8000/app/", help="App URL")
    parser.add_argument("--wav", default="", help="WAV file path for fake microphone (optional)")
    parser.add_argument("--timeout-ms", type=int, default=5000, help="Observation timeout in ms")
    parser.add_argument(
        "--allow-no-recognition",
        action="store_true",
        help="Do not fail even if recognition evidence is not observed (flaky fallback).",
    )
    parser.add_argument(
        "--trace-path",
        default="artifacts/traces/audio_mic_check_trace.zip",
        help="Playwright trace output path",
    )
    args = parser.parse_args()
    wav = Path(args.wav) if args.wav else None
    return run(args.url, wav, args.timeout_ms, Path(args.trace_path), args.allow_no_recognition)


if __name__ == "__main__":
    raise SystemExit(main())
