# Telemetry 実装確認メモ（Block 5）

## 仕様

- 音声イベント `onstart/onresult/onerror/onend` を記録する。
- 速度メトリクスを session 単位で算出する。
- Edit モードから JSON をエクスポートできる。
- クリップボードコピーでも JSON を取得できる。

## 手動チェック

1. 音声入力を開始・停止して Telemetry JSON を出力する。
2. `events` に `voice.onstart` / `voice.onend` が含まれる。
3. `events` に `voice.onresult.*` と `voice.onerror` が条件に応じて含まれる。
4. `metrics` に `t_start_to_first_interim_ms` / `t_start_to_first_final_ms` / `session_duration_ms` が出る。
5. `Telemetry Copy` で JSON をクリップボードにコピーできる。
