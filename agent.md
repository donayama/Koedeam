# agent.md

## Project

Koedeam は Voice First の草稿エディタ。  
No Server / Static / PWA 前提で運用する。

## 公式UI用語

- `App Header`
- `Status Indicator`
- `Tool Bar`
- `Main Editor`
- `Voice Panel`
- `Edit Panel`
- `Side Bar`
- `Search Panel`
- `Snapshot Panel`
- `Overflow Menu`
- `Update Banner`

コード・コメント・Issue・ドキュメントではこの名称を使う。

## 状態モデル

`UI = Primary x Input x System x Layout`

- `Primary`: `EDIT` / `SEARCH` / `MANAGE` / `CONFIG`
- `Input`: `VOICE_OFF` / `VOICE_APPEND` / `VOICE_LOCKED`
- `System`: `LOCAL` / `SAVING` / `OFFLINE` / `UPDATE_AVAILABLE` / `ERROR`
- `Layout`: `MOBILE` / `TABLET` / `DESKTOP`

状態遷移は `app/app.js` で集中管理する。

## 禁止ルール

- `VOICE_LOCKED` では編集不可（read-only + beforeinput/paste/keydown 抑止）
- `SEARCH` 表示中に `Edit Panel` と `Side Bar` を同時展開しない
- `MOBILE` では `Main Editor` に対して同時表示パネルを1つまでに制限
- `Dialog` 表示中の背後操作を許可しない

## レイヤー規約

- `L1`: Main Editor
- `L2`: Edit Panel / Voice Panel
- `L3`: Side Bar
- `L4`: Search/Snapshot/Dialog Overlay
- `L5`: OS Keyboard

キーボードは最上位災害要因として扱う。下部UIは潰さず縮退/退避する。

## ツールバー規約

- 1行固定
- 優先機能のみ常時表示
- 溢れた機能は `Overflow Menu` に自動退避

## 更新方式（B方式）

- `app/version.json` を `no-store` で取得
- 差分時に `Update Banner` 表示
- ユーザー承認で `skipWaiting -> controllerchange -> reload`
- リリース時は `version.json` と `app/sw.js` の版を同時更新

## データ規約

- 本文や履歴は `localStorage` のみ
- 壊れたJSONは `.broken` に退避してフォールバック
- 互換破壊時は `koedeam.version` でマイグレーション

## テスト観点（最低限）

1. `MOBILE` で `Tool Bar` が2段化しない
2. `MOBILE` で `Edit Panel` と `Side Bar` 同時表示が起きない
3. `VOICE_LOCKED` で編集イベントが反映されない
4. `version.json` 差分で `Update Banner` が表示される
5. iOSで入力時ズームが発生しない（16px以上）

## 実装方針

- Vanilla JS / CSS / HTML を優先
- 外部CDN・解析コード・広告コードは禁止
- 既存構成を壊さず差分で改修する
