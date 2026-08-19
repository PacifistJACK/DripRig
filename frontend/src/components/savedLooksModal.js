/**
 * DripRig — Saved Looks Gallery Modal
 * Displays a grid of user's saved outfit looks from Firebase Firestore.
 * Tap any look to open a full-screen lightbox with Download & Share actions.
 */
import { getUserSavedLooks, deleteSavedLook } from '../services/savedLooksService.js';
import { showToast } from '../main.js';

// ── Lightbox ──────────────────────────────────────────────────────────────────
function openLightbox(imgSrc, lookId) {
  document.getElementById('look-lightbox')?.remove();

  const lb = document.createElement('div');
  lb.id = 'look-lightbox';
  lb.className = 'look-lightbox animate-fade-in';
  lb.innerHTML = `
    <div class="look-lightbox__backdrop"></div>
    <div class="look-lightbox__panel animate-slide-up">

      <!-- Header bar -->
      <div class="look-lightbox__header">
        <span class="look-lightbox__title">
          <span class="material-symbols-outlined" style="color:var(--color-amber);font-size:18px;">bookmark</span>
          Saved Look
        </span>
        <button class="look-lightbox__close" id="lb-close" aria-label="Close">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Image -->
      <div class="look-lightbox__img-wrap">
        <img class="look-lightbox__img" src="${imgSrc}" alt="Saved outfit look" />
        <div class="result-badge" style="top:12px;left:12px;">
          <span class="material-symbols-outlined" style="font-size:14px;font-variation-settings:'FILL' 1">bookmark</span>
          <span>Saved Look</span>
        </div>
      </div>

      <!-- Actions: Download + Share row, then Delete full-width -->
      <div class="lightbox-actions">
        <div class="lightbox-actions__row">
          <a
            id="lb-download"
            href="${imgSrc}"
            download="driprig-look.jpg"
            class="btn-secondary btn-secondary--download"
            title="Download"
          >
            <span class="material-symbols-outlined">download</span>
            <span>Download</span>
          </a>
          <button id="lb-share" class="btn-secondary btn-secondary--share" title="Share">
            <span class="material-symbols-outlined">share</span>
            <span>Share</span>
          </button>
        </div>
        <button id="lb-delete" class="btn-secondary btn-secondary--danger lightbox-actions__delete" title="Delete look" data-id="${lookId}">
          <span class="material-symbols-outlined">delete</span>
          <span>Remove from saved looks</span>
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(lb);

  // Close on backdrop click or close button
  const close = () => lb.remove();
  lb.querySelector('#lb-close').addEventListener('click', close);
  lb.querySelector('.look-lightbox__backdrop').addEventListener('click', close);

  // Share
  lb.querySelector('#lb-share').addEventListener('click', async () => {
    const fullUrl = imgSrc.startsWith('http') ? imgSrc : `${window.location.origin}${imgSrc}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My DripRig Fit', text: 'Check out my fit from DripRig 🔥', url: fullUrl });
      } catch (err) {
        if (err.name !== 'AbortError') _copyToClipboard(fullUrl);
      }
    } else {
      _copyToClipboard(fullUrl);
    }
  });

  // Delete
  lb.querySelector('#lb-delete').addEventListener('click', async (e) => {
    const id = e.currentTarget.dataset.id;
    lb.remove();
    // Remove card from grid
    document.querySelector(`.btn-delete-look[data-id="${id}"]`)?.closest('.saved-look-card')?.remove();
    try {
      await deleteSavedLook(id);
      showToast('Look removed from saved collection', 'info');
    } catch {
      showToast('Failed to delete look', 'error');
    }
  });
}

