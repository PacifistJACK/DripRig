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
    this.onGenerateResult = onGenerateResult || (() => {});
    this.slots = {};
    this.filledCount = 0;
    this.el = null;
    this._rigId = this._generateRigId();
    this.selectedModel = 'fast'; // 'fast' | 'quality'
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
          onError:  (msg) => showToast(msg, 'error'),
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
    modelWrap.className = 'model-selector slide-up delay-350';
    modelWrap.innerHTML = `
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
    `;
    page.appendChild(modelWrap);

    modelWrap.querySelectorAll('.model-selector__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedModel = btn.dataset.model;
        modelWrap.querySelectorAll('.model-selector__btn').forEach(b =>
          b.classList.toggle('model-selector__btn--active', b === btn)
        );
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
    page.appendChild(ctaWrap);

    this.el = page;

    // Init particles after DOM is ready
    requestAnimationFrame(() => {
      setTimeout(() => initParticles('particles-js'), 100);
    });

    return page;
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

    // Send both slots to the backend
    const payload = {
      person: personFilename,
      outfit: outfitFilename,
      model: this.selectedModel,
    };

    this._showGeneratingOverlay(true);

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
      this._showGeneratingOverlay(false);

      // Map model keys to display names
      const MODEL_NAMES = { fast: 'Fast (sm4ll-VTON)', quality: 'Quality (WeShopAI)', mock: 'Mock' };
      const requestedName = MODEL_NAMES[this.selectedModel] || this.selectedModel;
      const usedName = MODEL_NAMES[data.model_used] || data.model_used;

      if (data.model_used === 'mock') {
        showToast('⚠️ All engines are busy — showing placeholder. Try again later!', 'error');
      } else if (data.model_used && data.model_used.toLowerCase() !== this.selectedModel) {
        showToast(`⚡ ${requestedName} was unavailable — switched to ${usedName} automatically.`, 'info');
      }

      this.onGenerateResult(data);
    } catch (err) {
      this._showGeneratingOverlay(false);
      showToast(`Something went wrong — try a different engine! (${err.message || 'Generation failed'})`, 'error');
    }
  }

  _showGeneratingOverlay(show) {
    let overlay = document.getElementById('generating-overlay');

    if (show) {
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.id = 'generating-overlay';
      overlay.className = 'generating-overlay';
      overlay.innerHTML = `
        <div class="generating-spinner"></div>
        <div class="generating-overlay__logo">DripRig</div>
        <span class="generating-overlay__text">Constructing your rig…</span>
      `;
      document.body.appendChild(overlay);

      const texts = [
        'Constructing your rig…',
        'Aligning components…',
        'Rendering the fit…',
        'Almost there…',
      ];
      let i = 0;
      this._loadingTextInterval = setInterval(() => {
        i = (i + 1) % texts.length;
        const span = overlay?.querySelector('.generating-overlay__text');
        if (span) span.textContent = texts[i];
      }, 1200);
    } else {
      if (overlay) overlay.remove();
      if (this._loadingTextInterval) {
        clearInterval(this._loadingTextInterval);
        this._loadingTextInterval = null;
      }
    }
  }

  mount(parent) {
    if (!this.el) this.render();
    parent.appendChild(this.el);
  }

  unmount() {
    if (this.el) this.el.remove();
  }
}

