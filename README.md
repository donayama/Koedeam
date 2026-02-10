# Koedeam（コエデアム）

声で編む、草稿エディタ。音声で草稿を作り、編集で整え、共有するための軽量ツールです。

- LP: `/`
- エディタ本体（PWA）: `/app/`

## No Server ポリシー

Koedeam は**本文をサーバー保存しません**。草稿・履歴・テンプレ・設定は端末内の `localStorage` のみを利用します。

使用キー:

- `koedeam.version`
- `koedeam.currentDraft`
- `koedeam.recentDrafts`
- `koedeam.templates`
- `koedeam.settings`

## GitHub Pages 公開手順

1. GitHub リポジトリを開く
2. `Settings` → `Pages`
3. `Build and deployment` を `Deploy from a branch` に設定
4. Branch を `main` / `/ (root)` に設定して保存
5. 公開後、`/` が LP、`/app/` がエディタとして利用可能

> すべて相対パス構成のため、Pages サブパス配下でも動作します。

## 主要機能

- 音声入力（Web Speech API 対応環境）
- 検索/置換（前へ・次へ・置換・次を置換して次へ・全置換・選択範囲置換、大小文字/正規表現）
- 編集補助（行/段落選択、行頭/行末移動、上下移動、選択拡張/縮小）
- 音声挿入モード切替（末尾/カーソル/選択範囲）
- 自動保存（800ms デバウンス）
- 履歴（最大5件）スナップショット保存・復元・自動スナップショット
- テンプレ管理（定番プロンプト同梱・追加・編集・削除・適用）
- 共有（Share API → Clipboard API → `execCommand('copy')` フォールバック、ショートカット編集/追加）
- フォーカスモード
- PWA（`/app/`）

## Web Speech API の注意

Web Speech API（`SpeechRecognition` / `webkitSpeechRecognition`）は、ブラウザ実装により外部認識サービスが利用される可能性があります。

- この挙動はアプリ側から送信先を制御できません
- 機密情報の音声入力は避けてください
- 非対応ブラウザでは OS の音声入力キーボードを使用してください

## 共有・URLスキーム制約

- `navigator.share` は端末・ブラウザ対応に依存
- `navigator.clipboard` は HTTPS / 権限条件に依存
- `mailto:` `line://` `https://chatgpt.com/` `https://gemini.google.com/app` などの起動は環境依存
- ChatGPT/Gemini 向けのショートカットは、アプリがインストールされていれば起動する場合があります
- URL パラメータによる本文の自動入力は環境/仕様差で効かないことがあります（うまく動かない場合は URL を編集・またはコピー共有を利用）
- 一部サービスでは、本文の自動入力にブラウザ拡張が必要な場合があります
- 起動失敗時はコピーでの共有導線を利用

## PWA とホーム画面追加

### iOS
1. Safari で `/app/` を開く
2. 共有メニュー
3. 「ホーム画面に追加」

### Android
1. Chrome で `/app/` を開く
2. メニュー
3. 「アプリをインストール」または「ホーム画面に追加」

## localStorage データを削除する方法

- ブラウザ設定の「サイトデータ削除」から対象サイトを削除
- または DevTools の Application/Storage から `localStorage` を削除

## ローカル開発

```bash
python -m http.server 8000
```

その後、`http://localhost:8000/` を開いて確認します。
