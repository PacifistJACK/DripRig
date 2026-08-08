/**
 * DripRig — Saved Looks Gallery Modal
 * Displays a grid of user's saved outfit looks from Firebase Firestore.
 */
import { getUserSavedLooks, deleteSavedLook } from '../services/savedLooksService.js';
import { showToast } from '../main.js';

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
          <p style="margin-top: 0.5rem;">Loading your saved looks from Firebase...</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#btn-close-saved')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Load looks from Firestore
  const gridEl = overlay.querySelector('#saved-looks-grid');
  const looks = await getUserSavedLooks();

  if (!looks || looks.length === 0) {
    gridEl.innerHTML = `
      <div style="text-align: center; color: var(--on-surface-variant); padding: 3rem 1rem;">
        <span class="material-symbols-outlined" style="font-size: 3rem; color: rgba(255,184,0,0.3); margin-bottom: 0.5rem;">checkroom</span>
        <h4 style="color: var(--on-surface); font-size: 1.1rem; margin-bottom: 0.25rem;">No Saved Looks Yet</h4>
        <p style="font-size: 0.85rem;">Generate an outfit and click "Save Look" to view your collection here!</p>
      </div>
    `;
    return;
  }

  gridEl.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem;">
      ${looks.map(look => `
        <div class="glass-card" style="position: relative; border-radius: 0.75rem; overflow: hidden; border: 1px solid rgba(255,184,0,0.2); background: rgba(0,0,0,0.3);">
          <img src="${look.resultUrl}" alt="Saved Look" style="width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block;" />
          <button data-id="${look.id}" class="btn-delete-look" style="position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.6); color: #ff4444; border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Delete look">
            <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
          </button>
        </div>
      `).join('')}
    </div>
  `;



  // Attach delete events
  gridEl.querySelectorAll('.btn-delete-look').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const lookId = btn.getAttribute('data-id');
      btn.closest('.glass-card')?.remove();
      try {
        await deleteSavedLook(lookId);
        showToast('Look removed from saved collection', 'info');
      } catch (err) {
        showToast('Failed to delete look', 'error');
      }
    });
  });
}
