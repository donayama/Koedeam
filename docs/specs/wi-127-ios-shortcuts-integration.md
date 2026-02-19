# WI-127 iOS Shortcuts Integration Examples (Consider)

## Scope
- WI-ID: `WI-127`
- Type: `consider`
- Goal: Koedeam (PWA/No Server) と iOS Shortcuts の実用的な連携例を定義する
- Non-Goal: iOS ネイティブアプリ実装、サーバ追加、複雑な双方向同期

## Current Fit (Koedeam)
- Koedeam は本文を `localStorage` に保持し、共有は `Web Share` / `Clipboard` / URL テンプレート中心。
- iOS では Shortcuts 側で「Share Sheet入力」または `shortcuts://` URL 起動を使うのが現実的。

## Candidate Patterns

### Pattern A: Share Sheet -> Shortcuts -> 送信先アプリ
- Flow:
1. Koedeam で共有またはコピー
2. iOS Share Sheet からショートカット実行
3. ショートカット内で整形して送信先アプリを開く
- Use cases:
1. 「日報化してメモに追記」
2. 「Discord/LINE 形式に整形」
3. 「タイトル付与して保存」
- Notes:
1. Shortcuts 側の `Show in Share Sheet` 有効化が前提
2. 入力型は `Text`/`URLs` などに制限して誤表示を減らす

### Pattern B: Koedeam -> `shortcuts://run-shortcut` 起動
- Flow:
1. Koedeam の共有URLテンプレートから `shortcuts://run-shortcut?...` を開く
2. `input=text` または `input=clipboard` でショートカットへ引き渡す
- Use cases:
1. ワンタップで特定ショートカットに本文を渡す
2. 「クリップボード連携」運用の固定化
- Notes:
1. URLエンコードが必須
2. ショートカット名変更でリンクが壊れるため運用注意

### Pattern C: `x-callback-url` で結果を返す
- Flow:
1. `shortcuts://x-callback-url/run-shortcut?...&x-success=...`
2. 成功時に `result` を付けてコールバック
- Use cases:
1. 外部ショートカット処理結果の受け取り
2. 段階的なワークフロー
- Notes:
1. PWA側で戻り結果を確実に処理するには追加設計が必要
2. 本WIでは実装対象外（検討止まり）

### Pattern D: Safari「Run JavaScript on Webpage」補助
- Flow:
1. Safariでページ上からショートカットを実行
2. JavaScriptでページ情報を取得・加工して後続アクションへ渡す
- Use cases:
1. Webページメモ化の補助
- Notes:
1. `Allow Running Scripts` が必要
2. Koedeam本体への依存を増やさない方針で限定利用

## Recommended Package (Low Risk)
1. Pattern A を公式例の第一候補にする
2. Pattern B を「上級者向けテンプレート」として併記する
3. Pattern C/D は将来拡張枠として注記のみ

## Draft Shortcut Recipes

### Recipe 1: 共有テキストを定型化してコピー
- Input: `Text`
- Steps:
1. `Receive` で Text を受ける
2. 先頭に日付/タグを付与
3. `Copy to Clipboard`

### Recipe 2: 共有テキストを LINE へ送る
- Input: `Text`
- Steps:
1. Text を受ける
2. 必要なら文字数を丸める
3. `Open URLs` で LINE 共有用URLへ遷移

### Recipe 3: `shortcuts://run-shortcut` 受け口
- Input: `Text` または `Clipboard`
- Steps:
1. 受けた入力を整形
2. メモ/リマインダー/他アプリへ引き渡し

## Risks / Constraints
1. URL scheme は可読性・保守性が低く、デバッグ難度が高い
2. iOS バージョンやアプリ実装差で挙動が変わる可能性
3. Share Sheet の入力型設定が緩いとショートカットが不要な場所にも出る

## DoD (consider)
1. Koedeam向けの連携パターンを A-D で分類できる
2. 低リスク推奨パッケージが定義されている
3. 最低3つの再現可能レシピが記載されている

## Test Plan (manual)
1. iOS Safari で Koedeam の共有操作から Shortcuts 実行できる
2. 入力型を `Text` 限定したショートカットが Safari 共有で表示される
3. `shortcuts://run-shortcut` で `input=text` と `input=clipboard` の両方が通る

## References (primary)
- Run a shortcut using a URL scheme on iPhone or iPad (Apple):
  - https://support.apple.com/en-lamr/guide/shortcuts/apd624386f42/ios
- Use x-callback-url with Shortcuts on iPhone or iPad (Apple):
  - https://support.apple.com/guide/shortcuts/use-x-callback-url-apdcd7f20a6f/ios
- Launch a shortcut from another app on iPhone or iPad (Apple):
  - https://support.apple.com/en-bh/guide/shortcuts/apd163eb9f95/ios
- Understanding input types in Shortcuts on iPhone or iPad (Apple):
  - https://support.apple.com/en-asia/guide/shortcuts/apd7644168e1/ios
- Limit the input for a shortcut on iPhone or iPad (Apple):
  - https://support.apple.com/guide/shortcuts/limit-the-input-for-a-shortcut-apd8195f96d6/ios
- Use another app’s URL scheme in Shortcuts on iPhone or iPad (Apple):
  - https://support.apple.com/en-is/guide/shortcuts/apd68802640c/ios
- Use the Run JavaScript on Webpage action in Shortcuts on iPhone or iPad (Apple):
  - https://support.apple.com/en-lamr/guide/shortcuts/apdb71a01d93/ios
