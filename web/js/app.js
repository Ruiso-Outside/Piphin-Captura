// Piphin Captura · tela principal: capturar (prints e gravação), galeria e ajustes. O editor fica em editor.js.
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const call = async (ch, ...a) => { const r = await piphin.invoke(ch, ...a); if (!r.ok) throw new Error(r.error); return r.data; };
const mb = (b) => (b >= 1073741824 ? (b / 1073741824).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " GB" : b >= 1048576 ? Math.round(b / 1048576) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
const dur = (s) => { s = Math.round(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const when = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const keyLabel = (acc) => String(acc || "—").replace("PrintScreen", "PrtSc").replace(/\+/g, " + ");

const S = { tab: "home", items: [], prefs: null, rec: { on: false }, hotkeysOk: {}, displays: [], filter: "all", mics: [] };

// ---------------------------------------------------------------- avisos e janelas
function toast(text, kind = "") { const el = document.createElement("div"); el.className = "toast " + kind; el.textContent = text; $("#toasts").appendChild(el); setTimeout(() => el.remove(), 4000); }
const modal = $("#modal"), box = $("#modalBox");
const openModal = (html, cls = "") => { box.className = "modal-box " + cls; box.innerHTML = html; modal.hidden = false; };
const closeModal = () => { modal.hidden = true; box.innerHTML = ""; };
modal.addEventListener("mousedown", (e) => { if (e.target === modal) closeModal(); });
const confirmBox = (title, text, yes = "Continuar", danger = false) => new Promise((resolve) => {
  openModal(`<h3>${esc(title)}</h3><p>${text}</p><div class="modal-actions"><button class="btn" data-n>Cancelar</button><button class="btn ${danger ? "danger solid" : "primary"}" data-y>${esc(yes)}</button></div>`);
  box.querySelector("[data-y]").onclick = () => { closeModal(); resolve(true); };
  box.querySelector("[data-n]").onclick = () => { closeModal(); resolve(false); };
});
const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, "err"); } };

// ---------------------------------------------------------------- eventos do motor
piphin.on("items", (list) => { S.items = list; if (S.tab !== "settings") render(); });
piphin.on("shot", () => { /* a galeria chega pelo "items" */ });
piphin.on("edit", (it) => openEditor(it));
piphin.on("hotkeys", (h) => { S.hotkeysOk = h; if (S.tab !== "gallery") render(); });
piphin.on("rec", (r) => {
  S.rec = r; refreshRec();
  if (r.error) toast(r.error, "err");
  if (r.last) toast(`Gravação salva: ${dur(r.last.seconds)} · ${mb(r.last.size)}`, "ok");
  if (S.tab === "home") render();
});
let recTimer = 0;
function refreshRec() {
  const p = $("#recPill"); clearInterval(recTimer);
  p.hidden = !S.rec.on;
  if (!S.rec.on) return;
  const upd = () => { p.innerHTML = `<span class="rdot ${S.rec.paused ? "paused" : ""}"></span>${S.rec.paused ? "Pausado" : "Gravando"} ${S.rec.since ? dur((Date.now() - S.rec.since) / 1000) : ""} <b>Parar</b>`; };
  upd(); recTimer = setInterval(upd, 1000);
  p.onclick = guard(() => call("rec-stop"));
}

