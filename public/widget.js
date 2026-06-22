/**
 * Universal RAG System — Embeddable Chat Widget
 * ------------------------------------------------
 * Drop this script tag on any website:
 *
 *   <script
 *     src="https://your-rag-backend/api/v1/widget.js"
 *     data-widget-key="wk_live_xxxx"
 *     data-position="bottom-right"
 *   ></script>
 *
 * The widget will auto-initialise when the page loads.
 */
(function () {
  "use strict";

  /* ── Config ─────────────────────────────────────────────────────────────── */
  const SCRIPT_EL = document.currentScript;
  const WIDGET_KEY = SCRIPT_EL?.getAttribute("data-widget-key") || "";
  const POSITION = SCRIPT_EL?.getAttribute("data-position") || "bottom-right";
  const API_BASE = (SCRIPT_EL?.getAttribute("data-api-base") || "http://localhost:8000/api/v1");

  if (!WIDGET_KEY) {
    console.warn("[RAG Widget] No data-widget-key attribute found — widget disabled.");
    return;
  }

  /* ── Helpers ─────────────────────────────────────────────────────────────── */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }

  function injectStyles() {
    if (document.getElementById("rag-widget-styles")) return;
    const css = `
      #rag-widget-btn {
        position: fixed;
        ${POSITION.includes("right") ? "right:24px" : "left:24px"};
        ${POSITION.includes("top") ? "top:24px" : "bottom:24px"};
        width: 60px; height: 60px;
        background: var(--rag-color, #6366f1);
        border-radius: 50%;
        box-shadow: 0 4px 20px rgba(0,0,0,.25);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        z-index: 999998;
        border: none; outline: none;
        transition: transform .2s, box-shadow .2s;
      }
      #rag-widget-btn:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(0,0,0,.35); }
      #rag-widget-btn svg { width:28px; height:28px; fill:#fff; }

      #rag-widget-box {
        position: fixed;
        ${POSITION.includes("right") ? "right:20px" : "left:20px"};
        ${POSITION.includes("top") ? "top:90px" : "bottom:90px"};
        width: 380px; max-width: calc(100vw - 40px);
        height: 540px; max-height: calc(100vh - 120px);
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 12px 48px rgba(0,0,0,.20);
        display: flex; flex-direction: column;
        z-index: 999999;
        overflow: hidden;
        transform: scale(0); transform-origin: ${POSITION.includes("right") ? "bottom right" : "bottom left"};
        transition: transform .25s cubic-bezier(.34,1.56,.64,1), opacity .2s;
        opacity: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      #rag-widget-box.open { transform: scale(1); opacity: 1; }

      #rag-widget-header {
        background: var(--rag-color, #6366f1);
        color:#fff; padding:14px 16px;
        display:flex; align-items:center; gap:10px;
        font-weight:600; font-size:15px;
        flex-shrink:0;
      }
      #rag-widget-header .dot { width:9px; height:9px; background:#a5f3fc; border-radius:50%; flex-shrink:0; }
      #rag-widget-close {
        margin-left:auto; cursor:pointer; background:none; border:none;
        color:#fff; font-size:20px; line-height:1; padding:2px 6px;
      }

      #rag-widget-msgs {
        flex:1; overflow-y:auto; padding:14px;
        display:flex; flex-direction:column; gap:10px;
        background:#f8fafc;
      }
      .rag-msg { max-width:85%; border-radius:12px; padding:10px 14px; font-size:14px; line-height:1.5; }
      .rag-msg.bot { background:#fff; border:1px solid #e2e8f0; align-self:flex-start; color:#1e293b; }
      .rag-msg.user { background: var(--rag-color, #6366f1); color:#fff; align-self:flex-end; }
      .rag-sources { font-size:11px; color:#64748b; margin-top:6px; }
      .rag-typing { display:flex; gap:4px; align-items:center; padding:10px 14px; }
      .rag-typing span { width:7px; height:7px; border-radius:50%; background:#94a3b8; animation:rag-bounce .9s infinite; }
      .rag-typing span:nth-child(2) { animation-delay:.15s; }
      .rag-typing span:nth-child(3) { animation-delay:.3s; }
      @keyframes rag-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }

      #rag-widget-input-area {
        display:flex; gap:8px; padding:12px; border-top:1px solid #e2e8f0;
        background:#fff; flex-shrink:0;
      }
      #rag-widget-input {
        flex:1; border:1px solid #cbd5e1; border-radius:8px;
        padding:9px 12px; font-size:14px; outline:none;
        transition:border-color .2s;
      }
      #rag-widget-input:focus { border-color: var(--rag-color, #6366f1); }
      #rag-widget-send {
        background: var(--rag-color, #6366f1); color:#fff;
        border:none; border-radius:8px; padding:9px 14px;
        cursor:pointer; font-size:14px; font-weight:600;
        transition:opacity .2s;
      }
      #rag-widget-send:disabled { opacity:.5; cursor:default; }
      #rag-widget-branding {
        text-align:center; font-size:10px; color:#94a3b8; padding:4px 0 8px;
        background:#fff;
      }
    `;
    const style = document.createElement("style");
    style.id = "rag-widget-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ── Fetch widget config ─────────────────────────────────────────────────── */
  let widgetConfig = { title: "Chat Assistant", welcome_message: "Hi! How can I help you?", primary_color: "#6366f1" };

  async function fetchConfig() {
    try {
      const res = await fetch(`${API_BASE}/widget/config`, {
        headers: { "X-Widget-Key": WIDGET_KEY }
      });
      if (res.ok) widgetConfig = { ...widgetConfig, ...(await res.json()) };
    } catch (_) { /* use defaults */ }
  }

  /* ── DOM creation ────────────────────────────────────────────────────────── */
  function buildWidget() {
    const color = widgetConfig.primary_color || "#6366f1";
    document.documentElement.style.setProperty("--rag-color", color);

    // Button
    const btn = document.createElement("button");
    btn.id = "rag-widget-btn";
    btn.setAttribute("aria-label", "Open chat");
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
    document.body.appendChild(btn);

    // Box
    const box = document.createElement("div");
    box.id = "rag-widget-box";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Chat widget");
    box.innerHTML = `
      <div id="rag-widget-header">
        <span class="dot"></span>
        <span id="rag-widget-title">${widgetConfig.title}</span>
        <button id="rag-widget-close" aria-label="Close chat">✕</button>
      </div>
      <div id="rag-widget-msgs" aria-live="polite"></div>
      <div id="rag-widget-input-area">
        <input id="rag-widget-input" type="text" placeholder="Ask something…" autocomplete="off" />
        <button id="rag-widget-send">Send</button>
      </div>
      <div id="rag-widget-branding">Powered by Universal RAG</div>
    `;
    document.body.appendChild(box);

    return { btn, box };
  }

  /* ── Chat logic ──────────────────────────────────────────────────────────── */
  function appendMsg(text, role, sources) {
    const msgs = $("#rag-widget-msgs");
    const div = document.createElement("div");
    div.className = `rag-msg ${role}`;
    div.textContent = text;

    if (role === "bot" && sources && sources.length) {
      const src = document.createElement("div");
      src.className = "rag-sources";
      const names = [...new Set(sources.map(s => s.file_name).filter(Boolean))];
      src.textContent = "Sources: " + names.slice(0, 3).join(", ");
      div.appendChild(src);
    }
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function appendTyping() {
    const msgs = $("#rag-widget-msgs");
    const div = document.createElement("div");
    div.className = "rag-msg bot rag-typing";
    div.id = "rag-typing-indicator";
    div.innerHTML = "<span></span><span></span><span></span>";
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  async function sendMessage(question) {
    const input = $("#rag-widget-input");
    const sendBtn = $("#rag-widget-send");

    input.disabled = true;
    sendBtn.disabled = true;

    appendMsg(question, "user");
    const typing = appendTyping();

    try {
      // Use SSE streaming endpoint
      const response = await fetch(`${API_BASE}/widget/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Widget-Key": WIDGET_KEY,
        },
        body: JSON.stringify({ question, top_k: 5, rewrite_query: true, retrieval_mode: "hybrid", rerank: true }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Stream failed");
      }

      typing.remove();

      // Streaming: build answer token-by-token
      const botDiv = appendMsg("", "bot");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalSources = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token !== undefined) {
                botDiv.childNodes[0]
                  ? (botDiv.firstChild.textContent += data.token)
                  : (botDiv.textContent += data.token);
              }
              if (data.sources) finalSources = data.sources;
            } catch (_) {}
          }
        }
        const msgs = $("#rag-widget-msgs");
        msgs.scrollTop = msgs.scrollHeight;
      }

      // Append sources after streaming finishes
      if (finalSources.length) {
        const src = document.createElement("div");
        src.className = "rag-sources";
        const names = [...new Set(finalSources.map(s => s.file_name).filter(Boolean))];
        src.textContent = "Sources: " + names.slice(0, 3).join(", ");
        botDiv.appendChild(src);
      }

    } catch (err) {
      typing.remove();
      appendMsg("Sorry, I encountered an error. Please try again.", "bot");
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  /* ── Init ────────────────────────────────────────────────────────────────── */
  async function init() {
    await fetchConfig();
    injectStyles();
    const { btn, box } = buildWidget();

    let open = false;
    let greeted = false;

    function toggleBox() {
      open = !open;
      box.classList.toggle("open", open);
      if (open && !greeted) {
        greeted = true;
        appendMsg(widgetConfig.welcome_message || "Hi! How can I help you today?", "bot");
      }
      if (open) setTimeout(() => $("#rag-widget-input").focus(), 300);
    }

    btn.addEventListener("click", toggleBox);
    $("#rag-widget-close").addEventListener("click", toggleBox);

    const input = $("#rag-widget-input");
    const sendBtn = $("#rag-widget-send");

    function handleSend() {
      const q = input.value.trim();
      if (!q) return;
      input.value = "";
      sendMessage(q);
    }

    sendBtn.addEventListener("click", handleSend);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSend(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
