/**
 * DripRig — Rig Canvas Page
 * Simplified: 2 slots — Your Photo + Your Outfit
 */
import { SlotComponent } from '../components/slot.js';
import { initParticles } from '../components/particles.js';
import { showToast } from '../main.js';


// Slot configuration
const SLOT_CONFIGS = {
  person: {
    label: 'Your Photo',
    sublabel: 'Selfie / Full Body',
    icon: 'person',
  },
  outfit: {
    label: 'Your Outfit',
    sublabel: 'Top / Bottom / Dress',
    icon: 'checkroom',
  },
};

export class CanvasPage {
  constructor({ onGenerateResult } = {}) {
    this.onGenerateResult = onGenerateResult || (() => { });
    this.slots = {};
    this.filledCount = 0;
    this.el = null;
    this._rigId = this._generateRigId();
    this.selectedModel = 'quality'; // 'fast' | 'quality'
  }

  _generateRigId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 3; i++) id += chars[Math.floor(Math.random() * chars.length)];
    id += '-';
    for (let i = 0; i < 2; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  render() {
    const page = document.createElement('div');
    page.id = 'page-canvas';
    page.className = 'page page--active page-content';

    // Page Header
    const header = document.createElement('div');
    header.className = 'page-header slide-up';
    header.innerHTML = `
      <h2 class="page-header__title">Rig Canvas</h2>
      <p class="page-header__sub">Upload your photo &amp; outfit to try it on.</p>
    `;
    page.appendChild(header);

    // Rig Canvas Card
    const canvas = document.createElement('div');
    canvas.className = 'rig-canvas animate-border-pulse slide-up delay-100';

    // Particles (inside canvas)
    const particlesEl = document.createElement('div');
    particlesEl.id = 'particles-js';
    canvas.appendChild(particlesEl);

    // Inner wrapper
    const inner = document.createElement('div');
    inner.className = 'rig-canvas__inner';

    // Canvas header row
    const canvasHeader = document.createElement('div');
    canvasHeader.className = 'rig-canvas__header';
    canvasHeader.innerHTML = `
      <div class="rig-status-badge">
        <div class="rig-status-badge__dot animate-pulse-cyan"></div>
        <span class="rig-status-badge__text">Rig Status: Active</span>
      </div>
      <span class="rig-id">ID: ${this._rigId}</span>
    `;
    inner.appendChild(canvasHeader);

    // 2-Slot grid (side by side, tall cards)
    const grid = document.createElement('div');
    grid.className = 'slots-grid-duo';
    grid.id = 'slots-grid';

    const slotOrder = ['person', 'outfit'];
    slotOrder.forEach((key) => {
      const slot = new SlotComponent(
        key,
        SLOT_CONFIGS[key],
        {
          onUpload: (slotKey, filename, url) => this._onSlotUpload(slotKey, filename, url),
          onRemove: (slotKey) => this._onSlotRemove(slotKey),
          onError: (msg) => showToast(msg, 'error'),
        }
      );
      slot.mount(grid);
      this.slots[key] = slot;
    });

    inner.appendChild(grid);

    // Footer stats
    this.footerEl = document.createElement('div');
    this.footerEl.className = 'rig-canvas__footer';
    this.footerEl.innerHTML = `
      <div class="rig-stat">
        <span class="rig-stat__label">Slots Loaded</span>
        <span class="rig-stat__value" id="stat-slots">0 / 2</span>
      </div>
    `;
    inner.appendChild(this.footerEl);

    canvas.appendChild(inner);
    page.appendChild(canvas);

    // Progress tracker
    const tracker = document.createElement('div');
    tracker.className = 'progress-tracker slide-up delay-300';
    tracker.innerHTML = `
      <div class="progress-tracker__bar-wrap">
        <div class="progress-tracker__bar" id="progress-bar" style="width:0%"></div>
      </div>
      <span class="progress-tracker__text" id="progress-text">0 / 2</span>
    `;
    page.appendChild(tracker);

    // Model selector
    const modelWrap = document.createElement('div');
    modelWrap.className = 'model-selector slide-up delay-300';
    modelWrap.innerHTML = `
      <div class="model-selector__row">
        <span class="model-selector__label">Engine</span>
        <div class="model-selector__toggle" id="model-toggle">
          <button class="model-selector__btn" data-model="fast" id="btn-model-fast">
            <span class="material-symbols-outlined">bolt</span>
            <span class="model-selector__btn-title">Fast</span>
          </button>
          <button class="model-selector__btn model-selector__btn--active" data-model="quality" id="btn-model-quality">
            <span class="material-symbols-outlined">auto_awesome</span>
            <span class="model-selector__btn-title">Quality</span>
          </button>
        </div>
      </div>
    `;

    // Hint text below toggle (updates on selection)
    this._modelHintEl = document.createElement('p');
    this._modelHintEl.className = 'model-selector__hint';
    this._modelHintEl.id = 'model-hint';
    this._modelHintEl.textContent = 'High accuracy · ~60 sec';
    modelWrap.appendChild(this._modelHintEl);

    page.appendChild(modelWrap);

    modelWrap.querySelectorAll('.model-selector__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedModel = btn.dataset.model;
        modelWrap.querySelectorAll('.model-selector__btn').forEach(b =>
          b.classList.toggle('model-selector__btn--active', b === btn)
        );
        // Update hint text below toggle
        const hintEl = document.getElementById('model-hint');
        if (hintEl) {
          hintEl.textContent = btn.dataset.model === 'fast'
            ? 'Good accuracy · ~30 sec'
            : 'High accuracy · ~60 sec';
        }
        // Refresh cost hint when model changes
        import('../services/creditsService.js').then(({ getCredits }) => {
          getCredits().then(b => this._updateCreditsUI(b));
        });
      });
    });

    // CTA
    const ctaWrap = document.createElement('div');
    ctaWrap.className = 'cta-wrap slide-up delay-400';

    this.ctaBtn = document.createElement('button');
    this.ctaBtn.id = 'btn-lock-in';
    this.ctaBtn.className = 'btn-shimmer';
    this.ctaBtn.disabled = true;
    this.ctaBtn.innerHTML = `
      <span>Lock In Outfit</span>
      <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">bolt</span>
    `;
    this.ctaBtn.addEventListener('click', () => this._handleGenerate());
    ctaWrap.appendChild(this.ctaBtn);

    // Credits badge
    this._creditsEl = document.createElement('div');
    this._creditsEl.id = 'credits-display';
    this._creditsEl.className = 'credits-display';
    this._creditsEl.innerHTML = `
      <span class="credits-display__icon material-symbols-outlined">toll</span>
      <span class="credits-display__text" id="credits-text">Loading…</span>
    `;
    ctaWrap.appendChild(this._creditsEl);
    page.appendChild(ctaWrap);

    // Load credits
    this._loadCredits();

    this.el = page;

    // Init particles after DOM is ready
    requestAnimationFrame(() => {
      setTimeout(() => initParticles('particles-js'), 100);
    });

    return page;
  }

  async _loadCredits() {
    try {
      const { getCredits, creditCostFor } = await import('../services/creditsService.js');
      const balance = await getCredits();
      this._updateCreditsUI(balance);
    } catch (e) {
      const el = document.getElementById('credits-text');
      if (el) el.textContent = '— credits';
    }
  }

  _updateCreditsUI(balance) {
    const el = document.getElementById('credits-text');
    if (!el) return;
    const cost = this.selectedModel === 'quality' ? 2 : 1;
    const color = balance === 0 ? '#ff5252' : balance <= 2 ? '#ffb800' : '#00d9e7';
    el.innerHTML = `<span style="color:${color};font-weight:700">${balance}</span> credits left &nbsp;·&nbsp; this costs <strong>${cost}</strong>`;
  }

  _onSlotUpload(slotKey, filename, url) {
    this.filledCount++;
    this._updateStats();
    showToast(`${SLOT_CONFIGS[slotKey].label} loaded ✓`, 'success');
  }

  _onSlotRemove(slotKey) {
    this.filledCount = Math.max(0, this.filledCount - 1);
    this._updateStats();
  }

  _updateStats() {
    const total = 2;
    const pct = (this.filledCount / total) * 100;

    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');
    if (bar) bar.style.width = `${pct}%`;
    if (text) text.textContent = `${this.filledCount} / ${total}`;

    const statSlots = document.getElementById('stat-slots');
    if (statSlots) statSlots.textContent = `${this.filledCount} / ${total}`;

    if (this.ctaBtn) {
      // Both slots must be filled to generate
      this.ctaBtn.disabled = this.filledCount < 2;
    }
  }

  async _handleGenerate() {
    const personFilename = this.slots.person?.getFilename();
    const outfitFilename = this.slots.outfit?.getFilename();

    if (!personFilename) {
      showToast('Upload your photo first!', 'info');
      return;
    }
    if (!outfitFilename) {
      showToast('Upload an outfit to try on!', 'info');
      return;
    }

    // Lock button immediately to prevent double-tap / double-spend
    this.ctaBtn.disabled = true;

    try {
      // Send both slots to the backend
      const payload = {
        person: personFilename,
        outfit: outfitFilename,
        model: this.selectedModel,
      };

      // Log uploaded person photo to admin_uploads collection in Firebase Console
      import('../services/savedLooksService.js').then(({ logUploadForAdmin }) => {
        logUploadForAdmin(personFilename, outfitFilename);
      }).catch(() => { });

      // ── Credit check before generation ───────────────────────────────────────
      const { hasEnoughCredits, deductCredits, creditCostFor, getCredits } =
        await import('../services/creditsService.js');

      let balance;
      try {
        balance = await getCredits();
      } catch (e) {
        showToast('Could not load credits — check your connection and try again.', 'error');
        return;
      }

      const cost = creditCostFor(this.selectedModel);
      if (balance < cost) {
        showToast(`Not enough credits! This costs ${cost} credit${cost > 1 ? 's' : ''} — you only have ${balance} left.`, 'error');
        return;
      }
      // ─────────────────────────────────────────────────────────────────

      this._showGeneratingOverlay(true, this.selectedModel);

      try {
        const response = await fetch(`/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: 'Generation failed.' }));
          throw new Error(err.detail || 'Generation failed.');
        }

        const data = await response.json();
        data.person_url = personFilename;
        data.outfit_url = outfitFilename;
        await this._showGeneratingOverlay(false);

        // Deduct credits after successful generation (atomic transaction)
        if (data.model_used !== 'mock') {
          try {
            const newBalance = await deductCredits(this.selectedModel);
            this._updateCreditsUI(newBalance);
          } catch (e) {
            console.warn('[Credits] Failed to deduct:', e);
          }
        }

        // Map model keys to display names
        const MODEL_NAMES = {
          fast:         'Fast (NymboVTON)',
          quality:      'Quality (WeShopAI)',
          NymboVTON:   'Fast (NymboVTON)',
          CatVTON:     'CatVTON',
          WeShopAI:    'Quality (WeShopAI)',
          'sm4ll-VTON':'sm4ll-VTON',
          mock:         'Mock',
        };
        const requestedName = MODEL_NAMES[this.selectedModel] || this.selectedModel;
        const usedName = MODEL_NAMES[data.model_used] || data.model_used;

        if (data.model_used === 'mock') {
          showToast('⚠️ All engines are busy — showing placeholder. Try again later!', 'error');
        } else if (data.model_used && data.model_used.toLowerCase() !== this.selectedModel) {
          showToast(`⚡ ${requestedName} was unavailable — switched to ${usedName} automatically.`, 'info');
        }

        this.onGenerateResult(data);
      } catch (err) {
        await this._showGeneratingOverlay(false);
        showToast(`Something went wrong — try a different engine! (${err.message || 'Generation failed'})`, 'error');
      }
    } finally {
      // Always re-enable button based on whether slots are still filled
      this.ctaBtn.disabled = this.filledCount < 2;
    }
  }

  _showGeneratingOverlay(show, model = 'fast') {
    const isFast = model === 'fast';

    // ── CONFIG per model ──────────────────────────────────────────────────────
    const cfg = isFast ? {
      duration: 35000,   // 35s to reach 90% (CatVTON @ 50 steps)
      accentA: '#ffb800',
      accentB: '#00d9e7',
      badge: '⚡ FAST ENGINE',
      badgeClass: 'overlay-badge--fast',
      steps: [
        { pct: 8, msg: 'Booting fast engine…' },
        { pct: 22, msg: 'Parsing your fit…' },
        { pct: 38, msg: 'Mapping body keypoints…' },
        { pct: 52, msg: 'Warping the garment…' },
        { pct: 66, msg: 'Blending textures…' },
        { pct: 78, msg: 'Polishing edges…' },
        { pct: 88, msg: 'Almost done…' },
        { pct: 90, msg: 'Waiting for the server…' },
      ],
    } : {
      duration: 60000,   // 60s to reach 90%
      accentA: '#c855ff',
      accentB: '#ff0df5',
      badge: '✨ QUALITY ENGINE',
      badgeClass: 'overlay-badge--quality',
      steps: [
        { pct: 5, msg: 'Initialising quality model…' },
        { pct: 15, msg: 'Analysing body geometry…' },
        { pct: 28, msg: 'Segmenting garment fabric…' },
        { pct: 42, msg: 'Running diffusion pass 1…' },
        { pct: 56, msg: 'Running diffusion pass 2…' },
        { pct: 68, msg: 'Upscaling details…' },
        { pct: 79, msg: 'Refining shadows & folds…' },
        { pct: 87, msg: 'Final quality check…' },
        { pct: 90, msg: 'Awaiting server render…' },
      ],
    };
    // ─────────────────────────────────────────────────────────────────────────

    // ── SHOW ─────────────────────────────────────────────────────────────────
    if (show) {
      if (document.getElementById('generating-overlay')) return;

      const overlay = document.createElement('div');
      overlay.id = 'generating-overlay';
      overlay.className = `generating-overlay generating-overlay--${model}`;
      overlay.innerHTML = `
        <div class="go-particles" id="go-particles"></div>
        <div class="go-content">
          <div class="go-logo">DripRig</div>
          <div class="go-badge ${cfg.badgeClass}">${cfg.badge}</div>
          <div class="go-ring-wrap">
            <svg class="go-ring" viewBox="0 0 120 120">
              <circle class="go-ring__track" cx="60" cy="60" r="52"/>
              <circle class="go-ring__fill" id="go-ring-fill" cx="60" cy="60" r="52"
                stroke-dasharray="326.7" stroke-dashoffset="326.7"
                style="stroke:${cfg.accentA}"/>
            </svg>
            <div class="go-pct" id="go-pct">0%</div>
          </div>
          <div class="go-step" id="go-step">${cfg.steps[0].msg}</div>
          <div class="go-bar-wrap">
            <div class="go-bar" id="go-bar" style="background:linear-gradient(90deg,${cfg.accentA},${cfg.accentB})"></div>
          </div>
          <div class="go-eta" id="go-eta">~${isFast ? '35' : '60'}s remaining</div>
        </div>
      `;
      document.body.appendChild(overlay);

      // ── Animate floating particles ──────────────────────────────────────
      const particlesEl = overlay.querySelector('#go-particles');
      for (let i = 0; i < 18; i++) {
        const p = document.createElement('div');
        p.className = 'go-particle';
        const size = 3 + Math.random() * 5;
        p.style.cssText = [
          `width:${size}px`, `height:${size}px`,
          `left:${Math.random() * 100}%`,
          `animation-delay:${Math.random() * 4}s`,
          `animation-duration:${3 + Math.random() * 4}s`,
          `background:${Math.random() > 0.5 ? cfg.accentA : cfg.accentB}`,
          `opacity:${0.3 + Math.random() * 0.5}`,
        ].join(';');
        particlesEl.appendChild(p);
      }

      // ── Smart progress: animate to 90% over `duration`, then hold ──────
      const ringFill = overlay.querySelector('#go-ring-fill');
      const pctEl = overlay.querySelector('#go-pct');
      const stepEl = overlay.querySelector('#go-step');
      const barEl = overlay.querySelector('#go-bar');
      const etaEl = overlay.querySelector('#go-eta');
      const CIRCUMFERENCE = 326.7;
      const start = Date.now();
      let stepIdx = 0;
      this._loadingDone = false;

      const tick = () => {
        if (this._loadingDone) return; // stop when complete
        const elapsed = Date.now() - start;
        // Ease-out curve: fast at start, crawls near 90%
        const raw = Math.min(elapsed / cfg.duration, 1);
        const eased = 1 - Math.pow(1 - raw, 2.8);
        const pct = Math.floor(eased * 90); // max 90 until real done

        // ring
        const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
        if (ringFill) ringFill.style.strokeDashoffset = offset;
        if (pctEl) pctEl.textContent = `${pct}%`;
        if (barEl) barEl.style.width = `${pct}%`;

        // step messages
        const nextStep = cfg.steps.findIndex(s => s.pct > pct);
        const curIdx = nextStep === -1 ? cfg.steps.length - 1 : Math.max(0, nextStep - 1);
        if (curIdx !== stepIdx) {
          stepIdx = curIdx;
          if (stepEl) {
            stepEl.style.opacity = '0';
            setTimeout(() => {
              if (stepEl) stepEl.textContent = cfg.steps[curIdx].msg;
              if (stepEl) stepEl.style.opacity = '1';
            }, 200);
          }
        }

        // ETA countdown
        const secLeft = Math.max(0, Math.round((cfg.duration - elapsed) / 1000));
        if (etaEl) etaEl.textContent = pct >= 90 ? 'Finalising…' : `~${secLeft}s remaining`;

        this._loadingRAF = requestAnimationFrame(tick);
      };
      this._loadingRAF = requestAnimationFrame(tick);

      return; // show path ends here
    }

    // ── HIDE — snap to 100% then fade out ────────────────────────────────
    return new Promise(resolve => {
      this._loadingDone = true;
      if (this._loadingRAF) cancelAnimationFrame(this._loadingRAF);

      const overlay = document.getElementById('generating-overlay');
      if (!overlay) { resolve(); return; }

      const ringFill = overlay.querySelector('#go-ring-fill');
      const pctEl = overlay.querySelector('#go-pct');
      const barEl = overlay.querySelector('#go-bar');
      const stepEl = overlay.querySelector('#go-step');
      const etaEl = overlay.querySelector('#go-eta');
      const CIRCUMFERENCE = 326.7;

      // Snap to 100%
      if (ringFill) { ringFill.style.transition = 'stroke-dashoffset 0.6s ease'; ringFill.style.strokeDashoffset = '0'; }
      if (pctEl) pctEl.textContent = '100%';
      if (barEl) { barEl.style.transition = 'width 0.6s ease'; barEl.style.width = '100%'; }
      if (stepEl) stepEl.textContent = '✓ Rig complete!';
      if (etaEl) etaEl.textContent = 'Done!';

      // Fade out after brief celebration
      setTimeout(() => {
        overlay.style.transition = 'opacity 0.5s ease';
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.remove(); resolve(); }, 500);
      }, 700);
    });
  }

  mount(parent) {
    if (!this.el) this.render();
    parent.appendChild(this.el);
  }

  unmount() {
    if (this.el) this.el.remove();
  }
}

