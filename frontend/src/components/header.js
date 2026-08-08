import { pingService } from '../services/pingService.js';
import { openPingModal } from './pingModal.js';

export function createHeader({ onMenuClick, onBookmarkClick } = {}) {
  const header = document.createElement('header');
  header.className = 'top-bar';
  header.innerHTML = `
    <button class="top-bar__icon-btn" id="btn-menu" aria-label="Open menu">
      <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 0">menu</span>
    </button>
    <div class="top-bar__center">
      <h1 class="top-bar__logo">DRIPRIG</h1>
      <button class="top-bar__ping-badge" id="btn-ping-status" title="Render Server Status & Keep-Alive">
        <span class="top-bar__ping-dot" id="header-ping-dot"></span>
        <span class="top-bar__ping-label" id="header-ping-label">LIVE</span>
      </button>
    </div>
    <button class="top-bar__icon-btn" id="btn-bookmark" aria-label="Saved looks">
      <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 0">bookmark</span>
    </button>
  `;

  header.querySelector('#btn-menu')?.addEventListener('click', onMenuClick || (() => {}));
  header.querySelector('#btn-bookmark')?.addEventListener('click', onBookmarkClick || (() => {}));

  const pingBtn = header.querySelector('#btn-ping-status');
  pingBtn?.addEventListener('click', () => openPingModal());

  // Subscribe header badge to pingService state updates
  pingService.subscribe((state) => {
    const dot = header.querySelector('#header-ping-dot');
    const label = header.querySelector('#header-ping-label');
    if (!dot || !label) return;

    if (state.status === 'online' || state.status === 'slow') {
      dot.className = 'top-bar__ping-dot top-bar__ping-dot--online';
      label.textContent = state.latencyMs != null ? `${state.latencyMs}ms` : 'LIVE';
    } else if (state.status === 'offline') {
      dot.className = 'top-bar__ping-dot top-bar__ping-dot--offline';
      label.textContent = 'OFFLINE';
    } else {
      dot.className = 'top-bar__ping-dot top-bar__ping-dot--idle';
      label.textContent = 'CONNECTING';
    }
  });

  return header;
}
