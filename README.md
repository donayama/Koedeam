# Koedeam（コエデアム）

無料で使える、声で編む草稿エディタです。  
`/` はLP、`/app/` はPWAエディタです。

## コンセプト

- 音声で思考を止めずに草稿化する
- 編集で整えてすぐ共有する
- 本文はサーバー保存しない

## No Server

本文・履歴・テンプレート・設定は端末内 `localStorage` のみを利用します。

- `koedeam.version`
- `koedeam.currentDraft`
- `koedeam.recentDrafts`
- `koedeam.templates`
- `koedeam.settings`

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

## 状態モデル

`UI = Primary x Input x System x Layout`

- `Primary`: `EDIT` / `SEARCH` / `MANAGE` / `CONFIG`
- `Input`: `VOICE_OFF` / `VOICE_APPEND` / `VOICE_LOCKED`
- `System`: `LOCAL` / `SAVING` / `OFFLINE` / `UPDATE_AVAILABLE` / `ERROR`
- `Layout`: `MOBILE` / `TABLET` / `DESKTOP`

## 入力可否ルール

- `VOICE_APPEND` のみ音声とタイピング同時許可
- `VOICE_LOCKED` は `Main Editor` を read-only
- `VOICE_LOCKED` 時は `beforeinput` / `paste` / `keydown` で編集を抑止
- `SEARCH` / `MANAGE` / `CONFIG` では編集優先度を下げ、必要に応じてキーボードを閉じる

## 端末別UI方針

- `MOBILE`: `Main Editor + 1パネル` の排他表示
- `TABLET/DESKTOP`: `Side Bar` 併用可。ただし文書操作優先時は編集抑止
- `Tool Bar`: 1行固定。溢れた機能は `Overflow Menu` へ退避
- iOS入力ズーム回避: `input/textarea/select` は 16px以上を保証
- Android戻る操作: 開いている `Dialog/Overlay/Side Bar/Edit Panel` を先に閉じてから離脱

## 音声入力

- `SpeechRecognition / webkitSpeechRecognition` 対応時のみ有効
- 非対応時はOSの音声入力キーボードを利用
- Web Speech APIはブラウザ実装により外部認識サービスを使う可能性あり

## 共有

- 優先順: `navigator.share` -> `navigator.clipboard.writeText` -> `execCommand('copy')`
- 共有ショートカット変数:
- `{text}`: 本文または選択範囲
- `{title}`: 先頭行
- `{prompt}`: `{text}` と同義

## ドキュメント管理

- `Document List` で複数ドキュメントを切替
- `Snapshot Panel` は現在ドキュメント単位で履歴を表示/復元
- 既存の古い履歴（`docId` なし）も互換表示

## PWA導線

### iOS
1. Safariで `/app/` を開く
2. 共有メニュー
3. 「ホーム画面に追加」

### Android
1. Chromeで `/app/` を開く
2. メニュー
3. 「アプリをインストール」または「ホーム画面に追加」

## 更新方式（B方式）

- `app/version.json` を `no-store` 取得して差分判定
- 差分時は `Update Banner` を表示
- 更新押下で `skipWaiting` -> `controllerchange` -> `reload`
- リリース時は `version.json` と `sw.js` のキャッシュ版を必ず更新

## データ初期化 / 強制リロード

- 設定の「その他」タブから実行
- 初期化: `localStorage` の下書き/履歴/テンプレ/設定をリセット
- 強制リロード: Service Worker解除 + Cache削除 + 再読み込み

## ローカル開発

```bash
python -m http.server 8000
```

`http://localhost:8000/` を開いて確認します。

## 検証チェックリスト

1. `MOBILE` 幅で `Tool Bar` が2段化しない
2. `MOBILE` で `Edit Panel` と `Side Bar` が同時展開しない
3. `VOICE_LOCKED` 時に編集入力が反映されない
4. IME変換中にショートカットが誤発火しない
5. `Update Banner` が `version.json` 差分で表示される
6. iOSで入力タップ時に自動ズームしない
