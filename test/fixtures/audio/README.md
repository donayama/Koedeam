# Audio Fixtures (WAV/MP3)

This directory stores metadata and policy for optional audio fixtures used by replay/E2E tests.

## Directory policy

- Audio binaries (`.wav`, `.mp3`, etc.) are ignored by default via `.gitignore`.
- Keep fixture metadata in `fixtures.meta.json`.
- Canonical expected text is stored in `expected_text.txt` (single phrase policy).
- Do not commit large binaries directly. Use local/private artifact storage for heavy assets.

## License and OSS compliance

- Only add assets with explicit redistribution permission.
- Recommended licenses:
  - `CC0`
  - `CC-BY-4.0` (attribution required)
  - `MIT` / public-domain / commercial-use-allowed datasets
- For each fixture, include in metadata:
  - source provider
  - source URL (if available)
  - license
  - attribution

## File size guideline

- Do not commit large audio files to this repository.
- Suggested threshold for direct commit: <= 3 MB per file.
- Larger files should be fetched/generated locally or in private storage.

## Conversion (MP3 -> WAV)

Use the local tool:

```bash
python tools/convert_mp3_to_wav.py --input test/fixtures/audio/koedeam_phrase_01.mp3 --output test/fixtures/audio/converted/koedeam_phrase_01.wav
```

Requirements:

- `ffmpeg` must be available on `PATH`.

Default conversion parameters:

- mono (`1` channel)
- `16000 Hz`
- `PCM s16le`
