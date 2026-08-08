/**
 * DripRig — Top App Bar Component
 */
export function createHeader({ onMenuClick, onBookmarkClick } = {}) {
  const header = document.createElement('header');
  header.className = 'top-bar';
  header.innerHTML = `
    <button class="top-bar__icon-btn" id="btn-menu" aria-label="Open menu">
      <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 0">menu</span>
    </button>
    <h1 class="top-bar__logo">DRIPRIG</h1>
    <button class="top-bar__icon-btn" id="btn-bookmark" aria-label="Saved looks">
      <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 0">bookmark</span>
    </button>
  `;

  header.querySelector('#btn-menu')?.addEventListener('click', onMenuClick || (() => {}));
  header.querySelector('#btn-bookmark')?.addEventListener('click', onBookmarkClick || (() => {}));

  return header;
}

