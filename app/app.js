(() => {
  const KEY_DRAFT = "koedeam.currentDraft";

  const editor = document.getElementById("editor");
  const btnFocus = document.getElementById("btnFocus");
  const btnHelp = document.getElementById("btnHelp");
  const dlgHelp = document.getElementById("dlgHelp");
  const btnCloseHelp = document.getElementById("btnCloseHelp");

  // restore
  try {
    const saved = localStorage.getItem(KEY_DRAFT);
    if (saved != null) editor.value = saved;
  } catch {}

  // autosave (debounce)
  let t = null;
  editor.addEventListener("input", () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      try { localStorage.setItem(KEY_DRAFT, editor.value); } catch {}
    }, 800);
  });

  // focus mode
  btnFocus.addEventListener("click", () => {
    document.body.classList.toggle("focus");
  });

  // help
  btnHelp.addEventListener("click", () => dlgHelp.showModal());
  btnCloseHelp.addEventListener("click", () => dlgHelp.close());

  // Mic button: placeholder (later)
  const btnMic = document.getElementById("btnMic");
  btnMic.addEventListener("click", () => {
    alert("音声入力は次のステップで実装します。OS音声入力キーボードも利用できます。");
  });

  // Share button: placeholder (later)
  const btnShare = document.getElementById("btnShare");
  btnShare.addEventListener("click", async () => {
    const text = editor.value || "";
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(text);
      alert("コピーしました");
    } catch {
      alert("共有/コピーができませんでした。手動でコピーしてください。");
    }
  });
})();
