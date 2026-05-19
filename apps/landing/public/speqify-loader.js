"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // packages/sdk/src/scrub.ts
  var SECRET_PATTERNS = [
    /\bBearer\s+[A-Za-z0-9._-]+/gi,
    /\beyJ[A-Za-z0-9._-]{20,}/g,
    // JWT-ish
    /\b(?:api[_-]?key|token|secret|password|passwd|pwd)\b\s*[=:]\s*[^\s&"']+/gi,
    /\b[A-Za-z0-9_-]{32,}\b/g
    // long opaque tokens
  ];
  function scrubString(input) {
    let out = input;
    for (const re of SECRET_PATTERNS) out = out.replace(re, "[redacted]");
    return out;
  }
  function scrubUrl(url) {
    try {
      const u = new URL(url, "http://x");
      return scrubString(`${u.origin === "http://x" ? "" : u.origin}${u.pathname}`);
    } catch {
      return scrubString(url.split("?")[0] ?? url);
    }
  }
  function capArray(arr, max) {
    return arr.length <= max ? arr.slice() : arr.slice(arr.length - max);
  }
  function capString(s, max) {
    return s.length <= max ? s : `${s.slice(0, max)}\u2026[+${s.length - max}]`;
  }

  // packages/sdk/src/breadcrumb.ts
  function startBreadcrumb(max = 50) {
    const steps = [];
    const push = (action) => {
      steps.push({ url: location.href, at: (/* @__PURE__ */ new Date()).toISOString(), ...action ? { action } : {} });
    };
    push("load");
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = ((...a) => {
      origPush(...a);
      push("navigate");
    });
    history.replaceState = ((...a) => {
      origReplace(...a);
      push("navigate");
    });
    const onPop = () => push("back");
    const onClick = (e) => {
      const t = e.target;
      if (t) push(`click ${t.tagName.toLowerCase()}`);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("click", onClick, true);
    return {
      steps: () => capArray(steps, max),
      stop: () => {
        history.pushState = origPush;
        history.replaceState = origReplace;
        window.removeEventListener("popstate", onPop);
        window.removeEventListener("click", onClick, true);
      }
    };
  }

  // packages/sdk/src/client.ts
  var SpeqifyClient = class {
    constructor(base, token2) {
      __publicField(this, "base", base);
      __publicField(this, "token", token2);
    }
    async validate() {
      try {
        const r = await fetch(`${this.base}/panels/${this.token}`);
        if (!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    }
    async createAnnotation(body) {
      const r = await fetch(`${this.base}/panels/${this.token}/annotations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(`Speqify ingest failed (${r.status})`);
      return await r.json();
    }
    async upload(kind, blob) {
      const r = await fetch(`${this.base}/panels/${this.token}/uploads?kind=${kind}`, {
        method: "POST",
        headers: { "content-type": blob.type || "application/octet-stream" },
        body: blob
      });
      if (!r.ok) throw new Error(`Speqify upload failed (${r.status})`);
      return await r.json();
    }
    async submit(submissionId, clientId) {
      const r = await fetch(`${this.base}/panels/${this.token}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId, clientId })
      });
      if (!r.ok) throw new Error(`Speqify submit failed (${r.status})`);
    }
  };

  // packages/sdk/src/idb.ts
  var DB_NAME = "speqify";
  var STORE = "outbox";
  function memoryStore() {
    const m = /* @__PURE__ */ new Map();
    return {
      put: async (r) => void m.set(r.payload.clientAnnotationId, r),
      getAll: async () => [...m.values()],
      del: async (id) => void m.delete(id)
    };
  }
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: "payload.clientAnnotationId" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    });
  }
  function promisify(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
    });
  }
  function createOutboxStore() {
    if (typeof indexedDB === "undefined") return memoryStore();
    return {
      async put(record) {
        const db = await openDb();
        await promisify(db.transaction(STORE, "readwrite").objectStore(STORE).put(record));
        db.close();
      },
      async getAll() {
        const db = await openDb();
        const all = await promisify(
          db.transaction(STORE, "readonly").objectStore(STORE).getAll()
        );
        db.close();
        return all;
      },
      async del(id) {
        const db = await openDb();
        await promisify(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
        db.close();
      }
    };
  }

  // packages/sdk/src/outbox.ts
  var MAX_ATTEMPTS = 8;
  var MAX_QUEUE = 200;
  function backoffMs(attempts) {
    return Math.min(2 ** attempts * 1e3, 5 * 60 * 1e3);
  }
  var Outbox = class {
    constructor(store, now = Date.now, maxQueue = MAX_QUEUE) {
      __publicField(this, "store", store);
      __publicField(this, "now", now);
      __publicField(this, "maxQueue", maxQueue);
    }
    /** Try to send now; queue on failure. Returns the outcome. */
    async send(payload, send) {
      try {
        await send(payload);
        return "sent";
      } catch {
        await this.enqueue(payload);
        return "queued";
      }
    }
    async enqueue(payload) {
      const all = await this.store.getAll();
      if (all.length >= this.maxQueue) {
        const oldest = all.reduce((a, b) => a.nextAt <= b.nextAt ? a : b);
        await this.store.del(oldest.payload.clientAnnotationId);
      }
      await this.store.put({ payload, attempts: 0, nextAt: 0 });
    }
    /** Retry everything due. Returns counts for diagnostics/UI. */
    async flush(send) {
      const all = await this.store.getAll();
      let sent = 0;
      let kept = 0;
      let dropped = 0;
      for (const r of all) {
        if (this.now() < r.nextAt) {
          kept++;
          continue;
        }
        try {
          await send(r.payload);
          await this.store.del(r.payload.clientAnnotationId);
          sent++;
        } catch {
          const attempts = r.attempts + 1;
          if (attempts > MAX_ATTEMPTS) {
            await this.store.del(r.payload.clientAnnotationId);
            dropped++;
          } else {
            await this.store.put({
              payload: r.payload,
              attempts,
              nextAt: this.now() + backoffMs(attempts)
            });
            kept++;
          }
        }
      }
      return { sent, kept, dropped };
    }
    async size() {
      return (await this.store.getAll()).length;
    }
  };

  // packages/sdk/src/media.ts
  function recorderToBlob(rec, fallbackType) {
    const chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const done = new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || fallbackType }));
    });
    rec.start();
    return done;
  }
  async function startScreenRecording() {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
    let mic = null;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      mic = null;
    }
    const videoTracks = display.getVideoTracks();
    const muxed = new MediaStream(videoTracks);
    if (mic) for (const t of mic.getAudioTracks()) muxed.addTrack(t);
    const videoRec = new MediaRecorder(muxed);
    const videoDone = recorderToBlob(videoRec, "video/webm");
    let audioRec = null;
    let audioDone = null;
    if (mic) {
      audioRec = new MediaRecorder(new MediaStream(mic.getAudioTracks()));
      audioDone = recorderToBlob(audioRec, "audio/webm");
    }
    const stopTracks = () => {
      display.getTracks().forEach((t) => t.stop());
      mic?.getTracks().forEach((t) => t.stop());
    };
    return {
      stop: async () => {
        const vp = videoDone;
        const ap = audioDone;
        videoRec.stop();
        audioRec?.stop();
        const video = await vp;
        const audio = ap ? await ap : null;
        stopTracks();
        return { video, audio };
      },
      cancel: () => {
        try {
          videoRec.stop();
          audioRec?.stop();
        } catch {
        }
        stopTracks();
      }
    };
  }
  async function startVoiceRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.start();
    const stopTracks = () => stream.getTracks().forEach((t) => t.stop());
    return {
      stop: () => new Promise((resolve) => {
        rec.onstop = () => {
          stopTracks();
          resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        };
        rec.stop();
      }),
      cancel: () => {
        try {
          rec.stop();
        } catch {
        }
        stopTracks();
      }
    };
  }

  // packages/sdk/src/ids.ts
  var newId = () => crypto.randomUUID();

  // packages/sdk/src/payload.ts
  function buildAnnotationPayload(args) {
    const type = args.recordingVideo ? "recording" : args.element ? "element" : "global";
    return {
      clientAnnotationId: newId(),
      submissionId: args.submissionId,
      clientId: args.clientId,
      type,
      pageUrl: args.pageUrl,
      breadcrumb: args.breadcrumb ?? [],
      element: args.element ?? null,
      screenshot: args.screenshot ?? null,
      voice: args.voice ?? null,
      recordingVideo: args.recordingVideo ?? null,
      recordingAudio: args.recordingAudio ?? null,
      textNote: args.textNote ?? null,
      tags: args.tags ?? [],
      structured: args.structured ?? null,
      technical: args.technical ?? null,
      hostApp: args.hostApp ?? null,
      clientCreatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }

  // packages/sdk/src/redact.ts
  function clampRects(rects, width, height) {
    const out = [];
    for (const r of rects) {
      const x1 = Math.max(0, Math.min(r.x, width));
      const y1 = Math.max(0, Math.min(r.y, height));
      const x2 = Math.max(0, Math.min(r.x + r.w, width));
      const y2 = Math.max(0, Math.min(r.y + r.h, height));
      const w = x2 - x1;
      const h = y2 - y1;
      if (w > 0 && h > 0) out.push({ x: x1, y: y1, w, h });
    }
    return out;
  }
  async function redactBlob(blob, rects) {
    if (rects.length === 0) return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return blob;
    }
    ctx.drawImage(bitmap, 0, 0);
    ctx.fillStyle = "#000";
    for (const r of clampRects(rects, bitmap.width, bitmap.height)) {
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    bitmap.close();
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b ?? blob), "image/png");
    });
  }

  // packages/sdk/src/screenshot.ts
  var DEFAULT_URL = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
  var loading = null;
  function getGlobal() {
    return globalThis.html2canvas;
  }
  function loadHtml2Canvas(url) {
    const existing = getGlobal();
    if (existing) return Promise.resolve(existing);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = () => {
        const fn = getGlobal();
        if (fn) resolve(fn);
        else reject(new Error("html2canvas unavailable after load"));
      };
      s.onerror = () => reject(new Error("Failed to load html2canvas"));
      document.head.appendChild(s);
    });
    return loading;
  }
  async function captureScreenshot(el, url = DEFAULT_URL) {
    const h2c = await loadHtml2Canvas(url);
    const target = el ?? document.body;
    const canvas = await h2c(target, {
      logging: false,
      useCORS: true,
      scale: Math.min(window.devicePixelRatio || 1, 2)
    });
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => b ? resolve(b) : reject(new Error("Screenshot encode failed")),
        "image/png"
      );
    });
  }

  // packages/sdk/src/selector.ts
  var MAX_HTML = 2e4;
  function nth(el) {
    let i = 1;
    let sib = el.previousElementSibling;
    while (sib) {
      if (sib.tagName === el.tagName) i++;
      sib = sib.previousElementSibling;
    }
    return i;
  }
  function cssSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const testId = el.getAttribute("data-testid") ?? el.getAttribute("data-speqify-id");
    if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && node.tagName !== "HTML" && depth < 6) {
      const tag = node.tagName.toLowerCase();
      const part = node.id ? `#${CSS.escape(node.id)}` : `${tag}:nth-of-type(${nth(node)})`;
      parts.unshift(part);
      if (node.id) break;
      node = node.parentElement;
      depth++;
    }
    return parts.join(" > ");
  }
  function xpath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node.tagName !== "HTML") {
      parts.unshift(`${node.tagName.toLowerCase()}[${nth(node)}]`);
      node = node.parentElement;
    }
    return `/html/${parts.join("/")}`;
  }
  function captureElement(el) {
    const r = el.getBoundingClientRect();
    return {
      selector: cssSelector(el),
      xpath: xpath(el),
      html: el.outerHTML.slice(0, MAX_HTML),
      boundingBox: {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height)
      }
    };
  }

  // packages/sdk/src/session.ts
  function persistent(key) {
    const k = `speqify.${key}`;
    let v = sessionStorage.getItem(k);
    if (!v) {
      v = newId();
      sessionStorage.setItem(k, v);
    }
    return v;
  }
  var getClientId = () => persistent("cid");
  var getSubmissionId = () => persistent("sid");
  function resetSubmission() {
    sessionStorage.removeItem("speqify.sid");
  }

  // packages/sdk/src/overlay.ts
  var CONSENT_KEY = "speqify.consent";
  var CONSENT_CAM_KEY = "speqify.consent.cam";
  var STYLE = `
:host{all:initial}
*,*::before,*::after{box-sizing:border-box}
:host{
  --primary:#0F172A;--on-primary:#fff;--primary-hover:#1E293B;
  --secondary:#475569;--accent:#DC2626;--accent-hover:#B91C1C;
  --success:#15803D;--warning:#B45309;--danger:#B91C1C;--info:#1D4ED8;
  --neutral:#F8FAFC;--surface:#fff;--surface-muted:#F1F5F9;--surface-sunken:#E2E8F0;
  --border:#E2E8F0;--border-strong:#CBD5E1;--border-focus:#1D4ED8;--muted:#64748B;
  --el-1:0 1px 2px rgba(15,23,42,.06);--el-2:0 4px 12px rgba(15,23,42,.08);
  --el-3:0 12px 32px rgba(15,23,42,.16);
  --font-sans:"Inter",-apple-system,system-ui,sans-serif;
  --font-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-family:var(--font-sans);
}
button{font-family:inherit;cursor:pointer}
:where(button,textarea):focus-visible{outline:2px solid var(--border-focus);outline-offset:2px}

/* Status pill */
.sp-status{
  position:fixed;top:14px;left:50%;transform:translateX(-50%);
  background:var(--surface);border:1px solid var(--border);
  box-shadow:var(--el-2);border-radius:999px;
  padding:6px 6px 6px 14px;display:flex;align-items:center;gap:10px;
  font-size:13px;color:var(--secondary);z-index:2147483000;max-width:92vw}
.sp-status .live-dot{width:8px;height:8px;border-radius:50%;background:#22C55E;
  box-shadow:0 0 0 3px rgba(34,197,94,.2);flex:none}
.sp-status .txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-status strong{color:var(--primary);font-weight:600}
.sp-status .v{font-family:var(--font-mono);font-size:11px;color:var(--muted);
  background:var(--surface-muted);padding:3px 8px;border-radius:999px;flex:none}
.sp-status .close{border:0;background:transparent;color:var(--muted);
  width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex:none}
.sp-status .close:hover{background:var(--surface-muted);color:var(--primary)}

/* Bottom toolbar */
.sp-toolbar{
  position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483000;
  background:var(--primary);color:#fff;border-radius:14px;padding:8px;
  box-shadow:var(--el-3);display:flex;align-items:center;gap:4px}
.sp-tool{background:transparent;border:0;color:rgba(255,255,255,.7);
  width:40px;height:40px;border-radius:10px;display:grid;place-items:center;position:relative}
.sp-tool svg{width:18px;height:18px}
.sp-tool:hover{background:rgba(255,255,255,.08);color:#fff}
.sp-tool.active{background:rgba(255,255,255,.12);color:#fff}
.sp-tool.accent{background:var(--accent);color:#fff}
.sp-tool.accent:hover{background:var(--accent-hover)}
.sp-tool .badge{position:absolute;top:4px;right:4px;background:var(--accent);color:#fff;
  font-size:10px;font-weight:700;min-width:16px;height:16px;border-radius:999px;
  display:grid;place-items:center;padding:0 5px;box-shadow:0 0 0 2px var(--primary)}
.sp-toolbar .sep{width:1px;height:24px;background:rgba(255,255,255,.12);margin:0 4px}
.sp-tip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);
  background:#0B1220;color:#fff;font-size:11px;font-weight:500;padding:5px 8px;
  border-radius:6px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s}
.sp-tool:hover .sp-tip{opacity:1}
.sp-tip .kbd{font-family:var(--font-mono);font-size:10px;background:rgba(255,255,255,.15);
  padding:1px 4px;border-radius:3px;margin-left:6px}

/* Annotation panel */
.sp-panel{position:fixed;top:0;right:0;bottom:0;width:440px;max-width:100vw;
  background:var(--surface);color:var(--primary);box-shadow:-20px 0 60px rgba(15,23,42,.18);
  border-left:1px solid var(--border);display:flex;flex-direction:column;
  z-index:2147483000;animation:sp-slide .4s cubic-bezier(.2,.7,.2,1);font-size:14px;line-height:1.6}
@keyframes sp-slide{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
.sp-head{display:flex;align-items:center;justify-content:space-between;
  padding:16px 20px;border-bottom:1px solid var(--border);flex:none}
.sp-head-l{display:flex;align-items:center;gap:10px}
.sp-logo{width:28px;height:28px;border-radius:8px;background:var(--primary);
  display:grid;place-items:center;color:#fff;position:relative;flex:none}
.sp-logo::after{content:"";position:absolute;width:8px;height:8px;border-radius:50%;
  background:var(--accent);top:-2px;right:-2px;box-shadow:0 0 0 2px var(--surface)}
.sp-logo svg{width:14px;height:14px}
.sp-title{font-weight:700;font-size:15px;letter-spacing:-.01em}
.sp-sub{font-size:11px;color:var(--muted);font-family:var(--font-mono)}
.sp-head-r{display:flex;align-items:center;gap:6px}
.sp-iconbtn{background:transparent;border:0;width:32px;height:32px;border-radius:8px;
  color:var(--muted);display:grid;place-items:center}
.sp-iconbtn:hover{background:var(--surface-muted);color:var(--primary)}
.sp-iconbtn svg{width:16px;height:16px}

.sp-tabs{display:flex;gap:4px;padding:0 12px;border-bottom:1px solid var(--border);flex:none}
.sp-tab{background:transparent;border:0;padding:10px 12px;font-size:13px;color:var(--muted);
  font-weight:500;border-bottom:2px solid transparent;margin-bottom:-1px;
  display:inline-flex;align-items:center;gap:6px}
.sp-tab:hover{color:var(--primary)}
.sp-tab.active{color:var(--primary);font-weight:600;border-bottom-color:var(--primary)}
.sp-tab .ct{background:var(--surface-muted);color:var(--muted);font-size:11px;
  font-weight:700;border-radius:999px;padding:1px 7px}
.sp-tab.active .ct{background:#FEF2F2;color:var(--accent)}

.sp-body{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:18px}

.ann-head{display:flex;align-items:center;justify-content:space-between}
.ann-head .num{display:inline-flex;align-items:center;gap:8px;font-size:14px;
  font-weight:600;color:var(--primary)}
.ann-head .num .dot{width:22px;height:22px;border-radius:50%;background:var(--accent);
  color:#fff;font-size:12px;font-weight:700;display:grid;place-items:center}
.ann-head .state{font-size:11px;font-weight:700;text-transform:uppercase;
  letter-spacing:.04em;color:var(--warning);background:#FFFBEB;padding:3px 9px;border-radius:999px}
.ann-head .state.subm{color:var(--success);background:#F0FDF4}

.sec{display:flex;flex-direction:column;gap:8px}
.sec-label{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;
  letter-spacing:.06em;text-transform:uppercase;color:var(--secondary)}
.sec-label .req{color:var(--muted);font-weight:500;text-transform:none;letter-spacing:0;font-size:11px}

.elem-card{background:var(--surface-muted);border:1px solid var(--border);
  border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.elem-card .row{display:flex;align-items:center;gap:8px;font-size:12px}
.elem-card .row .l{color:var(--muted);font-weight:600;letter-spacing:.04em;
  text-transform:uppercase;font-size:10px;width:64px;flex:none}
.elem-card .row .v{font-family:var(--font-mono);font-size:12px;color:var(--primary);
  background:var(--surface);border:1px solid var(--border);padding:3px 7px;border-radius:5px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.elem-card .empty{font-size:12px;color:var(--muted)}
.pick{background:var(--surface);border:1px solid var(--border-strong);color:var(--primary);
  font-size:12px;font-weight:600;padding:7px 10px;border-radius:6px;
  display:inline-flex;align-items:center;gap:6px;align-self:flex-start}
.pick:hover{background:#fff;border-color:var(--primary)}
.pick svg{width:12px;height:12px}

.rec{background:linear-gradient(180deg,#FEF2F2,#fff);border:1px solid #FECACA;
  border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:12px}
.rec.idle{background:var(--surface-muted);border-color:var(--border)}
.rec.done{background:linear-gradient(180deg,#F0FDF4,#fff);border-color:#BBF7D0}
.rec-row{display:flex;align-items:center;gap:12px}
.rec-btn{width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;
  border:0;display:grid;place-items:center;flex:none;
  box-shadow:0 4px 12px rgba(220,38,38,.35);position:relative}
.rec-btn::before{content:"";position:absolute;inset:-6px;border-radius:50%;
  border:2px solid var(--accent);opacity:.3;animation:sp-pulse 1.6s ease-out infinite}
.rec.idle .rec-btn{background:var(--surface);color:var(--accent);
  border:1.5px dashed var(--accent);box-shadow:none}
.rec.idle .rec-btn::before,.rec.done .rec-btn::before{display:none}
.rec.done .rec-btn{background:var(--success);box-shadow:none}
.rec-btn svg{width:16px;height:16px}
.rec-wave{flex:1;display:flex;align-items:center;gap:2px;height:36px}
.rec-wave span{flex:1;background:var(--accent);border-radius:2px;opacity:.85;
  transform-origin:center;height:8px}
.rec.idle .rec-wave span,.rec.done .rec-wave span{background:var(--border-strong);opacity:.6}
.rec.live .rec-wave span{animation:sp-bar 1s ease-in-out infinite}
.rec-time{font-family:var(--font-mono);font-size:14px;font-weight:600;
  color:var(--accent);min-width:42px;text-align:right}
.rec.idle .rec-time,.rec.done .rec-time{color:var(--muted)}
.rec-meta{display:flex;align-items:center;justify-content:space-between;
  font-size:12px;color:var(--secondary);gap:8px}
.rec-meta .l{display:inline-flex;align-items:center;gap:6px}
.rec-meta .lang{background:var(--surface);border:1px solid var(--border);padding:3px 8px;
  border-radius:6px;font-family:var(--font-mono);font-size:11px}
.rec-meta .actions{display:flex;gap:10px}
.rec-meta button{background:transparent;border:0;color:var(--secondary);font-size:12px;
  font-weight:500;padding:0}
.rec-meta button:hover{color:var(--primary)}
.rec-meta button.danger{color:var(--danger)}

.ta{width:100%;min-height:80px;resize:vertical;border:1px solid var(--border-strong);
  border-radius:8px;padding:12px 14px;font-family:inherit;font-size:14px;
  color:var(--primary);background:var(--surface);line-height:1.5}

.tags{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.tag{display:inline-flex;align-items:center;gap:4px;background:var(--surface-muted);
  border:1px solid var(--border);color:var(--primary);font-size:12px;font-weight:500;
  padding:4px 10px;border-radius:999px}
.tag button{background:0;border:0;color:var(--muted);font-weight:400;padding:0;font-size:13px}
.tag.add{background:#EFF6FF;border-color:#BFDBFE;color:var(--info);border-style:dashed}

.seg{display:grid;grid-template-columns:repeat(3,1fr);background:var(--surface-muted);
  border:1px solid var(--border);border-radius:8px;padding:3px;gap:3px}
.seg.two{grid-template-columns:repeat(2,1fr)}
.seg button{background:transparent;border:0;padding:7px 0;font-size:12px;font-weight:600;
  color:var(--secondary);border-radius:6px}
.seg button.active{background:var(--surface);color:var(--primary);box-shadow:var(--el-1)}
.seg button.active.danger{color:var(--accent)}
.seg button.active.warn{color:var(--warning)}
.seg button.active.ok{color:var(--success)}

.ctx{display:flex;flex-direction:column;gap:6px;background:var(--surface-muted);
  border:1px solid var(--border);border-radius:10px;padding:12px 14px}
.ctx-row{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--secondary)}
.ctx-row svg{width:12px;height:12px;flex:none;color:var(--success)}
.ctx-row.off svg{color:var(--muted)}
.ctx-row .v{color:var(--primary);font-weight:500}
.ctx-row.off .v{color:var(--muted)}
.ctx-row .meta{margin-left:auto;color:var(--muted);font-family:var(--font-mono);font-size:11px}

.ann-prev{background:var(--surface);border:1px solid var(--border);border-radius:10px;
  padding:12px 14px;display:flex;align-items:center;gap:12px}
.ann-prev .num{width:24px;height:24px;border-radius:50%;background:var(--surface-muted);
  color:var(--primary);font-size:12px;font-weight:700;display:grid;place-items:center;flex:none}
.ann-prev .num.done{background:#F0FDF4;color:var(--success)}
.ann-prev .info{flex:1;min-width:0}
.ann-prev .info .t{font-size:13px;font-weight:500;color:var(--primary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ann-prev .info .m{font-size:11px;color:var(--muted);font-family:var(--font-mono)}
.ann-prev .st{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  padding:2px 7px;border-radius:999px;flex:none}
.ann-prev .st.subm{background:#F0FDF4;color:var(--success)}
.ann-prev .st.draft{background:#FFFBEB;color:var(--warning)}
.empty-note{font-size:13px;color:var(--muted);padding:8px 0}

.kv{display:flex;flex-direction:column;gap:6px;background:var(--surface-muted);
  border:1px solid var(--border);border-radius:10px;padding:12px 14px}
.kv-row{display:flex;align-items:flex-start;gap:8px;font-size:12px}
.kv-row .l{color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em;
  font-size:10px;width:96px;flex:none;padding-top:1px}
.kv-row .v{color:var(--primary);font-family:var(--font-mono);font-size:11px;
  word-break:break-word;flex:1}

.row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}

.sp-foot{border-top:1px solid var(--border);padding:14px 20px;display:flex;
  align-items:center;gap:10px;background:var(--surface);flex:none}
.sp-save{background:transparent;border:0;color:var(--secondary);font-size:14px;
  font-weight:500;padding:10px 12px;border-radius:8px}
.sp-save:hover{color:var(--primary);background:var(--surface-muted)}
.sp-save:disabled{opacity:.5;cursor:not-allowed}
.sp-foot .sync{margin-left:auto;font-size:12px;color:var(--muted);
  display:inline-flex;align-items:center;gap:6px}
.sp-foot .sync svg{width:12px;height:12px}
.sp-foot .sync.ok{color:var(--success)}
.sp-foot .sync.err{color:var(--danger)}
.sp-submit{margin-left:8px;background:var(--primary);color:#fff;border:0;height:40px;
  padding:0 18px;border-radius:8px;font-weight:600;font-size:14px;
  display:inline-flex;align-items:center;gap:8px}
.sp-submit:hover{background:var(--primary-hover)}
.sp-submit:disabled{opacity:.5;cursor:not-allowed}
.sp-submit svg{width:14px;height:14px}

/* Consent gate (RODO disclosure) */
.consent{display:flex;flex-direction:column}
.consent-head{padding:22px 22px 0}
.consent-head .logo{width:42px;height:42px;border-radius:11px;background:var(--primary);
  color:#fff;display:grid;place-items:center;margin-bottom:14px;position:relative}
.consent-head .logo::after{content:"";position:absolute;width:9px;height:9px;border-radius:50%;
  background:var(--accent);top:-2px;right:-2px;box-shadow:0 0 0 2px var(--surface)}
.consent-head .logo svg{width:19px;height:19px}
.consent-head h3{margin:0;font-size:17px;font-weight:700;letter-spacing:-.01em;
  line-height:1.3;color:var(--primary)}
.consent-head p{margin:7px 0 0;color:var(--secondary);font-size:13px;line-height:1.6}
.consent-head p strong{color:var(--primary);font-weight:600}
.consent-list{list-style:none;padding:16px 22px 0;margin:0;display:flex;
  flex-direction:column;gap:8px}
.consent-list li{display:flex;align-items:flex-start;gap:11px;padding:11px 13px;
  background:var(--surface-muted);border-radius:10px;font-size:12.5px;line-height:1.5;
  color:var(--secondary)}
.consent-list li .ic{width:26px;height:26px;border-radius:8px;background:var(--surface);
  color:var(--info);display:grid;place-items:center;flex:none}
.consent-list li .ic svg{width:13px;height:13px}
.consent-list li strong{color:var(--primary);font-weight:600}
.consent-checks{padding:16px 22px;display:flex;flex-direction:column;gap:9px}
.consent-checks label{display:flex;align-items:flex-start;gap:9px;font-size:12.5px;
  line-height:1.5;color:var(--secondary);cursor:pointer}
.consent-checks label input{margin-top:1px;width:17px;height:17px;
  accent-color:var(--primary);flex:none}
.consent-checks label strong{color:var(--primary);font-weight:600}
.consent-foot{padding:14px 22px;border-top:1px solid var(--border);
  background:var(--surface-muted);display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.consent-foot a{font-size:11.5px;color:var(--info);font-weight:500;cursor:pointer}
.consent-foot .btn-row{margin-left:auto;display:flex;gap:8px}
.consent .agree{background:var(--primary);color:#fff;border:0;height:38px;padding:0 16px;
  border-radius:8px;font-weight:600;font-size:13.5px;display:inline-flex;
  align-items:center;gap:6px}
.consent .agree:hover{background:var(--primary-hover)}
.consent .agree:disabled{opacity:.45;cursor:not-allowed}
.consent .decline{background:transparent;border:0;color:var(--secondary);height:38px;
  padding:0 12px;border-radius:8px;font-weight:600;font-size:13.5px}
.consent .decline:hover{color:var(--primary)}

@keyframes sp-pulse{0%{transform:scale(.98);opacity:.4}100%{transform:scale(1.08);opacity:0}}
@keyframes sp-bar{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){
  .sp-panel{animation:none}
  .rec-btn::before,.rec.live .rec-wave span{animation:none}
}

/* Idle FAB + session pill (SDK Idle state) */
.sp-fab{position:fixed;bottom:24px;right:24px;z-index:2147483000;background:var(--primary);
  color:#fff;border:0;cursor:pointer;border-radius:999px;padding:10px 18px 10px 12px;
  display:flex;align-items:center;gap:12px;
  box-shadow:0 12px 32px rgba(15,23,42,.25),0 0 0 4px rgba(15,23,42,.05);
  transition:transform .15s,box-shadow .15s;font-family:var(--font-sans)}
.sp-fab:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(15,23,42,.3),0 0 0 6px rgba(15,23,42,.06)}
.sp-fab-mark{width:32px;height:32px;border-radius:8px;background:#fff;color:var(--primary);
  display:grid;place-items:center;position:relative;flex:none}
.sp-fab-mark::after{content:"";position:absolute;width:10px;height:10px;border-radius:50%;
  background:#22C55E;top:-2px;right:-2px;box-shadow:0 0 0 2px var(--primary);
  animation:sp-livedot 1.6s ease-in-out infinite}
@keyframes sp-livedot{50%{opacity:.4}}
.sp-fab-mark svg{width:16px;height:16px}
.sp-fab-body{display:flex;flex-direction:column;gap:1px;text-align:left}
.sp-fab-label{font-weight:700;font-size:14px;letter-spacing:-.01em}
.sp-fab-sub{font-size:11px;color:rgba(255,255,255,.65);font-family:var(--font-mono)}
.sp-fab-cta{width:28px;height:28px;border-radius:50%;background:var(--accent);
  display:grid;place-items:center;flex:none}
.sp-fab-cta svg{width:14px;height:14px;color:#fff}
.sp-session-pill{position:fixed;bottom:24px;right:232px;z-index:2147483000;
  background:var(--surface);color:var(--primary);border:1px solid var(--border);
  border-radius:999px;padding:8px 14px;display:flex;align-items:center;gap:10px;
  font-size:12px;font-weight:500;box-shadow:var(--el-2);max-width:48vw}
.sp-session-pill .av{width:20px;height:20px;border-radius:50%;
  background:linear-gradient(135deg,#22D3EE,#3B82F6);color:#fff;font-size:9px;
  font-weight:700;display:grid;place-items:center;flex:none}
.sp-session-pill .txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-session-pill strong{color:var(--primary);font-weight:600}
.sp-session-pill .ct{color:var(--accent);font-weight:700;font-family:var(--font-mono)}
@media (prefers-reduced-motion:reduce){
  .sp-fab-mark::after{animation:none}.sp-fab{transition:none}
}

/* Redactor modal */
.layer{position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.6);
  display:flex;align-items:center;justify-content:center}
.layer .box{background:#fff;border-radius:12px;padding:16px;font-family:var(--font-sans)}
.layer canvas{cursor:crosshair;display:block;touch-action:none;border-radius:6px}
.layer .bar{margin-top:12px;display:flex;gap:8px;align-items:center}
.layer .act{height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--border-strong);
  background:#fff;color:var(--primary);font:600 14px var(--font-sans);cursor:pointer}
.layer .act.primary{background:var(--primary);color:#fff;border-color:var(--primary)}
.layer .muted{color:var(--muted);font-size:12px}
.hl-soft{outline:2px dashed var(--info) !important;outline-offset:2px !important}
`;
  var HOST_STYLE = `
[data-speqify-annotated]{position:relative !important;outline:2px solid #DC2626 !important;
  outline-offset:2px !important;border-radius:6px;box-shadow:0 0 0 6px rgba(220,38,38,.12) !important}
[data-speqify-annotated]::after{content:attr(data-speqify-pin);position:absolute;top:-12px;
  left:-14px;width:24px;height:24px;border-radius:50%;background:#DC2626;color:#fff;
  font:700 12px/1 "Inter",system-ui,sans-serif;display:grid;place-items:center;
  box-shadow:0 4px 12px rgba(220,38,38,.45);z-index:2147482999}
[data-speqify-annotated]::before{content:"";position:absolute;inset:-6px;border-radius:8px;
  border:2px solid #DC2626;opacity:.3;animation:speqify-host-pulse 1.8s ease-out infinite}
@keyframes speqify-host-pulse{0%{transform:scale(.98);opacity:.4}100%{transform:scale(1.08);opacity:0}}
@media (prefers-reduced-motion:reduce){[data-speqify-annotated]::before{animation:none}}
`;
  var ICON = {
    pick: '<path d="M13 13l6 6"/><path d="M3 3l8 8"/><path d="M3 3v18h18"/><path d="M11 11l4-4"/>',
    voice: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>',
    text: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    shot: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    screen: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    end: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>',
    arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    logo: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'
  };
  var svg = (paths, sw = "2") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  var esc = (s) => s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );
  function mountOverlay(client, deps = {}) {
    const sessionLabel = deps.sessionLabel ?? "review";
    const host = document.createElement("div");
    host.setAttribute("data-speqify-overlay", "");
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    root.appendChild(style);
    const hostStyle = document.createElement("style");
    hostStyle.setAttribute("data-speqify-host-style", "");
    hostStyle.textContent = HOST_STYLE;
    document.head.appendChild(hostStyle);
    let tab = "new";
    let picked = null;
    let pickedEl = null;
    let annIndex = 1;
    let kind = "bug";
    let severity = "medium";
    let noteText = "";
    let tags = [];
    let attachShot = true;
    let voiceBlob = null;
    let voiceSec = 0;
    let recorder = null;
    let recElapsed = 0;
    let recTimer = null;
    let screenRec = null;
    let screenOut = null;
    let redactedShot = null;
    const session = [];
    let minimized = true;
    let panelOpen = false;
    let lastSync = null;
    const consented = () => localStorage.getItem(CONSENT_KEY) === "1";
    const nowHM = () => (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const openRedactor = (source) => {
      void (async () => {
        const bitmap = await createImageBitmap(source);
        const maxW = 360;
        const ratio = bitmap.width > maxW ? maxW / bitmap.width : 1;
        const dw = Math.round(bitmap.width * ratio);
        const dh = Math.round(bitmap.height * ratio);
        const layer = document.createElement("div");
        layer.className = "layer";
        const box = document.createElement("div");
        box.className = "box";
        const canvas = document.createElement("canvas");
        canvas.width = dw;
        canvas.height = dh;
        const bar = document.createElement("div");
        bar.className = "bar";
        bar.innerHTML = '<button class="act primary" data-ap>Zastosuj</button><button class="act" data-ca>Anuluj</button><span class="muted">Przeci\u0105gnij, aby zas\u0142oni\u0107 wra\u017Cliwe obszary</span>';
        box.appendChild(canvas);
        box.appendChild(bar);
        layer.appendChild(box);
        root.appendChild(layer);
        const ctx = canvas.getContext("2d");
        const rects = [];
        let start = null;
        let cur = null;
        const draw = () => {
          if (!ctx) return;
          ctx.drawImage(bitmap, 0, 0, dw, dh);
          ctx.fillStyle = "rgba(0,0,0,.85)";
          for (const r of rects) ctx.fillRect(r.x, r.y, r.w, r.h);
          if (cur) ctx.fillRect(cur.x, cur.y, cur.w, cur.h);
        };
        draw();
        const norm = (a, b) => ({
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          w: Math.abs(a.x - b.x),
          h: Math.abs(a.y - b.y)
        });
        canvas.addEventListener("pointerdown", (e) => {
          start = { x: e.offsetX, y: e.offsetY };
        });
        canvas.addEventListener("pointermove", (e) => {
          if (!start) return;
          cur = norm(start, { x: e.offsetX, y: e.offsetY });
          draw();
        });
        canvas.addEventListener("pointerup", () => {
          if (cur && cur.w > 2 && cur.h > 2) rects.push(cur);
          start = null;
          cur = null;
          draw();
        });
        bar.querySelector("[data-ca]")?.addEventListener("click", () => {
          bitmap.close();
          layer.remove();
        });
        bar.querySelector("[data-ap]")?.addEventListener("click", () => {
          void (async () => {
            const natural = rects.map((r) => ({
              x: r.x / ratio,
              y: r.y / ratio,
              w: r.w / ratio,
              h: r.h / ratio
            }));
            redactedShot = await redactBlob(source, natural);
            attachShot = true;
            bitmap.close();
            layer.remove();
            render();
          })();
        });
      })();
    };
    const statusPill = document.createElement("div");
    statusPill.className = "sp-status";
    statusPill.setAttribute("role", "status");
    statusPill.setAttribute("aria-live", "polite");
    statusPill.innerHTML = `
    <span class="live-dot" aria-hidden="true"></span>
    <span class="txt"><strong>Speqify SDK aktywny</strong> \xB7 sesja review \xB7 ${esc(sessionLabel)}</span>
    <span class="v">v0.5.0</span>
    <button class="close" aria-label="Zwi\u0144 overlay">${svg('<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>', "2.5")}</button>`;
    root.appendChild(statusPill);
    const toolbar = document.createElement("div");
    toolbar.className = "sp-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Speqify narz\u0119dzia");
    root.appendChild(toolbar);
    const panel = document.createElement("aside");
    panel.className = "sp-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Speqify panel adnotacji");
    panel.hidden = true;
    root.appendChild(panel);
    const fab = document.createElement("button");
    fab.className = "sp-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Otw\xF3rz Speqify SDK");
    fab.innerHTML = `
    <span class="sp-fab-mark" aria-hidden="true">${svg(ICON.logo, "2.5")}</span>
    <span class="sp-fab-body">
      <span class="sp-fab-label">Speqify</span>
      <span class="sp-fab-sub">Dodaj adnotacj\u0119</span>
    </span>
    <span class="sp-fab-cta" aria-hidden="true">${svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', "2.4")}</span>`;
    root.appendChild(fab);
    const sessionPill = document.createElement("div");
    sessionPill.className = "sp-session-pill";
    sessionPill.setAttribute("aria-live", "polite");
    root.appendChild(sessionPill);
    const annWord = (n) => n === 1 ? "adnotacja" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "adnotacje" : "adnotacji";
    const renderIdle = () => {
      const n = session.length;
      sessionPill.innerHTML = `
      <span class="av" aria-hidden="true">TY</span>
      <span class="txt">Sesja review \xB7 <strong>${esc(sessionLabel)}</strong> \xB7 <span class="ct">${n} ${annWord(n)}</span></span>`;
    };
    fab.addEventListener("click", () => {
      minimized = false;
      panelOpen = true;
      render();
    });
    const renderToolbar = () => {
      const tool = (id, label, icon, opts = {}) => `<button class="sp-tool${opts.active ? " active" : ""}${opts.accent ? " accent" : ""}" data-t="${id}" aria-label="${esc(label)}">
        ${svg(icon, "2")}
        ${opts.badge ? `<span class="badge">${opts.badge}</span>` : ""}
        <span class="sp-tip">${esc(label)}${opts.kbd ? `<span class="kbd">${opts.kbd}</span>` : ""}</span>
      </button>`;
      toolbar.innerHTML = tool("pick", "Wska\u017C element", ICON.pick, { active: panelOpen && tab === "new", kbd: "E" }) + tool("voice", "Notatka g\u0142osowa", ICON.voice, { accent: true, kbd: "V" }) + tool("text", "Notatka tekstowa", ICON.text, { kbd: "T" }) + tool("shot", "Zrzut + adnotacja", ICON.shot, { kbd: "S" }) + tool("screen", "Nagraj ekran", ICON.screen) + `<span class="sep"></span>` + tool("session", "Adnotacje w sesji", ICON.list, { badge: session.length || void 0 }) + tool("end", "Zako\u0144cz sesj\u0119", ICON.end);
      toolbar.querySelectorAll(".sp-tool").forEach((b) => {
        b.addEventListener("click", () => onTool(b.dataset.t));
      });
    };
    const ctxRow = (on, label, meta) => `<div class="ctx-row${on ? "" : " off"}">${svg(on ? ICON.check : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', "3")}
      <span class="v">${esc(label)}</span><span class="meta">${esc(meta)}</span></div>`;
    const renderBody = () => {
      if (tab === "session") {
        if (session.length === 0)
          return `<p class="empty-note">Brak adnotacji w tej sesji. Dodaj pierwsz\u0105 w zak\u0142adce \u201ENowa adnotacja".</p>`;
        return session.map(
          (s) => `<div class="ann-prev">
            <span class="num ${s.state === "submitted" ? "done" : ""}">${s.n}</span>
            <div class="info">
              <div class="t">${esc(s.text || "(bez opisu tekstowego)")}</div>
              <div class="m">${esc(s.selector)} \xB7 ${s.voiceSec ? `g\u0142os ${fmt(s.voiceSec)} \xB7 ` : ""}${esc(s.time)}</div>
            </div>
            <span class="st ${s.state === "submitted" ? "subm" : "draft"}">${s.state === "submitted" ? "submitted" : "draft"}</span>
          </div>`
        ).join("");
      }
      if (tab === "context") {
        const t2 = deps.technical?.();
        const h2 = deps.hostApp;
        const bc = deps.breadcrumb?.() ?? [];
        const rows = [];
        if (t2) {
          rows.push(
            `<div class="kv"><div class="kv-row"><span class="l">Przegl\u0105darka</span><span class="v">${esc(t2.browser)}</span></div>
           <div class="kv-row"><span class="l">System</span><span class="v">${esc(t2.os)}</span></div>
           <div class="kv-row"><span class="l">Ekran</span><span class="v">${t2.screen.w}\xD7${t2.screen.h} @${t2.screen.dpr}x</span></div>
           <div class="kv-row"><span class="l">Konsola</span><span class="v">${t2.consoleEntries.length} wpis\xF3w \xB7 ${t2.jsErrors.length} b\u0142\u0119d\xF3w JS</span></div>
           <div class="kv-row"><span class="l">Sie\u0107</span><span class="v">${t2.network.length} \u017C\u0105da\u0144</span></div></div>`
          );
        }
        if (h2) {
          const flags = h2.featureFlags ? Object.entries(h2.featureFlags).map(([k, v]) => `${k}=${v}`).join(", ") : "\u2014";
          rows.push(
            `<div class="kv"><div class="kv-row"><span class="l">\u015Arodowisko</span><span class="v">${esc(h2.environment ?? "\u2014")}</span></div>
           <div class="kv-row"><span class="l">Wersja</span><span class="v">${esc(h2.appVersion ?? "\u2014")}</span></div>
           <div class="kv-row"><span class="l">Build</span><span class="v">${esc(h2.buildSha ?? "\u2014")}</span></div>
           <div class="kv-row"><span class="l">U\u017Cytkownik</span><span class="v">${esc(h2.testUser ?? "\u2014")}</span></div>
           <div class="kv-row"><span class="l">Flagi</span><span class="v">${esc(flags)}</span></div></div>`
          );
        }
        rows.push(
          `<div class="kv"><div class="kv-row"><span class="l">\u015Acie\u017Cka</span><span class="v">${bc.length ? esc(
            bc.slice(-6).map((s) => new URL(s.url).pathname).join(" \u2192 ")
          ) : esc(location.pathname)}</span></div></div>`
        );
        return `<div class="sec"><span class="sec-label">Automatyczny kontekst techniczny</span>${rows.join("")}</div><p class="empty-note">Ten kontekst jest do\u0142\u0105czany automatycznie do ka\u017Cdej adnotacji w tej sesji.</p>`;
      }
      const t = deps.technical?.();
      const h = deps.hostApp;
      const elemCard = picked ? `<div class="elem-card">
          <div class="row"><span class="l">Selektor</span><span class="v">${esc(picked.selector)}</span></div>
          <div class="row"><span class="l">XPath</span><span class="v">${esc(picked.xpath)}</span></div>
          <div class="row"><span class="l">Tekst</span><span class="v">${esc((pickedEl?.textContent ?? "").trim().slice(0, 80) || "\u2014")}</span></div>
          <button class="pick" data-pick>${svg(ICON.pick, "2.4")} Wybierz inny element</button>
        </div>` : `<div class="elem-card">
          <span class="empty">Nie wskazano elementu. Adnotacja zostanie zapisana jako globalna.</span>
          <button class="pick" data-pick>${svg(ICON.pick, "2.4")} Wska\u017C element</button>
        </div>`;
      const recState = recorder ? "live" : voiceBlob ? "done" : "idle";
      const recCls = recState === "idle" ? "rec idle" : recState === "done" ? "rec done" : "rec live";
      const bars = Array.from(
        { length: 24 },
        (_, i) => `<span style="height:${6 + i * 7 % 26}px;animation-delay:${i % 8 * 0.08}s"></span>`
      ).join("");
      const recBlock = `<div class="${recCls}">
        <div class="rec-row">
          <button class="rec-btn" data-rec aria-label="${recorder ? "Zatrzymaj nagrywanie" : "Nagraj notatk\u0119 g\u0142osow\u0105"}">
            ${recorder ? svg(ICON.stop, "0") : svg(ICON.mic, "2.4")}
          </button>
          <span class="rec-wave" aria-hidden="true">${bars}</span>
          <span class="rec-time" data-rec-time>${recorder ? fmt(recElapsed) : voiceBlob ? fmt(voiceSec) : "0:00"}</span>
        </div>
        <div class="rec-meta">
          <span class="l">
            <span class="live-dot" style="background:${recorder ? "var(--accent)" : "var(--muted)"};box-shadow:none;width:7px;height:7px"></span>
            ${recorder ? "Nagrywanie" : voiceBlob ? "Notatka gotowa" : "Brak nagrania"}
            <span class="lang">PL \xB7 auto</span>
          </span>
          <span class="actions">
            ${recorder ? `<button data-rec-stop>Zatrzymaj</button><button class="danger" data-rec-cancel>Odrzu\u0107</button>` : voiceBlob ? `<button data-rec>Nagraj ponownie</button><button class="danger" data-rec-clear>Usu\u0144</button>` : ""}
          </span>
        </div>
      </div>`;
      const seg = (attr, opts, cur) => `<div class="seg${opts.length === 2 ? " two" : ""}" role="radiogroup">
        ${opts.map(
        (o) => `<button data-${attr}="${o.v}" role="radio" aria-checked="${o.v === cur}" class="${o.v === cur ? `active ${o.cls ?? ""}` : ""}">${o.label}</button>`
      ).join("")}
      </div>`;
      const shotPresent = !!redactedShot || attachShot;
      const ctxBlock = `<div class="ctx">
      ${ctxRow(shotPresent, redactedShot ? "Zrzut (redagowany)" : "Zrzut viewportu", shotPresent ? "PNG" : "wy\u0142\u0105czony")}
      ${ctxRow(!!picked, "Fragment HTML", picked ? `${(picked.html.match(/\n/g)?.length ?? 0) + 1} linii` : "brak elementu")}
      ${ctxRow(!!t, "Konsola & sie\u0107", t ? `${t.jsErrors.length} b\u0142\u0119d\xF3w \xB7 ${t.network.length} \u017C\u0105da\u0144` : "\u2014")}
      ${ctxRow(!!h, "Build & flagi", h ? `${h.environment ?? "?"} \xB7 ${h.buildSha ?? "?"}` : "\u2014")}
    </div>`;
      const others = session.slice(-3).reverse().map(
        (s) => `<div class="ann-prev">
          <span class="num ${s.state === "submitted" ? "done" : ""}">${s.n}</span>
          <div class="info"><div class="t">${esc(s.text || "(bez opisu)")}</div>
          <div class="m">${esc(s.selector)} \xB7 ${esc(s.time)}</div></div>
          <span class="st ${s.state === "submitted" ? "subm" : "draft"}">${s.state}</span>
        </div>`
      ).join("");
      return `
      <div class="ann-head">
        <div class="num"><span class="dot">${annIndex}</span> Adnotacja #${annIndex}</div>
        <span class="state">draft</span>
      </div>
      <div class="sec">
        <span class="sec-label">Element <span class="req">\xB7 opcjonalny</span></span>
        ${elemCard}
      </div>
      <div class="sec">
        <span class="sec-label">Notatka g\u0142osowa</span>
        ${recBlock}
      </div>
      <div class="sec">
        <span class="sec-label">Notatka tekstowa <span class="req">\xB7 opcjonalna</span></span>
        <textarea class="ta" data-note placeholder="Opisz, co ma si\u0119 zmieni\u0107. Markdown wspierany.">${esc(noteText)}</textarea>
      </div>
      <div class="row-2">
        <div class="sec">
          <span class="sec-label">Rodzaj</span>
          ${seg(
        "kind",
        [
          { v: "bug", label: "B\u0142\u0105d", cls: "danger" },
          { v: "change", label: "Zmiana", cls: "ok" }
        ],
        kind
      )}
        </div>
        <div class="sec">
          <span class="sec-label">Priorytet</span>
          ${seg(
        "sev",
        [
          { v: "low", label: "Niski", cls: "ok" },
          { v: "medium", label: "\u015Aredni", cls: "warn" },
          { v: "high", label: "Wysoki", cls: "danger" }
        ],
        severity
      )}
        </div>
      </div>
      <div class="sec">
        <span class="sec-label">Etykiety</span>
        <div class="tags">
          ${tags.map((t2, i) => `<span class="tag">${esc(t2)} <button data-tag-del="${i}" aria-label="Usu\u0144">\xD7</button></span>`).join("")}
          <button class="tag add" data-tag-add>+ dodaj etykiet\u0119</button>
        </div>
      </div>
      <div class="sec">
        <span class="sec-label">Za\u0142\u0105czony kontekst</span>
        ${ctxBlock}
      </div>
      ${others ? `<div class="sec"><span class="sec-label">Inne adnotacje w sesji</span>${others}</div>` : ""}`;
    };
    const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    const render = () => {
      if (minimized) {
        fab.style.display = "";
        sessionPill.style.display = "";
        statusPill.style.display = "none";
        toolbar.style.display = "none";
        panel.hidden = true;
        renderIdle();
        return;
      }
      fab.style.display = "none";
      sessionPill.style.display = "none";
      statusPill.style.display = "";
      toolbar.style.display = "";
      renderToolbar();
      if (!panelOpen) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      if (!consented()) {
        const codeIcon = '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>';
        panel.innerHTML = `<div class="consent">
        <div class="consent-head">
          <span class="logo" aria-hidden="true">${svg(ICON.logo, "2.5")}</span>
          <h3>Witaj w sesji review \xB7 ${esc(sessionLabel)}</h3>
          <p>Zosta\u0142e\u015B zaproszony do dodawania adnotacji wprost na dzia\u0142aj\u0105cej aplikacji.
          Zanim zaczniesz, potrzebujemy Twojej zgody.</p>
        </div>
        <ul class="consent-list">
          <li>
            <span class="ic">${svg(ICON.mic)}</span>
            <span><strong>Mikrofon</strong> \u2014 nagrywanie g\u0142osu tylko podczas Twoich sesji
            review. Mo\u017Cesz wstrzyma\u0107 w ka\u017Cdej chwili.</span>
          </li>
          <li>
            <span class="ic">${svg(ICON.shot)}</span>
            <span><strong>Zrzuty viewportu</strong> \u2014 robione w momencie tworzenia adnotacji.
            Sekrety i PII maskujemy automatycznie w przegl\u0105darce.</span>
          </li>
          <li>
            <span class="ic">${svg(codeIcon)}</span>
            <span><strong>Kontekst techniczny</strong> \u2014 selektor, XPath, fragment HTML,
            konsola, sie\u0107 i build. Bez danych biznesowych.</span>
          </li>
        </ul>
        <div class="consent-checks">
          <label><input type="checkbox" data-consent-req checked> <span>Wyra\u017Cam zgod\u0119 na
          nagrywanie g\u0142osu i zbieranie kontekstu technicznego podczas sesji review w projekcie
          <strong>${esc(sessionLabel)}</strong>.</span></label>
          <label><input type="checkbox" data-consent-cam> <span>Zgadzam si\u0119 na w\u0142\u0105czenie
          kamery do nagra\u0144 screen-cast z narracj\u0105 (opcjonalne).</span></label>
        </div>
        <div class="consent-foot">
          <span style="font-size:11.5px;color:var(--muted)">Polityka prywatno\u015Bci \xB7 sekrety
          usuwane przed wys\u0142aniem</span>
          <div class="btn-row">
            <button class="decline" data-decline>Nie teraz</button>
            <button class="agree" data-agree>Akceptuj i zacznij ${svg(ICON.arrow, "2.4")}</button>
          </div>
        </div>
      </div>`;
        const reqCb = panel.querySelector("[data-consent-req]");
        const camCb = panel.querySelector("[data-consent-cam]");
        const agreeBtn = panel.querySelector("[data-agree]");
        const syncAgree = () => {
          if (agreeBtn) agreeBtn.disabled = !reqCb?.checked;
        };
        reqCb?.addEventListener("change", syncAgree);
        syncAgree();
        agreeBtn?.addEventListener("click", () => {
          if (!reqCb?.checked) return;
          localStorage.setItem(CONSENT_KEY, "1");
          localStorage.setItem(CONSENT_CAM_KEY, camCb?.checked ? "1" : "0");
          render();
        });
        panel.querySelector("[data-decline]")?.addEventListener("click", () => {
          panelOpen = false;
          render();
        });
        return;
      }
      const sync = lastSync ? `<span class="sync ${lastSync.ok ? "ok" : "err"}">${svg(ICON.check, "2.5")}<span>${esc(lastSync.msg)}</span></span>` : `<span class="sync">${svg(ICON.check, "2.5")}<span>Zsynchronizowano lokalnie</span></span>`;
      panel.innerHTML = `
      <div class="sp-head">
        <div class="sp-head-l">
          <span class="sp-logo" aria-hidden="true">${svg(ICON.logo, "2.5")}</span>
          <div><div class="sp-title">Speqify</div><div class="sp-sub">sesja \xB7 ${esc(sessionLabel)}</div></div>
        </div>
        <div class="sp-head-r">
          <button class="sp-iconbtn" data-min aria-label="Minimalizuj">${svg('<line x1="5" y1="12" x2="19" y2="12"/>', "2")}</button>
          <button class="sp-iconbtn" data-close aria-label="Zamknij panel">${svg('<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>', "2")}</button>
        </div>
      </div>
      <div class="sp-tabs" role="tablist">
        <button class="sp-tab ${tab === "new" ? "active" : ""}" data-tab="new" role="tab" aria-selected="${tab === "new"}">Nowa adnotacja</button>
        <button class="sp-tab ${tab === "session" ? "active" : ""}" data-tab="session" role="tab" aria-selected="${tab === "session"}">Sesja <span class="ct">${session.length}</span></button>
        <button class="sp-tab ${tab === "context" ? "active" : ""}" data-tab="context" role="tab" aria-selected="${tab === "context"}">Kontekst</button>
      </div>
      <div class="sp-body">${renderBody()}</div>
      <div class="sp-foot">
        <button class="sp-save" data-save>Zapisz draft</button>
        ${sync}
        <button class="sp-submit" data-send>Wy\u015Blij ${svg(ICON.arrow, "2.4")}</button>
      </div>`;
      wireBody();
    };
    const wireBody = () => {
      panel.querySelector("[data-min]")?.addEventListener("click", () => {
        panelOpen = false;
        render();
      });
      panel.querySelector("[data-close]")?.addEventListener("click", () => {
        panelOpen = false;
        render();
      });
      panel.querySelectorAll("[data-tab]").forEach(
        (b) => b.addEventListener("click", () => {
          tab = b.dataset.tab;
          render();
        })
      );
      const note = panel.querySelector("[data-note]");
      note?.addEventListener("input", () => noteText = note.value);
      panel.querySelector("[data-pick]")?.addEventListener("click", startPick);
      panel.querySelectorAll("[data-kind]").forEach(
        (b) => b.addEventListener("click", () => {
          kind = b.dataset.kind;
          render();
        })
      );
      panel.querySelectorAll("[data-sev]").forEach(
        (b) => b.addEventListener("click", () => {
          severity = b.dataset.sev;
          render();
        })
      );
      panel.querySelectorAll("[data-tag-del]").forEach(
        (b) => b.addEventListener("click", () => {
          tags.splice(Number(b.dataset.tagDel), 1);
          render();
        })
      );
      panel.querySelector("[data-tag-add]")?.addEventListener("click", () => {
        const v = window.prompt("Etykieta:");
        if (v && v.trim()) {
          tags.push(v.trim());
          render();
        }
      });
      panel.querySelector("[data-rec]")?.addEventListener("click", toggleVoice);
      panel.querySelector("[data-rec-stop]")?.addEventListener("click", toggleVoice);
      panel.querySelector("[data-rec-cancel]")?.addEventListener("click", () => {
        recorder?.cancel();
        recorder = null;
        stopTimer();
        render();
      });
      panel.querySelector("[data-rec-clear]")?.addEventListener("click", () => {
        voiceBlob = null;
        voiceSec = 0;
        render();
      });
      panel.querySelector("[data-save]")?.addEventListener("click", () => void addAnnotation());
      panel.querySelector("[data-send]")?.addEventListener("click", () => void sendSession());
    };
    const clearPin = () => {
      pickedEl?.removeAttribute("data-speqify-annotated");
      pickedEl?.removeAttribute("data-speqify-pin");
    };
    const onPick = (e) => {
      if (e.composedPath().includes(host)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const target = e.target;
      if (!target) return;
      clearPin();
      pickedEl = target;
      target.setAttribute("data-speqify-annotated", "");
      target.setAttribute("data-speqify-pin", String(annIndex));
      picked = captureElement(target);
      document.removeEventListener("click", onPick, true);
      panelOpen = true;
      tab = "new";
      render();
    };
    const startPick = () => {
      panelOpen = false;
      render();
      document.addEventListener("click", onPick, true);
    };
    const stopTimer = () => {
      if (recTimer !== null) {
        clearInterval(recTimer);
        recTimer = null;
      }
    };
    const toggleVoice = () => {
      void (async () => {
        if (recorder) {
          const r = recorder;
          recorder = null;
          stopTimer();
          voiceBlob = await r.stop();
          voiceSec = recElapsed;
          render();
        } else {
          try {
            recorder = await startVoiceRecording();
            recElapsed = 0;
            render();
            recTimer = window.setInterval(() => {
              recElapsed++;
              const el = panel.querySelector("[data-rec-time]");
              if (el) el.textContent = fmt(recElapsed);
            }, 1e3);
          } catch {
            lastSync = { ok: false, msg: "Brak dost\u0119pu do mikrofonu" };
            render();
          }
        }
      })();
    };
    const toggleScreen = () => {
      void (async () => {
        if (screenRec) {
          const r = screenRec;
          screenRec = null;
          screenOut = await r.stop();
          lastSync = { ok: true, msg: "Nagranie ekranu do\u0142\u0105czone" };
          render();
        } else {
          try {
            screenRec = await startScreenRecording();
            lastSync = { ok: true, msg: "Nagrywanie ekranu\u2026" };
            render();
          } catch {
            lastSync = { ok: false, msg: "Przechwytywanie ekranu zablokowane" };
            render();
          }
        }
      })();
    };
    const resetForm = () => {
      clearPin();
      picked = null;
      pickedEl = null;
      noteText = "";
      voiceBlob = null;
      voiceSec = 0;
      screenOut = null;
      redactedShot = null;
      tags = [];
      kind = "bug";
      severity = "medium";
      annIndex++;
    };
    const addAnnotation = async () => {
      try {
        const structured = { kind, severity };
        const voice = voiceBlob ? await client.upload("voice", voiceBlob) : null;
        let screenshot = null;
        if (redactedShot) {
          screenshot = await client.upload("screenshot", redactedShot);
        } else if (attachShot) {
          try {
            const blob = await captureScreenshot(pickedEl, deps.screenshotUrl);
            screenshot = await client.upload("screenshot", blob);
          } catch {
          }
        }
        let recordingVideo = null;
        let recordingAudio = null;
        if (screenOut) {
          recordingVideo = await client.upload("recording-video", screenOut.video);
          if (screenOut.audio)
            recordingAudio = await client.upload("recording-audio", screenOut.audio);
        }
        const body = buildAnnotationPayload({
          submissionId: getSubmissionId(),
          clientId: getClientId(),
          pageUrl: location.href,
          element: picked,
          textNote: noteText.trim() || null,
          tags,
          screenshot,
          voice,
          recordingVideo,
          recordingAudio,
          structured,
          technical: deps.technical?.() ?? null,
          hostApp: deps.hostApp ?? null,
          breadcrumb: deps.breadcrumb?.() ?? []
        });
        let outcome = "sent";
        if (deps.sendAnnotation) outcome = await deps.sendAnnotation(body);
        else await client.createAnnotation(body);
        session.push({
          n: annIndex,
          text: noteText.trim(),
          selector: picked?.selector ?? "(globalna)",
          voiceSec: voiceBlob ? voiceSec : null,
          time: nowHM(),
          state: outcome === "queued" ? "queued" : "draft"
        });
        lastSync = {
          ok: true,
          msg: outcome === "queued" ? "Zapisano offline \u2014 ponowimy" : "Zapisano draft"
        };
        resetForm();
        tab = "new";
        render();
      } catch (err) {
        lastSync = { ok: false, msg: err instanceof Error ? err.message : "B\u0142\u0105d zapisu" };
        render();
      }
    };
    const sendSession = async () => {
      if (session.length === 0) {
        await addAnnotation();
      }
      try {
        await client.submit(getSubmissionId(), getClientId());
        resetSubmission();
        for (const s of session) s.state = "submitted";
        lastSync = { ok: true, msg: "Wys\u0142ano. Dzi\u0119kujemy!" };
        render();
      } catch (err) {
        lastSync = { ok: false, msg: err instanceof Error ? err.message : "B\u0142\u0105d wysy\u0142ki" };
        render();
      }
    };
    const open = () => {
      minimized = false;
      panelOpen = true;
      render();
    };
    const onTool = (id) => {
      switch (id) {
        case "pick":
          open();
          tab = "new";
          startPick();
          break;
        case "voice":
          open();
          tab = "new";
          render();
          toggleVoice();
          break;
        case "text":
          open();
          tab = "new";
          render();
          panel.querySelector("[data-note]")?.focus();
          break;
        case "shot":
          open();
          void (async () => {
            try {
              const base = await captureScreenshot(pickedEl, deps.screenshotUrl);
              openRedactor(base);
            } catch {
              lastSync = { ok: false, msg: "Nie uda\u0142o si\u0119 wykona\u0107 zrzutu" };
              render();
            }
          })();
          break;
        case "screen":
          open();
          toggleScreen();
          break;
        case "session":
          open();
          tab = "session";
          render();
          break;
        case "end":
          if (session.some((s) => s.state !== "submitted")) void sendSession();
          panelOpen = false;
          minimized = true;
          render();
          break;
      }
    };
    const onKey = (e) => {
      const tagn = e.target?.tagName;
      if (tagn === "INPUT" || tagn === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "e") onTool("pick");
      else if (k === "v") onTool("voice");
      else if (k === "t") onTool("text");
      else if (k === "s") onTool("shot");
    };
    document.addEventListener("keydown", onKey);
    statusPill.querySelector(".close")?.addEventListener("click", () => {
      panelOpen = false;
      minimized = true;
      render();
    });
    render();
    return {
      open,
      close: () => {
        panelOpen = false;
        minimized = true;
        render();
      },
      destroy: () => {
        stopTimer();
        recorder?.cancel();
        screenRec?.cancel();
        clearPin();
        document.removeEventListener("click", onPick, true);
        document.removeEventListener("keydown", onKey);
        hostStyle.remove();
        host.remove();
      }
    };
  }

  // packages/sdk/src/technical.ts
  var CAP = { console: 200, errors: 100, network: 200, msg: 4e3, stack: 8e3 };
  function safe(v) {
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  function startTechnicalCapture() {
    const consoleEntries = [];
    const jsErrors = [];
    const network = [];
    const now = () => (/* @__PURE__ */ new Date()).toISOString();
    const con = console;
    const original = { log: con.log, warn: con.warn, error: con.error };
    ["log", "warn", "error"].forEach((level) => {
      con[level] = (...args) => {
        try {
          consoleEntries.push({
            level,
            message: capString(scrubString(args.map(safe).join(" ")), CAP.msg),
            at: now()
          });
        } catch {
        }
        original[level](...args);
      };
    });
    const onError = (e) => {
      const stack = e.error instanceof Error ? e.error.stack : void 0;
      jsErrors.push({
        message: capString(scrubString(e.message || "error"), CAP.msg),
        ...stack ? { stack: capString(scrubString(stack), CAP.stack) } : {},
        at: now()
      });
    };
    const onRejection = (e) => {
      jsErrors.push({
        message: capString(scrubString(`Unhandled rejection: ${safe(e.reason)}`), CAP.msg),
        at: now()
      });
    };
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection, true);
    const origFetch = window.fetch.bind(window);
    window.fetch = (async (input, init2) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init2?.method ?? (input instanceof Request ? input.method : "GET");
      try {
        const res = await origFetch(input, init2);
        network.push({ method, url: scrubUrl(url), status: res.status, at: now() });
        return res;
      } catch (err) {
        network.push({ method, url: scrubUrl(url), status: 0, at: now() });
        throw err;
      }
    });
    return {
      snapshot() {
        return {
          consoleEntries: capArray(consoleEntries, CAP.console),
          jsErrors: capArray(jsErrors, CAP.errors),
          network: capArray(network, CAP.network),
          browser: navigator.userAgent,
          os: navigator.platform || "unknown",
          screen: {
            w: window.screen.width,
            h: window.screen.height,
            dpr: window.devicePixelRatio
          }
        };
      },
      stop() {
        con.log = original.log;
        con.warn = original.warn;
        con.error = original.error;
        window.removeEventListener("error", onError, true);
        window.removeEventListener("unhandledrejection", onRejection, true);
        window.fetch = origFetch;
      }
    };
  }

  // packages/sdk/src/index.ts
  var FLUSH_INTERVAL_MS = 3e4;
  async function init(options) {
    if (!options.enabled || !options.token) return null;
    const client = new SpeqifyClient(options.apiBaseUrl, options.token);
    const info = await client.validate();
    if (!info || info.status !== "open") return null;
    const technical = startTechnicalCapture();
    const breadcrumb = startBreadcrumb();
    const outbox = new Outbox(createOutboxStore());
    const sender = (p) => client.createAnnotation(p);
    const flush = () => void outbox.flush(sender).catch(() => void 0);
    flush();
    const onOnline = () => flush();
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(flush, FLUSH_INTERVAL_MS);
    let sessionLabel = info.projectName ?? info.environmentUrl;
    if (!info.projectName) {
      try {
        sessionLabel = new URL(info.environmentUrl).host;
      } catch {
      }
    }
    const overlay = mountOverlay(client, {
      technical: technical.snapshot,
      breadcrumb: breadcrumb.steps,
      sendAnnotation: (p) => outbox.send(p, sender),
      sessionLabel,
      ...options.context ? { hostApp: options.context } : {},
      ...options.html2canvasUrl ? { screenshotUrl: options.html2canvasUrl } : {}
    });
    return {
      open: overlay.open,
      close: overlay.close,
      destroy: () => {
        overlay.destroy();
        technical.stop();
        breadcrumb.stop();
        window.removeEventListener("online", onOnline);
        clearInterval(timer);
      }
    };
  }

  // packages/sdk/src/loader.ts
  var script = document.currentScript;
  var fromUrl = new URL(location.href).searchParams.get("speqify");
  var token = fromUrl ?? script?.dataset.speqifyToken ?? "";
  var apiBaseUrl = script?.dataset.speqifyApi ?? "https://api.speqify.app";
  if (token) {
    void init({ token, apiBaseUrl, enabled: true });
  }
})();
