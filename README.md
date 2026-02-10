# Koedeam（コエデアム）
声で編む、草稿エディタ。音声で草稿を作り、編集で整え、共有するための軽量ツールです。

## 公開（GitHub Pages）
1. GitHubの Settings → Pages
2. Deploy from a branch
3. Branch: main / root
4. 公開URLの `/` がLP、`/app/` がエディタです

## 使い方
- LP: `/`
- Editor: `/app/`
- 本文は端末内（localStorage）に保存され、サーバー保存は行いません。

## PWA（ホーム画面に追加）
- `/app/` を開く
- iOS: 共有 → ホーム画面に追加
- Android: メニュー → アプリをインストール（またはホーム画面に追加）

## 重要な制約
- Web Speech API（ブラウザ内音声認識）は、ブラウザ実装により外部の認識サービスが使われる可能性があります。
  - 機密が気になる場合は OS の音声入力キーボードを利用してください。
- `navigator.share` や URLスキーム起動は端末・ブラウザ依存です。失敗時はコピー共有で代替します。

## ローカルデータ
- localStorage を使います。消す場合はブラウザのサイトデータを削除してください。
