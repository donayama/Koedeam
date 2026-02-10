(() => {
  const STORAGE_KEYS = {
    version: "koedeam.version",
    currentDraft: "koedeam.currentDraft",
    recentDrafts: "koedeam.recentDrafts",
    templates: "koedeam.templates",
    settings: "koedeam.settings"
  };

  const DEFAULT_TEMPLATES = [
    { id: uid(), name: "AI整理依頼", text: "次のメモを、目的・要点・次アクションの3項目で整理してください。\n\n[メモ]\n", updatedAt: Date.now() },
    { id: uid(), name: "要約と見出し", text: "次の文章を3〜5行で要約し、見出しを付けてください。\n\n[本文]\n", updatedAt: Date.now() },
    { id: uid(), name: "改善レビュー依頼", text: "次の下書きを、読みやすさ・説得力・簡潔さの観点で改善提案してください。\n\n[本文]\n", updatedAt: Date.now() },
    { id: uid(), name: "メール下書き", text: "件名：\n\n○○様\n\nいつもお世話になっております。\n\n要件：\n\nどうぞよろしくお願いいたします。", updatedAt: Date.now() },
    { id: uid(), name: "議事メモ", text: "# 議事メモ\n- 日時:\n- 参加者:\n\n## 決定事項\n- \n\n## ToDo\n- [ ] ", updatedAt: Date.now() }
  ];

  const DEFAULT_SETTINGS = {
    focusDefault: false,
    voiceInsertMode: "cursor",
    autoSnapshotMinutes: 0,
    searchHistory: [],
    searchOptions: {
      caseSensitive: false,
      useRegex: false
    },
    punctuationMode: "jp",
    fontSize: 16,
    fontFace: "sans-jp",
    apiKeys: {
      openai: "",
      other: ""
    },
    shareShortcuts: [
      { id: uid(), name: "メール", urlTemplate: "mailto:?subject={title}&body={text}" },
      { id: uid(), name: "LINE", urlTemplate: "line://msg/text/{text}" },
      { id: uid(), name: "ChatGPT", urlTemplate: "https://chatgpt.com/?q={text}" },
      { id: uid(), name: "Gemini", urlTemplate: "https://gemini.google.com/app?prompt={text}" }
    ],
    ui: { sidebar: false }
  };

  const state = {
    draft: "",
    recentDrafts: [],
    templates: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    shareMode: "all",
    recognition: null,
    speaking: false,
    activeMatchIndex: -1,
    matches: [],
    waitingWorker: null,
    autoSnapshotTimer: null,
    lastAutoSnapshotText: "",
    dismissedUpdate: false
  };

  const el = getElements();
  init();

  function init() {
    migrateVersion();
    state.draft = safeGetString(STORAGE_KEYS.currentDraft, "");
    state.recentDrafts = safeGetArray(STORAGE_KEYS.recentDrafts, []);
    state.templates = safeGetArray(STORAGE_KEYS.templates, DEFAULT_TEMPLATES);
    state.settings = safeGetObject(STORAGE_KEYS.settings, DEFAULT_SETTINGS);

    el.editor.value = state.draft;
    applyFocus(state.settings.focusDefault);
    applySidebar();
    applyVoiceModeUI();
    applyPunctuationUI();
    applyTypography();
    setupAutoSnapshot();
    bindEvents();
    renderTemplates();
    renderHistory();
    renderShareShortcuts();
    renderSidebar();
    setupSpeech();
    setupServiceWorker();
  }

  function bindEvents() {
    let saveTimer = null;
    el.editor.addEventListener("input", () => {
      if (saveTimer) clearTimeout(saveTimer);
      el.saveStatus.textContent = "Typing...";
      saveTimer = setTimeout(() => {
        state.draft = el.editor.value;
        safeSet(STORAGE_KEYS.currentDraft, state.draft);
        el.saveStatus.textContent = "Saved";
      }, 800);
    });

    const toggleFocus = () => {
      const next = !document.body.classList.contains("focus");
      applyFocus(next);
      state.settings.focusDefault = next;
      saveSettings();
    };
    el.btnFocus.addEventListener("click", toggleFocus);
    el.btnExitFocus.addEventListener("click", toggleFocus);
    el.btnEditTools.addEventListener("click", () => {
      const next = !el.editToolsPanel.classList.contains("show");
      el.editToolsPanel.classList.toggle("show", next);
    });
    el.btnSettings.addEventListener("click", () => openSettings("appearance"));
    el.btnSidebar.addEventListener("click", () => {
      state.settings.ui.sidebar = !state.settings.ui.sidebar;
      applySidebar();
      saveSettings();
    });

    el.btnHelp.addEventListener("click", () => el.dlgHelp.showModal());
    el.btnCloseHelp.addEventListener("click", () => el.dlgHelp.close());

    el.btnFind.addEventListener("click", () => openFindReplace(false));
    el.btnReplace.addEventListener("click", () => openFindReplace(true));
    el.btnCloseFind.addEventListener("click", () => el.dlgFindReplace.close());
    el.findQuery.addEventListener("input", refreshMatches);
    el.findQuery.addEventListener("blur", () => recordSearch(el.findQuery.value));
    el.optCase.addEventListener("change", updateSearchOptions);
    el.optRegex.addEventListener("change", updateSearchOptions);
    el.btnFindNext.addEventListener("click", () => {
      recordSearch(el.findQuery.value);
      jumpMatch(1);
    });
    el.btnFindPrev.addEventListener("click", () => {
      recordSearch(el.findQuery.value);
      jumpMatch(-1);
    });
    el.btnReplaceOne.addEventListener("click", replaceCurrent);
    el.btnReplaceNext.addEventListener("click", replaceAndNext);
    el.btnReplaceAll.addEventListener("click", () => replaceAll(false));
    el.btnReplaceInSelection.addEventListener("click", () => replaceAll(true));

    el.btnTemplates.addEventListener("click", () => {
      openSettings("templates");
    });
    el.templateForm.addEventListener("submit", saveTemplate);
    el.btnTemplateReset.addEventListener("click", resetTemplateForm);

    el.btnHistory.addEventListener("click", () => {
      renderHistory();
      el.dlgHistory.showModal();
    });
    el.btnCloseHistory.addEventListener("click", () => el.dlgHistory.close());
    el.btnSnapshot.addEventListener("click", () => {
      snapshotDraft();
      renderHistory();
      renderSidebar();
    });
    el.autoSnapshotSelect.addEventListener("change", () => {
      const mins = Number(el.autoSnapshotSelect.value || 0);
      state.settings.autoSnapshotMinutes = Number.isFinite(mins) ? mins : 0;
      saveSettings();
      setupAutoSnapshot();
    });

    el.btnShare.addEventListener("click", () => {
      renderShareShortcuts();
      el.dlgShare.showModal();
    });
    el.btnCloseShare.addEventListener("click", () => el.dlgShare.close());
    el.btnOpenSettingsShare.addEventListener("click", () => openSettings("share"));
    el.btnShareAll.addEventListener("click", () => setShareMode("all"));
    el.btnShareSelection.addEventListener("click", () => setShareMode("selection"));
    el.btnNativeShare.addEventListener("click", doShare);
    el.btnCopy.addEventListener("click", copyCurrentText);
    el.btnCut.addEventListener("click", cutSelection);
    el.btnPaste.addEventListener("click", pasteClipboard);
    el.btnNormalize.addEventListener("click", normalizeLineBreaks);
    el.btnCompressBlank.addEventListener("click", compressBlankLines);
    el.shareShortcutForm.addEventListener("submit", saveShareShortcut);
    el.btnShortcutReset.addEventListener("click", resetShareShortcutForm);

    el.btnSelectLine.addEventListener("click", selectLine);
    el.btnSelectBlock.addEventListener("click", selectBlock);
    el.btnSelectPara.addEventListener("click", selectBlock);
    el.btnSelectParaPrev.addEventListener("click", () => moveParagraph(-1));
    el.btnSelectParaNext.addEventListener("click", () => moveParagraph(1));
    el.btnExpandUp.addEventListener("click", () => expandSelection(-1));
    el.btnExpandDown.addEventListener("click", () => expandSelection(1));
    el.btnShrinkDown.addEventListener("click", () => shrinkSelection(1));
    el.btnSelectAll.addEventListener("click", () => {
      el.editor.focus();
      el.editor.select();
    });
    el.btnLineStart.addEventListener("click", () => moveToLineEdge("start"));
    el.btnLineEnd.addEventListener("click", () => moveToLineEdge("end"));
    el.btnMoveUp.addEventListener("click", () => moveCursorLine(-1));
    el.btnMoveDown.addEventListener("click", () => moveCursorLine(1));
    el.btnMoveLeft.addEventListener("click", () => moveCursorChar(-1));
    el.btnMoveRight.addEventListener("click", () => moveCursorChar(1));
    el.btnPuncMode.addEventListener("click", togglePunctuationMode);
    el.btnComma.addEventListener("click", () => insertPunctuation("comma"));
    el.btnPeriod.addEventListener("click", () => insertPunctuation("period"));
    el.btnNewline.addEventListener("click", () => insertTextAtCursor("\n"));
    el.voiceModeRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        state.settings.voiceInsertMode = radio.value;
        saveSettings();
      });
    });
    el.fontSizeRange.addEventListener("input", () => {
      state.settings.fontSize = Number(el.fontSizeRange.value);
      applyTypography();
      saveSettings();
    });
    el.fontFaceSelect.addEventListener("change", () => {
      state.settings.fontFace = el.fontFaceSelect.value;
      applyTypography();
      saveSettings();
    });
    el.apiKeyOpenAI.addEventListener("change", () => saveApiKeys());
    el.apiKeyOther.addEventListener("change", () => saveApiKeys());
    el.btnCloseSettings.addEventListener("click", () => el.dlgSettings.close());

    el.btnUpdateApp.addEventListener("click", () => {
      if (state.waitingWorker) {
        state.waitingWorker.postMessage({ type: "SKIP_WAITING" });
      }
    });
    el.btnUpdateLater.addEventListener("click", () => {
      state.dismissedUpdate = true;
      el.updateToast.classList.add("hidden");
    });

    setupDialogDismiss();

    document.addEventListener("keydown", (evt) => {
      const ctrl = evt.ctrlKey || evt.metaKey;
      if (ctrl && evt.key.toLowerCase() === "f") {
        evt.preventDefault();
        openFindReplace(false);
      } else if (ctrl && evt.key.toLowerCase() === "h") {
        evt.preventDefault();
        openFindReplace(true);
      } else if (ctrl && evt.key.toLowerCase() === "k") {
        evt.preventDefault();
        el.dlgShare.showModal();
      } else if (evt.key === "Escape") {
        if (!closeOpenDialog() && document.body.classList.contains("focus")) {
          toggleFocus();
        }
      }
    });
  }

  function openFindReplace(focusReplace) {
    el.dlgFindReplace.showModal();
    renderFindRecent();
    applySearchOptionsUI();
    refreshMatches();
    (focusReplace ? el.replaceQuery : el.findQuery).focus();
  }

  function setupDialogDismiss() {
    [el.dlgHelp, el.dlgFindReplace, el.dlgHistory, el.dlgShare, el.dlgSettings].forEach((dialog) => {
      dialog.addEventListener("click", (evt) => {
        if (evt.target !== dialog) return;
        const ok = confirm("閉じますか？未保存の変更がある場合は失われる可能性があります。");
        if (ok) dialog.close();
      });
    });
  }

  function refreshMatches() {
    const query = el.findQuery.value;
    const text = el.editor.value;
    state.matches = [];
    if (!query) {
      state.activeMatchIndex = -1;
      el.findStatus.textContent = "0件";
      return;
    }
    const { regex, error } = buildSearchRegex(query);
    if (error) {
      state.activeMatchIndex = -1;
      el.findStatus.textContent = "正規表現エラー";
      return;
    }
    if (regex) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const m = match[0];
        state.matches.push({ start: match.index, end: match.index + m.length, text: m });
        if (m.length === 0) regex.lastIndex += 1;
      }
    }
    state.activeMatchIndex = state.matches.length ? 0 : -1;
    el.findStatus.textContent = `${state.matches.length}件`;
    if (state.matches.length) selectMatch(state.activeMatchIndex);
  }

  function jumpMatch(step) {
    if (!state.matches.length) return toast("一致なし");
    state.activeMatchIndex = (state.activeMatchIndex + step + state.matches.length) % state.matches.length;
    selectMatch(state.activeMatchIndex);
  }

  function selectMatch(index) {
    const m = state.matches[index];
    if (!m) return;
    el.editor.focus();
    el.editor.setSelectionRange(m.start, m.end);
    el.findStatus.textContent = `${state.matches.length}件 (${index + 1}/${state.matches.length})`;
  }

  function replaceCurrent() {
    const find = el.findQuery.value;
    if (!find) return;
    const replace = el.replaceQuery.value;
    const { selectionStart, selectionEnd, value } = el.editor;
    const active = state.matches[state.activeMatchIndex];
    const { regex, error } = buildSearchRegex(find, true);
    if (error) return toast("正規表現エラー");
    if (active && selectionStart === active.start && selectionEnd === active.end) {
      const selected = value.slice(selectionStart, selectionEnd);
      const replaced = regex ? selected.replace(regex, replace) : replace;
      el.editor.setRangeText(replaced, selectionStart, selectionEnd, "select");
      triggerInput();
      refreshMatches();
      recordSearch(find);
      toast("置換しました");
    } else if (!regex && value.slice(selectionStart, selectionEnd) === find) {
      el.editor.setRangeText(replace, selectionStart, selectionEnd, "select");
      triggerInput();
      refreshMatches();
      recordSearch(find);
      toast("置換しました");
    } else {
      jumpMatch(1);
    }
  }

  function replaceAndNext() {
    replaceCurrent();
    refreshMatches();
    jumpMatch(1);
  }

  function replaceAll(inSelectionOnly) {
    const find = el.findQuery.value;
    if (!find) return toast("検索語を入力してください");
    const replace = el.replaceQuery.value;
    const { regex, error } = buildSearchRegex(find);
    if (error) return toast("正規表現エラー");
    if (inSelectionOnly) {
      const start = el.editor.selectionStart;
      const end = el.editor.selectionEnd;
      if (start === end) return toast("選択範囲がありません");
      const selected = el.editor.value.slice(start, end);
      const replaced = regex ? selected.replace(regex, replace) : selected.split(find).join(replace);
      el.editor.setRangeText(replaced, start, end, "select");
    } else {
      el.editor.value = regex ? el.editor.value.replace(regex, replace) : el.editor.value.split(find).join(replace);
    }
    triggerInput();
    refreshMatches();
    recordSearch(find);
    toast("全置換しました");
  }

  function saveTemplate(evt) {
    evt.preventDefault();
    const id = el.templateId.value || uid();
    const item = {
      id,
      name: el.templateName.value.trim() || "無題テンプレ",
      text: el.templateText.value,
      updatedAt: Date.now()
    };
    const idx = state.templates.findIndex((t) => t.id === id);
    if (idx >= 0) state.templates[idx] = item;
    else state.templates.unshift(item);
    persistTemplates();
    renderTemplates();
    renderSidebar();
    resetTemplateForm();
    toast("テンプレを保存しました");
  }

  function renderTemplates() {
    el.templateList.innerHTML = "";
    if (!state.templates.length) {
      el.templateList.innerHTML = '<p class="dialog-item">テンプレはありません。</p>';
      return;
    }
    for (const t of state.templates) {
      const row = document.createElement("div");
      row.className = "dialog-item";
      row.innerHTML = `
        <div class="dialog-item-head"><strong>${escapeHtml(t.name)}</strong><small>${new Date(t.updatedAt).toLocaleString()}</small></div>
        <p>${escapeHtml(preview(t.text))}</p>
        <div class="dialog-actions">
          <button data-act="insert" data-id="${t.id}" type="button">末尾挿入</button>
          <button data-act="replace" data-id="${t.id}" type="button">本文置換</button>
          <button data-act="edit" data-id="${t.id}" type="button">編集</button>
          <button data-act="delete" data-id="${t.id}" type="button">削除</button>
        </div>`;
      row.addEventListener("click", (e) => handleTemplateAction(e));
      el.templateList.append(row);
    }
  }

  function handleTemplateAction(evt) {
    const target = evt.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const id = target.dataset.id;
    const item = state.templates.find((t) => t.id === id);
    if (!item) return;
    const act = target.dataset.act;
    if (act === "insert") {
      el.editor.value = `${el.editor.value}${el.editor.value.endsWith("\n") || !el.editor.value ? "" : "\n"}${item.text}`;
      triggerInput();
      toast("テンプレを末尾に挿入");
    } else if (act === "replace") {
      if (confirm("本文をテンプレで置き換えますか？")) {
        el.editor.value = item.text;
        triggerInput();
      }
    } else if (act === "edit") {
      el.templateId.value = item.id;
      el.templateName.value = item.name;
      el.templateText.value = item.text;
    } else if (act === "delete") {
      state.templates = state.templates.filter((t) => t.id !== id);
      persistTemplates();
      renderTemplates();
      renderSidebar();
    }
  }

  function resetTemplateForm() {
    el.templateId.value = "";
    el.templateName.value = "";
    el.templateText.value = "";
  }

  function snapshotDraft() {
    snapshotDraftInternal(false);
  }

  function snapshotDraftInternal(isAuto) {
    const text = el.editor.value;
    if (!text.trim()) return toast("空の本文は保存しません");
    if (isAuto && text === state.lastAutoSnapshotText) return;
    const title = firstLine(text);
    const item = { id: uid(), title, text, updatedAt: Date.now() };
    state.recentDrafts.unshift(item);
    state.recentDrafts = state.recentDrafts.slice(0, 5);
    persistRecentDrafts();
    state.lastAutoSnapshotText = text;
    toast(isAuto ? "自動スナップショットを保存" : "スナップショットを保存");
  }

  function renderHistory() {
    el.historyList.innerHTML = "";
    el.autoSnapshotSelect.value = String(state.settings.autoSnapshotMinutes || 0);
    if (!state.recentDrafts.length) {
      el.historyList.innerHTML = '<p class="dialog-item">履歴はありません。</p>';
      return;
    }
    for (const h of state.recentDrafts) {
      const row = document.createElement("div");
      row.className = "dialog-item";
      row.innerHTML = `
        <div class="dialog-item-head"><strong>${escapeHtml(h.title)}</strong><small>${new Date(h.updatedAt).toLocaleString()}</small></div>
        <p>${escapeHtml(preview(h.text))}</p>
        <label>タイトル<input data-hid="${h.id}" data-act="title" value="${escapeHtmlAttr(h.title)}" /></label>
        <div class="dialog-actions">
          <button data-act="restore" data-id="${h.id}" type="button">復元</button>
          <button data-act="delete" data-id="${h.id}" type="button">削除</button>
        </div>`;
      row.addEventListener("click", (e) => handleHistoryAction(e));
      row.addEventListener("change", (e) => handleHistoryAction(e));
      el.historyList.append(row);
    }
  }

  function handleHistoryAction(evt) {
    const target = evt.target;
    if (target instanceof HTMLInputElement && target.dataset.act === "title") {
      const item = state.recentDrafts.find((h) => h.id === target.dataset.hid);
      if (item) {
        item.title = target.value.trim() || firstLine(item.text);
        persistRecentDrafts();
        renderSidebar();
      }
      return;
    }
    if (!(target instanceof HTMLButtonElement)) return;
    const id = target.dataset.id;
    const act = target.dataset.act;
    const item = state.recentDrafts.find((h) => h.id === id);
    if (!item) return;
    if (act === "restore") {
      el.editor.value = item.text;
      triggerInput();
      toast("履歴を復元しました");
    } else if (act === "delete") {
      state.recentDrafts = state.recentDrafts.filter((h) => h.id !== id);
      persistRecentDrafts();
      renderHistory();
      renderSidebar();
    }
  }

  function setShareMode(mode) {
    state.shareMode = mode;
    el.btnShareAll.classList.toggle("active", mode === "all");
    el.btnShareSelection.classList.toggle("active", mode === "selection");
  }

  async function doShare() {
    const text = getShareText();
    if (!text) return toast("共有テキストがありません");
    const title = firstLine(text);
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return toast("共有しました");
      }
    } catch {
      // continue fallback
    }
    await copyCurrentText();
  }

  async function copyCurrentText() {
    const text = getShareText();
    if (!text) return toast("コピー対象がありません");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return toast("コピーしました");
      }
    } catch {
      // fallback
    }
    const temp = document.createElement("textarea");
    temp.value = text;
    document.body.append(temp);
    temp.select();
    const ok = document.execCommand("copy");
    temp.remove();
    toast(ok ? "コピーしました" : "コピーできませんでした");
  }

  async function cutSelection() {
    const { selectionStart, selectionEnd } = el.editor;
    if (selectionStart === selectionEnd) return toast("選択してからCutしてください");
    const selected = el.editor.value.slice(selectionStart, selectionEnd);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(selected);
      else throw new Error("no clipboard");
      el.editor.setRangeText("", selectionStart, selectionEnd, "start");
      triggerInput();
      toast("Cutしました");
    } catch {
      toast("Cutに失敗しました");
    }
  }

  async function pasteClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return toast("クリップボードが空です");
      const { selectionStart, selectionEnd } = el.editor;
      el.editor.setRangeText(text, selectionStart, selectionEnd, "end");
      triggerInput();
      toast("Pasteしました");
    } catch {
      toast("Paste非対応です");
    }
  }

  function normalizeLineBreaks() {
    el.editor.value = el.editor.value.replace(/\r\n?/g, "\n");
    triggerInput();
    toast("改行をLFに統一");
  }

  function compressBlankLines() {
    el.editor.value = el.editor.value.replace(/\n{3,}/g, "\n\n");
    triggerInput();
    toast("連続空行を圧縮");
  }

  function getShareText() {
    if (state.shareMode === "selection") {
      const { selectionStart, selectionEnd, value } = el.editor;
      return value.slice(selectionStart, selectionEnd);
    }
    return el.editor.value;
  }

  function renderShareShortcuts() {
    setShareMode(state.shareMode);
    el.shareShortcutList.innerHTML = "";
    el.settingsShareList.innerHTML = "";
    for (const s of state.settings.shareShortcuts.slice(0, 5)) {
      const shareRow = document.createElement("div");
      shareRow.className = "dialog-item";
      shareRow.innerHTML = `
        <div class="dialog-item-head"><strong>${escapeHtml(s.name)}</strong></div>
        <small>${escapeHtml(s.urlTemplate)}</small>
        <div class="dialog-actions">
          <button data-act="open" data-id="${s.id}" type="button">起動</button>
        </div>`;
      const settingsRow = document.createElement("div");
      settingsRow.className = "dialog-item";
      settingsRow.innerHTML = `
        <div class="dialog-item-head"><strong>${escapeHtml(s.name)}</strong></div>
        <small>${escapeHtml(s.urlTemplate)}</small>
        <div class="dialog-actions">
          <button data-act="open" data-id="${s.id}" type="button">起動</button>
          <button data-act="edit" data-id="${s.id}" type="button">編集</button>
          <button data-act="delete" data-id="${s.id}" type="button">削除</button>
        </div>`;
      shareRow.addEventListener("click", (evt) => handleShareShortcutAction(evt));
      settingsRow.addEventListener("click", (evt) => handleShareShortcutAction(evt));
      el.shareShortcutList.append(shareRow);
      el.settingsShareList.append(settingsRow);
    }
  }

  function handleShareShortcutAction(evt) {
    const target = evt.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const item = state.settings.shareShortcuts.find((s) => s.id === target.dataset.id);
    if (!item) return;
    const act = target.dataset.act;
    if (act === "open") {
      const text = getShareText();
      const title = firstLine(text || "Koedeam");
      const url = item.urlTemplate
        .replaceAll("{text}", encodeURIComponent(text))
        .replaceAll("{title}", encodeURIComponent(title));
      try {
        window.location.href = url;
      } catch {
        toast("起動できませんでした。コピー共有をお試しください");
      }
    } else if (act === "edit") {
      el.shortcutId.value = item.id;
      el.shortcutName.value = item.name;
      el.shortcutUrl.value = item.urlTemplate;
    } else if (act === "delete") {
      state.settings.shareShortcuts = state.settings.shareShortcuts.filter((s) => s.id !== item.id);
      saveSettings();
      renderShareShortcuts();
      renderSidebar();
    }
  }

  function saveShareShortcut(evt) {
    evt.preventDefault();
    const id = el.shortcutId.value || uid();
    const next = {
      id,
      name: el.shortcutName.value.trim() || "Shortcut",
      urlTemplate: el.shortcutUrl.value.trim()
    };
    const idx = state.settings.shareShortcuts.findIndex((s) => s.id === id);
    if (idx >= 0) state.settings.shareShortcuts[idx] = next;
    else state.settings.shareShortcuts.push(next);
    state.settings.shareShortcuts = state.settings.shareShortcuts.slice(0, 5);
    saveSettings();
    renderShareShortcuts();
    renderSidebar();
    resetShareShortcutForm();
  }

  function resetShareShortcutForm() {
    el.shortcutId.value = "";
    el.shortcutName.value = "";
    el.shortcutUrl.value = "";
  }

  function applyFocus(on) {
    document.body.classList.toggle("focus", !!on);
  }

  function applySidebar() {
    el.layout.classList.toggle("with-sidebar", !!state.settings.ui.sidebar);
  }

  function renderSidebar() {
    el.sidebarTemplates.innerHTML = state.templates.slice(0, 3)
      .map((t) => `<button type="button" data-side="template" data-id="${t.id}">${escapeHtml(t.name)}</button>`).join("");
    el.sidebarHistory.innerHTML = state.recentDrafts.slice(0, 5)
      .map((h) => `<button type="button" data-side="history" data-id="${h.id}">${escapeHtml(h.title)}</button>`).join("");
    el.sidebarShares.innerHTML = state.settings.shareShortcuts.slice(0, 5)
      .map((s) => `<button type="button" data-side="share" data-id="${s.id}">${escapeHtml(s.name)}</button>`).join("");

    el.sidebar.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.side;
        const id = btn.dataset.id;
        if (type === "template") {
          const t = state.templates.find((x) => x.id === id);
          if (t) {
            el.editor.value = `${el.editor.value}\n${t.text}`.trimStart();
            triggerInput();
          }
        } else if (type === "history") {
          const h = state.recentDrafts.find((x) => x.id === id);
          if (h) {
            el.editor.value = h.text;
            triggerInput();
          }
        } else if (type === "share") {
          const fakeEvt = { target: { dataset: { id, act: "open" } } };
          handleShareShortcutAction(fakeEvt);
        }
      });
    });
  }

  function setupSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      el.btnMic.disabled = true;
      toast("音声API非対応: OS音声入力キーボードをご利用ください", 3500);
      return;
    }
    const recognition = new SR();
    state.recognition = recognition;
    recognition.lang = "ja-JP";
    recognition.interimResults = true;
    recognition.continuous = true;

    let finalText = "";
    recognition.addEventListener("result", (event) => {
      finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
      }
      if (finalText) insertByVoiceMode(finalText);
    });
    recognition.addEventListener("end", () => {
      state.speaking = false;
      el.btnMic.textContent = "Mic";
    });

    el.btnMic.addEventListener("click", () => {
      if (state.speaking) {
        recognition.stop();
        return;
      }
      try {
        recognition.start();
        state.speaking = true;
        el.btnMic.textContent = "Stop";
      } catch {
        toast("音声入力を開始できませんでした");
      }
    });
  }

  function insertByVoiceMode(text) {
    const mode = state.settings.voiceInsertMode;
    if (mode === "append") {
      el.editor.value = `${el.editor.value}${el.editor.value ? "\n" : ""}${text}`;
    } else if (mode === "replace") {
      const { selectionStart, selectionEnd } = el.editor;
      el.editor.setRangeText(text, selectionStart, selectionEnd, "end");
    } else {
      const { selectionStart, selectionEnd } = el.editor;
      el.editor.setRangeText(text, selectionStart, selectionEnd, "end");
    }
    triggerInput();
  }

  function setupServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", async () => {
      try {
        const reg = await navigator.serviceWorker.register("./sw.js");
        if (reg.waiting) showUpdate(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdate(worker);
            }
          });
        });
        navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
      } catch {
        toast("Service Worker登録に失敗");
      }
    });
  }

  function showUpdate(worker) {
    state.waitingWorker = worker;
    if (state.dismissedUpdate) return;
    el.updateToast.classList.remove("hidden");
  }

  function closeOpenDialog() {
    let closed = false;
    [el.dlgHelp, el.dlgFindReplace, el.dlgHistory, el.dlgShare, el.dlgSettings].forEach((d) => {
      if (d.open) {
        d.close();
        closed = true;
      }
    });
    return closed;
  }

  function triggerInput() {
    el.editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function setupAutoSnapshot() {
    if (state.autoSnapshotTimer) {
      clearInterval(state.autoSnapshotTimer);
      state.autoSnapshotTimer = null;
    }
    const mins = Number(state.settings.autoSnapshotMinutes || 0);
    if (!mins) return;
    state.autoSnapshotTimer = setInterval(() => {
      snapshotDraftInternal(true);
      renderHistory();
      renderSidebar();
    }, mins * 60 * 1000);
  }

  function applyVoiceModeUI() {
    el.voiceModeRadios.forEach((radio) => {
      radio.checked = radio.value === state.settings.voiceInsertMode;
    });
  }

  function applyTypography() {
    const size = Number(state.settings.fontSize || 16);
    el.editor.style.fontSize = `${size}px`;
    el.fontSizeRange.value = String(size);
    el.fontSizeValue.textContent = `${size}px`;
    el.fontFaceSelect.value = state.settings.fontFace || "sans-jp";
    el.editor.style.fontFamily = getFontFamily(state.settings.fontFace);
  }

  function getFontFamily(key) {
    switch (key) {
      case "serif-jp":
        return "\"Yu Mincho\", \"Hiragino Mincho ProN\", \"MS PMincho\", serif";
      case "sans-en":
        return "\"Segoe UI\", Arial, sans-serif";
      case "serif-en":
        return "Georgia, \"Times New Roman\", serif";
      case "mono":
        return "\"Cascadia Mono\", \"Consolas\", \"SFMono-Regular\", monospace";
      case "sans-jp":
      default:
        return "\"Hiragino Kaku Gothic ProN\", \"Yu Gothic\", \"Meiryo\", system-ui, sans-serif";
    }
  }

  function openSettings(section) {
    el.dlgSettings.showModal();
    applyTypography();
    renderTemplates();
    renderShareShortcuts();
    loadApiKeys();
    const target = {
      appearance: el.settingsAppearance,
      templates: el.settingsTemplates,
      share: el.settingsShare,
      api: el.settingsApi
    }[section];
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function togglePunctuationMode() {
    state.settings.punctuationMode = state.settings.punctuationMode === "jp" ? "en" : "jp";
    saveSettings();
    applyPunctuationUI();
  }

  function applyPunctuationUI() {
    const jp = state.settings.punctuationMode !== "en";
    el.btnPuncMode.textContent = jp ? "JP" : "EN";
    el.btnComma.querySelector(".icon").textContent = jp ? "、" : ",";
    el.btnPeriod.querySelector(".icon").textContent = jp ? "。" : ".";
  }

  function insertPunctuation(kind) {
    const jp = state.settings.punctuationMode !== "en";
    const text = kind === "comma" ? (jp ? "、" : ",") : (jp ? "。" : ".");
    insertTextAtCursor(text);
  }

  function insertTextAtCursor(text) {
    const { selectionStart, selectionEnd } = el.editor;
    el.editor.setRangeText(text, selectionStart, selectionEnd, "end");
    triggerInput();
  }

  function loadApiKeys() {
    const keys = state.settings.apiKeys || {};
    el.apiKeyOpenAI.value = keys.openai || "";
    el.apiKeyOther.value = keys.other || "";
  }

  function saveApiKeys() {
    state.settings.apiKeys = {
      openai: el.apiKeyOpenAI.value.trim(),
      other: el.apiKeyOther.value.trim()
    };
    saveSettings();
  }

  function saveSettings() {
    safeSet(STORAGE_KEYS.settings, state.settings);
  }

  function persistTemplates() {
    safeSet(STORAGE_KEYS.templates, state.templates);
  }

  function persistRecentDrafts() {
    safeSet(STORAGE_KEYS.recentDrafts, state.recentDrafts.slice(0, 5));
  }

  function migrateVersion() {
    const v = localStorage.getItem(STORAGE_KEYS.version);
    if (v !== "1") localStorage.setItem(STORAGE_KEYS.version, "1");
  }

  function safeGetString(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return typeof v === "string" ? v : fallback;
    } catch {
      return fallback;
    }
  }

  function safeGetArray(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredClone(fallback);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : structuredClone(fallback);
    } catch {
      preserveBroken(key);
      return structuredClone(fallback);
    }
  }

  function safeGetObject(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredClone(fallback);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(fallback),
        ...parsed,
        ui: { ...fallback.ui, ...(parsed.ui || {}) },
        searchOptions: { ...fallback.searchOptions, ...(parsed.searchOptions || {}) },
        punctuationMode: parsed.punctuationMode || fallback.punctuationMode,
        fontSize: parsed.fontSize || fallback.fontSize,
        fontFace: parsed.fontFace || fallback.fontFace,
        apiKeys: { ...fallback.apiKeys, ...(parsed.apiKeys || {}) }
      };
    } catch {
      preserveBroken(key);
      return structuredClone(fallback);
    }
  }

  function preserveBroken(key) {
    try {
      const broken = localStorage.getItem(key);
      if (broken) localStorage.setItem(`${key}.broken`, broken);
    } catch {
      // ignore
    }
  }

  function safeSet(key, value) {
    try {
      const payload = typeof value === "string" ? value : JSON.stringify(value);
      localStorage.setItem(key, payload);
    } catch {
      toast("保存に失敗しました");
    }
  }

  function toast(msg, ms = 1800) {
    el.appMessage.textContent = msg;
    window.clearTimeout(toast.tid);
    toast.tid = window.setTimeout(() => { el.appMessage.textContent = ""; }, ms);
  }

  function firstLine(text) {
    return (text.split("\n").find((line) => line.trim()) || "無題").slice(0, 48);
  }

  function preview(text) {
    return text.replace(/\n/g, " ").slice(0, 80);
  }

  function recordSearch(query) {
    const q = (query || "").trim();
    if (!q) return;
    const next = [q, ...state.settings.searchHistory.filter((x) => x !== q)].slice(0, 3);
    state.settings.searchHistory = next;
    saveSettings();
    renderFindRecent();
  }

  function renderFindRecent() {
    el.findRecent.innerHTML = "";
    for (const q of state.settings.searchHistory.slice(0, 3)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = q;
      btn.addEventListener("click", () => {
        el.findQuery.value = q;
        refreshMatches();
      });
      el.findRecent.append(btn);
    }
  }

  function updateSearchOptions() {
    state.settings.searchOptions = {
      caseSensitive: !!el.optCase.checked,
      useRegex: !!el.optRegex.checked
    };
    saveSettings();
    refreshMatches();
  }

  function applySearchOptionsUI() {
    const opts = state.settings.searchOptions || {};
    el.optCase.checked = !!opts.caseSensitive;
    el.optRegex.checked = !!opts.useRegex;
  }

  function buildSearchRegex(query, single) {
    const opts = state.settings.searchOptions || {};
    const flags = `${single ? "" : "g"}${opts.caseSensitive ? "" : "i"}`;
    try {
      if (opts.useRegex) return { regex: new RegExp(query, flags) };
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return { regex: new RegExp(escaped, flags) };
    } catch {
      return { regex: null, error: true };
    }
  }

  function selectLine() {
    const text = el.editor.value;
    const pos = el.editor.selectionStart;
    const { start, end } = getLineBounds(text, pos);
    el.editor.focus();
    el.editor.setSelectionRange(start, end);
  }

  function selectBlock() {
    const text = el.editor.value;
    const pos = el.editor.selectionStart;
    const { start, end } = getBlockBounds(text, pos);
    el.editor.focus();
    el.editor.setSelectionRange(start, end);
  }

  function moveParagraph(dir) {
    const text = el.editor.value;
    const pos = el.editor.selectionStart;
    const { start, end } = getBlockBounds(text, pos);
    if (dir < 0) {
      const before = text.slice(0, Math.max(0, start - 2));
      const prevStartBoundary = before.lastIndexOf("\n\n");
      const nextPos = prevStartBoundary === -1 ? 0 : prevStartBoundary + 2;
      el.editor.focus();
      el.editor.setSelectionRange(nextPos, nextPos);
    } else {
      const after = text.slice(Math.min(text.length, end + 2));
      const nextBoundary = after.indexOf("\n\n");
      const nextPos = nextBoundary === -1 ? text.length : end + 2 + nextBoundary + 2;
      el.editor.focus();
      el.editor.setSelectionRange(nextPos, nextPos);
    }
  }

  function expandSelection(dir) {
    const text = el.editor.value;
    const { selectionStart, selectionEnd } = el.editor;
    if (selectionStart === selectionEnd) {
      selectLine();
      return;
    }
    if (dir < 0) {
      const { start } = getLineBounds(text, selectionStart);
      const prevStart = text.lastIndexOf("\n", Math.max(0, start - 2));
      const nextStart = prevStart === -1 ? 0 : prevStart + 1;
      el.editor.focus();
      el.editor.setSelectionRange(nextStart, selectionEnd);
    } else {
      const { end } = getLineBounds(text, selectionEnd);
      const nextEnd = text.indexOf("\n", end + 1);
      const next = nextEnd === -1 ? text.length : nextEnd;
      el.editor.focus();
      el.editor.setSelectionRange(selectionStart, next);
    }
  }

  function shrinkSelection() {
    const text = el.editor.value;
    const { selectionStart, selectionEnd } = el.editor;
    if (selectionStart === selectionEnd) return;
    const { end } = getLineBounds(text, selectionEnd);
    const prevEnd = text.lastIndexOf("\n", Math.max(0, end - 2));
    const nextEnd = prevEnd === -1 ? selectionStart : prevEnd;
    if (nextEnd <= selectionStart) {
      el.editor.setSelectionRange(selectionStart, selectionStart);
    } else {
      el.editor.setSelectionRange(selectionStart, nextEnd);
    }
    el.editor.focus();
  }

  function moveToLineEdge(edge) {
    const text = el.editor.value;
    const pos = el.editor.selectionStart;
    const { start, end } = getLineBounds(text, pos);
    const next = edge === "start" ? start : end;
    el.editor.focus();
    el.editor.setSelectionRange(next, next);
  }

  function moveCursorLine(dir) {
    const text = el.editor.value;
    const pos = el.editor.selectionStart;
    const { start, end } = getLineBounds(text, pos);
    const column = pos - start;
    if (dir < 0) {
      const prevEnd = start > 0 ? start - 1 : 0;
      const prevStart = text.lastIndexOf("\n", prevEnd - 1);
      const lineStart = prevStart === -1 ? 0 : prevStart + 1;
      const lineEnd = text.indexOf("\n", lineStart);
      const limit = lineEnd === -1 ? text.length : lineEnd;
      const next = Math.min(lineStart + column, limit);
      el.editor.focus();
      el.editor.setSelectionRange(next, next);
    } else {
      const nextStart = end < text.length ? end + 1 : text.length;
      const nextEnd = text.indexOf("\n", nextStart);
      const limit = nextEnd === -1 ? text.length : nextEnd;
      const next = Math.min(nextStart + column, limit);
      el.editor.focus();
      el.editor.setSelectionRange(next, next);
    }
  }

  function moveCursorChar(step) {
    const pos = el.editor.selectionStart;
    const next = Math.max(0, Math.min(el.editor.value.length, pos + step));
    el.editor.focus();
    el.editor.setSelectionRange(next, next);
  }

  function getLineBounds(text, pos) {
    const start = text.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
    const endIndex = text.indexOf("\n", pos);
    const end = endIndex === -1 ? text.length : endIndex;
    return { start, end };
  }

  function getBlockBounds(text, pos) {
    const before = text.slice(0, pos);
    const after = text.slice(pos);
    const startBoundary = before.lastIndexOf("\n\n");
    const endBoundary = after.indexOf("\n\n");
    const start = startBoundary === -1 ? 0 : startBoundary + 2;
    const end = endBoundary === -1 ? text.length : pos + endBoundary;
    return { start, end };
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function escapeHtml(str) {
    return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function escapeHtmlAttr(str) {
    return escapeHtml(str).replaceAll('"', "&quot;");
  }

  function getElements() {
    return {
      layout: document.querySelector(".layout"),
      editor: document.getElementById("editor"),
      saveStatus: document.getElementById("saveStatus"),
      appMessage: document.getElementById("appMessage"),
      sidebar: document.getElementById("sidebar"),
      sidebarTemplates: document.getElementById("sidebarTemplates"),
      sidebarHistory: document.getElementById("sidebarHistory"),
      sidebarShares: document.getElementById("sidebarShares"),

      btnSidebar: document.getElementById("btnSidebar"),
      btnEditTools: document.getElementById("btnEditTools"),
      btnFocus: document.getElementById("btnFocus"),
      btnExitFocus: document.getElementById("btnExitFocus"),
      btnSettings: document.getElementById("btnSettings"),
      btnHelp: document.getElementById("btnHelp"),
      btnMic: document.getElementById("btnMic"),
      btnFind: document.getElementById("btnFind"),
      btnReplace: document.getElementById("btnReplace"),
      btnTemplates: document.getElementById("btnTemplates"),
      btnHistory: document.getElementById("btnHistory"),
      btnShare: document.getElementById("btnShare"),

      dlgHelp: document.getElementById("dlgHelp"),
      btnCloseHelp: document.getElementById("btnCloseHelp"),

      dlgFindReplace: document.getElementById("dlgFindReplace"),
      findQuery: document.getElementById("findQuery"),
      findRecent: document.getElementById("findRecent"),
      optCase: document.getElementById("optCase"),
      optRegex: document.getElementById("optRegex"),
      replaceQuery: document.getElementById("replaceQuery"),
      findStatus: document.getElementById("findStatus"),
      btnFindPrev: document.getElementById("btnFindPrev"),
      btnFindNext: document.getElementById("btnFindNext"),
      btnReplaceOne: document.getElementById("btnReplaceOne"),
      btnReplaceNext: document.getElementById("btnReplaceNext"),
      btnReplaceAll: document.getElementById("btnReplaceAll"),
      btnReplaceInSelection: document.getElementById("btnReplaceInSelection"),
      btnCloseFind: document.getElementById("btnCloseFind"),

      dlgSettings: document.getElementById("dlgSettings"),
      settingsAppearance: document.getElementById("settingsAppearance"),
      settingsTemplates: document.getElementById("settingsTemplates"),
      settingsShare: document.getElementById("settingsShare"),
      settingsApi: document.getElementById("settingsApi"),
      fontSizeRange: document.getElementById("fontSizeRange"),
      fontSizeValue: document.getElementById("fontSizeValue"),
      fontFaceSelect: document.getElementById("fontFaceSelect"),
      apiKeyOpenAI: document.getElementById("apiKeyOpenAI"),
      apiKeyOther: document.getElementById("apiKeyOther"),
      btnCloseSettings: document.getElementById("btnCloseSettings"),
      templateList: document.getElementById("templateList"),
      templateForm: document.getElementById("templateForm"),
      templateId: document.getElementById("templateId"),
      templateName: document.getElementById("templateName"),
      templateText: document.getElementById("templateText"),
      btnTemplateReset: document.getElementById("btnTemplateReset"),

      dlgHistory: document.getElementById("dlgHistory"),
      btnSnapshot: document.getElementById("btnSnapshot"),
      autoSnapshotSelect: document.getElementById("autoSnapshotSelect"),
      historyList: document.getElementById("historyList"),
      btnCloseHistory: document.getElementById("btnCloseHistory"),

      dlgShare: document.getElementById("dlgShare"),
      btnOpenSettingsShare: document.getElementById("btnOpenSettingsShare"),
      btnShareAll: document.getElementById("btnShareAll"),
      btnShareSelection: document.getElementById("btnShareSelection"),
      btnNativeShare: document.getElementById("btnNativeShare"),
      btnCopy: document.getElementById("btnCopy"),
      btnCut: document.getElementById("btnCut"),
      btnPaste: document.getElementById("btnPaste"),
      btnNormalize: document.getElementById("btnNormalize"),
      btnCompressBlank: document.getElementById("btnCompressBlank"),
      shareShortcutList: document.getElementById("shareShortcutList"),
      settingsShareList: document.getElementById("settingsShareList"),
      shareShortcutForm: document.getElementById("shareShortcutForm"),
      shortcutId: document.getElementById("shortcutId"),
      shortcutName: document.getElementById("shortcutName"),
      shortcutUrl: document.getElementById("shortcutUrl"),
      btnShortcutReset: document.getElementById("btnShortcutReset"),
      btnCloseShare: document.getElementById("btnCloseShare"),

      editToolsPanel: document.getElementById("editToolsPanel"),
      voiceModeRadios: Array.from(document.querySelectorAll("input[name='voiceMode']")),
      btnSelectLine: document.getElementById("btnSelectLine"),
      btnSelectBlock: document.getElementById("btnSelectBlock"),
      btnSelectPara: document.getElementById("btnSelectPara"),
      btnSelectParaPrev: document.getElementById("btnSelectParaPrev"),
      btnSelectParaNext: document.getElementById("btnSelectParaNext"),
      btnExpandUp: document.getElementById("btnExpandUp"),
      btnExpandDown: document.getElementById("btnExpandDown"),
      btnShrinkDown: document.getElementById("btnShrinkDown"),
      btnSelectAll: document.getElementById("btnSelectAll"),
      btnLineStart: document.getElementById("btnLineStart"),
      btnLineEnd: document.getElementById("btnLineEnd"),
      btnMoveUp: document.getElementById("btnMoveUp"),
      btnMoveDown: document.getElementById("btnMoveDown"),
      btnMoveLeft: document.getElementById("btnMoveLeft"),
      btnMoveRight: document.getElementById("btnMoveRight"),
      btnPuncMode: document.getElementById("btnPuncMode"),
      btnComma: document.getElementById("btnComma"),
      btnPeriod: document.getElementById("btnPeriod"),
      btnNewline: document.getElementById("btnNewline"),

      updateToast: document.getElementById("updateToast"),
      btnUpdateApp: document.getElementById("btnUpdateApp"),
      btnUpdateLater: document.getElementById("btnUpdateLater")
    };
  }
})();
