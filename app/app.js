(() => {
  const APP_VERSION = "1.1.3";
  const VERSION_URL = "./version.json";
  const STORAGE_KEYS = {
    version: "koedeam.version",
    currentDraft: "koedeam.currentDraft",
    recentDrafts: "koedeam.recentDrafts",
    templates: "koedeam.templates",
    settings: "koedeam.settings"
  };
  const MAX_SHARE_SHORTCUTS = 8;
  const CHUNK_SEPARATOR = "\n\n――\n\n";

  const DEFAULT_TEMPLATES = [
    { id: uid(), name: "AI整理依頼", text: "次のメモを、目的・要点・次アクションの3項目で整理してください。\n\n[メモ]\n", updatedAt: Date.now() },
    { id: uid(), name: "要約と見出し", text: "次の文章を3〜5行で要約し、見出しを付けてください。\n\n[本文]\n", updatedAt: Date.now() },
    { id: uid(), name: "改善レビュー依頼", text: "次の下書きを、読みやすさ・説得力・簡潔さの観点で改善提案してください。\n\n[本文]\n", updatedAt: Date.now() },
    { id: uid(), name: "メール下書き", text: "件名：\n\n○○様\n\nいつもお世話になっております。\n\n要件：\n\nどうぞよろしくお願いいたします。", updatedAt: Date.now() },
    { id: uid(), name: "議事メモ", text: "# 議事メモ\n- 日時:\n- 参加者:\n\n## 決定事項\n- \n\n## ToDo\n- [ ] ", updatedAt: Date.now() },
    { id: uid(), name: "SNS投稿案", text: "以下の内容をSNS向けに3パターン作成してください。\n条件: 100文字前後 / 絵文字は控えめ / ハッシュタグ2つまで\n\n[内容]\n", updatedAt: Date.now() },
    { id: uid(), name: "PRDたたき台", text: "# PRD Draft\n## 背景\n\n## 課題\n\n## 目標\n\n## 機能要件\n- \n\n## 非機能要件\n- \n\n## 受け入れ条件\n- ", updatedAt: Date.now() },
    { id: uid(), name: "障害報告テンプレ", text: "# 障害報告\n- 発生日:\n- 影響範囲:\n- 検知方法:\n\n## 原因\n\n## 暫定対応\n\n## 恒久対応\n\n## 再発防止\n", updatedAt: Date.now() },
    { id: uid(), name: "翻訳依頼（日→英）", text: "次の日本語を自然なビジネス英語に翻訳してください。\n語調: 丁寧 / 簡潔\n\n[原文]\n", updatedAt: Date.now() },
    { id: uid(), name: "チェックリスト作成", text: "次の作業内容をチェックリスト化してください。\n優先度(高/中/低)も付けてください。\n\n[作業内容]\n", updatedAt: Date.now() }
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
    editPanelSections: {
      cursor: true,
      toolbar: true,
      range: true
    },
    sidebarTab: "templates",
    toolbar: {
      mic: true,
      voiceMode: true,
      replace: true,
      templates: false,
      history: false,
      edit: true,
      share: true
    },
    toolbarOrder: ["mic", "voiceMode", "replace", "templates", "history", "edit", "share"],
    toolbarPriority: ["replace", "mic", "voiceMode", "edit", "share", "history", "templates"],
    apiKeys: {
      openai: "",
      other: ""
    },
    shareShortcuts: [
      { id: uid(), name: "メール", urlTemplate: "mailto:?subject={title}&body={text}" },
      { id: uid(), name: "LINE", urlTemplate: "https://line.me/R/share?text={prompt}" },
      { id: uid(), name: "ChatGPT", urlTemplate: "https://chatgpt.com/?q={prompt}" },
      { id: uid(), name: "Gemini", urlTemplate: "https://gemini.google.com/app?q={prompt}" },
      { id: uid(), name: "X", urlTemplate: "https://x.com/intent/tweet?text={prompt}" },
      { id: uid(), name: "Google翻訳", urlTemplate: "https://translate.google.com/?sl=auto&tl=en&text={prompt}&op=translate" },
      { id: uid(), name: "DeepL", urlTemplate: "https://www.deepl.com/translator#ja/en/{prompt}" },
      { id: uid(), name: "GitHub Issue", urlTemplate: "https://github.com/issues/new?title={title}&body={text}" }
    ],
    documents: [],
    currentDocId: "",
    ui: { sidebar: false },
    candidate: {
      threshold: 0.65,
      noConfidenceRule: "show",
      idleBehavior: "auto",
      idleMs: 3500
    },
    undoDepth: 3
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
    overflowedTools: [],
    isComposing: false,
    deferredInstallPrompt: null,
    voiceSessionState: "STOPPED",
    voiceRestartTimer: null,
    voiceRestartAttempt: 0,
    voiceManualStop: false,
    stopVoiceInput: null,
    editPanelMode: "navigation",
    timeMenuOpen: false,
    telemetry: {
      events: [],
      sessions: [],
      activeSession: null,
      maxSessions: 200
    },
    candidateState: {
      list: [],
      timer: null,
      pending: null
    },
    history: {
      undoStack: [],
      redoStack: [],
      typingTimer: null,
      applying: false,
      maxDepth: 3
    },
    nextInputReason: ""
  };

  const el = getElements();
  init();

  function init() {
    migrateVersion();
    state.draft = safeGetString(STORAGE_KEYS.currentDraft, "");
    state.recentDrafts = safeGetArray(STORAGE_KEYS.recentDrafts, []);
    state.templates = safeGetArray(STORAGE_KEYS.templates, DEFAULT_TEMPLATES);
    state.settings = safeGetObject(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    if (state.settings.sidebarTab === "replace") {
      state.settings.sidebarTab = "templates";
      saveSettings();
    }
    if (state.settings.voiceInsertMode === "replace") {
      state.settings.voiceInsertMode = "cursor";
      saveSettings();
    }
    if (!["off", "cursor", "append"].includes(state.settings.voiceInsertMode)) {
      state.settings.voiceInsertMode = "cursor";
      saveSettings();
    }
    if (!state.settings.candidate || typeof state.settings.candidate !== "object") {
      state.settings.candidate = { ...DEFAULT_SETTINGS.candidate };
      saveSettings();
    }
    state.settings.undoDepth = Number.isFinite(Number(state.settings.undoDepth))
      ? Math.max(1, Math.min(5, Number(state.settings.undoDepth)))
      : DEFAULT_SETTINGS.undoDepth;
    normalizeEditPanelSections();
    ensureDocuments();
    const currentDoc = getCurrentDocument();
    state.draft = currentDoc?.text || state.draft || "";
    el.editor.value = state.draft;
    applySidebar();
    applyVoiceModeUI();
    applyPunctuationUI();
    applyTypography();
    applyInstallHints();
    applyEditPanelPosition();
    applyEditPanelSections();
    applyEditPanelMode();
    applyCandidateSettingsUI();
    applyUndoSettingsUI();
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
    setupInstallPrompt();
    setupVersionPolling();
    setupViewportWatcher();
    seedUndoState();
  }

  function bindEvents() {
    let saveTimer = null;
    const closeMenuIfOpen = () => {
      if (el.menuOverlay && !el.menuOverlay.classList.contains("hidden")) closeMenu();
    };
    el.editor.addEventListener("input", () => {
      const inputReason = state.nextInputReason || "typing";
      state.nextInputReason = "";
      if (!canType()) return;
      if (saveTimer) clearTimeout(saveTimer);
      el.saveStatus.textContent = "Typing...";
      applyPrimary("EDIT");
      applySystemState("SAVING");
      saveTimer = setTimeout(() => {
        state.draft = el.editor.value;
        syncCurrentDocumentFromEditor();
        safeSet(STORAGE_KEYS.currentDraft, state.draft);
        el.saveStatus.textContent = "Saved";
        applySystemState(navigator.onLine ? "LOCAL" : "OFFLINE");
      }, 800);
      if (!state.history.applying) {
        if (inputReason === "typing") scheduleTypingHistoryCommit();
        else pushUndoSnapshot(inputReason);
      }
      updateCaretUI();
    });
    el.editor.addEventListener("compositionstart", () => {
      state.isComposing = true;
    });
    el.editor.addEventListener("compositionend", () => {
      state.isComposing = false;
    });
    el.editor.addEventListener("beforeinput", (evt) => {
      if (!canType()) evt.preventDefault();
    });
    el.editor.addEventListener("paste", (evt) => {
      if (!canType()) evt.preventDefault();
    });
    el.editor.addEventListener("keydown", (evt) => {
      if ((evt.metaKey || evt.ctrlKey) && !evt.shiftKey && evt.key.toLowerCase() === "z") {
        evt.preventDefault();
        undoEdit();
        return;
      }
      if ((evt.metaKey || evt.ctrlKey) && (evt.key.toLowerCase() === "y" || (evt.shiftKey && evt.key.toLowerCase() === "z"))) {
        evt.preventDefault();
        redoEdit();
        return;
      }
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
    if (el.editGroupToggles?.length) {
      el.editToolsPanel.addEventListener("click", (evt) => {
        const btn = evt.target.closest(".edit-group-toggle[data-section]");
        if (!btn) return;
        toggleEditPanelSection(btn.dataset.section);
      });
    }
    if (el.btnEditModeNavigation) {
      el.btnEditModeNavigation.addEventListener("click", () => setEditPanelMode("navigation"));
    }
    if (el.btnEditModeEdit) {
      el.btnEditModeEdit.addEventListener("click", () => setEditPanelMode("edit"));
    }
    if (el.btnEditModeAssist) {
      el.btnEditModeAssist.addEventListener("click", () => setEditPanelMode("assist"));
    }
    if (el.editToolsPanel) {
      el.editToolsPanel.addEventListener("click", (evt) => {
        const btn = evt.target.closest("button[data-edit-mode]");
        if (!btn) return;
        setEditPanelMode(btn.dataset.editMode || "navigation");
      });
    }
    el.editToolsPanel.addEventListener("mousedown", (evt) => {
      if (!evt.target.closest("button")) return;
      // Keep editor focus during desktop pointer operations to reduce flicker.
      evt.preventDefault();
    });
    document.addEventListener("dblclick", (evt) => {
      if (!evt.target.closest("button, .btn-icon, .nav-pad, .nav-wide, .chip, .tab-btn")) return;
      evt.preventDefault();
    }, { passive: false });
    document.addEventListener("pointerdown", (evt) => {
      if (!state.timeMenuOpen) return;
      if (evt.target.closest("#timeMenuPanel, #btnTimeMenu")) return;
      setTimeMenuOpen(false);
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
        pushUiHistory();
        closeDialogsExcept("help");
        if (state.settings.ui.sidebar) {
          state.settings.ui.sidebar = false;
          applySidebar();
          saveSettings();
        }
        setEditToolsVisible(false);
        applyPrimary("CONFIG");
        enforceKeyboardPolicy();
        el.dlgHelp.showModal();
      });
    }
    if (el.btnHelpInstallPwa) {
      el.btnHelpInstallPwa.addEventListener("click", async () => {
        if (state.deferredInstallPrompt) {
          try {
            state.deferredInstallPrompt.prompt();
            const result = await state.deferredInstallPrompt.userChoice;
            state.deferredInstallPrompt = null;
            el.btnHelpInstallPwa.disabled = true;
            toast(result?.outcome === "accepted" ? "インストールを開始しました" : "インストールをキャンセルしました");
            return;
          } catch {
            toast("インストールを開始できませんでした");
            return;
          }
        }
        const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        toast(isiOS ? "iOSは共有メニューから「ホーム画面に追加」を実行してください" : "この環境ではインストールショートカットを利用できません");
      });
    }
    el.btnCloseHelp.addEventListener("click", () => el.dlgHelp.close());
    el.dlgHelp.addEventListener("close", () => applyPrimary("EDIT"));

    el.btnReplace.addEventListener("click", () => {
      closeMenuIfOpen();
      openFindReplace(false);
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
      openSnapshotPanel();
    });
    if (el.btnBrandDocuments) {
      el.btnBrandDocuments.addEventListener("click", () => {
        closeMenuIfOpen();
        openDocumentListPanel();
      });
    }
    if (el.btnOpenDocuments) {
      el.btnOpenDocuments.addEventListener("click", () => openDocumentListPanel());
    }
    if (el.btnNewDoc) {
      el.btnNewDoc.addEventListener("click", () => createDocument());
    }
    if (el.btnOpenSnapshotPanel) {
      el.btnOpenSnapshotPanel.addEventListener("click", () => openSnapshotPanel());
    }
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
    if (el.snapshotAutoSnapshotSelect) {
      el.snapshotAutoSnapshotSelect.addEventListener("change", () => {
        const mins = Number(el.snapshotAutoSnapshotSelect.value || 0);
        state.settings.autoSnapshotMinutes = Number.isFinite(mins) ? mins : 0;
        saveSettings();
        setupAutoSnapshot();
        renderHistory();
      });
    }
    if (el.btnSnapshotSave) {
      el.btnSnapshotSave.addEventListener("click", () => {
        snapshotDraft();
        renderHistory();
        renderSidebar();
      });
    }
    if (el.btnCloseSnapshot) {
      el.btnCloseSnapshot.addEventListener("click", () => el.dlgSnapshot.close());
    }
    if (el.btnCloseDocuments) {
      el.btnCloseDocuments.addEventListener("click", () => el.dlgDocuments.close());
    }
    if (el.dlgSnapshot) {
      el.dlgSnapshot.addEventListener("close", () => applyPrimary("EDIT"));
    }
    if (el.dlgDocuments) {
      el.dlgDocuments.addEventListener("close", () => applyPrimary("EDIT"));
    }
    if (el.btnCloseSearch) {
      el.btnCloseSearch.addEventListener("click", () => el.dlgSearch.close());
    }
    if (el.dlgSearch) {
      el.dlgSearch.addEventListener("close", () => applyPrimary("EDIT"));
    }
    if (el.documentsList) {
      el.documentsList.addEventListener("click", (evt) => handleDocumentAction(evt));
    }
    if (el.snapshotHistoryList) {
      el.snapshotHistoryList.addEventListener("click", (evt) => handleHistoryAction(evt));
      el.snapshotHistoryList.addEventListener("change", (evt) => handleHistoryAction(evt));
    }

    el.btnShare.addEventListener("click", () => {
      renderShareShortcuts();
      pushUiHistory();
      closeDialogsExcept("share");
      if (state.settings.ui.sidebar) {
        state.settings.ui.sidebar = false;
        applySidebar();
        saveSettings();
      }
      setEditToolsVisible(false);
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
    if (el.btnSelectBlock) el.btnSelectBlock.addEventListener("click", selectBlock);
    el.btnSelectPara.addEventListener("click", selectBlock);
    el.btnSelectParaPrev.addEventListener("click", () => moveParagraph(-1));
    el.btnSelectParaNext.addEventListener("click", () => moveParagraph(1));
    el.btnExpandUp.addEventListener("click", () => expandSelection(-1));
    el.btnExpandDown.addEventListener("click", () => expandSelection(1));
    if (el.btnShrinkUp) el.btnShrinkUp.addEventListener("click", () => shrinkSelection(-1));
    el.btnShrinkDown.addEventListener("click", () => shrinkSelection(1));
    el.btnSelectAll.addEventListener("click", () => {
      focusEditorForEditAction();
      el.editor.select();
    });
    el.btnLineStart.addEventListener("click", () => moveToLineEdge("start"));
    el.btnLineEnd.addEventListener("click", () => moveToLineEdge("end"));
    el.btnDocStart.addEventListener("click", () => moveToDocumentEdge("start"));
    el.btnDocEnd.addEventListener("click", () => moveToDocumentEdge("end"));
    el.btnDeleteToLineStart.addEventListener("click", () => deleteToLineEdge("start"));
    el.btnDeleteToLineEnd.addEventListener("click", () => deleteToLineEdge("end"));
    el.btnMoveUp.addEventListener("click", () => moveCursorLine(-1));
    el.btnMoveDown.addEventListener("click", () => moveCursorLine(1));
    el.btnMoveLeft.addEventListener("click", () => moveCursorChar(-1));
    el.btnMoveRight.addEventListener("click", () => moveCursorChar(1));
    el.btnPuncMode.addEventListener("click", togglePunctuationMode);
    el.btnComma.addEventListener("click", () => insertPunctuation("comma"));
    el.btnPeriod.addEventListener("click", () => insertPunctuation("period"));
    el.btnNewline.addEventListener("click", () => insertTextAtCursor("\n"));
    if (el.btnTimeMenu) {
      el.btnTimeMenu.addEventListener("click", () => toggleTimeMenu());
    }
    if (el.timeMenuPanel) {
      el.timeMenuPanel.addEventListener("click", (evt) => {
        const btn = evt.target.closest("button[data-time-action]");
        if (!btn) return;
        runTimeMenuAction(btn.dataset.timeAction || "");
      });
    }
    if (el.btnChunkDelete) el.btnChunkDelete.addEventListener("click", deleteCurrentChunk);
    if (el.btnChunkSplit) el.btnChunkSplit.addEventListener("click", splitCurrentChunk);
    if (el.btnChunkMerge) el.btnChunkMerge.addEventListener("click", mergeCurrentChunk);
    if (el.btnChunkFormat) el.btnChunkFormat.addEventListener("click", formatCurrentChunk);
    if (el.btnTelemetryExportJson) el.btnTelemetryExportJson.addEventListener("click", exportTelemetryJson);
    if (el.btnTelemetryCopyJson) el.btnTelemetryCopyJson.addEventListener("click", copyTelemetryJson);
    if (el.btnUndo) el.btnUndo.addEventListener("click", undoEdit);
    if (el.btnRedo) el.btnRedo.addEventListener("click", redoEdit);
    if (el.undoDepth) {
      el.undoDepth.addEventListener("change", () => {
        const depth = Number(el.undoDepth.value);
        state.settings.undoDepth = Number.isFinite(depth) ? Math.max(1, Math.min(5, depth)) : 3;
        state.history.maxDepth = state.settings.undoDepth;
        trimUndoStack();
        applyUndoSettingsUI();
        saveSettings();
      });
    }
    if (el.candidateThreshold) {
      el.candidateThreshold.addEventListener("change", () => {
        const v = Number(el.candidateThreshold.value);
        state.settings.candidate.threshold = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.65;
        applyCandidateSettingsUI();
        saveSettings();
      });
    }
    if (el.candidateNoConfidenceRule) {
      el.candidateNoConfidenceRule.addEventListener("change", () => {
        state.settings.candidate.noConfidenceRule = el.candidateNoConfidenceRule.value === "direct" ? "direct" : "show";
        saveSettings();
      });
    }
    if (el.candidateIdleBehavior) {
      el.candidateIdleBehavior.addEventListener("change", () => {
        state.settings.candidate.idleBehavior = el.candidateIdleBehavior.value === "hold" ? "hold" : "auto";
        saveSettings();
      });
    }
    if (el.candidateList) {
      el.candidateList.addEventListener("click", (evt) => {
        const btn = evt.target.closest("button[data-candidate-index]");
        if (!btn) return;
        const idx = Number(btn.dataset.candidateIndex || "0");
        applyCandidateSelection(idx);
      });
    }
    el.btnCopySel.addEventListener("click", copySelection);
    el.btnCutSel.addEventListener("click", cutSelection);
    el.btnPasteSel.addEventListener("click", pasteClipboard);
    el.btnBackspace.addEventListener("click", () => deleteByDirection(-1));
    el.btnDelete.addEventListener("click", () => deleteByDirection(1));
    if (el.btnVoiceMode) {
      el.btnVoiceMode.addEventListener("click", () => {
        const modes = ["off", "cursor", "append"];
        const idx = modes.indexOf(state.settings.voiceInsertMode);
        const next = modes[(idx + 1) % modes.length] || "cursor";
        state.settings.voiceInsertMode = next;
        applyVoiceModeUI();
        if (state.speaking) {
          if (next === "off") {
            state.stopVoiceInput?.();
          } else {
            applyInputState(next === "append" ? "VOICE_APPEND" : "VOICE_LOCKED");
          }
        }
        saveSettings();
      });
    }
    el.voiceModeRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        state.settings.voiceInsertMode = radio.value;
        applyVoiceModeUI();
        if (state.speaking) {
          if (radio.value === "off") {
            state.stopVoiceInput?.();
          } else {
            applyInputState(radio.value === "append" ? "VOICE_APPEND" : "VOICE_LOCKED");
          }
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
        if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return;
        if (!input.dataset.tool) return;
        const tool = input.dataset.tool === "find" ? "replace" : input.dataset.tool;
        state.settings.toolbar = state.settings.toolbar || {};
        state.settings.toolbar[tool] = input.checked;
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

    el.btnUpdateApp.addEventListener("click", handleUpdateNow);
    el.btnUpdateLater.addEventListener("click", () => {
      state.dismissedUpdate = true;
      el.updateToast.classList.add("hidden");
      applySystemState(navigator.onLine ? "LOCAL" : "OFFLINE");
    });

    setupDialogDismiss();
    setupMenuOverlay();
    setupBackNavigation();
    window.addEventListener("resize", () => {
      applyLayoutState();
      updateOverflowToolbar();
      requestAnimationFrame(updateEditPanelSize);
    });
    window.addEventListener("orientationchange", () => {
      applyLayoutState();
      updateOverflowToolbar();
      requestAnimationFrame(updateEditPanelSize);
    });

    document.addEventListener("keydown", (evt) => {
      if (evt.isComposing || state.isComposing) return;
      const ctrl = evt.ctrlKey || evt.metaKey;
      if (ctrl && evt.key.toLowerCase() === "f") {
        evt.preventDefault();
        openFindReplace(false);
      } else if (ctrl && evt.key.toLowerCase() === "h") {
        evt.preventDefault();
        openFindReplace(true);
      } else if (ctrl && evt.key.toLowerCase() === "k") {
        evt.preventDefault();
        pushUiHistory();
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
    if (isDialogLayerOpen() || el.dlgSnapshot?.open) {
      toast("現在のパネルを閉じてから検索を開いてください");
      return;
    }
    pushUiHistory();
    closeDialogsExcept("search");
    if (state.settings.ui.sidebar) {
      state.settings.ui.sidebar = false;
      applySidebar();
      saveSettings();
    }
    setEditToolsVisible(false);
    applyPrimary("SEARCH");
    enforceKeyboardPolicy();
    renderFindRecent();
    applySearchOptionsUI();
    refreshMatches();
    if (el.dlgSearch && !el.dlgSearch.open) el.dlgSearch.showModal();
    (focusReplace ? el.replaceQuery : el.findQuery).focus();
  }

  function setupDialogDismiss() {
    [el.dlgHelp, el.dlgShare, el.dlgSettings, el.dlgDocuments, el.dlgSnapshot, el.dlgSearch].forEach((dialog) => {
      if (!dialog) return;
      dialog.addEventListener("click", (evt) => {
        if (evt.target !== dialog) return;
        const ok = confirm("閉じますか？未保存の変更がある場合は失われる可能性があります。");
        if (ok) dialog.close();
      });
    });
  }

  function closeDialogsExcept(kind) {
    const map = {
      help: el.dlgHelp,
      share: el.dlgShare,
      settings: el.dlgSettings,
      documents: el.dlgDocuments,
      snapshot: el.dlgSnapshot,
      search: el.dlgSearch
    };
    Object.entries(map).forEach(([key, dialog]) => {
      if (!dialog || key === kind) return;
      if (dialog.open) dialog.close();
    });
  }

  function isDialogLayerOpen() {
    return !!(el.dlgHelp?.open || el.dlgShare?.open || el.dlgSettings?.open || el.dlgDocuments?.open);
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
      if (act === "replace" || act === "templates" || act === "history" || act === "edit" || act === "share" || act === "mic") {
        triggerToolbarTool(act);
      } else if (act === "documents") openDocumentListPanel();
      else if (act === "snapshot") openSnapshotPanel();
      else if (act === "settings") openSettings("appearance");
      else if (act === "help") {
        applyPrimary("CONFIG");
        enforceKeyboardPolicy();
        el.dlgHelp.showModal();
      }
    });
  }

  function setupBackNavigation() {
    if (history.state?.koedeamBase !== true) {
      history.replaceState({ koedeamBase: true }, "");
    }
    window.addEventListener("popstate", () => {
      const handled = closeTransientUi();
      if (handled) {
        applyPrimary("EDIT");
      }
    });
  }

  function pushUiHistory() {
    history.pushState({ koedeamUi: true, at: Date.now() }, "");
  }

  function closeTransientUi() {
    if (closeOpenDialog()) return true;
    if (!el.menuOverlay.classList.contains("hidden")) {
      closeMenu();
      return true;
    }
    if (state.settings.ui.sidebar) {
      state.settings.ui.sidebar = false;
      applySidebar();
      saveSettings();
      return true;
    }
    if (state.editToolsVisible) {
      setEditToolsVisible(false);
      return true;
    }
    return false;
  }

  function openMenu() {
    pushUiHistory();
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
    else if (tool === "voiceMode") el.btnVoiceMode.click();
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

  function ensureDocuments() {
    const docs = Array.isArray(state.settings.documents) ? state.settings.documents : [];
    if (docs.length) {
      state.settings.documents = docs;
    } else {
      const seedText = state.draft || "";
      state.settings.documents = [{
        id: uid(),
        title: firstLine(seedText) || "無題ドキュメント",
        text: seedText,
        updatedAt: Date.now()
      }];
    }
    const exists = state.settings.documents.some((doc) => doc.id === state.settings.currentDocId);
    if (!exists) state.settings.currentDocId = state.settings.documents[0].id;
    saveSettings();
    renderDocumentLists();
  }

  function getCurrentDocument() {
    return state.settings.documents.find((doc) => doc.id === state.settings.currentDocId) || null;
  }

  function syncCurrentDocumentFromEditor() {
    const current = getCurrentDocument();
    if (!current) return;
    current.text = el.editor.value;
    current.title = firstLine(current.text) || "無題ドキュメント";
    current.updatedAt = Date.now();
    saveSettings();
    renderDocumentLists();
  }

  function createDocument() {
    const doc = {
      id: uid(),
      title: "無題ドキュメント",
      text: "",
      updatedAt: Date.now()
    };
    state.settings.documents.unshift(doc);
    state.settings.currentDocId = doc.id;
    state.draft = "";
    el.editor.value = "";
    saveSettings();
    safeSet(STORAGE_KEYS.currentDraft, state.draft);
    renderDocumentLists();
    if (el.dlgSnapshot?.open) renderHistory();
    toast("新規ドキュメントを作成");
    el.editor.focus();
    applyPrimary("EDIT");
    enforceKeyboardPolicy();
  }

  function switchDocument(docId) {
    const doc = state.settings.documents.find((item) => item.id === docId);
    if (!doc) return;
    syncCurrentDocumentFromEditor();
    state.settings.currentDocId = doc.id;
    state.draft = doc.text || "";
    el.editor.value = state.draft;
    saveSettings();
    safeSet(STORAGE_KEYS.currentDraft, state.draft);
    renderDocumentLists();
    updateCaretUI();
    toast("ドキュメントを切り替えました");
    applyPrimary("EDIT");
    enforceKeyboardPolicy();
  }

  function handleDocumentAction(evt) {
    const btn = evt.target.closest("button[data-doc-act]");
    if (!(btn instanceof HTMLButtonElement)) return;
    const id = btn.dataset.id;
    const act = btn.dataset.docAct;
    if (!id || !act) return;
    if (act === "open") {
      switchDocument(id);
      return;
    }
    if (act === "delete") {
      if (state.settings.documents.length <= 1) {
        toast("最後の1件は削除できません");
        return;
      }
      const ok = confirm("このドキュメントを削除します。よろしいですか？");
      if (!ok) return;
      state.settings.documents = state.settings.documents.filter((doc) => doc.id !== id);
      if (state.settings.currentDocId === id) {
        state.settings.currentDocId = state.settings.documents[0]?.id || "";
        const current = getCurrentDocument();
        state.draft = current?.text || "";
        el.editor.value = state.draft;
        safeSet(STORAGE_KEYS.currentDraft, state.draft);
      }
      saveSettings();
      renderDocumentLists();
      toast("ドキュメントを削除しました");
    }
  }

  function renderDocumentLists() {
    if (!el.documentsList) return;
    const docs = state.settings.documents || [];
    const html = docs.map((doc) => {
      const active = doc.id === state.settings.currentDocId;
      return `<div class="dialog-item">
        <div class="dialog-item-head">
          <strong>${active ? "● " : ""}${escapeHtml(doc.title || "無題ドキュメント")}</strong>
          <small>${new Date(doc.updatedAt || Date.now()).toLocaleString()}</small>
        </div>
        <div class="dialog-actions">
          <button type="button" data-doc-act="open" data-id="${doc.id}">開く</button>
          <button type="button" data-doc-act="delete" data-id="${doc.id}">削除</button>
        </div>
      </div>`;
    }).join("");
    const empty = '<p class="dialog-item">ドキュメントはありません。</p>';
    el.documentsList.innerHTML = html || empty;
  }

  function snapshotDraft() {
    snapshotDraftInternal(false);
  }

  function snapshotDraftInternal(isAuto) {
    const text = el.editor.value;
    if (!text.trim()) return toast("空の本文は保存しません");
    if (isAuto && text === state.lastAutoSnapshotText) return;
    const currentDoc = getCurrentDocument();
    const title = firstLine(text);
    const item = {
      id: uid(),
      docId: currentDoc?.id || "",
      title,
      text,
      updatedAt: Date.now()
    };
    state.recentDrafts.unshift(item);
    state.recentDrafts = state.recentDrafts.slice(0, 5);
    persistRecentDrafts();
    state.lastAutoSnapshotText = text;
    toast(isAuto ? "自動スナップショットを保存" : "スナップショットを保存");
  }

  function renderHistory() {
    const targets = [el.historyList, el.snapshotHistoryList].filter(Boolean);
    targets.forEach((target) => { target.innerHTML = ""; });
    if (el.autoSnapshotSelect) el.autoSnapshotSelect.value = String(state.settings.autoSnapshotMinutes || 0);
    if (el.snapshotAutoSnapshotSelect) el.snapshotAutoSnapshotSelect.value = String(state.settings.autoSnapshotMinutes || 0);
    renderDocumentLists();
    const currentDocId = state.settings.currentDocId || "";
    const items = state.recentDrafts.filter((h) => !h.docId || h.docId === currentDocId);
    if (!items.length) {
      targets.forEach((target) => { target.innerHTML = '<p class="dialog-item">履歴はありません。</p>'; });
      return;
    }
    for (const h of items) {
      for (const target of targets) {
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
        target.append(row);
      }
    }
  }

  function handleHistoryAction(evt) {
    const target = evt.target;
    if (target instanceof HTMLInputElement && target.dataset.act === "title") {
      const item = state.recentDrafts.find((h) => h.id === target.dataset.hid);
      if (item) {
        item.title = target.value.trim() || firstLine(item.text);
        persistRecentDrafts();
        renderHistory();
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
      if (item.docId && item.docId !== state.settings.currentDocId) {
        switchDocument(item.docId);
      }
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
    for (const s of state.settings.shareShortcuts.slice(0, MAX_SHARE_SHORTCUTS)) {
      const shareRow = document.createElement("button");
      shareRow.type = "button";
      shareRow.className = "share-shortcut-btn";
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
    state.settings.shareShortcuts = state.settings.shareShortcuts.slice(0, MAX_SHARE_SHORTCUTS);
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
      applySidebarTab(state.settings.sidebarTab || "templates");
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
    el.sideTabs = Array.from(document.querySelectorAll("#sidebar .side-tabs .tab-btn[data-tab]"));
    el.tabPanels = Array.from(document.querySelectorAll("#sidebar .tab-panel"));
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

  function applyCandidateSettingsUI() {
    const c = state.settings.candidate || DEFAULT_SETTINGS.candidate;
    state.settings.candidate = {
      threshold: Number.isFinite(Number(c.threshold)) ? Math.max(0, Math.min(1, Number(c.threshold))) : 0.65,
      noConfidenceRule: c.noConfidenceRule === "direct" ? "direct" : "show",
      idleBehavior: c.idleBehavior === "hold" ? "hold" : "auto",
      idleMs: Number.isFinite(Number(c.idleMs)) ? Math.max(1000, Number(c.idleMs)) : 3500
    };
    if (el.candidateThreshold) el.candidateThreshold.value = String(state.settings.candidate.threshold);
    if (el.candidateNoConfidenceRule) el.candidateNoConfidenceRule.value = state.settings.candidate.noConfidenceRule;
    if (el.candidateIdleBehavior) el.candidateIdleBehavior.value = state.settings.candidate.idleBehavior;
  }

  function clearCandidateTimer() {
    if (!state.candidateState.timer) return;
    clearTimeout(state.candidateState.timer);
    state.candidateState.timer = null;
  }

  function hideCandidatePanel() {
    clearCandidateTimer();
    state.candidateState.pending = null;
    state.candidateState.list = [];
    if (!el.candidatePanel || !el.candidateList) return;
    el.candidatePanel.classList.add("hidden");
    el.candidatePanel.setAttribute("aria-hidden", "true");
    el.candidateList.innerHTML = "";
  }

  function renderCandidatePanel(items) {
    state.candidateState.list = items.slice(0, 3);
    if (!el.candidatePanel || !el.candidateList) return;
    el.candidatePanel.classList.remove("hidden");
    el.candidatePanel.setAttribute("aria-hidden", "false");
    el.candidateList.innerHTML = state.candidateState.list.map((c, i) => {
      const rank = ["①", "②", "③"][i] || `${i + 1}.`;
      const cf = Number.isFinite(c.confidence) ? ` (${Math.round(c.confidence * 100)}%)` : "";
      return `<button type="button" data-candidate-index="${i}">${rank} ${escapeHtml(c.text)}${cf}</button>`;
    }).join("");
  }

  function applyCandidateSelection(index) {
    const pending = state.candidateState.pending;
    if (!pending) return;
    const item = state.candidateState.list[index] || state.candidateState.list[0];
    if (!item) return;
    insertByVoiceMode(item.text);
    hideCandidatePanel();
  }

  function shouldShowCandidates(candidates) {
    if (!candidates || candidates.length <= 1) return false;
    const top = candidates[0];
    if (!Number.isFinite(top.confidence)) {
      return state.settings.candidate.noConfidenceRule !== "direct";
    }
    return top.confidence < Number(state.settings.candidate.threshold || 0.65);
  }

  function queueCandidateSelection(candidates) {
    state.candidateState.pending = { at: Date.now() };
    renderCandidatePanel(candidates);
    clearCandidateTimer();
    if (state.settings.candidate.idleBehavior === "auto") {
      state.candidateState.timer = setTimeout(() => {
        applyCandidateSelection(0);
      }, Number(state.settings.candidate.idleMs || 3500));
    }
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
    recognition.continuous = false;

    const clearRestartTimer = () => {
      if (!state.voiceRestartTimer) return;
      clearTimeout(state.voiceRestartTimer);
      state.voiceRestartTimer = null;
    };

    const applyVoiceSessionState = (next) => {
      state.voiceSessionState = next;
      updateStatusIndicator();
    };

    const sessionRecord = (eventName, payload = {}) => {
      const ts = new Date().toISOString();
      const docId = state.settings.currentDocId || "";
      const base = {
        ts,
        sessionId: state.telemetry.activeSession?.id || "",
        docId,
        layout: state.layoutMode,
        primaryState: state.primary,
        inputState: state.input,
        event: eventName
      };
      const item = { ...base, ...payload };
      state.telemetry.events.push(item);
      if (state.telemetry.events.length > 2000) {
        state.telemetry.events.splice(0, state.telemetry.events.length - 2000);
      }
    };

    const startTelemetrySession = () => {
      const id = `voice-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      state.telemetry.activeSession = {
        id,
        startedAt: Date.now(),
        firstInterimAt: null,
        firstFinalAt: null,
        endedAt: null,
        restartScheduledAt: null,
        restartStartedAt: null
      };
      state.telemetry.sessions.push(state.telemetry.activeSession);
      if (state.telemetry.sessions.length > state.telemetry.maxSessions) {
        state.telemetry.sessions.splice(0, state.telemetry.sessions.length - state.telemetry.maxSessions);
      }
      sessionRecord("voice.onstart");
    };

    const closeTelemetrySession = (reason) => {
      const session = state.telemetry.activeSession;
      if (!session) return;
      session.endedAt = Date.now();
      sessionRecord("voice.onend", { reason: reason || "end" });
      state.telemetry.activeSession = null;
    };

    const canAutoRestart = () => {
      if (!state.speaking) return false;
      if (state.primary !== "EDIT") return false;
      if (state.settings.voiceInsertMode === "off") return false;
      return true;
    };

    const requestStopVoice = () => {
      clearRestartTimer();
      state.voiceManualStop = true;
      state.speaking = false;
      applyVoiceSessionState("STOPPED");
      sessionRecord("voice.stop.requested", { reason: "manual" });
      recognition.stop();
    };

    const scheduleRestart = (reason) => {
      if (!canAutoRestart()) {
        state.speaking = false;
        applyVoiceSessionState("STOPPED");
        applyInputState("VOICE_OFF");
        el.btnMic.innerHTML = '<span class="icon">🎤</span>音声入力';
        return;
      }
      clearRestartTimer();
      applyVoiceSessionState("RESTART_WAIT");
      if (state.telemetry.activeSession) state.telemetry.activeSession.restartScheduledAt = Date.now();
      sessionRecord("voice.restart.scheduled", { cause: reason, delayMs: reason === "no-speech" ? 300 : 650 });
      state.voiceRestartTimer = setTimeout(() => {
        state.voiceRestartTimer = null;
        if (!canAutoRestart()) return;
        try {
          state.voiceRestartAttempt += 1;
          applyVoiceSessionState("PERMISSION_WAIT");
          if (state.telemetry.activeSession) state.telemetry.activeSession.restartStartedAt = Date.now();
          sessionRecord("voice.restart.started", { attempt: state.voiceRestartAttempt });
          recognition.start();
        } catch {
          toast("音声入力の再開に失敗しました");
          state.speaking = false;
          applyVoiceSessionState("STOPPED");
          applyInputState("VOICE_OFF");
          el.btnMic.innerHTML = '<span class="icon">🎤</span>音声入力';
        }
      }, reason === "no-speech" ? 300 : 650);
    };

    recognition.addEventListener("result", (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const session = state.telemetry.activeSession;
        if (!result.isFinal && session && session.firstInterimAt == null) {
          session.firstInterimAt = Date.now();
        }
        sessionRecord(result.isFinal ? "voice.onresult.final" : "voice.onresult.interim", {
          resultIndex: i,
          charLen: `${result[0]?.transcript || ""}`.length
        });
        if (!result.isFinal) continue;
        const candidates = [];
        for (let j = 0; j < Math.min(3, result.length || 0); j += 1) {
          const alt = result[j];
          candidates.push({
            text: `${alt?.transcript || ""}`.trim(),
            confidence: Number.isFinite(alt?.confidence) ? Number(alt.confidence) : null
          });
        }
        const filtered = candidates.filter((c) => c.text);
        if (!filtered.length) continue;
        if (session && session.firstFinalAt == null) session.firstFinalAt = Date.now();
        if (shouldShowCandidates(filtered)) {
          queueCandidateSelection(filtered);
        } else {
          insertByVoiceMode(filtered[0].text);
        }
      }
    });
    recognition.addEventListener("start", () => {
      state.voiceRestartAttempt = 0;
      applyVoiceSessionState("RUNNING");
      state.speaking = true;
      startTelemetrySession();
      el.btnMic.innerHTML = '<span class="icon">■</span>停止';
      applyInputState(state.settings.voiceInsertMode === "append" ? "VOICE_APPEND" : "VOICE_LOCKED");
    });
    recognition.addEventListener("error", (event) => {
      const err = event?.error || "unknown";
      sessionRecord("voice.onerror", { error: err });
      if (err === "aborted" && state.voiceManualStop) {
        return;
      }
      if (err === "no-speech" || err === "network" || err === "audio-capture") {
        scheduleRestart(err);
        return;
      }
      toast(`音声入力エラー: ${err}`);
      state.speaking = false;
      clearRestartTimer();
      applyVoiceSessionState("STOPPED");
      applyInputState("VOICE_OFF");
      closeTelemetrySession("error");
      el.btnMic.innerHTML = '<span class="icon">🎤</span>音声入力';
    });
    recognition.addEventListener("end", () => {
      if (state.voiceManualStop) {
        state.voiceManualStop = false;
        state.speaking = false;
        applyVoiceSessionState("STOPPED");
        el.btnMic.innerHTML = '<span class="icon">🎤</span>音声入力';
        applyInputState("VOICE_OFF");
        hideCandidatePanel();
        closeTelemetrySession("manual");
        return;
      }
      hideCandidatePanel();
      closeTelemetrySession("auto-end");
      scheduleRestart("end");
    });

    el.btnMic.addEventListener("click", () => {
      if (state.speaking) {
        requestStopVoice();
        return;
      }
      if (state.settings.voiceInsertMode === "off") {
        toast("音声モードがOFFです。ツールバーの音声モードを切り替えてください。");
        return;
      }
      try {
        clearRestartTimer();
        applyVoiceSessionState("PERMISSION_WAIT");
        state.voiceManualStop = false;
        recognition.start();
      } catch {
        applyVoiceSessionState("STOPPED");
        toast("音声入力を開始できませんでした");
      }
    });

    state.stopVoiceInput = requestStopVoice;
  }

  function splitChunks(text) {
    if (!text) return [""];
    return String(text).split(CHUNK_SEPARATOR);
  }

  function joinChunks(chunks) {
    return chunks.join(CHUNK_SEPARATOR);
  }

  function getChunkIndexAtCursor(text, cursorPos) {
    const chunks = splitChunks(text);
    let offset = 0;
    for (let i = 0; i < chunks.length; i += 1) {
      const end = offset + chunks[i].length;
      if (cursorPos <= end) return i;
      offset = end + CHUNK_SEPARATOR.length;
    }
    return chunks.length - 1;
  }

  function getChunkCursorOffset(text, cursorPos, chunkIndex) {
    const chunks = splitChunks(text);
    let offset = 0;
    for (let i = 0; i < chunkIndex; i += 1) {
      offset += chunks[i].length + CHUNK_SEPARATOR.length;
    }
    return Math.max(0, Math.min(chunks[chunkIndex].length, cursorPos - offset));
  }

  function applyChunksAndSelection(chunks, chunkIndex, inChunkOffset) {
    const normalized = chunks.map((chunk) => String(chunk));
    const value = joinChunks(normalized);
    el.editor.value = value;
    const idx = Math.max(0, Math.min(normalized.length - 1, chunkIndex));
    let cursor = 0;
    for (let i = 0; i < idx; i += 1) {
      cursor += normalized[i].length + CHUNK_SEPARATOR.length;
    }
    cursor += Math.max(0, Math.min(normalized[idx].length, inChunkOffset));
    el.editor.setSelectionRange(cursor, cursor);
    triggerInput("voice-final");
    updateCaretUI();
  }

  function insertVoiceChunk(text) {
    const mode = state.settings.voiceInsertMode;
    if (mode === "off") return;
    const cleaned = String(text || "").trim();
    if (!cleaned) return;
    const source = el.editor.value || "";
    const chunks = splitChunks(source);
    if (chunks.length === 1 && !chunks[0]) {
      chunks[0] = cleaned;
      applyChunksAndSelection(chunks, 0, cleaned.length);
      return;
    }
    if (mode === "append") {
      chunks.push(cleaned);
      applyChunksAndSelection(chunks, chunks.length - 1, cleaned.length);
      return;
    }
    const pos = el.editor.selectionStart;
    const idx = getChunkIndexAtCursor(source, pos);
    chunks.splice(idx + 1, 0, cleaned);
    applyChunksAndSelection(chunks, idx + 1, cleaned.length);
  }

  function getActiveChunkContext() {
    const value = el.editor.value || "";
    const chunks = splitChunks(value);
    const cursorPos = el.editor.selectionStart;
    const idx = getChunkIndexAtCursor(value, cursorPos);
    const inOffset = getChunkCursorOffset(value, cursorPos, idx);
    return { value, chunks, idx, inOffset };
  }

  function deleteCurrentChunk() {
    focusEditorForEditAction();
    const { chunks, idx } = getActiveChunkContext();
    if (chunks.length <= 1) {
      el.editor.value = "";
      el.editor.setSelectionRange(0, 0);
      triggerInput();
      return;
    }
    chunks.splice(idx, 1);
    const next = Math.max(0, idx - 1);
    applyChunksAndSelection(chunks, next, chunks[next].length);
  }

  function splitCurrentChunk() {
    focusEditorForEditAction();
    const { chunks, idx, inOffset } = getActiveChunkContext();
    const current = chunks[idx] || "";
    if (inOffset <= 0 || inOffset >= current.length) {
      toast("チャンク内の中間位置で分割してください");
      return;
    }
    const left = current.slice(0, inOffset);
    const right = current.slice(inOffset);
    chunks.splice(idx, 1, left, right);
    applyChunksAndSelection(chunks, idx + 1, 0);
  }

  function mergeCurrentChunk() {
    focusEditorForEditAction();
    const { chunks, idx } = getActiveChunkContext();
    if (idx <= 0) {
      toast("先頭チャンクは結合できません");
      return;
    }
    chunks[idx - 1] = `${chunks[idx - 1]} ${chunks[idx]}`.trim();
    chunks.splice(idx, 1);
    applyChunksAndSelection(chunks, idx - 1, chunks[idx - 1].length);
  }

  function formatCurrentChunk() {
    focusEditorForEditAction();
    const { chunks, idx, inOffset } = getActiveChunkContext();
    const before = chunks[idx] || "";
    const formatted = before
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    chunks[idx] = formatted;
    applyChunksAndSelection(chunks, idx, Math.min(inOffset, formatted.length));
  }

  function insertByVoiceMode(text) {
    insertVoiceChunk(text);
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

  function setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (evt) => {
      evt.preventDefault();
      state.deferredInstallPrompt = evt;
      if (el.btnHelpInstallPwa) el.btnHelpInstallPwa.disabled = false;
    });
    window.addEventListener("appinstalled", () => {
      state.deferredInstallPrompt = null;
      if (el.btnHelpInstallPwa) el.btnHelpInstallPwa.disabled = true;
    });
  }

  function showUpdate(worker) {
    state.waitingWorker = worker;
    applySystemState("UPDATE_AVAILABLE");
    if (state.dismissedUpdate) return;
    el.updateToast.classList.remove("hidden");
  }

  async function handleUpdateNow() {
    if (state.waitingWorker) {
      state.waitingWorker.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting) {
            showUpdate(reg.waiting);
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
            return;
          }
        }
      }
    } catch {
      // fallback to reload
    }
    const url = new URL(window.location.href);
    url.searchParams.set("refresh", `${Date.now()}`);
    window.location.href = url.toString();
  }

  function closeOpenDialog() {
    let closed = false;
    [el.dlgHelp, el.dlgShare, el.dlgSettings, el.dlgDocuments, el.dlgSnapshot, el.dlgSearch].forEach((d) => {
      if (!d) return;
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
      state.stopVoiceInput?.();
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
    applySoftKeyboardSuppression();
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

  function shouldSuppressSoftKeyboard() {
    return state.layoutMode === "MOBILE" && state.editToolsVisible;
  }

  function applySoftKeyboardSuppression() {
    if (shouldSuppressSoftKeyboard()) {
      el.editor.setAttribute("inputmode", "none");
      return;
    }
    if (el.editor.getAttribute("inputmode") === "none") {
      el.editor.removeAttribute("inputmode");
    }
  }

  function canType() {
    if (state.input === "VOICE_LOCKED") return false;
    if (state.primary === "SEARCH" || state.primary === "MANAGE" || state.primary === "CONFIG") return false;
    return true;
  }

  function focusEditorForEditAction() {
    if (document.activeElement === el.editor) return;
    try {
      el.editor.focus({ preventScroll: true });
    } catch (_) {
      el.editor.focus();
    }
  }

  function enforceKeyboardPolicy() {
    const editable = canType();
    el.editor.readOnly = !editable;
    applySoftKeyboardSuppression();
    if (!editable && document.activeElement === el.editor) {
      el.editor.blur();
    }
  }

  function updateStatusIndicator() {
    if (!el.statusPrimary) return;
    el.statusPrimary.textContent = state.primary;
    el.statusInput.textContent = state.input.replaceAll("_", ":");
    el.statusInput.title = `voice-session:${state.voiceSessionState}`;
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

  function captureEditorState() {
    return {
      value: el.editor.value,
      selectionStart: el.editor.selectionStart,
      selectionEnd: el.editor.selectionEnd,
      scrollTop: el.editor.scrollTop,
      scrollLeft: el.editor.scrollLeft
    };
  }

  function statesEqual(a, b) {
    if (!a || !b) return false;
    return a.value === b.value
      && a.selectionStart === b.selectionStart
      && a.selectionEnd === b.selectionEnd;
  }

  function trimUndoStack() {
    const maxDepth = Math.max(1, Math.min(5, Number(state.settings.undoDepth || 3)));
    state.history.maxDepth = maxDepth;
    if (state.history.undoStack.length > maxDepth) {
      state.history.undoStack.splice(0, state.history.undoStack.length - maxDepth);
    }
  }

  function pushUndoSnapshot(reason) {
    const next = captureEditorState();
    const last = state.history.undoStack[state.history.undoStack.length - 1];
    if (statesEqual(last, next)) return;
    state.history.undoStack.push(next);
    trimUndoStack();
    state.history.redoStack = [];
    el.btnUndo?.toggleAttribute("disabled", state.history.undoStack.length <= 1);
    el.btnRedo?.toggleAttribute("disabled", state.history.redoStack.length === 0);
  }

  function scheduleTypingHistoryCommit() {
    if (state.history.typingTimer) clearTimeout(state.history.typingTimer);
    state.history.typingTimer = setTimeout(() => {
      state.history.typingTimer = null;
      pushUndoSnapshot("typing");
    }, 450);
  }

  function applyEditorState(snapshot) {
    if (!snapshot) return;
    state.history.applying = true;
    el.editor.value = snapshot.value;
    requestAnimationFrame(() => {
      el.editor.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
      el.editor.scrollTop = snapshot.scrollTop;
      el.editor.scrollLeft = snapshot.scrollLeft;
      triggerInput("undo");
      state.history.applying = false;
      updateCaretUI();
    });
  }

  function seedUndoState() {
    state.history.undoStack = [captureEditorState()];
    state.history.redoStack = [];
    trimUndoStack();
    el.btnUndo?.setAttribute("disabled", "true");
    el.btnRedo?.setAttribute("disabled", "true");
  }

  function undoEdit() {
    if (state.history.undoStack.length <= 1) return;
    const current = state.history.undoStack.pop();
    if (current) state.history.redoStack.push(current);
    const prev = state.history.undoStack[state.history.undoStack.length - 1];
    applyEditorState(prev);
    el.btnUndo?.toggleAttribute("disabled", state.history.undoStack.length <= 1);
    el.btnRedo?.toggleAttribute("disabled", state.history.redoStack.length === 0);
  }

  function redoEdit() {
    if (!state.history.redoStack.length) return;
    const next = state.history.redoStack.pop();
    if (!next) return;
    state.history.undoStack.push(next);
    trimUndoStack();
    applyEditorState(next);
    el.btnUndo?.toggleAttribute("disabled", state.history.undoStack.length <= 1);
    el.btnRedo?.toggleAttribute("disabled", state.history.redoStack.length === 0);
  }

  function applyUndoSettingsUI() {
    if (!el.undoDepth) return;
    const depth = Number(state.settings.undoDepth || 3);
    el.undoDepth.value = String(Math.max(1, Math.min(5, depth)));
  }

  function triggerInput(reason = "toolbar") {
    state.nextInputReason = reason;
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
    if (el.btnVoiceMode) {
      const labelMap = {
        off: "音声:OFF",
        cursor: "音声:カーソル",
        append: "音声:文末"
      };
      el.btnVoiceMode.innerHTML = `<span class="icon">🎛</span>${labelMap[state.settings.voiceInsertMode] || "音声:カーソル"}`;
    }
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

  function applyInstallHints() {
    if (!el.iosInstallHint) return;
    const ua = navigator.userAgent || "";
    const isiOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    el.iosInstallHint.classList.toggle("hidden", !isiOS);
  }

  function applyToolbarVisibility() {
    const t = getEffectiveToolbarSettings();
    state.settings.toolbar = t;
    const allowed = Object.keys(DEFAULT_SETTINGS.toolbar);
    const baseOrder = Array.isArray(state.settings.toolbarOrder) ? state.settings.toolbarOrder : DEFAULT_SETTINGS.toolbarOrder;
    const normalizedBase = baseOrder.filter((k) => allowed.includes(k));
    const order = [...normalizedBase.filter((k) => k in t), ...allowed.filter((k) => !(normalizedBase.includes(k)) && (k in t))];
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
      voiceMode: "音声モード",
      replace: "検索・置換",
      templates: "テンプレ",
      history: "保存・履歴",
      edit: "編集",
      share: "共有"
    };
    const icons = {
      mic: "🎤",
      voiceMode: "🎛",
      replace: "🔎",
      templates: "📄",
      history: "🕒",
      edit: "✎",
      share: "⇪"
    };
    const allowed = Object.keys(DEFAULT_SETTINGS.toolbar);
    const toolbarState = getEffectiveToolbarSettings();
    const order = (state.settings.toolbarOrder || DEFAULT_SETTINGS.toolbarOrder)
      .filter((k) => allowed.includes(k));
    const menuTools = order.filter((tool) => toolbarState[tool] && tool !== "voiceMode");
    el.overflowMenuItems.innerHTML = "";
    menuTools.forEach((tool) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-icon";
      btn.dataset.menu = "tool";
      btn.dataset.tool = tool;
      btn.innerHTML = `<span class="icon">${icons[tool] || "•"}</span>${labels[tool] || tool}`;
      el.overflowMenuItems.append(btn);
    });
    el.overflowMenuItems.classList.toggle("hidden", menuTools.length === 0);
  }

  function renderToolbarOrder() {
    const allowed = Object.keys(DEFAULT_SETTINGS.toolbar);
    const order = (state.settings.toolbarOrder || DEFAULT_SETTINGS.toolbarOrder).filter((k) => allowed.includes(k));
    const toolbarState = getEffectiveToolbarSettings();
    const labels = {
      mic: "音声入力",
      voiceMode: "音声モード",
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
          <input type="checkbox" data-tool="${tool}" ${toolbarState[tool] ? "checked" : ""} />
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
    const allowed = Object.keys(DEFAULT_SETTINGS.toolbar);
    const order = (state.settings.toolbarOrder || DEFAULT_SETTINGS.toolbarOrder).filter((k) => allowed.includes(k));
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

  function getEffectiveToolbarSettings() {
    const allowed = new Set(Object.keys(DEFAULT_SETTINGS.toolbar));
    const rawToolbar = state.settings.toolbar || {};
    const normalizedRaw = {};
    Object.keys(rawToolbar).forEach((k) => {
      if (allowed.has(k)) normalizedRaw[k] = !!rawToolbar[k];
    });
    const t = { ...DEFAULT_SETTINGS.toolbar, ...normalizedRaw };
    if ("find" in rawToolbar && !("replace" in normalizedRaw)) t.replace = !!rawToolbar.find;
    if ("find" in t) delete t.find;
    return t;
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
    pushUiHistory();
    closeDialogsExcept("settings");
    if (state.settings.ui.sidebar) {
      state.settings.ui.sidebar = false;
      applySidebar();
      saveSettings();
    }
    setEditToolsVisible(false);
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
    openSnapshotPanel();
  }

  function openDocumentListPanel() {
    if (isDialogLayerOpen()) {
      toast("現在のダイアログを閉じてからドキュメント一覧を開いてください");
      return;
    }
    pushUiHistory();
    closeDialogsExcept("documents");
    if (state.settings.ui.sidebar) {
      state.settings.ui.sidebar = false;
      applySidebar();
      saveSettings();
    }
    setEditToolsVisible(false);
    renderDocumentLists();
    applyPrimary("MANAGE");
    enforceKeyboardPolicy();
    if (el.dlgDocuments && !el.dlgDocuments.open) el.dlgDocuments.showModal();
  }

  function openSnapshotPanel() {
    if (isDialogLayerOpen()) {
      toast("現在のダイアログを閉じてから履歴を開いてください");
      return;
    }
    pushUiHistory();
    closeDialogsExcept("snapshot");
    if (state.settings.ui.sidebar) {
      state.settings.ui.sidebar = false;
      applySidebar();
      saveSettings();
    }
    setEditToolsVisible(false);
    renderHistory();
    applyPrimary("MANAGE");
    enforceKeyboardPolicy();
    if (el.dlgSnapshot && !el.dlgSnapshot.open) el.dlgSnapshot.showModal();
  }

  function openSidebarPanel(tab) {
    pushUiHistory();
    if (tab === "replace") setEditToolsVisible(false);
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
    const opening = !state.settings.ui.sidebar;
    if (opening) pushUiHistory();
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

  function setTimeMenuOpen(on) {
    state.timeMenuOpen = !!on;
    if (!el.timeMenuPanel || !el.btnTimeMenu) return;
    el.timeMenuPanel.classList.toggle("hidden", !state.timeMenuOpen);
    el.timeMenuPanel.setAttribute("aria-hidden", state.timeMenuOpen ? "false" : "true");
    el.btnTimeMenu.setAttribute("aria-expanded", state.timeMenuOpen ? "true" : "false");
  }

  function toggleTimeMenu() {
    setTimeMenuOpen(!state.timeMenuOpen);
  }

  function pad2(num) {
    return String(num).padStart(2, "0");
  }

  function getCurrentTimeParts() {
    const now = new Date();
    const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    return { date, time, datetime: `${date} ${time}` };
  }

  function getTokenRangeBeforeCursor(text, cursorPos) {
    if (cursorPos <= 0) return null;
    const maxScan = 12;
    const start = Math.max(0, cursorPos - maxScan);
    const segment = text.slice(start, cursorPos);
    const match = segment.match(/(\((?:今日|今|日時)\))$/);
    if (!match) return null;
    const tokenStart = cursorPos - match[1].length;
    return { start: tokenStart, end: cursorPos };
  }

  function expandTimeTokenInRange(raw, action) {
    const parts = getCurrentTimeParts();
    const map = {
      "expand-today": { token: "(今日)", value: parts.date },
      "expand-now": { token: "(今)", value: parts.time },
      "expand-datetime": { token: "(日時)", value: parts.datetime }
    };
    const target = map[action];
    if (!target) return { text: raw, changed: false };
    if (!raw.includes(target.token)) return { text: raw, changed: false };
    return { text: raw.split(target.token).join(target.value), changed: true };
  }

  function runTimeMenuAction(action) {
    focusEditorForEditAction();
    const insertMap = {
      "insert-today": "(今日)",
      "insert-now": "(今)",
      "insert-datetime": "(日時)"
    };
    if (insertMap[action]) {
      insertTextAtCursor(insertMap[action]);
      setTimeMenuOpen(false);
      return;
    }
    const ta = el.editor;
    const { selectionStart, selectionEnd, value } = ta;
    if (selectionStart !== selectionEnd) {
      const selected = value.slice(selectionStart, selectionEnd);
      const replaced = expandTimeTokenInRange(selected, action);
      if (!replaced.changed) {
        toast("選択範囲に対象トークンがありません");
        return;
      }
      ta.setRangeText(replaced.text, selectionStart, selectionEnd, "select");
      triggerInput();
      setTimeMenuOpen(false);
      return;
    }
    const tokenRange = getTokenRangeBeforeCursor(value, selectionStart);
    if (!tokenRange) {
      toast("カーソル直前に対象トークンがありません");
      return;
    }
    const token = value.slice(tokenRange.start, tokenRange.end);
    const replaced = expandTimeTokenInRange(token, action);
    if (!replaced.changed) {
      toast("カーソル直前に対象トークンがありません");
      return;
    }
    ta.setRangeText(replaced.text, tokenRange.start, tokenRange.end, "end");
    triggerInput();
    setTimeMenuOpen(false);
  }

  function insertTextAtCursor(text) {
    const { selectionStart, selectionEnd } = el.editor;
    el.editor.setRangeText(text, selectionStart, selectionEnd, "end");
    triggerInput();
  }

  function buildTelemetryPayload() {
    const sessions = state.telemetry.sessions.map((s) => {
      const start = s.startedAt || 0;
      const end = s.endedAt || start;
      const restartDelay = s.restartScheduledAt && s.restartStartedAt
        ? Math.max(0, s.restartStartedAt - s.restartScheduledAt)
        : null;
      return {
        sessionId: s.id,
        t_start_to_first_interim_ms: s.firstInterimAt ? Math.max(0, s.firstInterimAt - start) : null,
        t_start_to_first_final_ms: s.firstFinalAt ? Math.max(0, s.firstFinalAt - start) : null,
        session_duration_ms: end > start ? (end - start) : null,
        restart_delay_actual_ms: restartDelay
      };
    });
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions,
      events: state.telemetry.events.slice(),
      metrics: sessions
    };
  }

  function exportTelemetryJson() {
    const payload = buildTelemetryPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `koedeam-telemetry-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Telemetry JSON を出力しました");
  }

  async function copyTelemetryJson() {
    const payload = JSON.stringify(buildTelemetryPayload(), null, 2);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        toast("Telemetry JSON をコピーしました");
        return;
      }
    } catch {
      // fallback below
    }
    const ta = document.createElement("textarea");
    ta.value = payload;
    ta.setAttribute("readonly", "true");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast("Telemetry JSON をコピーしました");
  }

  function normalizeEditPanelSections() {
    const base = { cursor: true, toolbar: true, range: true };
    const src = state.settings.editPanelSections && typeof state.settings.editPanelSections === "object"
      ? state.settings.editPanelSections
      : {};
    state.settings.editPanelSections = {
      cursor: src.cursor !== false,
      toolbar: src.toolbar !== false,
      range: src.range !== false
    };
    // Prevent a state where everything is collapsed.
    if (!state.settings.editPanelSections.cursor && !state.settings.editPanelSections.toolbar && !state.settings.editPanelSections.range) {
      state.settings.editPanelSections = base;
    }
  }

  function applyEditPanelSections() {
    if (!el.editToolsPanel) return;
    normalizeEditPanelSections();
    el.editGroups.forEach((group) => {
      const key = group.querySelector(".edit-group-toggle")?.dataset.section;
      if (!key) return;
      const expanded = state.settings.editPanelSections[key] !== false;
      group.classList.toggle("is-collapsed", !expanded);
      const toggle = group.querySelector(".edit-group-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
  }

  function applyEditPanelMode() {
    const mode = ["navigation", "edit", "assist"].includes(state.editPanelMode) ? state.editPanelMode : "navigation";
    state.editPanelMode = mode;
    const applyModeClass = (node) => {
      const groupMode = node.dataset.editModeGroup || "navigation";
      const isToolbarGroup = node.classList?.contains("toolbar-group");
      const isEditOrAssist = mode === "edit" || mode === "assist";
      const visible = isToolbarGroup ? isEditOrAssist : groupMode === mode;
      node.classList.toggle("mode-hidden", !visible);
    };
    el.editGroups.forEach(applyModeClass);
    document.querySelectorAll("#editToolsPanel [data-edit-mode-group]").forEach(applyModeClass);
    if (el.btnEditModeNavigation) {
      const active = mode === "navigation";
      el.btnEditModeNavigation.classList.toggle("active", active);
      el.btnEditModeNavigation.setAttribute("aria-selected", active ? "true" : "false");
    }
    if (el.btnEditModeEdit) {
      const active = mode === "edit";
      el.btnEditModeEdit.classList.toggle("active", active);
      el.btnEditModeEdit.setAttribute("aria-selected", active ? "true" : "false");
    }
    if (el.btnEditModeAssist) {
      const active = mode === "assist";
      el.btnEditModeAssist.classList.toggle("active", active);
      el.btnEditModeAssist.setAttribute("aria-selected", active ? "true" : "false");
    }
    requestAnimationFrame(updateEditPanelSize);
  }

  function setEditPanelMode(mode) {
    if (!["navigation", "edit", "assist"].includes(mode)) return;
    state.editPanelMode = mode;
    if (mode !== "assist") {
      setTimeMenuOpen(false);
      hideCandidatePanel();
    }
    applyEditPanelMode();
  }

  function toggleEditPanelSection(section) {
    if (!["cursor", "toolbar", "range"].includes(section)) return;
    normalizeEditPanelSections();
    const next = { ...state.settings.editPanelSections, [section]: !state.settings.editPanelSections[section] };
    if (!next.cursor && !next.toolbar && !next.range) return;
    state.settings.editPanelSections = next;
    applyEditPanelSections();
    saveSettings();
    requestAnimationFrame(updateEditPanelSize);
  }

  function setEditToolsVisible(on) {
    state.editToolsVisible = !!on;
    if (!state.editToolsVisible) {
      setTimeMenuOpen(false);
      hideCandidatePanel();
    }
    if (state.editToolsVisible) {
      if (isMobileLayout() && document.activeElement === el.editor) {
        // Close software keyboard once when opening EditPanel on mobile.
        el.editor.blur();
      }
      pushUiHistory();
      applyPrimary("EDIT");
      if (isMobileLayout() && state.settings.ui.sidebar) {
        state.settings.ui.sidebar = false;
        applySidebar();
      }
    }
    el.editToolsPanel.classList.toggle("show", state.editToolsVisible);
    document.body.classList.toggle("edit-tools-show", state.editToolsVisible);
    applyEditPanelSections();
    applyEditPanelMode();
    applySoftKeyboardSuppression();
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
    const root = document.documentElement;
    root.style.setProperty("--edit-inset-top", "0px");
    root.style.setProperty("--edit-inset-right", "0px");
    root.style.setProperty("--edit-inset-bottom", "0px");
    root.style.setProperty("--edit-inset-left", "0px");
    if (!state.editToolsVisible) return;
    const pos = state.settings.editPanelPosition || "bottom";
    const gap = 12;
    const size = (pos === "left" || pos === "right")
      ? el.editToolsPanel.offsetWidth
      : el.editToolsPanel.offsetHeight;
    if (!size) return;
    const inset = `${Math.max(size + gap, 120)}px`;
    document.documentElement.style.setProperty("--edit-panel-size", inset);
    if (pos === "top") root.style.setProperty("--edit-inset-top", inset);
    if (pos === "right") root.style.setProperty("--edit-inset-right", inset);
    if (pos === "bottom") root.style.setProperty("--edit-inset-bottom", inset);
    if (pos === "left") root.style.setProperty("--edit-inset-left", inset);
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
    ensureDocuments();
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
        sidebarTab: (parsed.sidebarTab === "replace" ? "templates" : (parsed.sidebarTab || fallback.sidebarTab)),
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
    focusEditorForEditAction();
    el.editor.setSelectionRange(start, end);
  }

  function selectBlock() {
    const text = el.editor.value;
    const pos = el.editor.selectionStart;
    const { start, end } = getBlockBounds(text, pos);
    focusEditorForEditAction();
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
      focusEditorForEditAction();
      el.editor.setSelectionRange(nextPos, nextPos);
      ensureCaretVisible();
    } else {
      const after = text.slice(Math.min(text.length, end + 2));
      const nextBoundary = after.indexOf("\n\n");
      const nextPos = nextBoundary === -1 ? text.length : end + 2 + nextBoundary + 2;
      focusEditorForEditAction();
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
      focusEditorForEditAction();
      el.editor.setSelectionRange(nextStart, selectionEnd);
    } else {
      const { end } = getLineBounds(text, selectionEnd);
      const nextEnd = text.indexOf("\n", end + 1);
      const next = nextEnd === -1 ? text.length : nextEnd;
      focusEditorForEditAction();
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
    focusEditorForEditAction();
  }

  function moveToLineEdge(edge) {
    const text = el.editor.value;
    const pos = el.editor.selectionStart;
    const { start, end } = getLineBounds(text, pos);
    const next = edge === "start" ? start : end;
    focusEditorForEditAction();
    el.editor.setSelectionRange(next, next);
  }

  function moveToDocumentEdge(edge) {
    const next = edge === "start" ? 0 : el.editor.value.length;
    focusEditorForEditAction();
    el.editor.setSelectionRange(next, next);
    ensureCaretVisible();
  }

  function deleteToLineEdge(edge) {
    const text = el.editor.value;
    const { selectionStart, selectionEnd } = el.editor;
    if (selectionStart !== selectionEnd) {
      el.editor.setRangeText("", selectionStart, selectionEnd, "start");
      triggerInput();
      return;
    }
    const { start, end } = getLineBounds(text, selectionStart);
    if (edge === "start" && selectionStart > start) {
      el.editor.setRangeText("", start, selectionStart, "start");
      triggerInput();
    } else if (edge === "end" && selectionStart < end) {
      el.editor.setRangeText("", selectionStart, end, "start");
      triggerInput();
    }
  }

  async function copyEditorOrSelection() {
    const { selectionStart, selectionEnd } = el.editor;
    if (selectionStart !== selectionEnd) {
      await copySelection();
      return;
    }
    const text = el.editor.value;
    if (!text) {
      toast("コピー対象がありません");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast("Copyしました");
        return;
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
    toast(ok ? "Copyしました" : "Copyできませんでした");
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
      focusEditorForEditAction();
      el.editor.setSelectionRange(next, next);
    } else {
      const nextStart = end < text.length ? end + 1 : text.length;
      const nextEnd = text.indexOf("\n", nextStart);
      const limit = nextEnd === -1 ? text.length : nextEnd;
      const next = Math.min(nextStart + column, limit);
      focusEditorForEditAction();
      el.editor.setSelectionRange(next, next);
    }
  }

  function moveCursorChar(step) {
    const pos = el.editor.selectionStart;
    const next = Math.max(0, Math.min(el.editor.value.length, pos + step));
    focusEditorForEditAction();
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
      sideTabs: Array.from(document.querySelectorAll("#sidebar .side-tabs .tab-btn[data-tab]")),
      tabPanels: Array.from(document.querySelectorAll("#sidebar .tab-panel")),
      btnCloseSidebar: document.getElementById("btnCloseSidebar"),

      btnSidebar: document.getElementById("btnSidebar"),
      btnEditTools: document.getElementById("btnEditTools"),
      btnMenu: document.getElementById("btnMenu"),
      btnBrandDocuments: document.getElementById("btnBrandDocuments"),
      btnSettings: document.getElementById("btnSettings"),
      btnHelp: document.getElementById("btnHelp"),
      btnMic: document.getElementById("btnMic"),
      btnVoiceMode: document.getElementById("btnVoiceMode"),
      btnReplace: document.getElementById("btnReplace"),
      btnTemplates: document.getElementById("btnTemplates"),
      btnHistory: document.getElementById("btnHistory"),
      btnShare: document.getElementById("btnShare"),
      btnOverflow: document.getElementById("btnOverflow"),

      dlgHelp: document.getElementById("dlgHelp"),
      btnCloseHelp: document.getElementById("btnCloseHelp"),
      btnHelpInstallPwa: document.getElementById("btnHelpInstallPwa"),
      iosInstallHint: document.getElementById("iosInstallHint"),

      findQuery: document.getElementById("findQuery"),
      findRecent: document.getElementById("findRecent"),
      optCase: document.getElementById("optCase"),
      optRegex: document.getElementById("optRegex"),
      replaceQuery: document.getElementById("replaceQuery"),
      dlgSearch: document.getElementById("dlgSearch"),
      btnCloseSearch: document.getElementById("btnCloseSearch"),
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
      btnOpenDocuments: document.getElementById("btnOpenDocuments"),
      btnNewDoc: document.getElementById("btnNewDoc"),
      btnSnapshot: document.getElementById("btnSnapshot"),
      btnOpenSnapshotPanel: document.getElementById("btnOpenSnapshotPanel"),
      documentsList: document.getElementById("documentsList"),
      autoSnapshotSelect: document.getElementById("autoSnapshotSelect"),
      historyList: document.getElementById("historyList"),
      dlgDocuments: document.getElementById("dlgDocuments"),
      btnCloseDocuments: document.getElementById("btnCloseDocuments"),
      dlgSnapshot: document.getElementById("dlgSnapshot"),
      btnSnapshotSave: document.getElementById("btnSnapshotSave"),
      snapshotAutoSnapshotSelect: document.getElementById("snapshotAutoSnapshotSelect"),
      snapshotHistoryList: document.getElementById("snapshotHistoryList"),
      btnCloseSnapshot: document.getElementById("btnCloseSnapshot"),

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
      btnEditModeNavigation: document.getElementById("btnEditModeNavigation"),
      btnEditModeEdit: document.getElementById("btnEditModeEdit"),
      btnEditModeAssist: document.getElementById("btnEditModeAssist"),
      editGroupToggles: Array.from(document.querySelectorAll("#editToolsPanel .edit-group-toggle[data-section]")),
      editGroups: Array.from(document.querySelectorAll("#editToolsPanel .edit-group")),
      voiceModeRadios: Array.from(document.querySelectorAll("input[name='voiceMode']")),
      btnSelectLine: document.getElementById("btnSelectLine"),
      btnSelectBlock: document.getElementById("btnSelectBlock"),
      btnSelectPara: document.getElementById("btnSelectPara"),
      btnSelectParaPrev: document.getElementById("btnSelectParaPrev"),
      btnSelectParaNext: document.getElementById("btnSelectParaNext"),
      btnExpandUp: document.getElementById("btnExpandUp"),
      btnExpandDown: document.getElementById("btnExpandDown"),
      btnShrinkUp: document.getElementById("btnShrinkUp"),
      btnShrinkDown: document.getElementById("btnShrinkDown"),
      btnSelectAll: document.getElementById("btnSelectAll"),
      btnLineStart: document.getElementById("btnLineStart"),
      btnLineEnd: document.getElementById("btnLineEnd"),
      btnDocStart: document.getElementById("btnDocStart"),
      btnDocEnd: document.getElementById("btnDocEnd"),
      btnDeleteToLineStart: document.getElementById("btnDeleteToLineStart"),
      btnDeleteToLineEnd: document.getElementById("btnDeleteToLineEnd"),
      btnMoveUp: document.getElementById("btnMoveUp"),
      btnMoveDown: document.getElementById("btnMoveDown"),
      btnMoveLeft: document.getElementById("btnMoveLeft"),
      btnMoveRight: document.getElementById("btnMoveRight"),
      btnPuncMode: document.getElementById("btnPuncMode"),
      btnUndo: document.getElementById("btnUndo"),
      btnRedo: document.getElementById("btnRedo"),
      btnTimeMenu: document.getElementById("btnTimeMenu"),
      timeMenuPanel: document.getElementById("timeMenuPanel"),
      btnChunkDelete: document.getElementById("btnChunkDelete"),
      btnChunkSplit: document.getElementById("btnChunkSplit"),
      btnChunkMerge: document.getElementById("btnChunkMerge"),
      btnChunkFormat: document.getElementById("btnChunkFormat"),
      btnTelemetryExportJson: document.getElementById("btnTelemetryExportJson"),
      btnTelemetryCopyJson: document.getElementById("btnTelemetryCopyJson"),
      candidateThreshold: document.getElementById("candidateThreshold"),
      candidateNoConfidenceRule: document.getElementById("candidateNoConfidenceRule"),
      candidateIdleBehavior: document.getElementById("candidateIdleBehavior"),
      undoDepth: document.getElementById("undoDepth"),
      candidatePanel: document.getElementById("candidatePanel"),
      candidateList: document.getElementById("candidateList"),
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
