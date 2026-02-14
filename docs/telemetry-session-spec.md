# Telemetry Session Spec v1.1

Top-level structure:

{
  "schema_version": "1.1",
  "app_version": "x.y.z",
  "session_id": "uuid",
  "started_at": "ISO8601",
  "ended_at": "ISO8601",
  "consent": {},
  "environment_tag": "...",
  "device": {},
  "capabilities": {},
  "settings": {},
  "events": [],
  "metrics": {}
}

Key points:
- No audio recording
- No automatic external transmission
- OS/Browser normalized fields required
