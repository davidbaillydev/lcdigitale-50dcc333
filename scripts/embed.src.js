(function(){
"use strict";
if(window.LCDigitale&&window.LCDigitale._scan)return window.LCDigitale._scan();
var DEF_COLOR="#e11d48",DEF_LABEL="Commander en ligne";
var cur=document.currentScript;
var scripts=cur&&cur.getAttribute("data-restaurant")?[cur]:[].slice.call(document.querySelectorAll('script[src*="/embed.js"][data-restaurant]'));
if(!scripts.length)return;
var ORIGIN=new URL(scripts[0].src).origin;
var SLUG_RE=/^[a-z0-9][a-z0-9-]{0,62}$/i;
var ov=null,frame=null,frameSlug=null,lastBtn=null,timer=null,prevOverflow="",loaded=false,badge=null,inlineMode=false;
function lum(h){return[1,3,5].reduce(function(a,i,k){var c=parseInt(h.substr(i,2),16)/255;c=c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4);return a+c*[.2126,.7152,.0722][k]},0)}
function contrast(h){var L=lum(h);return(L+.05)/.05>=1.05/(L+.05)?"#000":"#fff"}
function fallback(slug){window.open(ORIGIN+"/"+encodeURIComponent(slug)+"?src=embed","_blank","noreferrer")}
function buildOverlay(){
var host=document.createElement("div");
host.style.cssText="position:fixed;inset:0;z-index:2147483001;display:none";
var root=host.attachShadow({mode:"open"});
root.innerHTML="<style>.bg{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}"+
".box{position:relative;width:440px;height:min(760px,90vh);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)}"+
"iframe{border:0;width:100%;height:100%;display:block}"+
".x{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));width:44px;height:44px;border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;font:22px/1 sans-serif;cursor:pointer;z-index:2}.x:focus-visible{outline:3px solid #fff;box-shadow:0 0 0 6px #000}"+
".bg{animation:f .2s}@keyframes f{from{opacity:0}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}"+
"@media(max-width:639px){.box{width:100vw;height:100vh;height:100dvh;border-radius:0;box-sizing:border-box;padding:env(safe-area-inset-top,0) env(safe-area-inset-right,0) env(safe-area-inset-bottom,0) env(safe-area-inset-left,0)}}</style>"+
"<div class='bg'><div class='box' role='dialog' aria-modal='true' lang='fr'><button type='button' class='x' aria-label='Fermer'>×</button></div></div>";
var bg=root.querySelector(".bg"),box=root.querySelector(".box"),x=root.querySelector(".x");
bg.addEventListener("click",function(e){if(e.target===bg)close()});
x.addEventListener("click",close);
host.addEventListener("keydown",function(e){if(e.key==="Escape"){e.preventDefault();close()}else if(e.key==="Tab"&&frame){e.preventDefault();(root.activeElement===x?frame:x).focus()}});
document.addEventListener("focusin",function(e){if(host.style.display!=="none"&&e.target!==host)x.focus()});
document.body.appendChild(host);
return{host:host,root:root,box:box,x:x};
}
function open(slug,btn,name){
slug=String(slug||scripts[0].getAttribute("data-restaurant")||"");
if(!SLUG_RE.test(slug))return;
lastBtn=btn||document.activeElement;
if(navigator.cookieEnabled===false)return fallback(slug);
if(!ov)ov=buildOverlay();
if(frameSlug!==slug){
if(frame)frame.remove();
loaded=false;
frame=document.createElement("iframe");
frame.src=ORIGIN+"/"+encodeURIComponent(slug)+"?embed=1&src=embed&ref="+encodeURIComponent(location.hostname);
frame.setAttribute("allow","payment *; clipboard-write");
frame.title="Commande en ligne - "+(name||slug);frame.lang="fr";
ov.box.setAttribute("aria-label","Commander chez "+(name||slug));
frame.addEventListener("load",function(){loaded=true;clearTimeout(timer)});
ov.box.appendChild(frame);
frameSlug=slug;
clearTimeout(timer);
timer=setTimeout(function(){if(!loaded){close();frame.remove();frame=null;frameSlug=null;fallback(slug)}},8000);
}
ov.host.style.display="block";
prevOverflow=document.body.style.overflow;
document.body.style.overflow="hidden";
ov.x.focus();
}
function close(){
if(!ov||ov.host.style.display==="none")return;
ov.host.style.display="none";
document.body.style.overflow=prevOverflow;
if(lastBtn&&lastBtn.focus)lastBtn.focus();
}
function setBadge(n){
if(!badge)return;
badge.textContent=n>0?String(n):"";
badge.style.display=n>0?"grid":"none";
var b=badge.parentNode;b.setAttribute("aria-label",b.firstChild.textContent+(n>0?", "+n+" article"+(n>1?"s":"")+" dans le panier":""));
}
window.addEventListener("message",function(e){
if(e.origin!==ORIGIN||!frame||e.source!==frame.contentWindow)return;
var d=e.data;
if(!d||d.v!==1||typeof d.type!=="string"||d.type.indexOf("lc:")!==0)return;
if(d.type==="lc:close")close();
else if(d.type==="lc:ready"){loaded=true;clearTimeout(timer);if(typeof d.name==="string"&&d.name){var nm=d.name.slice(0,80);frame.title="Commande en ligne - "+nm;ov.box.setAttribute("aria-label","Commander chez "+nm)}}
else if(d.type==="lc:resize"&&inlineMode&&typeof d.height==="number")frame.style.height=Math.min(Math.max(d.height,200),4000)+"px";
else if(d.type==="lc:cart"&&typeof d.count==="number")setBadge(d.count);
else if(d.type==="lc:order-completed"){
setBadge(0);
window.dispatchEvent(new CustomEvent("lcdigitale:order",{detail:{orderNumber:d.orderNumber,total:d.total}}));
}
});
function mount(s){
var slug=s.getAttribute("data-restaurant");
if(!slug||!SLUG_RE.test(slug)||s.__lcMounted)return;
s.__lcMounted=true;
var color=(s.getAttribute("data-color")||"").toLowerCase();
if(!/^#[0-9a-f]{6}$/.test(color))color=DEF_COLOR;
var label=(s.getAttribute("data-label")||DEF_LABEL).slice(0,30),name=(s.getAttribute("data-name")||"").slice(0,80);
var inline=s.getAttribute("data-mode")==="inline";
if(inline)inlineMode=true;
var left=s.getAttribute("data-position")==="left";
var host=document.createElement("div");
if(!inline)host.style.cssText="position:fixed;bottom:20px;"+(left?"left":"right")+":20px;z-index:2147483000";
var root=host.attachShadow({mode:"open"});
var st=document.createElement("style");
st.textContent="button{all:initial;cursor:pointer;font:600 16px/1.2 system-ui,sans-serif;position:relative;box-sizing:border-box;min-height:48px;min-width:48px;padding:14px 22px;transition:transform .15s;border-radius:999px;background:"+color+";color:"+contrast(color)+";box-shadow:0 6px 20px rgba(0,0,0,.25)}"+
"button:hover{transform:translateY(-1px)}button:focus-visible{outline:3px solid "+color+";outline-offset:3px;box-shadow:0 0 0 2px #fff}"+
"@media(prefers-reduced-motion:reduce){button{transition:none}button:hover{transform:none}}"+
".n{position:absolute;top:-6px;right:-6px;min-width:22px;height:22px;padding:0 5px;border-radius:11px;background:#111;color:#fff;font:700 12px/22px sans-serif;display:none;place-items:center;text-align:center}";
var b=document.createElement("button");
b.type="button";
b.setAttribute("aria-haspopup","dialog");
b.appendChild(document.createTextNode(label));b.setAttribute("aria-label",label);b.lang="fr";
var n=document.createElement("span");
n.className="n";n.setAttribute("aria-hidden","true");
b.appendChild(n);
if(!badge)badge=n;
b.addEventListener("click",function(){open(slug,b,name)});
root.appendChild(st);root.appendChild(b);
var tgt=s.getAttribute("data-target"),el=null;
if(inline&&tgt){try{el=document.querySelector(tgt)}catch(_){}}
if(el)el.appendChild(host);
else if(inline&&s.parentNode)s.parentNode.insertBefore(host,s.nextSibling);
else document.body.appendChild(host);
}
function init(){[].slice.call(document.querySelectorAll('script[src*="/embed.js"][data-restaurant]')).concat(scripts).forEach(mount)}
if(document.body)init();else document.addEventListener("DOMContentLoaded",init);
window.LCDigitale={_scan:function(){document.body?init():0},open:function(slug){open(slug)},close:close};
})();
