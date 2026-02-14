# Telemetry 計測方針（Block 0）

## 目的

音声入力の品質改善を定量化するため、Block 5 で実装する計測ログの仕様を先に固定する。

## 方針

- 計測対象は音声関連イベントと応答速度メトリクスに限定する
- 収集先はローカル（ブラウザ内）とし、外部送信は行わない
- 出力はユーザー操作でのみ実行（JSON/CSV ダウンロード or クリップボードコピー）
- 本ドキュメントは設計のみ。実装は Block 5 で行う

## イベントログ定義（必須）

| event | 説明 | 必須フィールド |
|---|---|---|
| `voice.onstart` | 音声認識開始 | `ts`, `sessionId`, `inputState` |
| `voice.onresult.interim` | interim 受信 | `ts`, `sessionId`, `charLen`, `resultIndex` |
| `voice.onresult.final` | final 受信 | `ts`, `sessionId`, `charLen`, `resultIndex` |
| `voice.onerror` | エラー発生 | `ts`, `sessionId`, `error`, `message?` |
| `voice.onend` | 音声認識終了 | `ts`, `sessionId`, `reason?` |
| `voice.restart.scheduled` | 再開待ちへ遷移 | `ts`, `sessionId`, `delayMs`, `cause` |
| `voice.restart.started` | 再開実行 | `ts`, `sessionId`, `attempt` |

### 共通フィールド

- `ts`: ISO 8601 文字列
- `sessionId`: 音声セッション識別子（UUID または連番）
- `docId`: 現在ドキュメントID（取得可能な場合）
- `layout`: `MOBILE` / `TABLET` / `DESKTOP`
- `primaryState`: `EDIT` / `SEARCH` / `MANAGE` / `CONFIG`
- `inputState`: `VOICE_OFF` / `VOICE_APPEND` / `VOICE_LOCKED`

## 速度メトリクス定義（必須）

| metric | 定義 | 単位 |
|---|---|---|
| `t_start_to_first_interim_ms` | 発話開始（onstart）→ 初回interim | ms |
| `t_start_to_first_final_ms` | 発話開始（onstart）→ 初回final | ms |
| `session_duration_ms` | onstart → onend | ms |
| `restart_delay_actual_ms` | 再開待ち開始 → 再 start 実行 | ms |

## データ保持ポリシー

- 一時保持件数: 直近 200 セッション（目安）
- セッション単位でローテーション
- 破損データは破棄せず `invalid: true` で保持（解析時に除外）

## 出力フォーマット案

### JSON

```json
{
  "version": 1,
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "sessions": [],
  "events": [],
  "metrics": []
}
```

### CSV（最小）

- `events.csv`: `ts,sessionId,event,error,charLen,resultIndex,...`
- `metrics.csv`: `sessionId,t_start_to_first_interim_ms,t_start_to_first_final_ms,session_duration_ms,...`

## プライバシー境界

- 生音声データは保存しない
- 必要最小限として文字数や所要時間のみ収集
- テキスト本文を保存する場合は既定で無効（将来オプトインが必要）

## Block 5 実装チェックポイント

- `onstart/onresult/onerror/onend` が欠損なく記録される
- 速度メトリクスの算出タイミングが一貫している
- JSON または CSV を UI から確実に出力できる
- 既存 UI（`Tool Bar` / `Main Editor`）のレイアウトを崩さない
