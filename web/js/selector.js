// Escolha da área do print: a janela cobre o monitor com o print congelado; arrastar recorta, Enter pega tudo, Esc cancela.
"use strict";
const $ = (s) => document.querySelector(s);
const img = $("#shot");
img.crossOrigin = "anonymous"; // vem do servidor local do módulo: sem isso o recorte no canvas é bloqueado
let scale = 1, start = null, cur = null, active = false, loaded = false;

function open(d) {
  if (!d || !d.src) return;
  scale = d.scale || 1; start = cur = null; loaded = false; active = true;
  img.onload = () => { loaded = true; };
  img.src = d.src + (d.src.includes("?") ? "&" : "?") + "t=" + Date.now();
  $("#sel").style.display = "none"; $("#size").style.display = "none"; $("#hint").style.display = "";
  dim(null);
}
piphin.on("start", open);
piphin.invoke("selector-ready").then((r) => { if (r && r.ok && r.data) open(r.data); });

// escurece tudo menos a área escolhida
function dim(r) {
  const W = innerWidth, H = innerHeight;
  const set = (el, x, y, w, h) => Object.assign($(el).style, { left: x + "px", top: y + "px", width: Math.max(0, w) + "px", height: Math.max(0, h) + "px" });
  if (!r) { set("#dT", 0, 0, W, H); set("#dL", 0, 0, 0, 0); set("#dR", 0, 0, 0, 0); set("#dB", 0, 0, 0, 0); return; }
  set("#dT", 0, 0, W, r.y); set("#dB", 0, r.y + r.h, W, H - r.y - r.h); set("#dL", 0, r.y, r.x, r.h); set("#dR", r.x + r.w, r.y, W - r.x - r.w, r.h);
}
const rect = () => { const x = Math.min(start.x, cur.x), y = Math.min(start.y, cur.y); return { x, y, w: Math.abs(cur.x - start.x), h: Math.abs(cur.y - start.y) }; };

addEventListener("mousemove", (e) => {
  $("#cx").style.left = e.clientX + "px"; $("#cy").style.top = e.clientY + "px";
  if (!start) return;
  cur = { x: e.clientX, y: e.clientY };
  const r = rect();
  Object.assign($("#sel").style, { display: "block", left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
  const s = $("#size"); s.style.display = "block"; s.textContent = `${Math.round(r.w * scale)} × ${Math.round(r.h * scale)}`;
  s.style.left = Math.min(innerWidth - 110, r.x) + "px"; s.style.top = (r.y > 30 ? r.y - 26 : r.y + r.h + 6) + "px";
  dim(r);
});
addEventListener("mousedown", (e) => {
  if (!active) return;
  if (e.button === 2) return cancel();
  start = cur = { x: e.clientX, y: e.clientY }; $("#hint").style.display = "none";
});
addEventListener("mouseup", () => {
  if (!start) return;
  const r = rect(); start = null;
  if (r.w < 4 || r.h < 4) { $("#sel").style.display = "none"; $("#size").style.display = "none"; dim(null); return; } // só um clique
  finish(r);
});
addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("keydown", (e) => {
  if (e.key === "Escape") cancel();
  else if (e.key === "Enter") finish({ x: 0, y: 0, w: innerWidth, h: innerHeight });
});

function cancel() { active = false; start = null; piphin.invoke("selector-done", null); }
async function finish(r) {
  if (!active) return;
  active = false;
  if (!loaded) await new Promise((res) => (img.onload = res));
  // recorta no tamanho real (pixels físicos do monitor)
  const fx = img.naturalWidth / innerWidth, fy = img.naturalHeight / innerHeight;
  const w = Math.max(1, Math.round(r.w * fx)), h = Math.max(1, Math.round(r.h * fy));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").drawImage(img, Math.round(r.x * fx), Math.round(r.y * fy), w, h, 0, 0, w, h);
  const blob = await new Promise((res) => c.toBlob(res, "image/png"));
  piphin.invoke("selector-done", new Uint8Array(await blob.arrayBuffer()), w, h);
}