function _copyToClipboard(text) {
  navigator.clipboard?.writeText(text).then(() => {
    showToast('Link copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Could not copy link.', 'error');
  });
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export async function openSavedLooksModal() {
  document.getElementById('saved-looks-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'saved-looks-modal';
  overlay.className = 'ping-modal-overlay animate-fade-in';
  overlay.innerHTML = `
    <div class="ping-modal glass-card animate-slide-up" style="max-width: 600px; width: 90%; max-height: 85vh; display: flex; flex-direction: column;">
      <div class="ping-modal__header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="material-symbols-outlined" style="color: var(--primary);">bookmark</span>
          <h3 class="ping-modal__title">Your Saved Looks</h3>
        </div>
        <button class="ping-modal__close" id="btn-close-saved">&times;</button>
      </div>

      <div class="ping-modal__body" id="saved-looks-grid" style="flex: 1; overflow-y: auto; padding: 1rem 0;">
        <div style="text-align: center; color: var(--on-surface-variant); padding: 2rem;">
          <span class="material-symbols-outlined spin" style="font-size: 2rem; color: var(--primary);">sync</span>
          <p style="margin-top: 0.5rem;">Loading your saved looks…</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#btn-close-saved')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Load looks from Firestore
  const gridEl = overlay.querySelector('#saved-looks-grid');
  const looks = await getUserSavedLooks();

  if (!looks || looks.length === 0) {
    gridEl.innerHTML = `
      <div style="text-align: center; color: var(--on-surface-variant); padding: 3rem 1rem;">
        <span class="material-symbols-outlined" style="font-size: 3rem; color: rgba(255,184,0,0.3); margin-bottom: 0.5rem; display:block;">checkroom</span>
        <h4 style="color: var(--on-surface); font-size: 1.1rem; margin-bottom: 0.25rem;">No Saved Looks Yet</h4>
        <p style="font-size: 0.85rem;">Generate an outfit and click "Save Look" to view your collection here!</p>
      </div>
    `;
    return;
  }

  gridEl.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem;">
      ${looks.map(look => {
        let imgSrc = look.resultUrl || '';
        if (imgSrc && !imgSrc.startsWith('data:image') && !imgSrc.startsWith('http://') && !imgSrc.startsWith('https://') && !imgSrc.startsWith('/')) {
          imgSrc = `/${imgSrc}`;
        }
        return `
        <div class="glass-card saved-look-card" style="position: relative; border-radius: 0.75rem; overflow: hidden; border: 1px solid rgba(255,184,0,0.2); background: rgba(0,0,0,0.3); cursor: pointer;" data-src="${imgSrc}" data-id="${look.id}">
          <img src="${imgSrc}" alt="Saved Look" style="width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; pointer-events: none;" onerror="this.onerror=null; this.src='/static/placeholder.jpg';" />

          <!-- Hover overlay hint -->
          <div class="saved-look-card__hover" style="position:absolute;inset:0;background:rgba(0,0,0,0.55);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;opacity:0;transition:opacity 0.2s ease;pointer-events:none;">
            <span class="material-symbols-outlined" style="font-size:28px;color:#fff;">open_in_full</span>
            <span style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#fff;">View</span>
          </div>

          <!-- Delete button -->
          <button data-id="${look.id}" class="btn-delete-look" style="position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.7); color: #ff4444; border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index:10; opacity:0; transition: opacity 0.2s ease;" title="Delete look">
            <span class="material-symbols-outlined" style="font-size: 16px; pointer-events:none;">delete</span>
          </button>
        </div>
      `}).join('')}
    </div>
  `;

  // Show delete & hover overlay on card hover
  gridEl.querySelectorAll('.saved-look-card').forEach(card => {
    const hoverEl = card.querySelector('.saved-look-card__hover');
    const delBtn  = card.querySelector('.btn-delete-look');

    card.addEventListener('mouseenter', () => {
      if (hoverEl) hoverEl.style.opacity = '1';
      if (delBtn)  delBtn.style.opacity  = '1';
    });
    card.addEventListener('mouseleave', () => {
      if (hoverEl) hoverEl.style.opacity = '0';
      if (delBtn)  delBtn.style.opacity  = '0';
    });

    // Open lightbox on card click (but not delete btn)
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete-look')) return;
      const src = card.dataset.src;
      const id  = card.dataset.id;
      openLightbox(src, id);
    });
  });

  // Delete events
  gridEl.querySelectorAll('.btn-delete-look').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const lookId = btn.getAttribute('data-id');
      btn.closest('.saved-look-card')?.remove();
      try {
        await deleteSavedLook(lookId);
        showToast('Look removed from saved collection', 'info');
      } catch {
        showToast('Failed to delete look', 'error');
      }
    });
  });
}
