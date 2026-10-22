// Desenha o ícone do Piphin Captura: icons/captura.png (256). Uso: npm run icon (usa o Electron do Piphin Hub).
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL("about:blank");
  const b64 = await win.webContents.executeJavaScript(`(() => {
    const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
    const g = c.getContext("2d");
    g.beginPath(); g.roundRect(8, 8, 240, 240, 56);
    const bg = g.createLinearGradient(0, 0, s, s); bg.addColorStop(0, "#062a33"); bg.addColorStop(1, "#0a0d14");
    g.fillStyle = bg; g.fill();
    g.lineWidth = 3; g.strokeStyle = "rgba(6,182,212,.6)"; g.stroke();
    const grad = g.createLinearGradient(50, 200, 206, 50); grad.addColorStop(0, "#0891b2"); grad.addColorStop(1, "#67e8f9");
    // cantos de seleção (o print de área)
    g.save(); g.strokeStyle = grad; g.lineWidth = 16; g.lineCap = "round"; g.lineJoin = "round"; g.shadowColor = "#06b6d4"; g.shadowBlur = 18;
    const L = 46, a = 52, b = 204;
    [[a, a, 1, 1], [b, a, -1, 1], [a, b, 1, -1], [b, b, -1, -1]].forEach(([x, y, dx, dy]) => { g.beginPath(); g.moveTo(x, y + dy * L); g.lineTo(x, y); g.lineTo(x + dx * L, y); g.stroke(); });
    g.restore();
    // botão de gravar no meio
    g.save(); g.shadowColor = "#ef4444"; g.shadowBlur = 24; g.fillStyle = "#ef4444";
    g.beginPath(); g.arc(128, 128, 34, 0, Math.PI * 2); g.fill(); g.restore();
    g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.arc(118, 118, 9, 0, Math.PI * 2); g.fill();
    return c.toDataURL("image/png").split(",")[1];
  })()`);
  fs.mkdirSync(path.join(__dirname, "..", "icons"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "..", "icons", "captura.png"), Buffer.from(b64, "base64"));
  console.log("ícone: icons/captura.png");
  app.quit();
});
