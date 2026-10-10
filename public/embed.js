/* LC Digitale — bouton de commande intégrable. Sans dépendance. */
(function () {
  "use strict";
  if (window.LCDigitale && window.LCDigitale._v) return;
  var DEF_COLOR = "#e11d48", DEF_LABEL = "Commander en ligne";
  var cur = document.currentScript;
  var scripts = cur && cur.getAttribute("data-restaurant") ? [cur] :
    Array.prototype.slice.call(document.querySelectorAll('script[src*="/embed.js"][data-restaurant]'));
  if (!scripts.length) return;
  var ORIGIN = new URL(scripts[0].src).origin;
  var SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/i;
  var ov = null, frame = null, frameSlug = null, lastBtn = null, timer = null, prevOverflow = "", loaded = false;

  function contrast(hex) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#000" : "#fff";
  }
  function fallback(slug) { window.open(ORIGIN + "/" + encodeURIComponent(slug) + "?src=embed", "_blank", "noopener"); }

  function buildOverlay() {
    var host = document.createElement("div");
    host.style.cssText = "position:fixed;inset:0;z-index:2147483001;display:none";
    var root = host.attachShadow({ mode: "open" });
    root.innerHTML = "<style>" +
      ".bg{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}" +
      ".box{position:relative;width:440px;height:min(760px,90vh);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)}" +
      "iframe{border:0;width:100%;height:100%;display:block}" +
      ".x{position:absolute;top:8px;right:8px;width:36px;height:36px;border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;font:22px/1 sans-serif;cursor:pointer;z-index:2}" +
      ".x:focus-visible{outline:3px solid #fff;outline-offset:2px}" +
      "@media(max-width:639px){.box{width:100vw;height:100vh;height:100dvh;border-radius:0}}" +
      "</style><div class='bg'><div class='box' role='dialog' aria-modal='true'><button type='button' class='x' aria-label='Fermer'>×</button></div></div>";
    var bg = root.querySelector(".bg"), box = root.querySelector(".box"), x = root.querySelector(".x");
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    x.addEventListener("click", close);
    host.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "Tab") {
        // Piège à focus : bouton × <-> iframe
        var a = root.activeElement;
        if (e.shiftKey && a === x) { e.preventDefault(); frame && frame.focus(); }
        else if (!e.shiftKey && a !== x) { e.preventDefault(); x.focus(); }
      }
    });
    document.body.appendChild(host);
    return { host: host, root: root, box: box, x: x };
  }

  function open(slug, btn) {
    slug = String(slug || scripts[0].getAttribute("data-restaurant") || "");
    if (!SLUG_RE.test(slug)) return;
    lastBtn = btn || document.activeElement;
    if (navigator.cookieEnabled === false) return fallback(slug);
    if (!ov) ov = buildOverlay();
    if (frameSlug !== slug) {
      if (frame) frame.remove();
      loaded = false;
      frame = document.createElement("iframe");
      frame.src = ORIGIN + "/" + encodeURIComponent(slug) + "?embed=1&src=embed&ref=" + encodeURIComponent(location.hostname);
      frame.setAttribute("allow", "payment *; clipboard-write");
      frame.title = "Commande en ligne";
      frame.addEventListener("load", function () { loaded = true; clearTimeout(timer); });
      ov.box.appendChild(frame);
      frameSlug = slug;
      clearTimeout(timer);
      timer = setTimeout(function () { if (!loaded) { close(); frame.remove(); frame = null; frameSlug = null; fallback(slug); } }, 8000);
    }
    var name = (btn && btn.getAttribute("data-name")) || slug;
    ov.box.setAttribute("aria-label", "Commander chez " + name);
    ov.host.style.display = "block";
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ov.x.focus();
  }

  function close() {
    if (!ov || ov.host.style.display === "none") return;
    ov.host.style.display = "none";
    document.body.style.overflow = prevOverflow;
    if (lastBtn && lastBtn.focus) lastBtn.focus();
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN || !frame || e.source !== frame.contentWindow) return;
    var d = e.data;
    if (!d || typeof d.type !== "string" || d.type.indexOf("lc:") !== 0) return;
    if (d.type === "lc:close") close();
  });

  function mount(s) {
    var slug = s.getAttribute("data-restaurant");
    if (!slug || !SLUG_RE.test(slug) || s.__lcMounted) return;
    s.__lcMounted = true;
    var color = (s.getAttribute("data-color") || "").toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) color = DEF_COLOR;
    var label = s.getAttribute("data-label") || DEF_LABEL;
    var inline = s.getAttribute("data-mode") === "inline";
    var left = s.getAttribute("data-position") === "left";
    var host = document.createElement("div");
    if (!inline) host.style.cssText = "position:fixed;bottom:20px;" + (left ? "left" : "right") + ":20px;z-index:2147483000";
    var root = host.attachShadow({ mode: "open" });
    var st = document.createElement("style");
    st.textContent = "button{all:initial;box-sizing:border-box;cursor:pointer;font:600 16px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;" +
      "padding:14px 22px;border-radius:999px;background:" + color + ";color:" + contrast(color) + ";box-shadow:0 6px 20px rgba(0,0,0,.25);transition:transform .15s}" +
      "button:hover{transform:translateY(-2px)}button:focus-visible{outline:3px solid " + color + ";outline-offset:3px}";
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-haspopup", "dialog");
    b.textContent = label;
    b.addEventListener("click", function () { open(slug, b); });
    root.appendChild(st); root.appendChild(b);
    var tgt = s.getAttribute("data-target"), el = null;
    if (inline && tgt) { try { el = document.querySelector(tgt); } catch (_) {} }
    if (el) el.appendChild(host);
    else if (inline && s.parentNode) s.parentNode.insertBefore(host, s.nextSibling);
    else document.body.appendChild(host);
  }

  function init() { scripts.forEach(mount); }
  if (document.body) init(); else document.addEventListener("DOMContentLoaded", init);

  window.LCDigitale = { _v: 1, open: function (slug) { open(slug); }, close: close };
})();