// ---------------------------------------------------------------- telas
$$("#nav [data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; render(); $("#content").scrollTop = 0; }));
function render() {
  $$("#nav [data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === S.tab));
  if (!S.prefs) { $("#content").innerHTML = `<div class="loading"><span class="spin"></span></div>`; return; }
  $("#content").innerHTML = { home, gallery, settings }[S.tab]();
  bind();
}

function home() {
  const hk = S.prefs.hotkeys, ok = S.hotkeysOk, r = S.prefs.rec;
  const k = (name) => `<kbd class="${ok[name] === false ? "bad" : ""}" title="${ok[name] === false ? "Esse atalho está em uso por outro programa: troque em Ajustes" : "Funciona em qualquer lugar"}">${esc(keyLabel(hk[name]))}</kbd>`;
  const recent = S.items.slice(0, 6);
  const srcLabel = r.source === "window" && r.sourceName ? `Janela: ${r.sourceName}` : r.displayId ? (S.displays.find((d) => d.id === r.displayId) || {}).label || "Monitor" : "Monitor onde está o mouse";
  return `<div class="wrap">
    <section class="actions">
      <button class="act" data-do="region"><span class="ic"><i class="i i-scan"></i></span><b>Print de uma área</b><span>Escolha o pedaço da tela</span>${k("region")}</button>
      <button class="act" data-do="screen"><span class="ic"><i class="i i-monitor"></i></span><b>Print da tela inteira</b><span>O monitor onde está o mouse</span>${k("screen")}</button>
      <button class="act" data-do="window"><span class="ic"><i class="i i-app-window"></i></span><b>Print de uma janela</b><span>Escolha o programa</span><kbd class="dim">pela lista</kbd></button>
      <button class="act rec ${S.rec.on ? "on" : ""}" data-do="record"><span class="ic"><i class="i i-${S.rec.on ? "square" : "video"}"></i></span><b>${S.rec.on ? "Parar a gravação" : "Gravar a tela"}</b><span>${S.rec.on ? "Salva em MP4" : "Vídeo MP4 com som"}</span>${k("record")}</button>
    </section>
    <p class="tip"><i class="i i-keyboard"></i>Os atalhos funcionam de qualquer lugar, até dentro de jogos. O print já vai copiado: é só colar com <kbd>Ctrl</kbd>+<kbd>V</kbd>${S.prefs.afterShot.save ? " (e fica salvo na Galeria)" : ""}.</p>
    <section class="panel">
      <div class="ph"><h3><i class="i i-video"></i> Gravação</h3><span class="faint">MP4 (H.264), usa a placa de vídeo para não pesar</span></div>
      <div class="opts">
        <div class="opt-row"><span class="lbl">O que gravar</span><button class="btn sm" data-do="pick-source"><i class="i i-${r.source === "window" ? "app-window" : "monitor"}"></i>${esc(srcLabel)}<i class="i i-chevron-down"></i></button></div>
        <div class="opt-row"><span class="lbl">Som</span>
          <label class="swl"><span class="switch"><input type="checkbox" data-rec="systemAudio" ${r.systemAudio ? "checked" : ""}><span></span></span><i class="i i-volume-2"></i>Som do PC</label>
          <label class="swl"><span class="switch"><input type="checkbox" data-rec="mic" ${r.mic ? "checked" : ""}><span></span></span><i class="i i-mic"></i>Microfone</label>
          ${r.mic ? `<select id="micSel">${[["", "Microfone padrão"], ...S.mics.map((m) => [m.deviceId, m.label || "Microfone"])].map(([id, l]) => `<option value="${esc(id)}" ${r.micId === id ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>` : ""}</div>
        <div class="opt-row"><span class="lbl">Qualidade</span>${seg("quality", [["high", "Alta"], ["medium", "Média"], ["low", "Leve"]], r.quality)}${seg("fps", [[60, "60 FPS"], [30, "30 FPS"]], r.fps)}${seg("height", [[0, "Original"], [1080, "1080p"], [720, "720p"]], r.height)}</div>
        <div class="opt-row"><span class="lbl">Antes de começar</span><label class="swl"><span class="switch"><input type="checkbox" data-rec="countdown" ${r.countdown ? "checked" : ""}><span></span></span>Contagem 3, 2, 1</label></div>
      </div>
      <p class="faint">Uma barrinha aparece no topo da tela com o tempo, pausar e parar. Ela não aparece no vídeo.</p>
    </section>
    ${recent.length ? `<section class="panel"><div class="ph"><h3><i class="i i-history"></i> Últimas capturas</h3><button class="btn sm ghost" data-tab-go="gallery">Ver todas<i class="i i-chevron-right"></i></button></div><div class="grid small">${recent.map(card).join("")}</div></section>` : ""}
  </div>`;
}
const seg = (key, list, cur) => `<div class="seg">${list.map(([v, l]) => `<button class="${String(cur) === String(v) ? "active" : ""}" data-seg="${key}" data-v="${v}">${l}</button>`).join("")}</div>`;
function card(it) {
  const v = it.type === "video";
  return `<div class="card-c" data-open="${esc(it.id)}"><div class="thumb">${it.thumbSrc ? `<img src="${esc(it.thumbSrc)}" alt="" loading="lazy">` : `<i class="i i-${v ? "film" : "image"}"></i>`}
    ${v ? `<span class="badge-t"><i class="i i-play"></i>${dur(it.seconds)}</span>` : ""}</div>
    <div class="meta"><b>${v ? "Gravação" : "Print"}</b><span>${when(it.at)} · ${it.w && it.h ? `${it.w}×${it.h} · ` : ""}${mb(it.size)}</span></div>
    <button class="btn icon ghost xs more" data-more="${esc(it.id)}" title="Mais"><i class="i i-chevron-down"></i></button></div>`;
}
function gallery() {
  const list = S.items.filter((i) => S.filter === "all" || i.type === S.filter);
  const n = { all: S.items.length, shot: S.items.filter((i) => i.type === "shot").length, video: S.items.filter((i) => i.type === "video").length };
  return `<div class="wrap"><div class="ghead"><h2>Galeria</h2>${seg("filter", [["all", `Tudo <em>${n.all}</em>`], ["shot", `Prints <em>${n.shot}</em>`], ["video", `Gravações <em>${n.video}</em>`]], S.filter)}<div class="grow"></div>
    <button class="btn sm" data-do="folder-shot"><i class="i i-folder-open"></i>Pasta dos prints</button><button class="btn sm" data-do="folder-video"><i class="i i-folder-open"></i>Pasta das gravações</button></div>
    ${list.length ? `<div class="grid">${list.map(card).join("")}</div>` : `<div class="empty-box"><i class="i i-images"></i><b>Nada por aqui ainda</b><span>Aperte <kbd>${esc(keyLabel(S.prefs.hotkeys.region))}</kbd> para tirar um print ou <kbd>${esc(keyLabel(S.prefs.hotkeys.record))}</kbd> para gravar a tela.</span></div>`}</div>`;
}
function settings() {
  const p = S.prefs, ok = S.hotkeysOk;
  const hk = (k, l) => `<div class="set"><div><h4>${l}</h4>${ok[k] === false ? `<p class="bad-t">Em uso por outro programa: escolha outro</p>` : `<p>Funciona em qualquer lugar</p>`}</div><button class="keybox ${ok[k] === false ? "bad" : ""}" data-key="${k}">${esc(keyLabel(p.hotkeys[k]))}</button></div>`;
  const sw = (k, l, d) => `<div class="set"><div><h4>${l}</h4><p>${d}</p></div><label class="switch"><input type="checkbox" data-after="${k}" ${p.afterShot[k] ? "checked" : ""}><span></span></label></div>`;
  return `<div class="wrap narrow"><h2>Ajustes</h2>
    <h3 class="sub">Atalhos</h3><div class="p-settings">${hk("region", "Print de uma área")}${hk("screen", "Print da tela inteira")}${hk("record", "Começar / parar a gravação")}</div>
    <p class="faint">Clique no atalho e aperte as teclas novas. Se o <kbd>PrtSc</kbd> abrir a Ferramenta de Captura do Windows, desligue em Configurações do Windows › Acessibilidade › Teclado › “Usar a tecla Print Screen para abrir a captura de tela”.</p>
    <h3 class="sub">Depois do print</h3><p class="faint">O print sempre vai copiado, pronto para colar com Ctrl+V no WhatsApp, Discord, Word...</p><div class="p-settings">${sw("save", "Salvar na pasta", "Fica na Galeria e na pasta dos prints")}${sw("edit", "Abrir o editor", "Para marcar com setas, texto e esconder informações")}${sw("notify", "Avisar", "Uma notificação curta do Windows")}</div>
    <h3 class="sub">Pastas</h3><div class="p-settings">
      <div class="set"><div><h4>Prints</h4><p class="path">${esc(p.shotsDir)}</p></div><button class="btn sm" data-do="choose-shot">Mudar</button></div>
      <div class="set"><div><h4>Gravações</h4><p class="path">${esc(p.videosDir)}</p></div><button class="btn sm" data-do="choose-video">Mudar</button></div></div>
  </div>`;
}

// ---------------------------------------------------------------- ações
const savePrefs = guard(async (patch) => { const r = await call("prefs", patch); S.prefs = r.prefs; S.hotkeysOk = r.hotkeysOk; });
function bind() {
  $$("[data-rec]").forEach((c) => (c.onchange = guard(async () => {
    await savePrefs({ rec: { [c.dataset.rec]: c.checked } });
    if (c.dataset.rec === "mic" && c.checked) await listMics();
    render();
  })));
  const ms = $("#micSel"); if (ms) ms.onchange = () => savePrefs({ rec: { micId: ms.value } });
  $$("[data-after]").forEach((c) => (c.onchange = () => savePrefs({ afterShot: { [c.dataset.after]: c.checked } })));
}
// lista os microfones (os nomes só aparecem depois de uma permissão)
async function listMics() {
  try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); } catch { /* sem microfone */ }
  S.mics = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications");
}

// pede uma contagem para dar tempo de sair do Hub (o print pelo botão pegaria a própria janela do Hub)
async function delayed(fn) {
  for (const n of [3, 2, 1]) { toast(`Print em ${n}... mude para a tela que quer capturar`); await new Promise((r) => setTimeout(r, 1000)); }
  return fn();
}
async function pickSource(forPrint) {
  openModal(`<h3>${forPrint ? "Print de uma janela" : "O que gravar"}</h3><div class="sources"><div class="loading"><span class="spin"></span></div></div><div class="modal-actions"><button class="btn" data-n>Cancelar</button></div>`, "wide");
  box.querySelector("[data-n]").onclick = closeModal;
  const list = await call("sources", forPrint ? ["window"] : ["screen", "window"]);
  const screens = list.filter((s) => s.type === "screen"), wins = list.filter((s) => s.type === "window");
  const tile = (s) => `<button class="src" data-src="${esc(s.id)}" data-name="${esc(s.name)}" data-type="${s.type}" data-display="${esc(s.displayId || "")}"><div class="st">${s.thumbnail ? `<img src="${s.thumbnail}" alt="">` : ""}</div><span>${s.icon ? `<img class="ico" src="${s.icon}" alt="">` : `<i class="i i-${s.type === "screen" ? "monitor" : "app-window"}"></i>`}${esc(s.type === "screen" ? (S.displays.find((d) => d.id === s.displayId) || {}).label || s.name : s.name)}</span></button>`;
  box.querySelector(".sources").innerHTML = `${!forPrint ? `<button class="src auto" data-src="" data-type="screen"><div class="st"><i class="i i-mouse-pointer-2"></i></div><span>Monitor onde está o mouse</span></button>${screens.map(tile).join("")}` : ""}
    ${wins.length ? `<h4>Janelas</h4>${wins.map(tile).join("")}` : `<p class="faint">Nenhuma janela aberta.</p>`}`;
  $$("[data-src]", box).forEach((b) => (b.onclick = guard(async () => {
    closeModal();
    if (forPrint) return printWindow(b.dataset.src);
    const t = b.dataset.type;
    await savePrefs({ rec: t === "window" ? { source: "window", sourceId: b.dataset.src, sourceName: b.dataset.name, displayId: "" } : { source: "screen", sourceId: "", sourceName: "", displayId: b.dataset.display || "" } });
    render();
  })));
}
// print de uma janela: pega um quadro da janela pelo getDisplayMedia (só a janela, mesmo atrás de outras)
async function printWindow(id) {
  await call("set-source", id);
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const v = document.createElement("video"); v.muted = true; v.srcObject = stream; await v.play();
    await new Promise((r) => setTimeout(r, 300));
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    await call("save-image", new Uint8Array(await blob.arrayBuffer()), { w: c.width, h: c.height, how: "janela" });
    toast("Print da janela copiado: é só colar (Ctrl+V)", "ok");
  } finally { stream.getTracks().forEach((t) => t.stop()); }
}
function moreMenu(it) {
  const v = it.type === "video";
  openModal(`<h3>${v ? "Gravação" : "Print"} · ${esc(when(it.at))}</h3><div class="menu-list">
    ${v ? "" : `<button data-m="edit"><i class="i i-pencil"></i>Editar</button><button data-m="copy"><i class="i i-copy"></i>Copiar</button>`}
    ${v ? `<button data-m="play"><i class="i i-play"></i>Assistir</button>` : ""}
    <button data-m="show"><i class="i i-folder-open"></i>Mostrar na pasta</button><button data-m="saveas"><i class="i i-download"></i>Salvar como</button>
    <button data-m="del" class="danger"><i class="i i-trash-2"></i>Apagar</button></div><div class="modal-actions"><button class="btn" data-n>Fechar</button></div>`);
  box.querySelector("[data-n]").onclick = closeModal;
  $$("[data-m]", box).forEach((b) => (b.onclick = guard(async () => {
    closeModal();
    const m = b.dataset.m;
    if (m === "edit") openEditor(it);
    else if (m === "play") play(it);
    else if (m === "copy") { await call("copy-image", it.id); toast("Copiado", "ok"); }
    else if (m === "show") call("show-item", it.id);
    else if (m === "saveas") { const f = await call("save-as", it.id); if (f) toast("Salvo", "ok"); }
    else if (m === "del" && (await confirmBox("Apagar?", `${v ? "A gravação" : "O print"} é apagado do computador.`, "Apagar", true))) await call("remove", [it.id]);
  })));
}
function play(it) {
  openModal(`<video class="player" src="${esc(it.src)}" controls autoplay></video><div class="modal-actions"><span class="faint grow">${dur(it.seconds)} · ${it.w}×${it.h} · ${mb(it.size)}</span><button class="btn" data-show><i class="i i-folder-open"></i>Mostrar na pasta</button><button class="btn primary" data-n>Fechar</button></div>`, "video-box");
  box.querySelector("[data-n]").onclick = closeModal;
  box.querySelector("[data-show]").onclick = () => call("show-item", it.id);
}
function openEditor(it) {
  Editor.open(it, {
    onSaved: guard(async (what, r, item) => {
      if (what === "copy") { await call("save-image", r.bytes, { copyOnly: true }); toast("Copiado: é só colar com Ctrl+V", "ok"); }
      else if (what === "save") { await call("save-image", r.bytes, { replaceId: item.id, w: r.w, h: r.h, copy: true }); toast("Print salvo e copiado", "ok"); }
      else if (what === "saveas") { const s = await call("save-image", r.bytes, { replaceId: item.id, w: r.w, h: r.h }); const f = await call("save-as", s.id); if (f) toast("Salvo", "ok"); }
    }),
    onClosed: (what) => (what === "ask" ? confirmBox("Fechar sem salvar?", "As marcações que você fez vão sumir.", "Fechar", true) : true),
  });
}
// gravação de atalho em Ajustes: aperte as teclas novas
function captureKey(btn) {
  btn.textContent = "Aperte as teclas..."; btn.classList.add("listening");
  const onKey = guard(async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
    removeEventListener("keydown", onKey, true);
    if (e.key === "Escape") return render();
    const map = { " ": "Space", PrintScreen: "PrintScreen", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right" };
    const k = map[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key);
    const acc = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", k].filter(Boolean).join("+");
    await savePrefs({ hotkeys: { [btn.dataset.key]: acc } });
    toast(S.hotkeysOk[btn.dataset.key] ? `Atalho trocado para ${keyLabel(acc)}` : `${keyLabel(acc)} está em uso por outro programa`, S.hotkeysOk[btn.dataset.key] ? "ok" : "err");
    render();
  });
  addEventListener("keydown", onKey, true);
}
$("#content").addEventListener("click", guard(async (e) => {
  const t = e.target.closest("[data-do],[data-open],[data-more],[data-seg],[data-key],[data-tab-go]"); if (!t) return;
  if (t.dataset.tabGo) { S.tab = t.dataset.tabGo; return render(); }
  if (t.dataset.key) return captureKey(t);
  if (t.dataset.more) { e.stopPropagation(); return moreMenu(S.items.find((i) => i.id === t.dataset.more)); }
  if (t.dataset.open) { const it = S.items.find((i) => i.id === t.dataset.open); return it.type === "video" ? play(it) : openEditor(it); }
  if (t.dataset.seg) {
    const k = t.dataset.seg, v = t.dataset.v;
    if (k === "filter") { S.filter = v; return render(); }
    await savePrefs({ rec: { [k]: k === "quality" ? v : Number(v) } }); return render();
  }
  switch (t.dataset.do) {
    case "region": return delayed(() => call("shot", "region"));
    case "screen": return delayed(() => call("shot", "screen"));
    case "window": return pickSource(true);
    case "pick-source": return pickSource(false);
    case "record": return S.rec.on ? call("rec-stop") : call("rec-start");
    case "folder-shot": return call("open-folder", "shot");
    case "folder-video": return call("open-folder", "video");
    case "choose-shot": case "choose-video": { const p = await call("choose-folder", t.dataset.do.slice(7)); if (p) { S.prefs = p; render(); } return; }
  }
}));

// ---------------------------------------------------------------- início
(async () => {
  const st = await call("state");
  Object.assign(S, { items: st.items, prefs: st.prefs, rec: st.rec, hotkeysOk: st.hotkeysOk, displays: st.displays });
  if (S.prefs.rec.mic) listMics().then(render).catch(() => {});
  refreshRec(); render();
})().catch((e) => { $("#content").innerHTML = `<div class="empty-box"><i class="i i-triangle-alert"></i><b>Não deu para abrir</b><span>${esc(e.message)}</span></div>`; });
