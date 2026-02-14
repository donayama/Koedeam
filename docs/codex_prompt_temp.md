# Codex指示プロンプト（Koedeam 改修：状態遷移・UIレイヤー・端末差・ドキュメント更新まで含む完全版）

あなたはKoedeamリポジトリに対して、iPhone/iPadでの評価結果と、それに基づくAndroid/PCでの懸念、さらにUIパーツ命名と表示状態遷移（状態機械）を統合し、アプリ/LP/ドキュメント（README.md / AGENTS.md）まで一貫して改修するエンジニアです。以下を“仕様として固定”し、破綻のない状態遷移とUI相互排他を実装してください。曖昧な解釈は避け、実装・ドキュメント・テストをセットで納品してください。

---

## 0. 目的（Must）
Koedeamは「思考を止めない音声×編集ツール」。UIは“画面遷移”ではなく“状態遷移”で制御し、端末差（iPhone/iPad/Android/PC）でも破綻しないこと。
特に以下の事故をゼロにする：
- パネル重なりで何も見えない
- キーボード出現でUIが潰れる・状態が分からない
- 音声入力とタイピングの競合で意図しない挿入/置換が起きる
- iPhone縦でツールバーが2段化して邪魔
- iOSの入力タップで自動ズームが発生
- Overlay（検索/履歴/ダイアログ）と音声/サイドバーが同居して迷子

---

## 1. iPhone/iPad所感からの必須改善（Must）
### 1.1 ライトモード崩れ
- ライトモードで差分/変化部表示が崩れる問題を修正（ダーク/ライト両対応を保証）

### 1.2 ツールバー
- iPhone縦で「ボタン4つでも2段」になる問題を必ず解消
- Tool Barは常に1行固定、溢れた機能は Overflow Menu（…）へ退避（priority制御）

### 1.3 iOS入力時ズーム
- 文字サイズ小時に入力タップで拡大される問題を解消
- input/textarea等のフォントサイズはiOS自動ズーム回避（>=16px）を保証

### 1.4 パネル重なり（iPhone縦でカオス）
- 編集パネル＋サイドバー＋本文＋その他が同時表示で破綻する問題を排他/同調ルールで必ず潰す
- MOBILE（狭幅）では本文+1パネルの排他を徹底

### 1.5 状態表示の位置
- 「保存」「タイピング」「音声」等の状態は“下”ではなく上部（App HeaderのStatus Indicator）で常時可視化

### 1.6 PWA導線（iOS）
- ヘルプ内に「ホーム画面に追加」導線（共有→ホームに追加）を明記、可能ならiOS検出時に専用ガイドUIを表示

### 1.7 編集機能の整理
- 操作を「常設（止めない）」「選択式（集中）」に分離
- 常設系：カーソル/移動/行頭行末/文頭文末/行頭まで削除/行末まで削除
- 選択系：整形、検索、履歴/スナップショット、設定、ヘルプ等
- 編集パネルはタブ化/密度切替（アイコンのみ/ラベルあり）を可能にする

### 1.8 音声入力の主導
- 音声ON/OFFと挿入位置（特に文末追記）はメイン画面から直接操作できるべき
- 音声入力UIは最下部配置が有力だが、キーボード（L5）で潰れるため最終配置は状態モデルに従って調整すること

---

## 2. Android/PCでの懸念（Must）
### 2.1 Android
- 端末/キーボード差でキーボード出現時のビューポート挙動が崩れやすい：下部固定UIは必ず再配置/最小化
- システム戻る（Back）は「開いてるパネル/Overlayを閉じる→EDITへ戻る→離脱」の順で処理

### 2.2 PC
- ウィンドウ狭幅/分割でモバイル同様の破綻が再発する：幅でLayout Stateを切替（狭幅はMOBILEモードへ）
- 物理キーボード/IME中のショートカット競合（composition中の誤発火）に注意

---

## 3. UIパーツ命名（Must：公式用語）
以下を公式用語としてコード/README/AGENTS/Issue/コメントで統一する。曖昧語は禁止。

- App Header（最上部固定領域）
- Status Indicator（Header内の状態表示）
- Tool Bar（主要ボタン帯、1行固定）
- Main Editor（本文編集領域）
- Voice Panel（音声制御/ログ領域）
- Edit Panel（編集補助）
- Side Bar（文書/履歴/設定のサイドレイヤ）
- Document List（ドキュメント一覧）
- Search Panel（検索UI：Overlay）
- Snapshot Panel（履歴/復元UI：Overlay）
- Overflow Menu（…）
- Update Banner（更新通知）

---

## 4. 状態遷移モデル（Must：UIは状態機械）
UI状態は4レイヤーで合成する：

UI = Primary(作業) × Input(入力) × System(裏) × Layout(表示)

