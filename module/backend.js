// Piphin Captura como módulo do Piphin Hub: print de tela (área, tela inteira, janela) com editor e gravador de tela com som.
// Prints: o Hub tira o PNG do monitor e uma janela por cima deixa escolher a área. Gravação: a barrinha do gravador
// (janela que não aparece no vídeo) captura a tela pelo getDisplayMedia, codifica em H.264/AAC e manda os pedaços para cá.
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const MIME = { png: "image/png", jpg: "image/jpeg", mp4: "video/mp4", webm: "video/webm" };
const DEFAULTS = {
  shotsDir: path.join(os.homedir(), "Pictures", "Piphin Capturas"),
  videosDir: path.join(os.homedir(), "Videos", "Piphin Capturas"),
  hotkeys: { region: "PrintScreen", screen: "Ctrl+PrintScreen", record: "Alt+F9" },
  afterShot: { copy: true, save: true, notify: true, edit: false },
  rec: { source: "screen", sourceId: "", systemAudio: true, mic: false, micId: "", fps: 60, quality: "high", height: 0, countdown: true },
};
const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b || {})) o[k] = v && typeof v === "object" && !Array.isArray(v) && a && typeof a[k] === "object" ? merge(a[k], v) : v; return o; };
const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`; };

exports.activate = (ctx) => {
  const PREFS = path.join(ctx.dataDir, "prefs.json"), LIST = path.join(ctx.dataDir, "capturas.json"), TMP = path.join(ctx.dataDir, "tmp");
  const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
  let prefs = merge(DEFAULTS, readJson(PREFS, {}));
  const savePrefs = () => fs.writeFileSync(PREFS, JSON.stringify(prefs, null, 1));
  let items = readJson(LIST, []); // { id, type: "shot"|"video", file, at, w, h, seconds, size, thumb }
  const saveList = () => { fs.writeFileSync(LIST, JSON.stringify(items)); ctx.emit("items", publicItems()); };
  fs.mkdirSync(TMP, { recursive: true });
  for (const f of fs.readdirSync(TMP)) try { fs.rmSync(path.join(TMP, f), { force: true }); } catch { /* em uso */ }

  // ---------------------------------------------------------------- servidor local (imagens e vídeos para as telas)
  const token = crypto.randomBytes(16).toString("hex");
  const files = new Map(), byFile = new Map(); let seq = 0, base = "";
  const server = http.createServer((req, res) => {
    const m = /^\/f\/([0-9a-f]+)\/(\d+)/.exec(req.url || "");
    const file = m && m[1] === token ? files.get(Number(m[2])) : null;
    let st; try { st = file && fs.statSync(file); } catch { st = null; }
    if (!st) { res.writeHead(404); return res.end(); }
    const head = { "Access-Control-Allow-Origin": "*", "Accept-Ranges": "bytes", "Content-Type": MIME[path.extname(file).slice(1).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" };
    const r = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
    let start = 0, end = st.size - 1, code = 200;
    if (r) { start = r[1] ? Number(r[1]) : Math.max(0, st.size - Number(r[2])); end = r[1] && r[2] ? Math.min(Number(r[2]), st.size - 1) : st.size - 1; code = 206; head["Content-Range"] = `bytes ${start}-${end}/${st.size}`; }
    head["Content-Length"] = Math.max(0, end - start + 1);
    res.writeHead(code, head);
    if (req.method === "HEAD") return res.end();
    const s = fs.createReadStream(file, { start, end }); s.pipe(res); res.on("close", () => s.destroy());
  });
  const ready = new Promise((r) => server.listen(0, "127.0.0.1", () => { base = `http://127.0.0.1:${server.address().port}/f/${token}`; r(); }));
  ctx.onStop(() => server.close());
  const url = (f) => { if (!f) return null; let id = byFile.get(f); if (!id) { id = ++seq; files.set(id, f); byFile.set(f, id); } return `${base}/${id}/${encodeURIComponent(path.basename(f))}`; };
  const publicItems = () => items.filter((i) => fs.existsSync(i.file)).map((i) => ({ ...i, src: url(i.file), thumbSrc: i.thumb && fs.existsSync(i.thumb) ? url(i.thumb) : i.type === "shot" ? url(i.file) : null }));

  // ---------------------------------------------------------------- prints
  let busy = false;
  const freeName = (dir, name, ext) => { let f = path.join(dir, `${name}.${ext}`); for (let i = 2; fs.existsSync(f); i++) f = path.join(dir, `${name} (${i}).${ext}`); return f; };
  // print pronto (PNG em base64): copia, salva, avisa e/ou abre o editor, conforme as preferências
  async function finishShot(b64, { w, h, how }) {
    const a = prefs.afterShot;
    if (a.copy) await ctx.host.writeClipboardImage(b64).catch((e) => ctx.log("copiar", e.message));
    let item = null;
    // sempre guarda (mesmo com "salvar" desligado vai para a pasta temporária, para o editor e a galeria)
    const dir = a.save ? prefs.shotsDir : TMP;
    fs.mkdirSync(dir, { recursive: true });
    const file = freeName(dir, `Print ${stamp()}`, "png");
    fs.writeFileSync(file, Buffer.from(b64, "base64"));
    item = { id: crypto.randomBytes(5).toString("hex"), type: "shot", file, at: new Date().toISOString(), w, h, size: fs.statSync(file).size, temp: !a.save, how };
    if (a.save) { items.unshift(item); items = items.slice(0, 500); saveList(); }
    ctx.emit("shot", { ...item, src: url(file) });
    if (a.edit) { lastForEditor = item.id; tmpItems.set(item.id, item); await ctx.host.focus().catch(() => {}); ctx.emit("edit", { ...item, src: url(file) }); }
    else if (a.notify) ctx.host.notify("Print " + (a.copy ? "copiado" : "pronto"), `${w}×${h}${a.save ? " · salvo em " + path.basename(prefs.shotsDir) : ""} · clique para editar`).catch(() => {});
    lastForEditor = item.id; tmpItems.set(item.id, item);
    return item;
  }
  const tmpItems = new Map(); let lastForEditor = null;
  // clicou na notificação do print: o Hub mostra o módulo e o print abre no editor (só se for de agora há pouco)
  let pendingEdit = 0;
  ctx.host.on("view-shown", () => {
    if (lastForEditor && pendingEdit && Date.now() - pendingEdit < 5 * 60000) { const it = tmpItems.get(lastForEditor); if (it) ctx.emit("edit", { ...it, src: url(it.file) }); }
    pendingEdit = 0;
  });

  async function shotScreen() {
    if (busy) return; busy = true;
    try {
      const disp = (await ctx.host.displays()).find((d) => d.underCursor);
      const b64 = await ctx.host.captureScreen({ format: "png", maxWidth: 0, display: disp && disp.id });
      if (!b64) throw new Error("Não deu para capturar a tela");
      const w = disp ? Math.round(disp.bounds.width * disp.scaleFactor) : 0, h = disp ? Math.round(disp.bounds.height * disp.scaleFactor) : 0;
      pendingEdit = Date.now();
      return await finishShot(b64, { w, h, how: "tela" });
    } finally { busy = false; }
  }
  // área: tira o print do monitor do mouse e abre por cima uma janela (do tamanho do monitor) para escolher a área
  let region = null;
  async function shotRegion() {
    if (busy) return; busy = true;
    try {
      const disp = (await ctx.host.displays()).find((d) => d.underCursor) || (await ctx.host.displays())[0];
      const b64 = await ctx.host.captureScreen({ format: "png", maxWidth: 0, display: disp.id });
      if (!b64) throw new Error("Não deu para capturar a tela");
      const file = path.join(TMP, `tela-${Date.now()}.png`);
      fs.writeFileSync(file, Buffer.from(b64, "base64"));
      region = { file, disp };
      await ctx.host.openWindow("selector", { file: "web/selector.html", frame: false, transparent: false, resizable: false, alwaysOnTop: true, topLevel: "screen-saver", skipTaskbar: true,
        fullscreenable: false, maximizable: false, minimizable: false, hasShadow: false, backgroundColor: "#000000", title: "Piphin Captura", x: disp.bounds.x, y: disp.bounds.y, width: disp.bounds.width, height: disp.bounds.height });
      await ctx.host.setWindowBounds("selector", disp.bounds);
      ctx.host.sendToWindow("selector", "start", { src: url(file), scale: disp.scaleFactor, w: Math.round(disp.bounds.width * disp.scaleFactor), h: Math.round(disp.bounds.height * disp.scaleFactor) }).catch(() => {});
      await ctx.host.showWindow("selector", { focus: true });
    } catch (e) { busy = false; throw e; }
  }
  ctx.handle("selector-ready", () => (region ? { src: url(region.file), scale: region.disp.scaleFactor } : null));
  ctx.handle("selector-done", async (pngBytes, w, h) => {
    await ctx.host.hideWindow("selector").catch(() => {});
    const r = region; region = null; busy = false;
    if (r) try { fs.rmSync(r.file, { force: true }); } catch { /* em uso */ }
    if (!pngBytes) return null; // cancelou (Esc)
    pendingEdit = Date.now();
    return finishShot(Buffer.from(pngBytes).toString("base64"), { w, h, how: "área" });
  });
  // print feito pela tela do módulo (janela escolhida, editor salvando uma cópia editada)
  ctx.handle("save-image", async (pngBytes, meta = {}) => {
    const b64 = Buffer.from(pngBytes).toString("base64");
    if (meta.replaceId) {
      const it = items.find((x) => x.id === meta.replaceId) || tmpItems.get(meta.replaceId);
      if (it) { fs.writeFileSync(it.file, Buffer.from(b64, "base64")); it.w = meta.w; it.h = meta.h; it.size = fs.statSync(it.file).size; if (it.temp) { it.temp = false; const nf = freeName(prefs.shotsDir, path.basename(it.file, ".png"), "png"); fs.mkdirSync(prefs.shotsDir, { recursive: true }); fs.renameSync(it.file, nf); it.file = nf; items.unshift(it); } saveList(); if (meta.copy) await ctx.host.writeClipboardImage(b64); return { ...it, src: url(it.file) }; }
    }
    if (meta.copyOnly) { await ctx.host.writeClipboardImage(b64); return true; }
    return finishShot(b64, { w: meta.w, h: meta.h, how: meta.how || "janela" });
  });
  ctx.handle("save-as", async (id) => {
    const it = items.find((x) => x.id === id) || tmpItems.get(id); if (!it) return null;
    const ext = path.extname(it.file).slice(1);
    const f = await ctx.host.saveDialog({ title: "Salvar como", defaultPath: path.join(os.homedir(), "Desktop", path.basename(it.file)), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (!f) return null; fs.copyFileSync(it.file, f); return f;
  });
  ctx.handle("copy-image", async (id) => { const it = items.find((x) => x.id === id) || tmpItems.get(id); if (!it) throw new Error("Print não encontrado"); await ctx.host.writeClipboardImage(fs.readFileSync(it.file).toString("base64")); return true; });
  ctx.handle("shot", async (kind) => (kind === "region" ? shotRegion() : shotScreen()));

  // ---------------------------------------------------------------- gravação
  // a barrinha (janela "recorder") faz a captura e a codificação; aqui só gravamos os pedaços no arquivo
  let rec = null; // { file, fd, since, paused }
  async function sources(types) { await ready; return ctx.host.listCaptureSources({ types }); }
  ctx.handle("sources", (types) => sources(types));
  // print de uma janela pela tela do módulo: escolhe a janela do próximo getDisplayMedia (sem som)
  ctx.handle("set-source", (id) => ctx.host.setCaptureSource({ id, audio: false }));
  ctx.handle("displays", () => ctx.host.displays());
  async function startRecording(opts = {}) {
    if (rec) return rec.file;
    const r = { ...prefs.rec, ...opts };
    // fonte: monitor do mouse (padrão), um monitor escolhido ou uma janela
    let id = r.sourceId;
    if (!id || r.source === "screen") {
      const list = await sources(["screen"]);
      const disp = (await ctx.host.displays()).find((d) => (r.displayId ? d.id === r.displayId : d.underCursor));
      const s = (disp && list.find((x) => x.displayId === disp.id)) || list[0];
      id = s && s.id;
    }
    if (!id) throw new Error("Nenhuma tela para gravar");
    await ctx.host.setCaptureSource({ id, audio: !!r.systemAudio });
    fs.mkdirSync(prefs.videosDir, { recursive: true });
    const file = freeName(prefs.videosDir, `Gravação ${stamp()}`, "mp4");
    rec = { file, fd: fs.openSync(file, "w"), since: null, paused: false, bytes: 0, opts: r };
    await ctx.host.openWindow("recorder", { file: "web/recorder.html", width: 340, height: 56, frame: false, transparent: true, resizable: false, alwaysOnTop: true, topLevel: "screen-saver",
      skipTaskbar: true, focusable: true, hasShadow: false, contentProtection: true, title: "Gravador · Piphin Captura", fullscreenable: false, maximizable: false, minimizable: false });
    const disp = (await ctx.host.displays()).find((d) => d.underCursor) || (await ctx.host.displays())[0];
    await ctx.host.setWindowBounds("recorder", { x: Math.round(disp.workArea.x + disp.workArea.width / 2 - 170), y: disp.workArea.y + 12, width: 340, height: 56 });
    ctx.host.sendToWindow("recorder", "start", { ...r }).catch(() => {});
    await ctx.host.showWindow("recorder", { focus: false });
    ctx.host.keepAlive(true, "gravando a tela").catch(() => {});
    ctx.emit("rec", recState());
    return file;
  }
  const recState = () => (rec ? { on: true, since: rec.since, paused: rec.paused, file: rec.file, bytes: rec.bytes } : { on: false });
  ctx.handle("recorder-ready", () => (rec ? { ...rec.opts } : null));
  ctx.handle("rec-started", () => { if (rec) { rec.since = Date.now(); ctx.emit("rec", recState()); } return true; });
  ctx.handle("rec-write", (bytes, position) => { if (!rec) return false; const b = Buffer.from(bytes); fs.writeSync(rec.fd, b, 0, b.length, position); rec.bytes = Math.max(rec.bytes, position + b.length); return true; });
  ctx.handle("rec-paused", (p) => { if (rec) { rec.paused = !!p; ctx.emit("rec", recState()); } return true; });
  ctx.handle("rec-done", (info = {}) => {
    if (!rec) return null;
    const r = rec; rec = null;
    try { fs.closeSync(r.fd); } catch { /* já fechado */ }
    ctx.host.hideWindow("recorder").catch(() => {});
    ctx.host.keepAlive(false).catch(() => {});
    const size = fs.existsSync(r.file) ? fs.statSync(r.file).size : 0;
    if (info.error || size < 1024) {
      try { fs.rmSync(r.file, { force: true }); } catch { /* em uso */ }
      ctx.emit("rec", { on: false, error: info.error || "A gravação ficou vazia" });
      if (info.error) ctx.host.notify("Gravação não deu certo", info.error).catch(() => {});
      return null;
    }
    let thumb = null;
    if (info.thumb) { thumb = path.join(ctx.dataDir, "miniaturas", path.basename(r.file, ".mp4") + ".jpg"); fs.mkdirSync(path.dirname(thumb), { recursive: true }); fs.writeFileSync(thumb, Buffer.from(info.thumb)); }
    const item = { id: crypto.randomBytes(5).toString("hex"), type: "video", file: r.file, at: new Date().toISOString(), w: info.w, h: info.h, seconds: info.seconds, size, thumb };
    items.unshift(item); saveList();
    ctx.emit("rec", { on: false, last: { ...item, src: url(item.file) } });
    ctx.host.notify("Gravação salva", `${Math.floor((info.seconds || 0) / 60)}:${String(Math.round((info.seconds || 0) % 60)).padStart(2, "0")} · ${(size / 1048576).toFixed(0)} MB · clique para ver`).catch(() => {});
    return item;
  });
  const stopRecording = () => { if (rec) ctx.host.sendToWindow("recorder", "stop").catch(() => {}); return !!rec; };
  ctx.handle("rec-start", (opts) => startRecording(opts));
  ctx.handle("rec-stop", () => stopRecording());
  ctx.handle("rec-toggle-pause", () => { if (rec) ctx.host.sendToWindow("recorder", "pause").catch(() => {}); return true; });
  ctx.handle("rec-state", () => recState());

  // ---------------------------------------------------------------- galeria, preferências e atalhos
  ctx.handle("state", async () => { await ready; return { items: publicItems(), prefs, rec: recState(), hotkeysOk, displays: await ctx.host.displays().catch(() => []) }; });
  ctx.handle("remove", (ids) => {
    for (const id of ids) { const it = items.find((x) => x.id === id); if (!it) continue; try { fs.rmSync(it.file, { force: true }); if (it.thumb) fs.rmSync(it.thumb, { force: true }); } catch { /* em uso */ } }
    items = items.filter((x) => !ids.includes(x.id)); saveList(); return true;
  });
  ctx.handle("show-item", (id) => { const it = items.find((x) => x.id === id) || tmpItems.get(id); if (it) ctx.host.showItem(it.file); return true; });
  ctx.handle("open-folder", (kind) => { const d = kind === "video" ? prefs.videosDir : prefs.shotsDir; fs.mkdirSync(d, { recursive: true }); return ctx.host.openPath(d); });
  ctx.handle("choose-folder", async (kind) => {
    const key = kind === "video" ? "videosDir" : "shotsDir";
    const r = await ctx.host.openDialog({ title: kind === "video" ? "Pasta das gravações" : "Pasta dos prints", properties: ["openDirectory", "createDirectory"], defaultPath: prefs[key] });
    if (!r || !r[0]) return null; prefs[key] = r[0]; savePrefs(); return prefs;
  });
  ctx.handle("prefs", async (patch) => {
    const oldKeys = { ...prefs.hotkeys };
    prefs = merge(prefs, patch || {}); savePrefs();
    if (patch && patch.hotkeys) { for (const a of Object.values(oldKeys)) await ctx.host.unregisterHotkey(a).catch(() => {}); await bindHotkeys(); }
    return { prefs, hotkeysOk };
  });
  let hotkeysOk = {};
  const ACTIONS = { region: () => shotRegion(), screen: () => shotScreen(), record: () => (rec ? stopRecording() : startRecording()) };
  async function bindHotkeys() {
    hotkeysOk = {};
    for (const [k, acc] of Object.entries(prefs.hotkeys)) hotkeysOk[k] = !!(acc && (await ctx.host.registerHotkey(acc).catch(() => false)));
    ctx.emit("hotkeys", hotkeysOk);
  }
  ctx.host.on("hotkey", (acc) => {
    const k = Object.keys(prefs.hotkeys).find((x) => prefs.hotkeys[x] === acc);
    if (k) Promise.resolve(ACTIONS[k]()).catch((e) => { busy = false; ctx.log(k, e.message); ctx.host.notify("Piphin Captura", e.message).catch(() => {}); });
  });
  bindHotkeys().catch((e) => ctx.log("atalhos", e.message));

  // ---------------------------------------------------------------- ferramentas para a IA
  ctx.handle("tool:take_screenshot", async () => {
    const it = await shotScreen();
    if (!it) throw new Error("Já tem um print em andamento");
    return { file: it.file, width: it.w, height: it.h, copied: prefs.afterShot.copy, note: "Print da tela onde está o mouse." };
  });
  ctx.handle("tool:start_recording", async (a = {}) => {
    if (rec) return { recording: true, file: rec.file, note: "Já estava gravando." };
    const ok = await ctx.host.messageBox({ message: "A IA quer começar a gravar a tela", detail: `${a.system_audio === false ? "Sem" : "Com"} o som do PC${a.microphone ? " e o microfone" : ""}. Para parar: ${prefs.hotkeys.record} ou o botão na barrinha.`, buttons: ["Gravar", "Cancelar"] });
    if (ok !== 0) return { recording: false, reason: "A pessoa não quis gravar agora." };
    const file = await startRecording({ systemAudio: a.system_audio !== false, mic: !!a.microphone });
    return { recording: true, file, stop_with: prefs.hotkeys.record };
  });
  ctx.handle("tool:stop_recording", async () => {
    if (!rec) return { recording: false, note: "Não estava gravando." };
    const file = rec.file; stopRecording();
    for (let i = 0; i < 60 && rec; i++) await new Promise((r) => setTimeout(r, 250));
    const it = items.find((x) => x.file === file);
    return it ? { saved: it.file, seconds: Math.round(it.seconds || 0), size_mb: +(it.size / 1048576).toFixed(1) } : { saved: null, note: "A gravação ainda está terminando ou falhou." };
  });
  ctx.handle("tool:list_captures", () => ({ captures: items.slice(0, 30).map((i) => ({ type: i.type === "shot" ? "print" : "vídeo", file: i.file, when: i.at, size: `${i.w}x${i.h}`, seconds: i.seconds ? Math.round(i.seconds) : undefined })),
    folders: { prints: prefs.shotsDir, videos: prefs.videosDir }, hotkeys: prefs.hotkeys }));

  ctx.onStop(() => { if (rec) try { fs.closeSync(rec.fd); } catch { /* já fechado */ } });
};
