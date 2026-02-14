# AGENTS.md

本リポジトリの実装・運用ガイドの正本は本ファイル（`AGENTS.md`）とする。

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

## 実装ガード（必須）

- `canType()` で入力可否を集中制御する
- `enforceKeyboardPolicy()` で `VOICE_LOCKED` / `MANAGE` / `CONFIG` / `Snapshot Panel` 時のキーボード抑止を維持する
- `canOpen()` で `Dialog` 表示中の `Menu/Search/Document List/Side Bar` 起動を抑止する
- `Dialog > Snapshot > Search` の優先順で背後操作を禁止する
- `MOBILE` では `Main Editor` に対して同時表示パネルを1つまでに制限する

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

## 変更時チェック

- `Tool Bar` が1行固定で、溢れ機能は `Overflow Menu` に退避されること
- `VOICE_LOCKED` で `beforeinput` / `paste` / `keydown` が抑止されること
- `Document List` / `Snapshot（Side Bar内履歴）` が現在ドキュメント単位で整合していること
- `version.json` 更新時に `Update Banner` 通知が出ること

## テスト観点（最低限）

1. `MOBILE` で `Tool Bar` が2段化しない
2. `MOBILE` で `Edit Panel` と `Side Bar` 同時表示が起きない
3. `VOICE_LOCKED` で編集イベントが反映されない
4. `Dialog` 表示中に `Menu/Search/Document List/Side Bar` を新規起動できない（`canOpen`）
5. `version.json` 差分で `Update Banner` が表示される
6. iOSで入力時ズームが発生しない（16px以上）
7. `Document List` の切替時に `currentDoc` と `Main Editor` が一致する
8. Android戻る操作で `Dialog/Overlay/Side Bar/Edit Panel` が先に閉じる

## Work Item 運用

このリポジトリでは GitHub Issue の代わりに、`docs/roadmap.md` の Work Item（WI）をタスク単位として扱う。

- 作業開始前に `docs/roadmap.md` から WI を1つ選ぶ
- WI が未選定の状態では実装に着手しない
- すべての出力（計画、コミット、PR）で `WI-ID`（例: `WI-101`）を明示する
- WI の選定誤りに気づいた場合は、無言で進めず停止して `WI-ID` の再マッピング案を提示する

## PR 記載ルール（必須）

すべての PR に以下を含める。

- `Implements: WI-xxx`
- `Type: implement | prepare | consider`
- `DoD:` 3〜7項目のチェックリスト
- `Test:` 手順または Playwright コマンド

## ブランチ/PR 運用

- 1 PR = 1 WI（関心ごとを混在させない）
- PR は常にマージ可能な最小差分を維持する
- 変更量の目安は可能なら 100〜250 行
- テスト専用の仕込みは feature flag または `testMode=1` で隔離する

## プロジェクト制約（運用面）

- Offline-first を維持し、自動外部テレメトリは導入しない
- Field Test データはローカル保存のみとし、明示的操作でのみエクスポートする
- 音声データ（生音声）は録音しない

## 優先テーマ（高レベル）

1. Dogfooding fixes（EPIC-1）
2. VoiceEngine thin abstraction（EPIC-1.5）
3. Field Test Mode + Replay + Playwright CI（EPIC-3/4/5）

## 実装方針

- Vanilla JS / CSS / HTML を優先
- 外部CDN・解析コード・広告コードは禁止
- 既存構成を壊さず差分で改修する

## 推奨作業手順

1. `docs/roadmap.md` を読み、対象 WI を1つ選ぶ
2. 関連仕様を `docs/` から確認する
3. 最小差分で実装し、必要テストを実行する
4. 挙動変更があればドキュメントを更新する
5. 上記ルールに従って PR 本文を作成する