### 4.1 Primary（排他）
- EDIT / SEARCH / MANAGE / CONFIG / (VIEWは必要なら)

### 4.2 Input（音声の扱いが肝）
- VOICE_OFF
- VOICE_APPEND（音声ON + 文末追記）※同時タイピング許可
- VOICE_LOCKED（音声ON + 文末追記以外：CURSOR/ANCHOR/LOG等）※タイピング禁止
- （TYPINGはKEYBOARD stateで扱ってもよいが、入力可否は下記ルールで固定）

### 4.3 System（複数併存）
- SAVING / OFFLINE / SYNCING(任意) / UPDATE_AVAILABLE / ERROR

### 4.4 Layout（自動）
- MOBILE / TABLET / DESKTOP
- ORIENTATION（PORTRAIT/LANDSCAPE）
- SPLIT（PC/iPad分割）

---

## 5. 入力可否ルール（Must：事故防止の強制制約）
### 5.1 音声入力とタイピングの同時許可条件
- 同時タイピングを許可するのは VOICE_APPEND のみ
- VOICE_LOCKED の時は Main Editor を read-only にしてキーボードを出さない（下記の二段ガードを必須実装）

### 5.2 VOICE_LOCKED時の具体制御（二段ガード）
A) キーボードを出さない
- focus取得を抑止（pointerdown/touchstartでpreventDefault + blur）
- 既にfocusしていたら遷移時にblur

B) 入力イベントを無効化（物理KB/ペースト対策）
- beforeinput / paste / keydown を preventDefault（編集禁止時）

※ disabledではなくreadonlyを基本（スクロール/選択は許可し得る）。ただしLOCKED中は「編集できそうなカーソル」を出さない（caret非表示/フォーカスリング抑制）

### 5.3 Primary間の整合性（禁止ルール）
- SEARCH中：Edit Panel/Side Barは原則閉じる。音声は反映停止または停止（少なくとも本文反映は停止）
- MANAGE中：Main Editorは原則編集不可（read-only）。音声反映は停止
- CONFIG中：編集/音声反映は停止
- Snapshot Overlay中：編集と音声反映は停止（復元事故防止）
- Dialog中：すべての背後操作停止

---

## 6. UIレイヤー階層（Must：キーボードは最上位）
UIは5階層で扱う：

L5: System Overlay（ソフトウェアキーボード等OS UI）
L4: App Overlay（Search Panel / Snapshot Panel / Dialog）
L3: Side Layer（Side Bar）
L2: Workspace Panel（Edit Panel / Voice Panel）
L1: Main Editor

### 6.1 キーボード（L5）ポリシー
- キーボードはアプリが勝てない最上位の災害要因として扱う
- KEYBOARD.visible時は、下部UI（特にTool Bar/Voice Panel）を再配置/最小化する
- KEYBOARDが出て良いのは EDIT（編集可）と SEARCH（検索入力）中心
- VOICE_LOCKED / SNAPSHOT / DIALOG / MANAGE / CONFIG ではキーボードを閉じる（blur強制）

---

## 7. Workspace Panel / Side Bar / Overlayの排他・同調（Must）
### 7.1 MOBILE（狭幅）
- Workspace上は完全排他：E xor V xor S
- Overlay表示時は必ず背景操作停止、Side Barは閉じる

### 7.2 TABLET/DESKTOP
- 同時表示は最大2（Side Bar含む）
- Side Bar表示中はEditorをread-only化（文書切替誤爆防止）

### 7.3 Overlay優先順位
- Dialog > Snapshot > Search
- Overlay表示時：
  - Side Barは強制クローズ
  - Edit Panelは無効化（基本クローズ）
  - Voiceは停止または反映停止（Snapshot/Dialogでは停止推奨）
  - 背景操作は停止（focus奪取・キーボード抑制）

---

## 8. 視覚フィードバック（Must：状態の可視化）
最低限これを実装：
- App HeaderのStatus Indicatorに以下を常時表示
  - Voice: OFF / APPEND / LOCKED
  - Saving / Offline / Update Available
- Workspace背景を状態で薄く変化
  - VOICE_OFF：通常
  - VOICE_APPEND：薄いトーン（録音中）
  - VOICE_LOCKED：やや強め（ただし可読性優先）
- VOICE_LOCKED時：編集できそうに見えない（caret非表示/フォーカス不可/ロック案内表示）

---

## 9. ドキュメント管理（Should→できればMust）
- 複数ドキュメント管理（doc_id：時系列ソート可能ID、例 timestamp+random）
- Document List：1行目をタイトル代用
- doc単位スナップショット（履歴保存/復元）
- Side Barは将来的に「履歴/文書切替」の統合UIとして機能

---

