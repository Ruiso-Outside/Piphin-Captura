// Barrinha do gravador (janela que não aparece no vídeo): captura a tela (e o som do PC / microfone), codifica em
// H.264 + AAC com o codificador da placa de vídeo (WebCodecs, pela Mediabunny) e manda os pedaços para o arquivo MP4.
"use strict";
const $ = (s) => document.querySelector(s);
const MB = window.Mediabunny;
const QUALITY = { high: MB.QUALITY_HIGH, medium: MB.QUALITY_MEDIUM, low: MB.QUALITY_LOW };
let R = null; // gravação em andamento

const fmt = (s) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };
const msg = (t) => ($("#msg").textContent = t);
const elapsed = () => (R && R.t0 ? (R.pausedAt || performance.now()) - R.t0 - R.pausedTotal : 0) / 1000;
setInterval(() => { if (R && R.t0) $("#time").textContent = fmt(elapsed()); }, 250);

async function start(o) {
  if (R) return;
  R = { o, t0: 0, pausedTotal: 0, pausedAt: 0, tracks: [], finishing: false };
  $("#bar").classList.remove("paused");
  $("#sSys").classList.toggle("on", !!o.systemAudio); $("#sMic").classList.toggle("on", !!o.mic);
  try {
    if (o.countdown) {
      document.body.classList.add("counting");
      for (const n of [3, 2, 1]) { $("#count").textContent = n; await new Promise((r) => setTimeout(r, 800)); }
      document.body.classList.remove("counting");
    }
    msg("Iniciando...");
    // a tela (o Hub entrega o monitor/janela escolhido; com som do PC se pedido)
    const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: o.fps || 60 }, audio: !!o.systemAudio });
    R.tracks.push(...display.getTracks());
    const video = display.getVideoTracks()[0];
    if (o.height) await video.applyConstraints({ height: { max: o.height }, frameRate: o.fps || 60 }).catch(() => {});
    video.addEventListener("ended", () => stop()); // a janela gravada fechou
    // som: do PC e/ou microfone, misturados numa trilha só
    const audioIns = [...display.getAudioTracks()];
    if (o.mic) {
      try { const mic = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: o.micId || undefined, echoCancellation: true, noiseSuppression: true } }); R.tracks.push(...mic.getTracks()); audioIns.push(...mic.getAudioTracks()); }
      catch { msg("Sem acesso ao microfone"); }
    }
    let audio = null;
    if (audioIns.length === 1) audio = audioIns[0];
    else if (audioIns.length > 1) {
      R.ac = new AudioContext({ sampleRate: 48000 });
      const dest = R.ac.createMediaStreamDestination();
      for (const t of audioIns) R.ac.createMediaStreamSource(new MediaStream([t])).connect(dest);
      audio = dest.stream.getAudioTracks()[0];
    }

    const st = video.getSettings(), w = st.width || 1920, h = st.height || 1080, fps = o.fps || 60;
    const vcodec = (await MB.getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width: w, height: h })) || "avc";
    const output = new MB.Output({
      format: new MB.Mp4OutputFormat(),
      // pedaços vão direto para o arquivo (a posição permite completar o cabeçalho no fim)
      target: new MB.StreamTarget(new WritableStream({ write: (c) => piphin.invoke("rec-write", c.data, c.position).then((r) => { if (!r.ok) throw new Error(r.error); }) }), { chunked: true, chunkSize: 4 * 1024 * 1024 }),
    });
    R.vsrc = new MB.MediaStreamVideoTrackSource(video, { codec: vcodec, bitrate: QUALITY[o.quality] || MB.QUALITY_HIGH, keyFrameInterval: 2 }, { frameRate: fps });
    R.vsrc.errorPromise.catch((e) => stop(e));
    output.addVideoTrack(R.vsrc, { frameRate: fps });
    if (audio) {
      const acodec = (await MB.getFirstEncodableAudioCodec(["aac", "opus"], { numberOfChannels: 2, sampleRate: 48000 })) || "aac";
      R.asrc = new MB.MediaStreamAudioTrackSource(audio, { codec: acodec, bitrate: 160000 });
      R.asrc.errorPromise.catch((e) => stop(e));
      output.addAudioTrack(R.asrc);
    }
    R.output = output; R.w = w; R.h = h;
    await output.start();
    R.t0 = performance.now();
    piphin.invoke("rec-started");
    msg(`${h}p`);
    // miniatura para a galeria (um quadro depois de 1 s)
    setTimeout(() => grabThumb(display), 1000);
  } catch (e) {
    await stop(e);
  }
}

async function grabThumb(stream) {
  try {
    const v = document.createElement("video"); v.muted = true; v.srcObject = new MediaStream(stream.getVideoTracks()); await v.play();
    const c = document.createElement("canvas"), k = 320 / v.videoWidth; c.width = 320; c.height = Math.round(v.videoHeight * k);
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height); v.srcObject = null;
    const b = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.8));
    if (R) R.thumb = new Uint8Array(await b.arrayBuffer());
  } catch { /* sem miniatura */ }
}

function togglePause() {
  if (!R || !R.t0 || R.finishing) return;
  if (R.pausedAt) { R.pausedTotal += performance.now() - R.pausedAt; R.pausedAt = 0; R.vsrc.resume(); if (R.asrc) R.asrc.resume(); }
  else { R.pausedAt = performance.now(); R.vsrc.pause(); if (R.asrc) R.asrc.pause(); }
  $("#bar").classList.toggle("paused", !!R.pausedAt);
  $("#pause").innerHTML = `<i class="i i-${R.pausedAt ? "play" : "pause"}"></i>`;
  msg(R.pausedAt ? "Pausado" : `${R.h}p`);
  piphin.invoke("rec-paused", !!R.pausedAt);
}

async function stop(err) {
  if (!R || R.finishing) return;
  const r = R; r.finishing = true;
  msg(err ? "Erro" : "Salvando...");
  const seconds = elapsed();
  let error = err ? (err.name === "NotAllowedError" ? "A captura da tela foi negada (o Hub precisa ser o 1.6.0 ou mais novo)" : err.message || String(err)) : null;
  try { if (r.output && !error) await r.output.finalize(); else if (r.output) await r.output.cancel().catch(() => {}); }
  catch (e) { error = error || e.message; }
  for (const t of r.tracks) t.stop();
  if (r.ac) r.ac.close().catch(() => {});
  R = null;
  $("#time").textContent = "0:00"; $("#pause").innerHTML = `<i class="i i-pause"></i>`;
  await piphin.invoke("rec-done", { seconds, w: r.w, h: r.h, thumb: r.thumb || null, error });
}

$("#pause").onclick = togglePause;
$("#stop").onclick = () => stop();
piphin.on("start", (o) => start(o));
piphin.on("stop", () => stop());
piphin.on("pause", togglePause);
piphin.invoke("recorder-ready").then((r) => { if (r && r.ok && r.data) start(r.data); });
