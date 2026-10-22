// Editor de print: seta, retângulo, caneta, marca-texto, texto, números, desfoque (pixelado) e cortar.
// As marcações ficam numa lista (dá para desfazer, mover e apagar); só viram pixels ao copiar ou salvar.
"use strict";
const Editor = (() => {
  const $ = (s) => document.querySelector(s);
  const TOOLS = [["move", "mouse-pointer-2", "Mover / apagar marcação (V)"], ["arrow", "move-up-right", "Seta (A)"], ["rect", "square-dashed", "Retângulo (R)"], ["pen", "pen-line", "Caneta (P)"],
    ["mark", "highlighter", "Marca-texto (M)"], ["text", "type", "Texto (T)"], ["step", "hash", "Números (N)"], ["blur", "eye-off", "Esconder (desfoque) (B)"], ["crop", "crop", "Cortar (C)"]];
  const KEYS = { v: "move", a: "arrow", r: "rect", p: "pen", m: "mark", t: "text", n: "step", b: "blur", c: "crop" };
  const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#22d3ee", "#a855f7", "#ffffff", "#111111"];
  const SIZES = [[2, "Fino"], [4, "Médio"], [8, "Grosso"]];
  const cv = $("#cv"), g = cv.getContext("2d"), stage = $("#stage"), ti = $("#textIn");
  let img = null, item = null, marks = [], redo = [], tool = "arrow", color = COLORS[0], size = 4, crop = null;
  let view = { k: 1, x: 0, y: 0 }, drag = null, sel = -1, onClose = null, onSave = null, dirty = false;

  // ---------------------------------------------------------------- desenho
  function fit() {
    const r = stage.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + "px"; cv.style.height = r.height + "px";
    if (!img) return;
    const k = Math.min((r.width - 40) / img.width, (r.height - 40) / img.height, 1);
    view = { k, x: (r.width - img.width * k) / 2, y: (r.height - img.height * k) / 2 };
    draw();
  }
  const toImg = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k }; };
  function arrow(c, a, b, w, col) {
    const ang = Math.atan2(b.y - a.y, b.x - a.x), hl = Math.max(12, w * 4.5);
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.lineCap = "round";
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x - Math.cos(ang) * hl * 0.6, b.y - Math.sin(ang) * hl * 0.6); c.stroke();
    c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - hl * Math.cos(ang - 0.45), b.y - hl * Math.sin(ang - 0.45)); c.lineTo(b.x - hl * Math.cos(ang + 0.45), b.y - hl * Math.sin(ang + 0.45)); c.closePath(); c.fill();
  }
  // pixelado: copia a área do print em blocos grandes (ninguém consegue ler senhas e nomes)
  function pixelate(c, m, source) {
    const x = Math.round(Math.min(m.a.x, m.b.x)), y = Math.round(Math.min(m.a.y, m.b.y)), w = Math.round(Math.abs(m.b.x - m.a.x)), h = Math.round(Math.abs(m.b.y - m.a.y));
    if (w < 2 || h < 2) return;
    const bs = Math.max(8, Math.round(Math.min(w, h) / 8)), sw = Math.max(1, Math.ceil(w / bs)), sh = Math.max(1, Math.ceil(h / bs));
    const t = document.createElement("canvas"); t.width = sw; t.height = sh;
    t.getContext("2d").drawImage(source, x, y, w, h, 0, 0, sw, sh);
    c.save(); c.imageSmoothingEnabled = false; c.drawImage(t, 0, 0, sw, sh, x, y, w, h); c.restore();
  }
  function paint(c, m, i, source) {
    c.save();
    if (m.t === "arrow") arrow(c, m.a, m.b, m.w, m.c);
    else if (m.t === "rect") { c.strokeStyle = m.c; c.lineWidth = m.w; c.lineJoin = "round"; c.strokeRect(Math.min(m.a.x, m.b.x), Math.min(m.a.y, m.b.y), Math.abs(m.b.x - m.a.x), Math.abs(m.b.y - m.a.y)); }
    else if (m.t === "pen" || m.t === "mark") {
      c.strokeStyle = m.c; c.lineWidth = m.t === "mark" ? m.w * 5 : m.w; c.lineCap = "round"; c.lineJoin = "round";
      if (m.t === "mark") { c.globalAlpha = 0.4; c.globalCompositeOperation = "multiply"; }
      c.beginPath(); m.pts.forEach((p, k) => (k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke();
    } else if (m.t === "text") {
      c.font = `700 ${m.w * 6 + 10}px "Segoe UI", system-ui, sans-serif`; c.textBaseline = "top"; c.fillStyle = m.c;
      c.lineWidth = Math.max(2, (m.w * 6 + 10) / 7); c.strokeStyle = m.c === "#111111" ? "#ffffff" : "#000000"; c.lineJoin = "round";
      m.text.split("\n").forEach((ln, k) => { const y = m.a.y + k * (m.w * 6 + 10) * 1.2; c.strokeText(ln, m.a.x, y); c.fillText(ln, m.a.x, y); });
    } else if (m.t === "step") {
      const r = 10 + m.w * 3;
      c.fillStyle = m.c; c.beginPath(); c.arc(m.a.x, m.a.y, r, 0, Math.PI * 2); c.fill();
      c.lineWidth = 2; c.strokeStyle = "rgba(255,255,255,.9)"; c.stroke();
      c.fillStyle = m.c === "#ffffff" ? "#111" : "#fff"; c.font = `800 ${Math.round(r * 1.15)}px "Segoe UI", sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(m.n), m.a.x, m.a.y + 1);
    } else if (m.t === "blur") pixelate(c, m, source);
    if (i === sel) { const b = bounds(m); c.setLineDash([6, 4]); c.lineWidth = 1.5 / (c === g ? view.k : 1); c.strokeStyle = "#22d3ee"; c.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12); }
    c.restore();
  }
  function draw() {
    const dpr = devicePixelRatio || 1;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    if (!img) return;
    g.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.x, dpr * view.y);
    g.drawImage(img, 0, 0);
    marks.forEach((m, i) => paint(g, m, i, img));
    if (drag && drag.preview) paint(g, drag.preview, -1, img);
    // área do corte: escurece o que vai sair
    const cr = crop || (drag && drag.crop);
    if (cr) {
      const x = Math.min(cr.a.x, cr.b.x), y = Math.min(cr.a.y, cr.b.y), w = Math.abs(cr.b.x - cr.a.x), h = Math.abs(cr.b.y - cr.a.y);
      g.fillStyle = "rgba(0,0,0,.55)";
      g.fillRect(0, 0, img.width, y); g.fillRect(0, y + h, img.width, img.height - y - h); g.fillRect(0, y, x, h); g.fillRect(x + w, y, img.width - x - w, h);
      g.setLineDash([8 / view.k, 6 / view.k]); g.strokeStyle = "#22d3ee"; g.lineWidth = 2 / view.k; g.strokeRect(x, y, w, h); g.setLineDash([]);
    }
    const c = crop ? cropRect() : { w: img.width, h: img.height };
    $("#edInfo").textContent = `${c.w} × ${c.h} px${crop ? " (cortado)" : ""} · ${Math.round(view.k * 100)}%`;
  }
  function bounds(m) {
    if (m.pts) { const xs = m.pts.map((p) => p.x), ys = m.pts.map((p) => p.y); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; }
    if (m.t === "text") { const fs = m.w * 6 + 10, lines = m.text.split("\n"); g.save(); g.font = `700 ${fs}px "Segoe UI"`; const w = Math.max(...lines.map((l) => g.measureText(l).width)); g.restore(); return { x: m.a.x, y: m.a.y, w, h: lines.length * fs * 1.2 }; }
    if (m.t === "step") { const r = 10 + m.w * 3; return { x: m.a.x - r, y: m.a.y - r, w: r * 2, h: r * 2 }; }
    return { x: Math.min(m.a.x, m.b.x), y: Math.min(m.a.y, m.b.y), w: Math.abs(m.b.x - m.a.x), h: Math.abs(m.b.y - m.a.y) };
  }
  const hit = (p) => { for (let i = marks.length - 1; i >= 0; i--) { const b = bounds(marks[i]), pad = 8 / view.k; if (p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad) return i; } return -1; };
  const cropRect = () => { const c = crop; return { x: Math.round(Math.max(0, Math.min(c.a.x, c.b.x))), y: Math.round(Math.max(0, Math.min(c.a.y, c.b.y))), w: Math.round(Math.min(img.width, Math.abs(c.b.x - c.a.x))), h: Math.round(Math.min(img.height, Math.abs(c.b.y - c.a.y))) }; };

  // ---------------------------------------------------------------- mouse e teclado
  const commit = (m) => { marks.push(m); redo = []; dirty = true; };
  cv.addEventListener("mousedown", (e) => {
    if (!img || e.button !== 0) return;
    if (!ti.hidden) return finishText();
    const p = toImg(e);
    if (tool === "move") { sel = hit(p); if (sel >= 0) drag = { move: true, last: p, before: JSON.stringify(marks[sel]) }; draw(); return; }
    sel = -1;
    if (tool === "text") return startText(p);
    if (tool === "step") { commit({ t: "step", a: p, w: size, c: color, n: marks.filter((m) => m.t === "step").length + 1 }); return draw(); }
    if (tool === "crop") { drag = { crop: { a: p, b: p } }; crop = null; return; }
    drag = { preview: tool === "pen" || tool === "mark" ? { t: tool, pts: [p], w: size, c: color } : { t: tool, a: p, b: p, w: size, c: color } };
  });
  addEventListener("mousemove", (e) => {
    if (!drag || !img) return;
    const p = toImg(e);
    if (drag.move) { const m = marks[sel], dx = p.x - drag.last.x, dy = p.y - drag.last.y; drag.last = p; const mv = (q) => { q.x += dx; q.y += dy; }; if (m.pts) m.pts.forEach(mv); if (m.a) mv(m.a); if (m.b) mv(m.b); dirty = true; }
    else if (drag.crop) drag.crop.b = p;
    else if (drag.preview.pts) drag.preview.pts.push(p);
    else { drag.preview.b = p; if (e.shiftKey && drag.preview.t === "arrow") { const a = drag.preview.a, ang = Math.round(Math.atan2(p.y - a.y, p.x - a.x) / (Math.PI / 4)) * (Math.PI / 4), d = Math.hypot(p.x - a.x, p.y - a.y); drag.preview.b = { x: a.x + Math.cos(ang) * d, y: a.y + Math.sin(ang) * d }; } }
    draw();
  });
  addEventListener("mouseup", () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.move) { if (JSON.stringify(marks[sel]) !== d.before) redo = []; }
    else if (d.crop) { const c = d.crop; if (Math.abs(c.b.x - c.a.x) > 8 && Math.abs(c.b.y - c.a.y) > 8) { crop = c; dirty = true; } }
    else { const m = d.preview, b = bounds(m); if (m.pts ? m.pts.length > 1 : b.w + b.h > 6) commit(m); }
    draw();
  });
  cv.addEventListener("wheel", (e) => {
    if (!img) return; e.preventDefault();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, k2 = Math.max(0.05, Math.min(8, view.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    view = { k: k2, x: mx - ((mx - view.x) * k2) / view.k, y: my - ((my - view.y) * k2) / view.k }; draw();
  }, { passive: false });

  function startText(p) {
    const r = cv.getBoundingClientRect();
    Object.assign(ti.style, { left: r.left - stage.getBoundingClientRect().left + view.x + p.x * view.k + "px", top: view.y + p.y * view.k + "px", color, fontSize: (size * 6 + 10) * view.k + "px" });
    ti.value = ""; ti.hidden = false; ti.dataset.x = p.x; ti.dataset.y = p.y; setTimeout(() => ti.focus(), 0);
  }
  function finishText() {
    const t = ti.value.trim(); ti.hidden = true;
    if (t) { commit({ t: "text", a: { x: +ti.dataset.x, y: +ti.dataset.y }, text: t, w: size, c: color }); draw(); }
  }
  ti.addEventListener("keydown", (e) => { if (e.key === "Escape") { ti.value = ""; finishText(); } if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); finishText(); } e.stopPropagation(); });
  ti.addEventListener("blur", () => { if (!ti.hidden) finishText(); });

  function undo() { if (crop && !marks.length) { crop = null; return draw(); } if (marks.length) { redo.push(marks.pop()); sel = -1; draw(); } }
  function redoIt() { if (redo.length) { marks.push(redo.pop()); draw(); } }
  addEventListener("keydown", (e) => {
    if ($("#editor").hidden || !ti.hidden) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === "z") { e.preventDefault(); undo(); }
    else if (e.ctrlKey && (k === "y" || (e.shiftKey && k === "z"))) { e.preventDefault(); redoIt(); }
    else if (e.ctrlKey && k === "c") { e.preventDefault(); act("copy"); }
    else if (e.ctrlKey && k === "s") { e.preventDefault(); act("save"); }
    else if (k === "escape") { if (crop && tool === "crop") { crop = null; draw(); } else act("close"); }
    else if ((k === "delete" || k === "backspace") && sel >= 0) { redo = []; marks.splice(sel, 1); sel = -1; dirty = true; draw(); }
    else if (!e.ctrlKey && KEYS[k]) setTool(KEYS[k]);
  });

  // ---------------------------------------------------------------- barra
  function setTool(t) { tool = t; sel = -1; $$tools(); $("#edHint").textContent = { blur: "Arraste sobre o que quer esconder (senhas, nomes, e-mails)", crop: "Arraste a área que fica · Esc desfaz o corte", text: "Clique onde vai o texto · Enter termina", step: "Cada clique põe o próximo número", move: "Arraste uma marcação para mover · Delete apaga", arrow: "Shift deixa a seta reta" }[t] || ""; cv.style.cursor = t === "move" ? "default" : "crosshair"; draw(); }
  function $$tools() {
    $("#tools").innerHTML = TOOLS.map(([k, ic, n]) => `<button class="tb ${tool === k ? "on" : ""}" data-tool="${k}" title="${n}"><i class="i i-${ic}"></i></button>`).join("");
    $("#swatches").innerHTML = COLORS.map((c) => `<button class="sw ${color === c ? "on" : ""}" data-color="${c}" style="--c:${c}" title="Cor"></button>`).join("");
    $("#sizes").innerHTML = SIZES.map(([s, n]) => `<button class="tb sz ${size === s ? "on" : ""}" data-size="${s}" title="${n}"><span style="width:${s + 4}px;height:${s + 4}px"></span></button>`).join("");
  }
  $("#editor").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tool],[data-color],[data-size],[data-ed]"); if (!t) return;
    if (t.dataset.tool) setTool(t.dataset.tool);
    else if (t.dataset.color) { color = t.dataset.color; if (sel >= 0) { marks[sel].c = color; dirty = true; } $$tools(); draw(); }
    else if (t.dataset.size) { size = +t.dataset.size; if (sel >= 0) { marks[sel].w = size; dirty = true; } $$tools(); draw(); }
    else act(t.dataset.ed);
  });

  // imagem final (com as marcações e o corte), no tamanho real
  async function render() {
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const keep = sel; sel = -1; marks.forEach((m, i) => paint(x, m, i, img)); sel = keep;
    let out = c;
    if (crop) { const r = cropRect(); out = document.createElement("canvas"); out.width = r.w; out.height = r.h; out.getContext("2d").drawImage(c, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); }
    const blob = await new Promise((res) => out.toBlob(res, "image/png"));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w: out.width, h: out.height };
  }
  async function act(a) {
    if (a === "undo") return undo();
    if (a === "redo") return redoIt();
    if (a === "close") { if (dirty && !(await onClose("ask"))) return; return close(); }
    const r = await render();
    await onSave(a, r, item);
    if (a === "save") dirty = false;
  }

  function open(it, { onSaved, onClosed }) {
    item = it; onSave = onSaved; onClose = onClosed; marks = []; redo = []; crop = null; sel = -1; dirty = false;
    $("#editor").hidden = false; $$tools(); setTool(tool === "move" || tool === "crop" ? "arrow" : tool);
    img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => { fit(); }; img.src = it.src + (it.src.includes("?") ? "&" : "?") + "v=" + Date.now();
  }
  function close() { $("#editor").hidden = true; img = null; item = null; onClose && onClose("closed"); }
  addEventListener("resize", () => { if (img) fit(); });
  return { open, close, isOpen: () => !$("#editor").hidden };
})();
