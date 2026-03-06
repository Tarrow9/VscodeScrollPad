import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const provider = new PenScrollViewProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('penScrollPanelView', provider)
  );
}

export function deactivate() {}

class PenScrollViewProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'scrollByPixels': {
          const pixels = Number(message.deltaY ?? 0);
          if (!Number.isFinite(pixels) || pixels === 0) {
            return;
          }

          const lineHeightPx = 24;
          const rawLines = pixels / lineHeightPx;
          const lines = Math.max(1, Math.min(40, Math.round(Math.abs(rawLines))));
          const to = pixels > 0 ? 'down' : 'up';

          await vscode.commands.executeCommand('editorScroll', {
            to,
            by: 'wrappedLine',
            value: lines,
            revealCursor: false,
          });
          break;
        }

        case 'scrollPage': {
          const direction = message.direction === 'up' ? 'up' : 'down';
          await vscode.commands.executeCommand('editorScroll', {
            to: direction,
            by: 'halfPage',
            value: 1,
            revealCursor: false,
          });
          break;
        }
      }
    });
  }

  private getHtml(): string {
    const nonce = getNonce();

    return [
      '<!DOCTYPE html>',
      '<html lang="ko">',
      '<head>',
      '  <meta charset="UTF-8" />',
      `  <meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'nonce-${nonce}\';" />`,
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      '  <style>',
      '    html, body {',
      '      height: 100%;',
      '      margin: 0;',
      '      padding: 0;',
      '      overflow: hidden;',
      '      font-family: var(--vscode-font-family);',
      '      color: #ffffff;',
      '      background: transparent;',
      '    }',
      '    .wrap {',
      '      height: 100%;',
      '      display: grid;',
      '      grid-template-rows: auto 1fr auto;',
      '      gap: 10px;',
      '      padding: 10px;',
      '      box-sizing: border-box;',
      '      background: rgba(18, 18, 22, 0.10);',
      '    }',
      '    .title {',
      '      font-size: 13px;',
      '      font-weight: 700;',
      '      color: #ffffff;',
      '    }',
      '    .desc {',
      '      font-size: 11px;',
      '      line-height: 1.4;',
      '      color: rgba(255, 255, 255, 0.92);',
      '    }',
      '    .pad {',
      '      border: 1px solid rgba(255, 255, 255, 0.12);',
      '      border-radius: 10px;',
      '      background: rgba(255, 255, 255, 0.06);',
      '      backdrop-filter: blur(10px);',
      '      -webkit-backdrop-filter: blur(10px);',
      '      touch-action: none;',
      '      user-select: none;',
      '      display: grid;',
      '      place-items: center;',
      '      min-height: 180px;',
      '    }',
      '    .pad.active {',
      '      outline: 2px solid rgba(255, 255, 255, 0.38);',
      '      outline-offset: -2px;',
      '    }',
      '    .hint {',
      '      text-align: center;',
      '      font-size: 12px;',
      '      line-height: 1.6;',
      '      padding: 12px;',
      '      color: #ffffff;',
      '    }',
      '    .meta {',
      '      display: flex;',
      '      justify-content: space-between;',
      '      gap: 8px;',
      '      align-items: center;',
      '      font-size: 11px;',
      '      color: #ffffff;',
      '    }',
      '    .buttons {',
      '      display: flex;',
      '      gap: 6px;',
      '    }',
      '    .badge {',
      '      padding: 3px 8px;',
      '      border-radius: 999px;',
      '      border: 1px solid rgba(255, 255, 255, 0.14);',
      '      background: rgba(255, 255, 255, 0.08);',
      '      color: #ffffff;',
      '    }',
      '    button {',
      '      border: 1px solid rgba(255, 255, 255, 0.14);',
      '      background: rgba(255, 255, 255, 0.12);',
      '      color: #ffffff;',
      '      border-radius: 8px;',
      '      padding: 6px 8px;',
      '      cursor: pointer;',
      '      font-size: 11px;',
      '    }',
      '    button:hover {',
      '      background: rgba(255, 255, 255, 0.18);',
      '    }',
      '  </style>',
      '</head>',
      '<body>',
      '  <div class="wrap">',
      '    <div>',
      '      <div class="title">Scroll Pad</div>',
      '    </div>',
      '    <div id="pad" class="pad">',
      '    </div>',
      '    <div class="meta">',
      '      <div class="buttons">',
      '        <button id="pageUp">▲</button>',
      '        <button id="pageDown">▼</button>',
      '      </div>',
      '      <div class="badge" id="status">idle</div>',
      '    </div>',
      '  </div>',
      `  <script nonce="${nonce}">`,
      '    const vscode = acquireVsCodeApi();',
      '    const pad = document.getElementById("pad");',
      '    const status = document.getElementById("status");',
      '    const pageUp = document.getElementById("pageUp");',
      '    const pageDown = document.getElementById("pageDown");',
      '    let dragging = false;',
      '    let pointerId = null;',
      '    let lastY = 0;',
      '    let remainder = 0;',
      '    let lastMoveAt = 0;',
      '    let recentVelocity = 0;',
      '    let inertiaVelocity = 0;',
      '    let inertiaHandle = 0;',
      '    const PIXEL_STEP = 18;',
      '    const VELOCITY_BLEND = 0.75;',
      '    const INERTIA_START_THRESHOLD = 0.18;',
      '    const INERTIA_FRICTION = 0.92;',
      '    const MAX_INERTIA_PER_FRAME = 72;',
      '    function setStatus(text) {',
      '      if (status) status.textContent = text;',
      '    }',
      '    function stopInertia() {',
      '      if (inertiaHandle) {',
      '        cancelAnimationFrame(inertiaHandle);',
      '        inertiaHandle = 0;',
      '      }',
      '      inertiaVelocity = 0;',
      '    }',
      '    function postScroll(deltaY) {',
      '      if (!deltaY) return;',
      '      vscode.postMessage({ type: "scrollByPixels", deltaY: deltaY });',
      '    }',
      '    function flushRemainderToScroll() {',
      '      while (Math.abs(remainder) >= PIXEL_STEP) {',
      '        const direction = remainder > 0 ? 1 : -1;',
      '        const step = direction * PIXEL_STEP;',
      '        postScroll(step);',
      '        remainder -= step;',
      '      }',
      '    }',
      '    function startInertia() {',
      '      stopInertia();',
      '      if (Math.abs(recentVelocity) < INERTIA_START_THRESHOLD) {',
      '        return;',
      '      }',
      '      inertiaVelocity = recentVelocity;',
      '      setStatus("inertia");',
      '      const tick = function () {',
      '        if (Math.abs(inertiaVelocity) < 0.02) {',
      '          stopInertia();',
      '          setStatus("idle");',
      '          return;',
      '        }',
      '        const frameDelta = Math.max(-MAX_INERTIA_PER_FRAME, Math.min(MAX_INERTIA_PER_FRAME, inertiaVelocity * 16));',
      '        remainder += frameDelta;',
      '        flushRemainderToScroll();',
      '        inertiaVelocity *= INERTIA_FRICTION;',
      '        inertiaHandle = requestAnimationFrame(tick);',
      '      };',
      '      inertiaHandle = requestAnimationFrame(tick);',
      '    }',
      '    function beginDrag(e) {',
      '      stopInertia();',
      '      dragging = true;',
      '      pointerId = e.pointerId;',
      '      lastY = e.clientY;',
      '      remainder = 0;',
      '      recentVelocity = 0;',
      '      lastMoveAt = performance.now();',
      '      if (pad) pad.classList.add("active");',
      '      if (pad && pad.setPointerCapture) pad.setPointerCapture(e.pointerId);',
      '      setStatus("drag: " + e.pointerType);',
      '      e.preventDefault();',
      '    }',
      '    function moveDrag(e) {',
      '      if (!dragging || e.pointerId !== pointerId) return;',
      '      const now = performance.now();',
      '      const delta = -(e.clientY - lastY);',
      '      const dt = Math.max(1, now - lastMoveAt);',
      '      lastY = e.clientY;',
      '      lastMoveAt = now;',
      '      const instantVelocity = delta / dt;',
      '      recentVelocity = recentVelocity * VELOCITY_BLEND + instantVelocity * (1 - VELOCITY_BLEND);',
      '      remainder += delta;',
      '      flushRemainderToScroll();',
      '      e.preventDefault();',
      '    }',
      '    function endDrag(e) {',
      '      if (!dragging || e.pointerId !== pointerId) return;',
      '      dragging = false;',
      '      pointerId = null;',
      '      if (pad) pad.classList.remove("active");',
      '      e.preventDefault();',
      '      startInertia();',
      '      if (!inertiaHandle) {',
      '        setStatus("idle");',
      '      }',
      '    }',
      '    if (pad) {',
      '      pad.addEventListener("pointerdown", beginDrag);',
      '      pad.addEventListener("pointermove", moveDrag);',
      '      pad.addEventListener("pointerup", endDrag);',
      '      pad.addEventListener("pointercancel", endDrag);',
      '      pad.addEventListener("lostpointercapture", function () {',
      '        dragging = false;',
      '        pointerId = null;',
      '        if (pad) pad.classList.remove("active");',
      '        if (!inertiaHandle) setStatus("idle");',
      '      });',
      '    }',
      '    if (pageUp) {',
      '      pageUp.addEventListener("click", function () {',
      '        stopInertia();',
      '        vscode.postMessage({ type: "scrollPage", direction: "up" });',
      '      });',
      '    }',
      '    if (pageDown) {',
      '      pageDown.addEventListener("click", function () {',
      '        stopInertia();',
      '        vscode.postMessage({ type: "scrollPage", direction: "down" });',
      '      });',
      '    }',
      '  </script>',
      '</body>',
      '</html>',
    ].join('');
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}