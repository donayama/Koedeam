(() => {
  const APP_VERSION = "1.1.0";
  const VERSION_URL = "./version.json";
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
    editPanelPosition: "bottom",
    sidebarTab: "replace",
    toolbar: {
      mic: true,
      replace: true,
      templates: false,
      history: false,
      edit: true,
      share: true
    },
    toolbarOrder: ["mic", "replace", "templates", "history", "edit", "share"],
    toolbarPriority: ["mic", "replace", "edit", "share", "history", "templates"],
    apiKeys: {
      openai: "",
      other: ""
    },
    shareShortcuts: [
      { id: uid(), name: "メール", urlTemplate: "mailto:?subject={title}&body={text}" },
      { id: uid(), name: "LINE", urlTemplate: "https://line.me/R/share?text={prompt}" },
      { id: uid(), name: "ChatGPT", urlTemplate: "https://chatgpt.com/?q={prompt}" },
      { id: uid(), name: "Gemini", urlTemplate: "https://gemini.google.com/app?q={prompt}" }
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
    dismissedUpdate: false,
    editToolsVisible: false,
    sideTabsBound: false,
    settingsTabsBound: false,
    primary: "EDIT",
    input: "VOICE_OFF",
    system: "LOCAL",
    layoutMode: "MOBILE",
    overflowedTools: []
  };

  const el = getElements();
  init();

  function init() {
    migrateVersion();
    state.draft = safeGetString(STORAGE_KEYS.currentDraft, "");
    state.recentDrafts = safeGetArray(STORAGE_KEYS.recentDrafts, []);
    state.templates = safeGetArray(STORAGE_KEYS.templates, DEFAULT_TEMPLATES);
    state.settings = safeGetObject(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    if (state.settings.voiceInsertMode === "replace") {
      state.settings.voiceInsertMode = "cursor";
      saveSettings();
    }

    el.editor.value = state.draft;
    applySidebar();
    applyVoiceModeUI();
    applyPunctuationUI();
    applyTypography();
    applyEditPanelPosition();
    applyToolbarVisibility();
    applySidebarTab(state.settings.sidebarTab || "templates");
    applyLayoutState();
    applyPrimary("EDIT");
    applyInputState("VOICE_OFF");
    applySystemState("LOCAL");
    setupAutoSnapshot();
    bindEvents();
    renderTemplates();
    renderHistory();
    renderShareShortcuts();
    renderSidebar();
    updateOverflowToolbar();
    updateStatusIndicator();
    setupSpeech();
    setupServiceWorker();
    setupVersionPolling();
    setupViewportWatcher();
  }

  function bindEvents() {
    let saveTimer = null;
    const closeMenuIfOpen = () => {
      if (el.menuOverlay && !el.menuOverlay.classList.contains("hidden")) closeMenu();
    };
    el.editor.addEventListener("input", () => {
      if (!canType()) return;
      if (saveTimer) clearTimeout(saveTimer);
      el.saveStatus.textContent = "Typing...";
      applyPrimary("EDIT");
      applySystemState("SAVING");
      saveTimer = setTimeout(() => {
        state.draft = el.editor.value;
        safeSet(STORAGE_KEYS.currentDraft, state.draft);
        el.saveStatus.textContent = "Saved";
        applySystemState(navigator.onLine ? "LOCAL" : "OFFLINE");
      }, 800);
      updateCaretUI();
    });
    el.editor.addEventListener("beforeinput", (evt) => {
      if (!canType()) evt.preventDefault();
    });
    el.editor.addEventListener("paste", (evt) => {
      if (!canType()) evt.preventDefault();
    });
    el.editor.addEventListener("keydown", (evt) => {
      if (!canType() && !evt.metaKey && !evt.ctrlKey) evt.preventDefault();
    });
    el.editor.addEventListener("click", updateCaretUI);
    el.editor.addEventListener("keyup", updateCaretUI);
    el.editor.addEventListener("scroll", updateCaretUI);
    el.editor.addEventListener("focus", updateCaretUI);
    el.editor.addEventListener("pointerdown", (evt) => {
      if (!canType()) {
        evt.preventDefault();
        el.editor.blur();
      }
    });
    el.editor.addEventListener("blur", () => {
      el.caretLine.classList.add("hidden");
      el.caretDot.classList.add("hidden");
    });
    document.addEventListener("selectionchange", () => {
      if (document.activeElement === el.editor) updateCaretUI();
    });

    el.btnMenu.addEventListener("click", () => openMenu());
    if (el.btnOverflow) el.btnOverflow.addEventListener("click", () => openMenu());
    el.btnCloseMenu.addEventListener("click", () => closeMenu());
    el.btnEditTools.addEventListener("click", () => {
      const next = !state.editToolsVisible;
      setEditToolsVisible(next);
    });
    if (el.btnSettings) {
      el.btnSettings.addEventListener("click", () => {
        closeMenuIfOpen();
        openSettings("appearance");
      });
    }
    if (el.btnSidebar) {
      el.btnSidebar.addEventListener("click", () => {
        closeMenuIfOpen();
        toggleSidebar();
      });
    }
    if (el.btnCloseSidebar) {
      el.btnCloseSidebar.addEventListener("click", () => toggleSidebar());
    }
    bindSideTabs();
    bindSettingsTabs();

    if (el.btnHelp) {
      el.btnHelp.addEventListener("click", () => {
        closeMenuIfOpen();
        applyPrimary("CONFIG");
        enforceKeyboardPolicy();
        el.dlgHelp.showModal();
      });
    }
    el.btnCloseHelp.addEventListener("click", () => el.dlgHelp.close());
    el.dlgHelp.addEventListener("close", () => applyPrimary("EDIT"));

    el.btnReplace.addEventListener("click", () => {
      closeMenuIfOpen();
      openSidebarPanel("replace");
    });
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
      closeMenuIfOpen();
      openSidebarPanel("templates");
    });
    el.templateForm.addEventListener("submit", saveTemplate);
    el.btnTemplateReset.addEventListener("click", resetTemplateForm);

    el.btnHistory.addEventListener("click", () => {
      closeMenuIfOpen();
      openSidebarPanel("history");
    });
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
      applyPrimary("MANAGE");
      enforceKeyboardPolicy();
      el.dlgShare.showModal();
    });
    el.btnCloseShare.addEventListener("click", () => el.dlgShare.close());
    el.dlgShare.addEventListener("close", () => applyPrimary("EDIT"));
    el.btnOpenSettingsShare.addEventListener("click", () => openSettings("share"));
    el.btnShareAll.addEventListener("click", () => setShareMode("all"));
    el.btnShareSelection.addEventListener("click", () => setShareMode("selection"));
    el.btnNativeShare.addEventListener("click", doShare);
    el.btnCopy.addEventListener("click", copyCurrentText);
    // share dialog: only Share + Copy
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
    el.btnCopySel.addEventListener("click", copySelection);
    el.btnCutSel.addEventListener("click", cutSelection);
    el.btnPasteSel.addEventListener("click", pasteClipboard);
    el.btnBackspace.addEventListener("click", () => deleteByDirection(-1));
    el.btnDelete.addEventListener("click", () => deleteByDirection(1));
    el.voiceModeRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        state.settings.voiceInsertMode = radio.value;
        if (state.speaking) {
          applyInputState(radio.value === "append" ? "VOICE_APPEND" : "VOICE_LOCKED");
        }
        saveSettings();
      });
    });
    el.fontSizeRange.addEventListener("input", () => {
      state.settings.fontSize = Number(el.fontSizeRange.value);
      applyTypography();
      saveSettings();
    });
    el.fontFaceRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        state.settings.fontFace = radio.value;
        applyTypography();
        saveSettings();
      });
    });
    el.editPanelPosRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        state.settings.editPanelPosition = radio.value;
        applyEditPanelPosition();
        saveSettings();
      });
    });
    if (el.toolbarOrderList) {
      el.toolbarOrderList.addEventListener("click", (evt) => {
        const btn = evt.target.closest("button[data-move]");
        if (!btn) return;
        const tool = btn.dataset.tool;
        const dir = btn.dataset.move;
        moveToolbarItem(tool, dir === "up" ? -1 : 1);
      });
      el.toolbarOrderList.addEventListener("change", (evt) => {
        const input = evt.target;
        if (!(input instanceof HTMLInputElement)) return;
        if (!input.dataset.tool) return;
        state.settings.toolbar = state.settings.toolbar || {};
        state.settings.toolbar[input.dataset.tool] = input.checked;
        applyToolbarVisibility();
        saveSettings();
      });
    }
    el.apiKeyOpenAI.addEventListener("change", () => saveApiKeys());
    el.apiKeyOther.addEventListener("change", () => saveApiKeys());
    el.btnCloseSettings.addEventListener("click", () => el.dlgSettings.close());
    el.dlgSettings.addEventListener("close", () => applyPrimary("EDIT"));
    el.btnResetApp.addEventListener("click", resetApp);
    if (el.btnForceReload) {
      el.btnForceReload.addEventListener("click", forceReload);
    }

    el.btnUpdateApp.addEventListener("click", () => {
      if (state.waitingWorker) {
        state.waitingWorker.postMessage({ type: "SKIP_WAITING" });
      }
    });
    el.btnUpdateLater.addEventListener("click", () => {
      state.dismissedUpdate = true;
      el.updateToast.classList.add("hidden");
      applySystemState(navigator.onLine ? "LOCAL" : "OFFLINE");
    });

    setupDialogDismiss();
    setupMenuOverlay();
    window.addEventListener("resize", () => {
      applyLayoutState();
      updateOverflowToolbar();
    });
    window.addEventListener("orientationchange", () => {
      applyLayoutState();
      updateOverflowToolbar();
    });

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
        applyPrimary("MANAGE");
        enforceKeyboardPolicy();
        el.dlgShare.showModal();
      } else if (evt.key === "Escape") {
        closeMenuIfOpen();
        closeOpenDialog();
      }
    });
  }

  function openFindReplace(focusReplace) {
    applyPrimary("SEARCH");
    openSidebarPanel("replace");
    renderFindRecent();
    applySearchOptionsUI();
    refreshMatches();
    (focusReplace ? el.replaceQuery : el.findQuery).focus();
  }

  function setupDialogDismiss() {
    [el.dlgHelp, el.dlgShare, el.dlgSettings].forEach((dialog) => {
      dialog.addEventListener("click", (evt) => {
        if (evt.target !== dialog) return;
        const ok = confirm("閉じますか？未保存の変更がある場合は失われる可能性があります。");
        if (ok) dialog.close();
      });
    });
  }

  function setupMenuOverlay() {
    el.menuOverlay.addEventListener("click", (evt) => {
      if (evt.target === el.menuOverlay) closeMenu();
    });
    el.menuPanel.addEventListener("click", (evt) => {
      const btn = evt.target.closest("button[data-menu]");
      if (!btn) return;
      const act = btn.dataset.menu;
      if (act === "tool") {
        closeMenu();
        const tool = btn.dataset.tool;
        triggerToolbarTool(tool);
        return;
      }
      closeMenu();
      if (act === "replace") openSidebarPanel("replace");
      else if (act === "templates") openSidebarPanel("templates");
      else if (act === "history") { openSidebarPanel("history"); }
      else if (act === "sidebar") { toggleSidebar(); }
      else if (act === "settings") openSettings("appearance");
      else if (act === "help") {
        applyPrimary("CONFIG");
        enforceKeyboardPolicy();
        el.dlgHelp.showModal();
      }
    });
  }

  function openMenu() {
    applyPrimary("MANAGE");
    el.menuOverlay.classList.remove("hidden");
    el.menuOverlay.setAttribute("aria-hidden", "false");
    renderOverflowMenuItems();
  }

  function closeMenu() {
    el.menuOverlay.classList.add("hidden");
    el.menuOverlay.setAttribute("aria-hidden", "true");
    if (state.primary !== "CONFIG") applyPrimary("EDIT");
  }

  function triggerToolbarTool(tool) {
    if (tool === "mic") el.btnMic.click();
    else if (tool === "replace") el.btnReplace.click();
    else if (tool === "templates") el.btnTemplates.click();
    else if (tool === "history") el.btnHistory.click();
    else if (tool === "edit") el.btnEditTools.click();
    else if (tool === "share") el.btnShare.click();
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
      row.className = "dialog-item compact-item";
      row.innerHTML = `
        <div class="dialog-item-head compact-head">
          <button data-act="edit" data-id="${t.id}" type="button" class="icon-only" aria-label="編集"><span class="icon">✎</span></button>
          <strong>${escapeHtml(t.name)}</strong>
          <button data-act="delete" data-id="${t.id}" type="button" class="icon-only compact-delete" aria-label="削除"><span class="icon">🗑</span></button>
        </div>
        <p class="compact-preview">${escapeHtml(preview(t.text))}</p>`;
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
    if (act === "edit") {
      el.templateId.value = item.id;
      el.templateName.value = item.name;
      el.templateText.value = item.text;
      openSettings("templates");
    } else if (act === "delete") {
      const ok = confirm("このテンプレを削除します。よろしいですか？");
      if (!ok) return;
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

  function deleteByDirection(direction) {
    const ta = el.editor;
    const { selectionStart, selectionEnd, value } = ta;
    if (selectionStart !== selectionEnd) {
      ta.setRangeText("", selectionStart, selectionEnd, "start");
      triggerInput();
      return;
    }
    if (direction < 0 && selectionStart > 0) {
      ta.setRangeText("", selectionStart - 1, selectionStart, "start");
      triggerInput();
      return;
    }
    if (direction > 0 && selectionStart < value.length) {
      ta.setRangeText("", selectionStart, selectionStart + 1, "start");
      triggerInput();
    }
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
      const shareRow = document.createElement("button");
      shareRow.type = "button";
      shareRow.dataset.act = "open";
      shareRow.dataset.id = s.id;
      shareRow.textContent = s.name;
      const settingsRow = document.createElement("div");
      settingsRow.className = "dialog-item compact-item";
      settingsRow.innerHTML = `
        <div class="dialog-item-head compact-head">
          <button data-act="open" data-id="${s.id}" type="button" class="icon-only" aria-label="起動"><span class="icon">⇪</span><span class="icon-label">起動</span></button>
          <strong>${escapeHtml(s.name)}</strong>
          <button data-act="edit" data-id="${s.id}" type="button" class="icon-only" aria-label="編集"><span class="icon">✎</span><span class="icon-label">編集</span></button>
          <button data-act="delete" data-id="${s.id}" type="button" class="icon-only compact-delete" aria-label="削除"><span class="icon">🗑</span><span class="icon-label">削除</span></button>
        </div>
        <small class="compact-preview">${escapeHtml(s.urlTemplate)}</small>`;
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
        .replaceAll("{title}", encodeURIComponent(title))
        .replaceAll("{prompt}", encodeURIComponent(text));
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
      const ok = confirm("このショートカットを削除します。よろしいですか？");
      if (!ok) return;
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

  function applySidebar() {
    el.layout.classList.toggle("with-sidebar", !!state.settings.ui.sidebar);
    document.body.classList.toggle("with-sidebar", !!state.settings.ui.sidebar);
    if (state.settings.ui.sidebar && !isMobileLayout() && state.primary === "EDIT") {
      applyPrimary("MANAGE");
    }
    if (state.settings.ui.sidebar) {
      refreshSideTabElements();
      bindSideTabs();
      applySidebarTab(state.settings.sidebarTab || "replace");
    }
    enforceKeyboardPolicy();
  }

  async function copySelection() {
    const { selectionStart, selectionEnd } = el.editor;
    if (selectionStart === selectionEnd) return toast("選択してからCopyしてください");
    const selected = el.editor.value.slice(selectionStart, selectionEnd);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(selected);
        return toast("Copyしました");
      }
    } catch {
      // fallback
    }
    const temp = document.createElement("textarea");
    temp.value = selected;
    document.body.append(temp);
    temp.select();
    const ok = document.execCommand("copy");
    temp.remove();
    toast(ok ? "Copyしました" : "Copyできませんでした");
  }

  function refreshSideTabElements() {
    el.sideTabs = Array.from(document.querySelectorAll(".side-tabs .tab-btn"));
    el.tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
  }

  function bindSideTabs() {
    if (state.sideTabsBound) return;
    if (!el.sidebar) return;
    el.sidebar.addEventListener("click", (evt) => {
      const tabBtn = evt.target.closest(".tab-btn");
      if (!tabBtn) return;
      const tab = tabBtn.dataset.tab;
      applySidebarTab(tab);
      state.settings.sidebarTab = tab;
      saveSettings();
    });
    state.sideTabsBound = true;
  }

  function applySidebarTab(tab) {
    const btn = el.sideTabs.find((b) => b.dataset.tab === tab);
    const targetId = btn?.getAttribute("aria-controls") || `panel${capitalize(tab)}`;
    el.sideTabs.forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
    el.tabPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === targetId);
    });
  }

  function bindSettingsTabs() {
    if (state.settingsTabsBound) return;
    if (!el.settingsTabs || !el.settingsTabs.length) return;
    el.settingsTabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        if (!tab) return;
        applySettingsTab(tab);
      });
    });
    state.settingsTabsBound = true;
  }

  function renderSidebar() {
    el.sidebarTemplates.innerHTML = state.templates.slice(0, 3)
      .map((t) => `<button type="button" data-side="template" data-id="${t.id}">${escapeHtml(t.name)}</button>`).join("");
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
      el.btnMic.innerHTML = '<span class="icon">🎤</span>音声入力';
      applyInputState("VOICE_OFF");
    });

    el.btnMic.addEventListener("click", () => {
      if (state.speaking) {
        recognition.stop();
        return;
      }
      try {
        recognition.start();
        state.speaking = true;
        el.btnMic.innerHTML = '<span class="icon">■</span>停止';
        applyInputState(state.settings.voiceInsertMode === "append" ? "VOICE_APPEND" : "VOICE_LOCKED");
      } catch {
        toast("音声入力を開始できませんでした");
      }
    });
  }

  function insertByVoiceMode(text) {
    const mode = state.settings.voiceInsertMode;
    if (mode === "append") {
      const ta = el.editor;
      const hadFocus = document.activeElement === ta;
      const prevStart = ta.selectionStart;
      const prevEnd = ta.selectionEnd;
      const prevScrollTop = ta.scrollTop;
      const prevScrollLeft = ta.scrollLeft;
      const insertAt = ta.value.length;
      const sep = ta.value && !ta.value.endsWith("\n") ? "\n" : "";
      ta.setRangeText(`${sep}${text}`, insertAt, insertAt, "preserve");
      if (hadFocus) {
        ta.setSelectionRange(prevStart, prevEnd);
        ta.scrollTop = prevScrollTop;
        ta.scrollLeft = prevScrollLeft;
      }
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
        applySystemState(navigator.onLine ? "LOCAL" : "OFFLINE");
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
        applySystemState("ERROR");
      }
    });
    window.addEventListener("online", () => applySystemState("LOCAL"));
    window.addEventListener("offline", () => applySystemState("OFFLINE"));
  }

  function showUpdate(worker) {
    state.waitingWorker = worker;
    applySystemState("UPDATE_AVAILABLE");
    if (state.dismissedUpdate) return;
    el.updateToast.classList.remove("hidden");
  }

  function closeOpenDialog() {
    let closed = false;
    [el.dlgHelp, el.dlgShare, el.dlgSettings].forEach((d) => {
      if (d.open) {
        d.close();
        closed = true;
      }
    });
    if (closed) applyPrimary("EDIT");
    return closed;
  }

  function applyPrimary(next) {
    state.primary = next;
    document.body.classList.remove("primary-edit", "primary-search", "primary-manage", "primary-config");
    document.body.classList.add(`primary-${next.toLowerCase()}`);
    if (next !== "EDIT" && state.speaking && state.recognition) {
      state.recognition.stop();
    }
    enforceKeyboardPolicy();
    updateStatusIndicator();
  }

  function applyInputState(next) {
    state.input = next;
    document.body.classList.remove("voice-off", "voice-append", "voice-locked");
    if (next === "VOICE_APPEND") document.body.classList.add("voice-append");
    else if (next === "VOICE_LOCKED") document.body.classList.add("voice-locked");
    else document.body.classList.add("voice-off");
    enforceKeyboardPolicy();
    updateStatusIndicator();
  }

  function applySystemState(next) {
    state.system = next;
    updateStatusIndicator();
  }

  function applyLayoutState() {
    const w = window.innerWidth;
    const mode = w < 760 ? "MOBILE" : (w < 1080 ? "TABLET" : "DESKTOP");
    state.layoutMode = mode;
    document.body.classList.remove("layout-mobile", "layout-tablet", "layout-desktop");
    document.body.classList.add(`layout-${mode.toLowerCase()}`);
    if (mode === "MOBILE" && state.settings.ui.sidebar && state.editToolsVisible) {
      setEditToolsVisible(false);
    }
    if (mode === "MOBILE" && state.settings.ui.sidebar && state.primary === "EDIT") {
      applyPrimary("MANAGE");
    }
    updateStatusIndicator();
  }

  function setupViewportWatcher() {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      const delta = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      const keyboardOpen = delta > 80;
      document.documentElement.style.setProperty("--kb-offset", `${delta}px`);
      document.body.classList.toggle("keyboard-open", keyboardOpen);
      if (keyboardOpen && state.layoutMode === "MOBILE" && state.editToolsVisible) {
        setEditToolsVisible(false);
      }
    };
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    window.addEventListener("focusin", apply);
    window.addEventListener("focusout", () => setTimeout(apply, 80));
    apply();
  }

  function isMobileLayout() {
    return state.layoutMode === "MOBILE";
  }

  function canType() {
    if (state.input === "VOICE_LOCKED") return false;
    if (state.primary === "SEARCH" || state.primary === "MANAGE" || state.primary === "CONFIG") return false;
    return true;
  }

  function enforceKeyboardPolicy() {
    const editable = canType();
    el.editor.readOnly = !editable;
    if (!editable && document.activeElement === el.editor) {
      el.editor.blur();
    }
  }

  function updateStatusIndicator() {
    if (!el.statusPrimary) return;
    el.statusPrimary.textContent = state.primary;
    el.statusInput.textContent = state.input.replaceAll("_", ":");
    el.statusSystem.textContent = state.system;
    el.statusLayout.textContent = state.layoutMode;
    el.statusInput.classList.toggle("input-locked", state.input === "VOICE_LOCKED");
    el.statusSystem.classList.toggle("system-saving", state.system === "SAVING");
    el.statusSystem.classList.toggle("system-offline", state.system === "OFFLINE");
    el.statusSystem.classList.toggle("system-update", state.system === "UPDATE_AVAILABLE");
  }

  function setupVersionPolling() {
    window.addEventListener("load", checkVersion);
    window.setInterval(checkVersion, 5 * 60 * 1000);
  }

  async function checkVersion() {
    try {
      const r = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) return;
      const json = await r.json();
      const remote = `${json.version || ""}`.trim();
      if (!remote || remote === APP_VERSION) return;
      if (!el.updateToast.classList.contains("hidden")) return;
      el.updateToast.classList.remove("hidden");
      applySystemState("UPDATE_AVAILABLE");
    } catch {
      // keep silent for offline/local dev
    }
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
    el.fontFaceRadios.forEach((radio) => {
      radio.checked = radio.value === (state.settings.fontFace || "sans-jp");
    });
    el.editor.style.fontFamily = getFontFamily(state.settings.fontFace);
  }

  function applyToolbarVisibility() {
    const t = { ...DEFAULT_SETTINGS.toolbar, ...(state.settings.toolbar || {}) };
    if ("find" in t) delete t.find;
    state.settings.toolbar = t;
    const order = (state.settings.toolbarOrder || DEFAULT_SETTINGS.toolbarOrder).filter((k) => k in t);
    state.settings.toolbarOrder = order;
    el.toolbarButtons.forEach((btn) => {
      const key = btn.dataset.tool;
      btn.classList.toggle("toolbar-hidden", !t[key]);
    });
    if (el.toolbarOrderList) renderToolbarOrder();
    if (el.bottombar) {
      order.forEach((key) => {
        const btn = el.toolbarButtons.find((b) => b.dataset.tool === key);
        if (btn) el.bottombar.append(btn);
      });
    }
    updateOverflowToolbar();
  }

  function updateOverflowToolbar() {
    if (!el.bottombar || !el.btnOverflow) return;
    state.overflowedTools = [];
    el.toolbarButtons.forEach((btn) => btn.classList.remove("overflowed"));
    const visibleTools = el.toolbarButtons.filter((btn) => !btn.classList.contains("toolbar-hidden"));
    if (state.layoutMode !== "MOBILE" || visibleTools.length <= 4) {
      el.btnOverflow.classList.add("hidden");
      renderOverflowMenuItems();
      return;
    }
    const priority = state.settings.toolbarPriority || DEFAULT_SETTINGS.toolbarPriority || [];
    const sorted = [...visibleTools].sort((a, b) => {
      const ia = priority.indexOf(a.dataset.tool);
      const ib = priority.indexOf(b.dataset.tool);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    const keep = new Set(sorted.slice(0, 4).map((b) => b.dataset.tool));
    visibleTools.forEach((btn) => {
      if (!keep.has(btn.dataset.tool)) {
        btn.classList.add("overflowed");
        state.overflowedTools.push(btn.dataset.tool);
      }
    });
    el.btnOverflow.classList.remove("hidden");
    renderOverflowMenuItems();
  }

  function renderOverflowMenuItems() {
    if (!el.overflowMenuItems) return;
    const labels = {
      mic: "音声入力",
      replace: "検索・置換",
      templates: "テンプレ",
      history: "保存・履歴",
      edit: "編集",
      share: "共有"
    };
    const icons = {
      mic: "🎤",
      replace: "🔎",
      templates: "📄",
      history: "🕒",
      edit: "✎",
      share: "⇪"
    };
    el.overflowMenuItems.innerHTML = "";
    state.overflowedTools.forEach((tool) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-icon";
      btn.dataset.menu = "tool";
      btn.dataset.tool = tool;
      btn.innerHTML = `<span class="icon">${icons[tool] || "•"}</span>${labels[tool] || tool}`;
      el.overflowMenuItems.append(btn);
    });
  }

  function renderToolbarOrder() {
    const order = state.settings.toolbarOrder || DEFAULT_SETTINGS.toolbarOrder;
    const labels = {
      mic: "音声入力",
      replace: "検索・置換",
      templates: "テンプレ",
      history: "保存・履歴",
      edit: "編集",
      share: "共有"
    };
    el.toolbarOrderList.innerHTML = "";
    order.forEach((tool, idx) => {
      const row = document.createElement("div");
      row.className = "dialog-item toolbar-item-row";
      row.innerHTML = `
        <label class="toolbar-check">
          <input type="checkbox" data-tool="${tool}" ${state.settings.toolbar?.[tool] ? "checked" : ""} />
          <strong>${labels[tool] || tool}</strong>
        </label>
        <div class="toolbar-move">
          <button type="button" data-move="up" data-tool="${tool}" ${idx === 0 ? "disabled" : ""}>↑</button>
          <button type="button" data-move="down" data-tool="${tool}" ${idx === order.length - 1 ? "disabled" : ""}>↓</button>
        </div>`;
      el.toolbarOrderList.append(row);
    });
  }

  function moveToolbarItem(tool, delta) {
    const order = state.settings.toolbarOrder || DEFAULT_SETTINGS.toolbarOrder;
    const idx = order.indexOf(tool);
    if (idx === -1) return;
    const next = idx + delta;
    if (next < 0 || next >= order.length) return;
    order.splice(idx, 1);
    order.splice(next, 0, tool);
    state.settings.toolbarOrder = order;
    applyToolbarVisibility();
    saveSettings();
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
    applyPrimary("CONFIG");
    enforceKeyboardPolicy();
    el.dlgSettings.showModal();
    applyTypography();
    applyToolbarVisibility();
    renderTemplates();
    renderShareShortcuts();
    loadApiKeys();
    applyEditPanelPosition();
    applySettingsTab(section || "appearance");
  }

  function applySettingsTab(tab) {
    el.settingsTabs.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    el.settingsPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === `panelSettings${capitalize(tab)}`);
    });
  }

  function openHistoryPanel() {
    openSidebarPanel("history");
  }

  function openSidebarPanel(tab) {
    applyPrimary(tab === "replace" ? "SEARCH" : "MANAGE");
    if (isMobileLayout()) setEditToolsVisible(false);
    state.settings.ui.sidebar = true;
    applySidebar();
    applySidebarTab(tab);
    saveSettings();
    if (tab === "history") renderHistory();
    if (tab === "templates") renderSidebar();
    if (tab === "replace") refreshMatches();
    if (el.sidebar) el.sidebar.scrollTop = 0;
  }

  function toggleSidebar() {
    state.settings.ui.sidebar = !state.settings.ui.sidebar;
    applyPrimary(state.settings.ui.sidebar ? "MANAGE" : "EDIT");
    if (state.settings.ui.sidebar && isMobileLayout()) setEditToolsVisible(false);
    applySidebar();
    saveSettings();
  }

  function togglePunctuationMode() {
    state.settings.punctuationMode = state.settings.punctuationMode === "jp" ? "en" : "jp";
    saveSettings();
    applyPunctuationUI();
  }

  function applyPunctuationUI() {
    const jp = state.settings.punctuationMode !== "en";
    el.btnPuncMode.textContent = jp ? "JP" : "EN";
    el.btnComma.textContent = jp ? "、" : ",";
    el.btnPeriod.textContent = jp ? "。" : ".";
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

  function setEditToolsVisible(on) {
    state.editToolsVisible = !!on;
    if (state.editToolsVisible) {
      applyPrimary("EDIT");
      if (isMobileLayout() && state.settings.ui.sidebar) {
        state.settings.ui.sidebar = false;
        applySidebar();
      }
    }
    el.editToolsPanel.classList.toggle("show", state.editToolsVisible);
    document.body.classList.toggle("edit-tools-show", state.editToolsVisible);
    applyEditPanelPosition();
    requestAnimationFrame(updateEditPanelSize);
  }

  function applyEditPanelPosition() {
    const pos = state.settings.editPanelPosition || "bottom";
    document.body.classList.remove("edit-pos-bottom", "edit-pos-top", "edit-pos-left", "edit-pos-right");
    document.body.classList.add(`edit-pos-${pos}`);
    el.editToolsPanel.classList.remove("pos-bottom", "pos-top", "pos-left", "pos-right");
    el.editToolsPanel.classList.add(`pos-${pos}`);
    el.editPanelPosRadios.forEach((radio) => {
      radio.checked = radio.value === pos;
    });
    requestAnimationFrame(updateEditPanelSize);
  }

  function updateEditPanelSize() {
    if (!state.editToolsVisible) return;
    const pos = state.settings.editPanelPosition || "bottom";
    const size = (pos === "left" || pos === "right")
      ? el.editToolsPanel.offsetWidth
      : el.editToolsPanel.offsetHeight;
    if (size) document.documentElement.style.setProperty("--edit-panel-size", `${Math.max(size, 120)}px`);
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

  function resetApp() {
    const ok = confirm("設定・下書き・履歴・テンプレを初期化します。よろしいですか？");
    if (!ok) return;
    try {
      localStorage.removeItem(STORAGE_KEYS.currentDraft);
      localStorage.removeItem(STORAGE_KEYS.recentDrafts);
      localStorage.removeItem(STORAGE_KEYS.templates);
      localStorage.removeItem(STORAGE_KEYS.settings);
      localStorage.setItem(STORAGE_KEYS.version, "1");
    } catch {
      // ignore
    }
    state.draft = "";
    state.recentDrafts = [];
    state.templates = structuredClone(DEFAULT_TEMPLATES);
    state.settings = structuredClone(DEFAULT_SETTINGS);
    el.editor.value = "";
    applySidebar();
    applyVoiceModeUI();
    applyPunctuationUI();
    applyTypography();
    applyEditPanelPosition();
    applyToolbarVisibility();
    renderTemplates();
    renderHistory();
    renderShareShortcuts();
    renderSidebar();
    applyPrimary("EDIT");
    applyInputState("VOICE_OFF");
    applySystemState(navigator.onLine ? "LOCAL" : "OFFLINE");
    toast("初期化しました");
  }

  async function forceReload() {
    const ok = confirm("Service Worker とキャッシュを解除して再読み込みします。よろしいですか？");
    if (!ok) return;
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore
    }
    window.location.reload(true);
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
        editPanelPosition: parsed.editPanelPosition || fallback.editPanelPosition,
        toolbar: { ...fallback.toolbar, ...(parsed.toolbar || {}) },
        toolbarOrder: Array.isArray(parsed.toolbarOrder) ? parsed.toolbarOrder : fallback.toolbarOrder,
        toolbarPriority: Array.isArray(parsed.toolbarPriority) ? parsed.toolbarPriority : fallback.toolbarPriority,
        sidebarTab: parsed.sidebarTab || fallback.sidebarTab,
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
      ensureCaretVisible();
    } else {
      const after = text.slice(Math.min(text.length, end + 2));
      const nextBoundary = after.indexOf("\n\n");
      const nextPos = nextBoundary === -1 ? text.length : end + 2 + nextBoundary + 2;
      el.editor.focus();
      el.editor.setSelectionRange(nextPos, nextPos);
      ensureCaretVisible();
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

  function ensureCaretVisible() {
    const ta = el.editor;
    const pos = ta.selectionStart;
    const text = ta.value.slice(0, pos);
    const cs = window.getComputedStyle(ta);
    const mirror = document.createElement("div");
    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordWrap = "break-word";
    mirror.style.fontFamily = cs.fontFamily;
    mirror.style.fontSize = cs.fontSize;
    mirror.style.lineHeight = cs.lineHeight;
    mirror.style.padding = cs.padding;
    mirror.style.border = cs.border;
    mirror.style.width = `${ta.clientWidth}px`;
    mirror.textContent = text;
    const marker = document.createElement("span");
    marker.textContent = "▮";
    mirror.append(marker);
    document.body.append(mirror);
    const markerTop = marker.offsetTop;
    const padTop = parseFloat(cs.paddingTop) || 0;
    const viewTop = ta.scrollTop;
    const viewBottom = viewTop + ta.clientHeight;
    const caretTop = markerTop + padTop;
    if (caretTop < viewTop || caretTop > viewBottom - 24) {
      ta.scrollTop = Math.max(0, caretTop - ta.clientHeight / 2);
    }
    mirror.remove();
  }

  function updateCaretUI() {
    const coords = getCaretCoordinates();
    if (!coords) return;
    const { top, left, lineHeight } = coords;
    el.caretLine.classList.remove("hidden");
    el.caretDot.classList.remove("hidden");
    el.caretLine.style.top = `${top}px`;
    el.caretLine.style.height = `${lineHeight}px`;
    el.caretDot.style.top = `${top + Math.max(2, lineHeight * 0.15)}px`;
    el.caretDot.style.left = `${left}px`;
    el.caretDot.style.height = `${Math.max(2, lineHeight * 0.7)}px`;
  }

  function getCaretCoordinates() {
    const ta = el.editor;
    if (!ta) return null;
    const pos = ta.selectionStart;
    const text = ta.value.slice(0, pos);
    const cs = window.getComputedStyle(ta);
    const mirror = document.createElement("div");
    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordWrap = "break-word";
    mirror.style.fontFamily = cs.fontFamily;
    mirror.style.fontSize = cs.fontSize;
    mirror.style.lineHeight = cs.lineHeight;
    mirror.style.padding = cs.padding;
    mirror.style.border = cs.border;
    mirror.style.width = `${ta.clientWidth}px`;
    mirror.textContent = text;
    const marker = document.createElement("span");
    marker.textContent = "▮";
    mirror.append(marker);
    document.body.append(mirror);
    const markerTop = marker.offsetTop - ta.scrollTop;
    const markerLeft = marker.offsetLeft - ta.scrollLeft;
    const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6 || 24;
    mirror.remove();
    return { top: markerTop, left: markerLeft, lineHeight };
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

  function capitalize(str) {
    return `${str}`.charAt(0).toUpperCase() + `${str}`.slice(1);
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
      statusPrimary: document.getElementById("statusPrimary"),
      statusInput: document.getElementById("statusInput"),
      statusSystem: document.getElementById("statusSystem"),
      statusLayout: document.getElementById("statusLayout"),
      sidebar: document.getElementById("sidebar"),
      sidebarTemplates: document.getElementById("sidebarTemplates"),
      sideTabs: Array.from(document.querySelectorAll(".side-tabs .tab-btn")),
      tabPanels: Array.from(document.querySelectorAll(".tab-panel")),
      btnCloseSidebar: document.getElementById("btnCloseSidebar"),

      btnSidebar: document.getElementById("btnSidebar"),
      btnEditTools: document.getElementById("btnEditTools"),
      btnMenu: document.getElementById("btnMenu"),
      btnSettings: document.getElementById("btnSettings"),
      btnHelp: document.getElementById("btnHelp"),
      btnMic: document.getElementById("btnMic"),
      btnReplace: document.getElementById("btnReplace"),
      btnTemplates: document.getElementById("btnTemplates"),
      btnHistory: document.getElementById("btnHistory"),
      btnShare: document.getElementById("btnShare"),
      btnOverflow: document.getElementById("btnOverflow"),

      dlgHelp: document.getElementById("dlgHelp"),
      btnCloseHelp: document.getElementById("btnCloseHelp"),

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

      dlgSettings: document.getElementById("dlgSettings"),
      settingsAppearance: document.getElementById("panelSettingsAppearance"),
      settingsTemplates: document.getElementById("panelSettingsTemplates"),
      settingsShare: document.getElementById("panelSettingsShare"),
      settingsApi: document.getElementById("panelSettingsApi"),
      settingsTabs: Array.from(document.querySelectorAll("#dlgSettings .settings-tabs .tab-btn[data-tab]")),
      settingsPanels: Array.from(document.querySelectorAll("#dlgSettings .tab-panel")),
      fontSizeRange: document.getElementById("fontSizeRange"),
      fontSizeValue: document.getElementById("fontSizeValue"),
      fontFaceRadios: Array.from(document.querySelectorAll("input[name='fontFace']")),
      editPanelPosRadios: Array.from(document.querySelectorAll("input[name='editPanelPos']")),
      toolbarButtons: Array.from(document.querySelectorAll(".toolbar-item")),
      btnResetApp: document.getElementById("btnResetApp"),
      btnForceReload: document.getElementById("btnForceReload"),
      toolbarOrderList: document.getElementById("toolbarOrderList"),
      bottombar: document.querySelector(".bottombar"),
      apiKeyOpenAI: document.getElementById("apiKeyOpenAI"),
      apiKeyOther: document.getElementById("apiKeyOther"),
      btnCloseSettings: document.getElementById("btnCloseSettings"),
      templateList: document.getElementById("templateList"),
      templateForm: document.getElementById("templateForm"),
      templateId: document.getElementById("templateId"),
      templateName: document.getElementById("templateName"),
      templateText: document.getElementById("templateText"),
      btnTemplateReset: document.getElementById("btnTemplateReset"),

      sideHistory: document.getElementById("sideHistory"),
      btnSnapshot: document.getElementById("btnSnapshot"),
      autoSnapshotSelect: document.getElementById("autoSnapshotSelect"),
      historyList: document.getElementById("historyList"),

      dlgShare: document.getElementById("dlgShare"),
      btnOpenSettingsShare: document.getElementById("btnOpenSettingsShare"),
      btnShareAll: document.getElementById("btnShareAll"),
      btnShareSelection: document.getElementById("btnShareSelection"),
      btnNativeShare: document.getElementById("btnNativeShare"),
      btnCopy: document.getElementById("btnCopy"),
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
      btnCopySel: document.getElementById("btnCopySel"),
      btnCutSel: document.getElementById("btnCutSel"),
      btnPasteSel: document.getElementById("btnPasteSel"),
      btnBackspace: document.getElementById("btnBackspace"),
      btnDelete: document.getElementById("btnDelete"),

      caretLine: document.getElementById("caretLine"),
      caretDot: document.getElementById("caretDot"),

      menuOverlay: document.getElementById("menuOverlay"),
      menuPanel: document.getElementById("menuPanel"),
      overflowMenuItems: document.getElementById("overflowMenuItems"),
      btnCloseMenu: document.getElementById("btnCloseMenu"),

      updateToast: document.getElementById("updateToast"),
      btnUpdateApp: document.getElementById("btnUpdateApp"),
      btnUpdateLater: document.getElementById("btnUpdateLater")
    };
  }
})();
