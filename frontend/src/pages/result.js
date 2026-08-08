/**
 * DripRig — Result Page
 * Shows the generated outfit composite with download, share, and redo actions.
 */

export class ResultPage {
  constructor({ onTryAgain } = {}) {
    this.onTryAgain = onTryAgain || (() => {});
    this.el = null;
    this.data = null;
  }

  render(data) {
    this.data = data;

    const page = document.createElement('div');
    page.id = 'page-result';
    page.className = 'page page--active result-page';

    // Page header
    const header = document.createElement('div');
    header.className = 'page-header slide-up';
    header.innerHTML = `
      <h2 class="page-header__title">Your Rig</h2>
      <p class="page-header__sub">Fresh drop — locked and loaded.</p>
    `;
    page.appendChild(header);

    // Result image
    const imgWrap = document.createElement('div');
    imgWrap.className = 'result-image-wrap animate-result-glow slide-up delay-100';

    const img = document.createElement('img');
    img.src = data.result_url;
    img.alt = 'Generated outfit composite';
    img.loading = 'eager';

    // Success badge
    const badge = document.createElement('div');
    badge.className = 'result-badge';
    badge.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:14px;font-variation-settings:'FILL' 1">check_circle</span>
      <span>Rig Generated</span>
    `;

    imgWrap.appendChild(img);
    imgWrap.appendChild(badge);
    page.appendChild(imgWrap);

    // Meta info strip
    const timeInSeconds = data.processing_time_ms ? (data.processing_time_ms / 1000).toFixed(1) : '—';
    const meta = document.createElement('div');
    meta.className = 'result-meta slide-up delay-200';
    meta.style.justifyContent = 'center'; // Center the single remaining stat
    meta.innerHTML = `
      <div class="result-meta__item" style="align-items: center">
        <span class="result-meta__label">Render Time</span>
        <span class="result-meta__value">${timeInSeconds}s</span>
      </div>
    `;
    page.appendChild(meta);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'result-actions slide-up delay-300';

    // Save to Firebase button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-primary';
    saveBtn.id = 'btn-save-firebase';
    saveBtn.style.background = 'linear-gradient(135deg, var(--primary) 0%, #ff8c00 100%)';
    saveBtn.innerHTML = `
      <span class="material-symbols-outlined">bookmark_add</span>
      <span>Save Look</span>
    `;
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      try {
        const { saveLookToFirestore } = await import('../services/savedLooksService.js');
        const { showToast } = await import('../main.js');
        await saveLookToFirestore(data);
        showToast('Saved to your collection!', 'success');
        saveBtn.innerHTML = `<span class="material-symbols-outlined">bookmark_added</span><span>Saved!</span>`;
      } catch (err) {
        const { showToast } = await import('../main.js');
        showToast(err.message || 'Failed to save look.', 'error');
        saveBtn.disabled = false;
      }
    });

    // Download button
    const downloadBtn = document.createElement('a');
    downloadBtn.href = data.result_url;
    downloadBtn.download = 'driprig-outfit.jpg';
    downloadBtn.className = 'btn-secondary';
    downloadBtn.id = 'btn-download';
    downloadBtn.innerHTML = `
      <span class="material-symbols-outlined">download</span>
      <span>Download</span>
    `;

    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn-secondary';
    shareBtn.id = 'btn-share';
    shareBtn.innerHTML = `
      <span class="material-symbols-outlined">share</span>
      <span>Share</span>
    `;
    shareBtn.addEventListener('click', () => this._handleShare(data.result_url));

    actions.appendChild(saveBtn);
    actions.appendChild(downloadBtn);
    actions.appendChild(shareBtn);
    page.appendChild(actions);


    // Try Again CTA
    const tryAgainWrap = document.createElement('div');
    tryAgainWrap.className = 'cta-wrap slide-up delay-400';
    const tryAgainBtn = document.createElement('button');
    tryAgainBtn.id = 'btn-try-again';
    tryAgainBtn.className = 'btn-shimmer';
    tryAgainBtn.innerHTML = `
      <span>Rebuild Rig</span>
      <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">refresh</span>
    `;
    tryAgainBtn.addEventListener('click', () => this.onTryAgain());
    tryAgainWrap.appendChild(tryAgainBtn);
    page.appendChild(tryAgainWrap);

    this.el = page;
    return page;
  }

  _ratingFromCount(count) {
    const ratings = { 1: 'WEAK', 2: 'DECENT', 3: 'SOLID', 4: 'ELITE' };
    return ratings[count] || 'N/A';
  }

  async _handleShare(url) {
    const fullUrl = `${window.location.origin}${url}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My DripRig Fit',
          text: 'Check out my fit from DripRig 🔥',
          url: fullUrl,
        });
      } catch (err) {
        if (err.name !== 'AbortError') this._copyToClipboard(fullUrl);
      }
    } else {
      this._copyToClipboard(fullUrl);
    }
  }

  _copyToClipboard(text) {
    navigator.clipboard?.writeText(text).then(() => {
      import('../main.js').then(({ showToast }) => showToast('Link copied to clipboard!', 'success'));
    }).catch(() => {
      import('../main.js').then(({ showToast }) => showToast('Could not copy link.', 'error'));
    });
  }

  mount(parent, data) {
    this.render(data);
    parent.appendChild(this.el);
  }

  unmount() {
    if (this.el) this.el.remove();
  }
}
