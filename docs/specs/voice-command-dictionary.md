# WI-111 Voice Command Dictionary

Implements: `WI-111`

## Purpose
`voiceMode=command` 中に、音声認識の最終結果をローカル辞書で照合し、対応する編集操作を実行する。

## Matching Policy
- 完全一致ベース（同義語は辞書側で吸収）
- 正規化:
  - 前後空白を削除
  - 半角/全角スペースを除去
  - 句読点・記号を除去: `、。,.!！?？`
- 非一致時:
  - 本文には挿入しない
  - `コマンド一致なし` を表示

## Command Dictionary

### Tool Bar / Panel
| Action | Phrases |
|---|---|
| `openSearch` | `検索`, `検索する` |
| `openReplace` | `置換`, `置き換え` |
| `openTemplates` | `テンプレート`, `テンプレ` |
| `openShare` | `共有`, `共有する` |
| `openHistory` | `履歴`, `履歴を開く`, `スナップショット`, `スナップショットを開く` |
| `openDocuments` | `文書一覧`, `文書一覧を開く`, `ドキュメント一覧`, `ドキュメント一覧を開く` |
| `openEditPanel` | `編集パネル`, `編集パネルを開く`, `編集を開く` |
| `closeEditPanel` | `編集パネルを閉じる`, `編集を閉じる` |
| `openSettings` | `設定`, `設定を開く` |
| `openHelp` | `ヘルプ`, `ヘルプを開く` |
| `closeUi` | `閉じる`, `戻る`, `キャンセル` |
| `saveSnapshot` | `スナップショット保存`, `履歴保存` |
| `createDocument` | `新規ドキュメント`, `新規文書` |

### End Command Mode
| Action | Phrases |
|---|---|
| `stopCommandMode` | `終わり`, `中止`, `コマンド終了`, `コマンド終わり` |
| `stopVoiceInput` | `停止`, `音声停止`, `音声を止める`, `音声止めて`, `止めて` |

### Edit Actions
| Action | Phrases |
|---|---|
| `cutSelection` | `切り取る`, `切り取り`, `切り取って`, `カット`, `カットして` |
| `copySelection` | `コピー`, `複写` |
| `pasteClipboard` | `貼り付け`, `ペースト` |
| `undo` | `元に戻す`, `取り消し`, `アンドゥ`, `戻す` |
| `redo` | `やり直し`, `リドゥ` |
| `deleteBackward` | `バックスペース`, `一文字削除`, `1文字削除` |
| `deleteForward` | `デリート`, `削除`, `前方削除` |
| `insertComma` | `読点`, `カンマ`, `てん` |
| `insertPeriod` | `句点`, `ピリオド`, `まる` |
| `insertNewline` | `改行`, `改行する` |
| `selectLine` | `行選択` |
| `selectParagraph` | `段落選択` |
| `selectAll` | `全選択` |
| `clearSelection` | `選択解除`, `解除` |
| `selectToLineStart` | `行頭まで選択` |
| `selectToLineEnd` | `行末まで選択` |
| `selectToDocStart` | `最初まで選択` |
| `selectToDocEnd` | `最後まで選択` |
| `expandSelectionUp` | `上に拡張`, `選択を上に拡張` |
| `expandSelectionDown` | `下に拡張`, `選択を下に拡張` |
| `shrinkSelectionUp` | `上を縮小`, `選択を上に縮小` |
| `shrinkSelectionDown` | `下を縮小`, `選択を下に縮小` |
| `moveParagraphPrev` | `前の段落`, `段落を上へ` |
| `moveParagraphNext` | `次の段落`, `段落を下へ` |
| `moveLineStart` | `行頭へ`, `行頭に移動` |
| `moveLineEnd` | `行末へ`, `行末に移動` |
| `moveDocStart` | `文頭へ`, `最初へ移動` |
| `moveDocEnd` | `文末へ`, `最後へ移動` |
| `moveUp` | `上へ`, `上に移動` |
| `moveDown` | `下へ`, `下に移動` |
| `moveLeft` | `左へ`, `左に移動` |
| `moveRight` | `右へ`, `右に移動` |
| `deleteToLineStart` | `行頭まで削除`, `行頭まで消す` |
| `deleteToLineEnd` | `行末まで削除`, `行末まで消す` |
| `deleteLine` | `行削除`, `行を消す` |
| `deleteParagraph` | `段落削除`, `段落を消す` |

### Time Menu Actions
| Action | Phrases |
|---|---|
| `insertTodayToken` | `今日を挿入`, `今日トークン` |
| `insertNowToken` | `今を挿入`, `今トークン` |
| `insertDatetimeToken` | `日時を挿入`, `日時トークン` |
| `expandTodayToken` | `日付に展開`, `今日を展開` |
| `expandNowToken` | `時刻に展開`, `今を展開` |
| `expandDatetimeToken` | `日時に展開`, `日時を展開` |

## Scope Guard
- 画面前提の操作のみ許可する
- `openShare` / `openTemplates` はダイアログ/パネル表示まで
- 共有先選択やテンプレ選択などの自動実行は行わない

## Extension Note
- 現段階はローカル辞書の力技で運用する
- 将来的に `kuromoji.js` などの形態素解析を導入する場合も、まずはこの Action 契約を維持したまま同義語解釈だけを強化する
