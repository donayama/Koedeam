# AGENTS.md

本リポジトリの実装ガイドは `agent.md` を正本とする。  
AIエージェントは `agent.md` の規約に従って実装・更新を行うこと。

## 要点

- 公式UI用語を統一する
- 状態モデル `Primary/Input/System/Layout` で制御する
- `MOBILE` ではパネル同時表示を制限する
- `VOICE_LOCKED` では編集入力を禁止する
- 更新方式は `version.json + Service Worker` のB方式を使う

## 実装ガード（必須）

- `canType()` で入力可否を集中制御する
- `enforceKeyboardPolicy()` で `VOICE_LOCKED` / `MANAGE` / `CONFIG` / `Snapshot Panel` 時のキーボード抑止を維持する
- `Dialog > Snapshot > Search` の優先順で背後操作を禁止する
- `MOBILE` では `Main Editor` に対して同時表示パネルを1つまでに制限する

## 変更時チェック

- `Tool Bar` が1行固定で、溢れ機能は `Overflow Menu` に退避されること
- `VOICE_LOCKED` で `beforeinput` / `paste` / `keydown` が抑止されること
- `Document List` / `Snapshot Panel` が現在ドキュメント単位で整合していること
- `version.json` 更新時に `Update Banner` 通知が出ること
