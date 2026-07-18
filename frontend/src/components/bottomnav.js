/**
 * DripRig — Bottom Navigation Component
 */

const NAV_ITEMS = [
  { id: 'nav-explore', icon: 'explore',    label: 'Explore',  page: 'explore' },
  { id: 'nav-canvas',  icon: 'grid_view',  label: 'Rig',      page: 'canvas'  },
  { id: 'nav-saved',   icon: 'favorite',   label: 'Saved',    page: 'saved'   },
  { id: 'nav-profile', icon: 'person',     label: 'Profile',  page: 'profile' },
];

export class BottomNav {
  constructor({ onNavigate } = {}) {
    this.onNavigate = onNavigate || (() => {});
    this.activeId = 'nav-canvas';
    this.el = this._render();
  }

  _render() {
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('aria-label', 'Main navigation');

    NAV_ITEMS.forEach(({ id, icon, label, page }) => {
      const btn = document.createElement('button');
      btn.id = id;
      btn.className = `bottom-nav__item${id === this.activeId ? ' bottom-nav__item--active' : ''}`;
      btn.setAttribute('aria-label', label);
      btn.innerHTML = `
        <span class="material-symbols-outlined" style="font-variation-settings:'FILL' ${id === this.activeId ? '1' : '0'}">${icon}</span>
        <span>${label}</span>
      `;
      btn.addEventListener('click', () => this._navigate(id, page));
      nav.appendChild(btn);
    });

    return nav;
  }

  _navigate(id, page) {
    if (id === this.activeId) return;

    // Update styles
    this.el.querySelectorAll('.bottom-nav__item').forEach((btn) => {
      const isActive = btn.id === id;
      btn.classList.toggle('bottom-nav__item--active', isActive);
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.style.fontVariationSettings = `'FILL' ${isActive ? '1' : '0'}`;
      }
    });

    this.activeId = id;
    this.onNavigate(page);
  }

  setActive(page) {
    const item = NAV_ITEMS.find((i) => i.page === page);
    if (item) this._navigate(item.id, page);
  }

  mount(parent) {
    parent.appendChild(this.el);
  }
}
