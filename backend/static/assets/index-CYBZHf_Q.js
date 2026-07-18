(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))s(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const i of n.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&s(i)}).observe(document,{childList:!0,subtree:!0});function t(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function s(a){if(a.ep)return;a.ep=!0;const n=t(a);fetch(a.href,n)}})();class I{constructor(e){this.containerId=e,this.canvas=null,this.gl=null,this.prog=null,this.rafId=null,this.mouse={x:0,y:0}}init(){const e=document.getElementById(this.containerId);if(!e)return;this.canvas=document.createElement("canvas"),this.canvas.style.cssText="display:block;width:100%;height:100%;",e.appendChild(this.canvas),this._syncSize(),typeof ResizeObserver<"u"&&(this._ro=new ResizeObserver(()=>this._syncSize()),this._ro.observe(this.canvas));const t=this.canvas.getContext("webgl")||this.canvas.getContext("experimental-webgl");if(!t){e.style.background="radial-gradient(ellipse at 30% 60%, rgba(255,184,0,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 40%, rgba(255,13,245,0.08) 0%, transparent 60%)";return}this.gl=t;const s=`
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `,a=`
      precision highp float;
      varying vec2 v_texCoord;
      uniform float u_time;
      uniform vec2 u_resolution;

      // Smooth noise function
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));

        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        for(int i = 0; i < 2; i++) { // Optimized from 5 to 2 for massive performance gain
          val += amp * noise(p);
          p *= 2.0;
          amp *= 0.5;
        }
        return val;
      }

      void main() {
        vec2 uv = v_texCoord;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.15; // Very slow movement

        // Organic flowing noise layers
        float n1 = fbm(p * 1.2 + vec2(t * 0.3, t * 0.2));
        float n2 = fbm(p * 0.8 + vec2(-t * 0.2, t * 0.4) + n1 * 0.5);
        float n3 = fbm(p * 1.5 + vec2(t * 0.1, -t * 0.3) + n2 * 0.3);

        // Color channels — warm amber, magenta, cool cyan
        vec3 amber   = vec3(1.0, 0.72, 0.0);
        vec3 magenta = vec3(1.0, 0.05, 0.96);
        vec3 cyan    = vec3(0.0, 0.85, 0.91);
        vec3 bg      = vec3(0.031, 0.031, 0.031);

        // Blend organic noise into color
        vec3 color = bg;
        color = mix(color, amber,   smoothstep(0.35, 0.65, n1) * 0.25);
        color = mix(color, magenta, smoothstep(0.4, 0.7, n2) * 0.18);
        color = mix(color, cyan,    smoothstep(0.45, 0.75, n3) * 0.12);

        // Subtle vignette
        float vig = 1.0 - length(p) * 0.35;
        vig = clamp(vig, 0.0, 1.0);
        color *= vig;

        // Very subtle grain
        float grain = (hash(uv * u_time) - 0.5) * 0.02;
        color += grain;

        gl_FragColor = vec4(color, 1.0);
      }
    `;this.prog=this._createProgram(s,a),t.useProgram(this.prog);const n=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,n),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),t.STATIC_DRAW);const i=t.getAttribLocation(this.prog,"a_position");t.enableVertexAttribArray(i),t.vertexAttribPointer(i,2,t.FLOAT,!1,0,0),this.uTime=t.getUniformLocation(this.prog,"u_time"),this.uRes=t.getUniformLocation(this.prog,"u_resolution"),this._render(0)}_syncSize(){if(!this.canvas)return;const e=this.canvas.clientWidth||390,t=this.canvas.clientHeight||844;(this.canvas.width!==e||this.canvas.height!==t)&&(this.canvas.width=e,this.canvas.height=t)}_createShader(e,t){const s=this.gl.createShader(e);return this.gl.shaderSource(s,t),this.gl.compileShader(s),s}_createProgram(e,t){const s=this.gl.createProgram();return this.gl.attachShader(s,this._createShader(this.gl.VERTEX_SHADER,e)),this.gl.attachShader(s,this._createShader(this.gl.FRAGMENT_SHADER,t)),this.gl.linkProgram(s),s}_render(e){const{gl:t,canvas:s}=this;!t||!s||(typeof ResizeObserver>"u"&&this._syncSize(),t.viewport(0,0,s.width,s.height),this.uTime&&t.uniform1f(this.uTime,e*.001),this.uRes&&t.uniform2f(this.uRes,s.width,s.height),t.drawArrays(t.TRIANGLE_STRIP,0,4),this.rafId=requestAnimationFrame(a=>this._render(a)))}destroy(){this.rafId&&cancelAnimationFrame(this.rafId),this._ro&&this._ro.disconnect()}}function N({onMenuClick:r,onBookmarkClick:e}={}){var s,a;const t=document.createElement("header");return t.className="top-bar",t.innerHTML=`
    <button class="top-bar__icon-btn" id="btn-menu" aria-label="Open menu">
      <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 0">menu</span>
    </button>
    <h1 class="top-bar__logo">DRIPRIG</h1>
    <button class="top-bar__icon-btn" id="btn-bookmark" aria-label="Saved looks">
      <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 0">bookmark</span>
    </button>
  `,(s=t.querySelector("#btn-menu"))==null||s.addEventListener("click",r||(()=>{})),(a=t.querySelector("#btn-bookmark"))==null||a.addEventListener("click",e||(()=>{})),t}const _=[{id:"nav-explore",icon:"explore",label:"Explore",page:"explore"},{id:"nav-canvas",icon:"grid_view",label:"Rig",page:"canvas"},{id:"nav-saved",icon:"favorite",label:"Saved",page:"saved"},{id:"nav-profile",icon:"person",label:"Profile",page:"profile"}];class A{constructor({onNavigate:e}={}){this.onNavigate=e||(()=>{}),this.activeId="nav-canvas",this.el=this._render()}_render(){const e=document.createElement("nav");return e.className="bottom-nav",e.setAttribute("aria-label","Main navigation"),_.forEach(({id:t,icon:s,label:a,page:n})=>{const i=document.createElement("button");i.id=t,i.className=`bottom-nav__item${t===this.activeId?" bottom-nav__item--active":""}`,i.setAttribute("aria-label",a),i.innerHTML=`
        <span class="material-symbols-outlined" style="font-variation-settings:'FILL' ${t===this.activeId?"1":"0"}">${s}</span>
        <span>${a}</span>
      `,i.addEventListener("click",()=>this._navigate(t,n)),e.appendChild(i)}),e}_navigate(e,t){e!==this.activeId&&(this.el.querySelectorAll(".bottom-nav__item").forEach(s=>{const a=s.id===e;s.classList.toggle("bottom-nav__item--active",a);const n=s.querySelector(".material-symbols-outlined");n&&(n.style.fontVariationSettings=`'FILL' ${a?"1":"0"}`)}),this.activeId=e,this.onNavigate(t))}setActive(e){const t=_.find(s=>s.page===e);t&&this._navigate(t.id,e)}mount(e){e.appendChild(this.el)}}class x{constructor(e,t,{onUpload:s,onRemove:a,onError:n}={}){this.slotKey=e,this.config=t,this.onUpload=s||(()=>{}),this.onRemove=a||(()=>{}),this.onError=n||(()=>{}),this.state="empty",this.filename=null,this.url=null,this.el=null,this.fileInput=null,this._render()}_render(){return this.el=document.createElement("div"),this.el.className="slot slide-up",this.el.setAttribute("tabindex","0"),this.el.setAttribute("role","button"),this.el.setAttribute("aria-label",`Upload ${this.config.label}`),this.el.dataset.slot=this.slotKey,this.fileInput=document.createElement("input"),this.fileInput.type="file",this.fileInput.accept="image/jpeg,image/png,image/webp",this.fileInput.className="sr-only",this.fileInput.setAttribute("aria-hidden","true"),this.fileInput.addEventListener("change",e=>this._handleFileSelect(e)),this.el.appendChild(this.fileInput),this._renderEmptyState(),this._bindEvents(),this.el}_renderEmptyState(){Array.from(this.el.children).forEach(s=>{s!==this.fileInput&&s.remove()}),this.el.className="slot";const e=document.createElement("div");e.className="slot__empty",e.innerHTML=`
      <span class="material-symbols-outlined slot__icon" style="font-variation-settings:'FILL' 0">${this.config.icon}</span>
      <span class="slot__label">${this.config.label}</span>
      <span class="slot__sublabel">Tap to upload</span>
    `;const t=document.createElement("div");t.className="slot__plus",t.innerHTML='<span class="material-symbols-outlined">add</span>',this.el.appendChild(e),this.el.appendChild(t),this.state="empty",this.filename=null,this.url=null}_renderUploadingState(){Array.from(this.el.children).forEach(t=>{t!==this.fileInput&&t.remove()}),this.el.className="slot slot--uploading";const e=document.createElement("div");e.className="slot__upload-progress",e.innerHTML=`
      <div class="slot__spinner"></div>
      <span class="slot__upload-text">Uploading…</span>
    `,this.el.appendChild(e),this.state="uploading"}_renderLoadedState(e){Array.from(this.el.children).forEach(n=>{n!==this.fileInput&&n.remove()}),this.el.className="slot slot--loaded";const t=document.createElement("img");t.src=e,t.alt=`${this.config.label} preview`,t.className="slot__thumbnail",t.draggable=!1;const s=document.createElement("div");s.className="slot__loaded-overlay",s.innerHTML=`<span class="slot__loaded-label">${this.config.label}</span>`;const a=document.createElement("button");a.className="slot__remove-btn",a.setAttribute("aria-label",`Remove ${this.config.label}`),a.innerHTML='<span class="material-symbols-outlined">close</span>',a.addEventListener("click",n=>{n.stopPropagation(),this._handleRemove()}),this.el.appendChild(t),this.el.appendChild(s),this.el.appendChild(a),this.state="loaded"}_bindEvents(){this.el.addEventListener("click",e=>{if(this.state!=="uploading"&&!e.target.closest(".slot__remove-btn")){if(this.state==="loaded"){this.fileInput.click();return}this.fileInput.click()}}),this.el.addEventListener("keydown",e=>{(e.key==="Enter"||e.key===" ")&&this.state!=="uploading"&&(e.preventDefault(),this.fileInput.click())}),this.el.addEventListener("dragover",e=>{e.preventDefault(),this.el.classList.add("slot--drag-over")}),this.el.addEventListener("dragleave",()=>{this.el.classList.remove("slot--drag-over")}),this.el.addEventListener("drop",e=>{var s;e.preventDefault(),this.el.classList.remove("slot--drag-over");const t=(s=e.dataTransfer.files)==null?void 0:s[0];t&&this._uploadFile(t)})}_handleFileSelect(e){var s;const t=(s=e.target.files)==null?void 0:s[0];t&&this._uploadFile(t),this.fileInput.value=""}async _uploadFile(e){if(!["image/jpeg","image/png","image/webp"].includes(e.type)){this.onError("Invalid file type. Please upload a JPEG, PNG, or WEBP image.");return}if(e.size>20*1024*1024){this.onError("File too large. Maximum size is 20MB.");return}this._renderUploadingState();const s=new FormData;s.append("file",e);try{const a=await fetch(`/api/upload/${this.slotKey}`,{method:"POST",body:s});if(!a.ok){const i=await a.json().catch(()=>({detail:"Upload failed."}));throw new Error(i.detail||"Upload failed.")}const n=await a.json();this.filename=n.filename,this.url=n.url,this._renderLoadedState(n.url),this.onUpload(this.slotKey,n.filename,n.url)}catch(a){this._renderEmptyState(),this.onError(a.message||"Upload failed. Please try again.")}}async _handleRemove(){this.filename&&fetch(`/api/upload/${this.slotKey}/${this.filename}`,{method:"DELETE"}).catch(()=>{}),this._renderEmptyState(),this.onRemove(this.slotKey)}mount(e){e.appendChild(this.el)}getFilename(){return this.filename}isLoaded(){return this.state==="loaded"}}const b={particles:{number:{value:35,density:{enable:!0,value_area:800}},color:{value:["#ffb800","#ff0df5","#00d9e7"]},shape:{type:"circle"},opacity:{value:.45,random:!0,anim:{enable:!0,speed:.8,opacity_min:.05,sync:!1}},size:{value:2.5,random:!0,anim:{enable:!1}},line_linked:{enable:!1,distance:130,color:"#2a2a2a",opacity:.35,width:1},move:{enable:!0,speed:1.5,direction:"none",random:!0,straight:!1,out_mode:"out",bounce:!1}},interactivity:{detect_on:"canvas",events:{onhover:{enable:!1},onclick:{enable:!1},resize:!0}},retina_detect:!0};function R(r="particles-js"){typeof window.particlesJS=="function"?window.particlesJS(r,b):(console.warn("[Particles] particlesJS not loaded yet. Will retry..."),window.addEventListener("load",()=>{typeof window.particlesJS=="function"&&window.particlesJS(r,b)},{once:!0}))}const y={person:{label:"Your Photo",sublabel:"Selfie / Full Body",icon:"person"},outfit:{label:"Your Outfit",sublabel:"Top / Bottom / Dress",icon:"checkroom"}};class k{constructor({onGenerateResult:e}={}){this.onGenerateResult=e||(()=>{}),this.slots={},this.filledCount=0,this.el=null,this._rigId=this._generateRigId(),this.selectedModel="fast"}_generateRigId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";let t="";for(let s=0;s<3;s++)t+=e[Math.floor(Math.random()*e.length)];t+="-";for(let s=0;s<2;s++)t+=e[Math.floor(Math.random()*e.length)];return t}render(){const e=document.createElement("div");e.id="page-canvas",e.className="page page--active page-content";const t=document.createElement("div");t.className="page-header slide-up",t.innerHTML=`
      <h2 class="page-header__title">Rig Canvas</h2>
      <p class="page-header__sub">Upload your photo &amp; outfit to try it on.</p>
    `,e.appendChild(t);const s=document.createElement("div");s.className="rig-canvas animate-border-pulse slide-up delay-100";const a=document.createElement("div");a.id="particles-js",s.appendChild(a);const n=document.createElement("div");n.className="rig-canvas__inner";const i=document.createElement("div");i.className="rig-canvas__header",i.innerHTML=`
      <div class="rig-status-badge">
        <div class="rig-status-badge__dot animate-pulse-cyan"></div>
        <span class="rig-status-badge__text">Rig Status: Active</span>
      </div>
      <span class="rig-id">ID: ${this._rigId}</span>
    `,n.appendChild(i);const o=document.createElement("div");o.className="slots-grid-duo",o.id="slots-grid",["person","outfit"].forEach(u=>{const m=new x(u,y[u],{onUpload:(g,S,T)=>this._onSlotUpload(g,S,T),onRemove:g=>this._onSlotRemove(g),onError:g=>p(g,"error")});m.mount(o),this.slots[u]=m}),n.appendChild(o),this.footerEl=document.createElement("div"),this.footerEl.className="rig-canvas__footer",this.footerEl.innerHTML=`
      <div class="rig-stat">
        <span class="rig-stat__label">Slots Loaded</span>
        <span class="rig-stat__value" id="stat-slots">0 / 2</span>
      </div>
    `,n.appendChild(this.footerEl),s.appendChild(n),e.appendChild(s);const h=document.createElement("div");h.className="progress-tracker slide-up delay-300",h.innerHTML=`
      <div class="progress-tracker__bar-wrap">
        <div class="progress-tracker__bar" id="progress-bar" style="width:0%"></div>
      </div>
      <span class="progress-tracker__text" id="progress-text">0 / 2</span>
    `,e.appendChild(h);const d=document.createElement("div");d.className="model-selector slide-up delay-350",d.innerHTML=`
      <span class="model-selector__label">Engine</span>
      <div class="model-selector__toggle" id="model-toggle">
        <button class="model-selector__btn model-selector__btn--active" data-model="fast" id="btn-model-fast">
          <span class="material-symbols-outlined">bolt</span>
          Fast
        </button>
        <button class="model-selector__btn" data-model="quality" id="btn-model-quality">
          <span class="material-symbols-outlined">auto_awesome</span>
          Quality
        </button>
      </div>
    `,e.appendChild(d),d.querySelectorAll(".model-selector__btn").forEach(u=>{u.addEventListener("click",()=>{this.selectedModel=u.dataset.model,d.querySelectorAll(".model-selector__btn").forEach(m=>m.classList.toggle("model-selector__btn--active",m===u))})});const l=document.createElement("div");return l.className="cta-wrap slide-up delay-400",this.ctaBtn=document.createElement("button"),this.ctaBtn.id="btn-lock-in",this.ctaBtn.className="btn-shimmer",this.ctaBtn.disabled=!0,this.ctaBtn.innerHTML=`
      <span>Lock In Outfit</span>
      <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">bolt</span>
    `,this.ctaBtn.addEventListener("click",()=>this._handleGenerate()),l.appendChild(this.ctaBtn),e.appendChild(l),this.el=e,requestAnimationFrame(()=>{setTimeout(()=>R("particles-js"),100)}),e}_onSlotUpload(e,t,s){this.filledCount++,this._updateStats(),p(`${y[e].label} loaded ✓`,"success")}_onSlotRemove(e){this.filledCount=Math.max(0,this.filledCount-1),this._updateStats()}_updateStats(){const t=this.filledCount/2*100,s=document.getElementById("progress-bar"),a=document.getElementById("progress-text");s&&(s.style.width=`${t}%`),a&&(a.textContent=`${this.filledCount} / 2`);const n=document.getElementById("stat-slots");n&&(n.textContent=`${this.filledCount} / 2`),this.ctaBtn&&(this.ctaBtn.disabled=this.filledCount<2)}async _handleGenerate(){var a,n;const e=(a=this.slots.person)==null?void 0:a.getFilename(),t=(n=this.slots.outfit)==null?void 0:n.getFilename();if(!e){p("Upload your photo first!","info");return}if(!t){p("Upload an outfit to try on!","info");return}const s={person:e,outfit:t,model:this.selectedModel};this._showGeneratingOverlay(!0);try{const i=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)});if(!i.ok){const l=await i.json().catch(()=>({detail:"Generation failed."}));throw new Error(l.detail||"Generation failed.")}const o=await i.json();this._showGeneratingOverlay(!1);const c={fast:"Fast (sm4ll-VTON)",quality:"Quality (WeShopAI)",mock:"Mock"},h=c[this.selectedModel]||this.selectedModel,d=c[o.model_used]||o.model_used;o.model_used==="mock"?p("⚠️ All engines are busy — showing placeholder. Try again later!","error"):o.model_used&&o.model_used.toLowerCase()!==this.selectedModel&&p(`⚡ ${h} was unavailable — switched to ${d} automatically.`,"info"),this.onGenerateResult(o)}catch(i){this._showGeneratingOverlay(!1),p(`Something went wrong — try a different engine! (${i.message||"Generation failed"})`,"error")}}_showGeneratingOverlay(e){let t=document.getElementById("generating-overlay");if(e){if(t)return;t=document.createElement("div"),t.id="generating-overlay",t.className="generating-overlay",t.innerHTML=`
        <div class="generating-spinner"></div>
        <div class="generating-overlay__logo">DripRig</div>
        <span class="generating-overlay__text">Constructing your rig…</span>
      `,document.body.appendChild(t);const s=["Constructing your rig…","Aligning components…","Rendering the fit…","Almost there…"];let a=0;this._loadingTextInterval=setInterval(()=>{a=(a+1)%s.length;const n=t==null?void 0:t.querySelector(".generating-overlay__text");n&&(n.textContent=s[a])},1200)}else t&&t.remove(),this._loadingTextInterval&&(clearInterval(this._loadingTextInterval),this._loadingTextInterval=null)}mount(e){this.el||this.render(),e.appendChild(this.el)}unmount(){this.el&&this.el.remove()}}const P="modulepreload",M=function(r){return"/"+r},E={},L=function(e,t,s){let a=Promise.resolve();if(t&&t.length>0){document.getElementsByTagName("link");const i=document.querySelector("meta[property=csp-nonce]"),o=(i==null?void 0:i.nonce)||(i==null?void 0:i.getAttribute("nonce"));a=Promise.allSettled(t.map(c=>{if(c=M(c),c in E)return;E[c]=!0;const h=c.endsWith(".css"),d=h?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${c}"]${d}`))return;const l=document.createElement("link");if(l.rel=h?"stylesheet":P,h||(l.as="script"),l.crossOrigin="",l.href=c,o&&l.setAttribute("nonce",o),document.head.appendChild(l),h)return new Promise((u,m)=>{l.addEventListener("load",u),l.addEventListener("error",()=>m(new Error(`Unable to preload CSS for ${c}`)))})}))}function n(i){const o=new Event("vite:preloadError",{cancelable:!0});if(o.payload=i,window.dispatchEvent(o),!o.defaultPrevented)throw i}return a.then(i=>{for(const o of i||[])o.status==="rejected"&&n(o.reason);return e().catch(n)})};class F{constructor({onTryAgain:e}={}){this.onTryAgain=e||(()=>{}),this.el=null,this.data=null}render(e){this.data=e;const t=document.createElement("div");t.id="page-result",t.className="page page--active result-page";const s=document.createElement("div");s.className="page-header slide-up",s.innerHTML=`
      <h2 class="page-header__title">Your Rig</h2>
      <p class="page-header__sub">Fresh drop — locked and loaded.</p>
    `,t.appendChild(s);const a=document.createElement("div");a.className="result-image-wrap animate-result-glow slide-up delay-100";const n=document.createElement("img");n.src=e.result_url,n.alt="Generated outfit composite",n.loading="eager";const i=document.createElement("div");i.className="result-badge",i.innerHTML=`
      <span class="material-symbols-outlined" style="font-size:14px;font-variation-settings:'FILL' 1">check_circle</span>
      <span>Rig Generated</span>
    `,a.appendChild(n),a.appendChild(i),t.appendChild(a);const o=e.processing_time_ms?(e.processing_time_ms/1e3).toFixed(1):"—",c=document.createElement("div");c.className="result-meta slide-up delay-200",c.style.justifyContent="center",c.innerHTML=`
      <div class="result-meta__item" style="align-items: center">
        <span class="result-meta__label">Render Time</span>
        <span class="result-meta__value">${o}s</span>
      </div>
    `,t.appendChild(c);const h=document.createElement("div");h.className="result-actions slide-up delay-300";const d=document.createElement("a");d.href=e.result_url,d.download="driprig-outfit.jpg",d.className="btn-secondary",d.id="btn-download",d.innerHTML=`
      <span class="material-symbols-outlined">download</span>
      <span>Save</span>
    `;const l=document.createElement("button");l.className="btn-secondary",l.id="btn-share",l.innerHTML=`
      <span class="material-symbols-outlined">share</span>
      <span>Share</span>
    `,l.addEventListener("click",()=>this._handleShare(e.result_url)),h.appendChild(d),h.appendChild(l),t.appendChild(h);const u=document.createElement("div");u.className="cta-wrap slide-up delay-400";const m=document.createElement("button");return m.id="btn-try-again",m.className="btn-shimmer",m.innerHTML=`
      <span>Rebuild Rig</span>
      <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">refresh</span>
    `,m.addEventListener("click",()=>this.onTryAgain()),u.appendChild(m),t.appendChild(u),this.el=t,t}_ratingFromCount(e){return{1:"WEAK",2:"DECENT",3:"SOLID",4:"ELITE"}[e]||"N/A"}async _handleShare(e){const t=`${window.location.origin}${e}`;if(navigator.share)try{await navigator.share({title:"My DripRig Fit",text:"Check out my fit from DripRig 🔥",url:t})}catch(s){s.name!=="AbortError"&&this._copyToClipboard(t)}else this._copyToClipboard(t)}_copyToClipboard(e){var t;(t=navigator.clipboard)==null||t.writeText(e).then(()=>{L(async()=>{const{showToast:s}=await Promise.resolve().then(()=>C);return{showToast:s}},void 0).then(({showToast:s})=>s("Link copied to clipboard!","success"))}).catch(()=>{L(async()=>{const{showToast:s}=await Promise.resolve().then(()=>C);return{showToast:s}},void 0).then(({showToast:s})=>s("Could not copy link.","error"))})}mount(e,t){this.render(t),e.appendChild(this.el)}unmount(){this.el&&this.el.remove()}}let f=null;function p(r,e="info"){f||(f=document.createElement("div"),f.className="toast-container",f.id="toast-container",document.body.appendChild(f));const t={error:"error",success:"check_circle",info:"info"},s=document.createElement("div");s.className=`toast toast--${e}`,s.innerHTML=`
    <span class="material-symbols-outlined toast__icon" style="font-variation-settings:'FILL' 1">${t[e]||"info"}</span>
    <span class="toast__msg">${r}</span>
  `,f.appendChild(s);const a=()=>{s.classList.add("toast--exiting"),s.addEventListener("animationend",()=>s.remove(),{once:!0})},n=setTimeout(a,3500);s.addEventListener("click",()=>{clearTimeout(n),a()})}const v={currentPage:null,resultData:null};class B{constructor(e){this.appEl=e,this.currentPageEl=null,this.header=null,this.bottomNav=null,this.contentEl=null,this._shellBuilt=!1}init(){this.navigate("canvas")}_buildShell(){this._shellBuilt||(this.appEl.innerHTML="",this.header=N({onMenuClick:()=>this._showUserMenu(),onBookmarkClick:()=>p("Saved looks coming soon!","info")}),this.appEl.appendChild(this.header),this.contentEl=document.createElement("main"),this.contentEl.id="main-content",this.contentEl.style.cssText="flex:1;display:flex;flex-direction:column;",this.appEl.appendChild(this.contentEl),this.bottomNav=new A({onNavigate:e=>{e==="canvas"?this.navigate("canvas"):p(`${e.charAt(0).toUpperCase()+e.slice(1)} coming soon!`,"info")}}),this.bottomNav.mount(this.appEl),this._shellBuilt=!0)}navigate(e,t=null){var s;if(this._buildShell(),this.currentPageEl&&(this.currentPageEl.remove(),this.currentPageEl=null),v.currentPage=e,e==="canvas"){const a=new k({onGenerateResult:n=>{v.resultData=n,this.navigate("result",n)}});this.currentPageEl=a.render(),this.contentEl.appendChild(this.currentPageEl),(s=this.bottomNav)==null||s.setActive("canvas")}else if(e==="result"){const a=new F({onTryAgain:()=>this.navigate("canvas")});this.currentPageEl=a.render(t||v.resultData),this.contentEl.appendChild(this.currentPageEl)}}_showUserMenu(){var s;(s=document.getElementById("user-menu"))==null||s.remove();const e=document.createElement("div");e.id="user-menu",e.className="user-menu glass-card",e.innerHTML=`
      <div class="user-menu__profile">
        <div class="user-menu__avatar user-menu__avatar--placeholder">U</div>
        <div>
          <div class="user-menu__name">User</div>
        </div>
      </div>
    `,document.body.appendChild(e);const t=a=>{e.contains(a.target)||(e.remove(),document.removeEventListener("click",t))};setTimeout(()=>document.addEventListener("click",t),0)}}function w(){document.getElementById("shader-background")&&new I("shader-background").init();const e=document.getElementById("app");if(!e){console.error("[DripRig] #app element not found!");return}new B(e).init(),console.info("%c DripRig v0.2 ","background:#ffb800;color:#000;font-weight:bold;padding:2px 6px;border-radius:2px;")}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",w):w();const C=Object.freeze(Object.defineProperty({__proto__:null,showToast:p},Symbol.toStringTag,{value:"Module"}));
