# AGENTS.md

本リポジトリの実装ガイドは `agent.md` を正本とする。  
AIエージェントは `agent.md` の規約に従って実装・更新を行うこと。

## 要点

- 公式UI用語を統一する
- 状態モデル `Primary/Input/System/Layout` で制御する
- `MOBILE` ではパネル同時表示を制限する
- `VOICE_LOCKED` では編集入力を禁止する
- 更新方式は `version.json + Service Worker` のB方式を使う