## 10. 更新方式（Must：B方式＝通知→反映、キャッシュに勝つ）
- 起動時/定期で version.json を no-store 取得して最新判定
- 差分があれば Update Banner を表示
- ユーザーが「更新」押下でSWのskipWaiting→controllerchange→reload
- リリース毎に version.json と sw.js 内のversionを必ず更新（SWが変わらないリリースは禁止）

---

## 11. ドキュメント介入（Must）
### 11.1 README.md（人間向け）
- コンセプト（音声×編集/思考を止めない）
- 対応端末/ブラウザと端末別UI方針（MOBILE排他など）
- 主要UI用語（上記公式用語）
- 音声モード（OFF/APPEND/LOCKED）と入力可否ルール
- PWA導線（iOSホーム追加手順）
- 更新方式（Update Bannerで通知→反映）
- 既知の制限/注意（例：LOCKED中は編集不可）

### 11.2 AGENTS.md（AI/エージェント向け）
- 公式UI用語の強制
- 状態モデル（Primary/Input/System/Layout）と禁止ルール
- レイヤー階層（L1-L5）とキーボードポリシー
- Panel/Overlay/Side Barの排他・同調ルール（MOBILE完全排他、Overlay優先順位）
- 更新方式（version.json + SW、B方式）
- 実装時のガード関数方針（canOpen/canType/enforceKeyboardPolicy等）
- テスト観点（後述）

※ 既に存在するREADME/AGENTS/LPの内容を尊重しつつ、矛盾が出ないように追記・再編すること（丸ごと破壊しない）。

---

## 12. LP（ランディングページ）介入（Should）
- 音声×編集の価値（APPENDモード）を明確に訴求
- PWA導線（iOS/Android）
- 対応端末と「状態可視化」「更新通知」などの安心要素
- スクリーンショット/モックがあれば配置

---

## 13. テスト/検証（Must）
最低限、以下を自動または手順化してREADME/AGENTSに残す：

### 13.1 レイアウト/排他
- MOBILE幅で E/V/S が同時に出ない
- Tool Barが1行から折り返さない（Overflowに退避する）

### 13.2 入力制御
- VOICE_LOCKEDでタップしてもキーボードが出ない
- VOICE_LOCKEDで物理KB/ペースト/IME入力が反映されない
- VOICE_APPENDでタイピングしながら音声が文末に追記される（または音声ログに追記される）

### 13.3 Overlay同調
- Snapshot中は編集/音声反映が止まる
- Search中はSide Barが閉じる、Edit Panelが無効化される
- Dialogが最優先で背後操作が止まる

### 13.4 キーボード
- KEYBOARD.visible時に下部UIが潰れない（必要なら退避/縮退）
- MANAGE/CONFIG/SNAPSHOT/DIALOG/VOICE_LOCKEDでキーボードが閉じる（blurされる）

### 13.5 更新
- version.json差分→Update Banner表示
- 更新押下→SW切替→reloadで最新版反映

---

## 14. 実装の進め方（Must）
1) まず状態モデルとガード関数（canOpen/canType/enforce…）を実装して“法律”を作る  
2) 次にUIをその法律に従って再配置/排他制御する  
3) その後、README/AGENTS/LPを現実の挙動に合わせて更新する  
4) 最後に検証手順（or簡易テスト）を追加する

---

## 15. 漏れがちな観点（今回分に適切に組み込む：Must）
- Safe Area（ノッチ/ホームバー）考慮：固定UIはセーフエリアに収める
- アクセシビリティ：LOCKED/UPDATE等は色だけでなくテキストでも判別可能に
- 端末回転/分割（iPad/PC）でLayout Stateが正しく切替わり排他が崩れない
- オフライン時（OFFLINE/System）：保存/同期の状態が明確で、失われない（自動保存の粒度は既存仕様に従いつつ破壊しない）

---

## 16. 成果物（Deliverables）
- アプリの改修（状態モデル、排他制御、入力ガード、視覚フィードバック、更新通知B方式の実装が既存構成に統合されていること）
- README.md 更新（利用者向け）
- AGENTS.md 更新（開発/AI向け）
- （任意）LPの文言/導線更新
- 検証チェックリスト（README or docs）追加

---

## 17. 重要な実装制約（Must）
- 既存のフォルダ構成・起動方法・ビルド方法は尊重する（壊さない）
- 追加ライブラリは最小限。必要なら理由を書き、導入手順をREADME/AGENTSに追加
- iPhone縦（最小幅）を最初に満たし、そこからiPad/PCへ拡張する
- 「見た目だけ直す」ではなく、必ず状態モデルとガードで事故を防ぐこと

---

以上を満たす形で改修を実施してください。作業開始前に、現状のREADME/AGENTS/LP/アプリ構造を読み、矛盾のない差分計画（変更点の一覧）を提示し、その後実装・更新を行ってください。
