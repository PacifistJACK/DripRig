/**
 * DripRig — Application Bootstrap
 * Handles: shader init, routing, toast system, global auth state.
 */
import './styles/index.css';
import './styles/animations.css';

import { ShaderBackground } from './components/shader.js';
import { createHeader } from './components/header.js';
import { BottomNav } from './components/bottomnav.js';
import { CanvasPage } from './pages/canvas.js';
import { ResultPage } from './pages/result.js';
import { LoginPage } from './pages/login.js';
import { AdminPage } from './pages/admin.js';
import {
  initAuth,
  signOut,
  isCurrentUserAdmin,
} from './services/firebase.js';

// ============================================================
// TOAST SYSTEM (exported so pages can import it)
// ============================================================
let toastContainer = null;

export function showToast(message, type = 'info') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const icons = { error: 'error', success: 'check_circle', info: 'info' };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined toast__icon" style="font-variation-settings:'FILL' 1">${icons[type] || 'info'}</span>
    <span class="toast__msg">${message}</span>
  `;
  toastContainer.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('toast--exiting');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  const timer = setTimeout(dismiss, 3500);
  toast.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
}

// ============================================================
// APP STATE
// ============================================================
const state = {
  currentPage: null,
  resultData: null,
  currentUser: null,
  isAdmin: false,
};

// ============================================================
// ROUTER
// ============================================================
class Router {
  constructor(appEl) {
    this.appEl = appEl;
    this.currentPageEl = null;
    this.header = null;
    this.bottomNav = null;
    this.contentEl = null;
    this._shellBuilt = false;
  }

  init() {
    // Show login immediately; swap to app once auth resolves
    this._showLogin();
  }

  // ── Login (pre-auth) ─────────────────────────────────────────────────────
  _showLogin() {
    // Remove any existing shell
    this.appEl.innerHTML = '';
    this._shellBuilt = false;

    const loginPage = new LoginPage({
      onAuthSuccess: () => {}, // handled by auth state listener
    });
    loginPage.mount(this.appEl);
  }

  // ── App shell (post-auth) ─────────────────────────────────────────────────
  _buildShell() {
    if (this._shellBuilt) return;
    this.appEl.innerHTML = '';

    // Header
    this.header = createHeader({
      onMenuClick: () => this._showUserMenu(),
      onBookmarkClick: () => showToast('Saved looks coming soon!', 'info'),
    });
    this.appEl.appendChild(this.header);

    // Main content area
    this.contentEl = document.createElement('main');
    this.contentEl.id = 'main-content';
    this.contentEl.style.cssText = 'flex:1;display:flex;flex-direction:column;';
    this.appEl.appendChild(this.contentEl);

    // Bottom nav
    this.bottomNav = new BottomNav({
      onNavigate: (page) => {
        if (page === 'canvas') this.navigate('canvas');
        else showToast(`${page.charAt(0).toUpperCase() + page.slice(1)} coming soon!`, 'info');
      },
    });
    this.bottomNav.mount(this.appEl);

    this._shellBuilt = true;
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  navigate(page, data = null) {
    // Auth guard — redirect to login if not signed in
    if (!state.currentUser && page !== 'login') {
      this._showLogin();
      return;
    }

    // Admin guard — only admins can visit /admin
    if (page === 'admin' && !state.isAdmin) {
      showToast('Admin access required.', 'error');
      return;
    }

    this._buildShell();

    // Remove current page
    if (this.currentPageEl) {
      this.currentPageEl.remove();
      this.currentPageEl = null;
    }

    state.currentPage = page;

    if (page === 'canvas') {
      const canvasPage = new CanvasPage({
        onGenerateResult: (resultData) => {
          state.resultData = resultData;
          this.navigate('result', resultData);
        },
      });
      this.currentPageEl = canvasPage.render();
      this.contentEl.appendChild(this.currentPageEl);
      this.bottomNav?.setActive('canvas');

    } else if (page === 'result') {
      const resultPage = new ResultPage({
        onTryAgain: () => this.navigate('canvas'),
      });
      this.currentPageEl = resultPage.render(data || state.resultData);
      this.contentEl.appendChild(this.currentPageEl);

    } else if (page === 'admin') {
      const adminPage = new AdminPage({
        onBack: () => this.navigate('canvas'),
      });
      this.currentPageEl = adminPage.render();
      this.contentEl.appendChild(this.currentPageEl);
    }
  }

  // ── User menu (simple dropdown) ───────────────────────────────────────────
  _showUserMenu() {
    // Remove existing menu
    document.getElementById('user-menu')?.remove();

    const user = state.currentUser;
    const menu = document.createElement('div');
    menu.id = 'user-menu';
    menu.className = 'user-menu glass-card';
    menu.innerHTML = `
      <div class="user-menu__profile">
        ${user?.photoURL
          ? `<img class="user-menu__avatar" src="${user.photoURL}" alt=""/>`
          : `<div class="user-menu__avatar user-menu__avatar--placeholder">${(user?.displayName || user?.email || '?')[0].toUpperCase()}</div>`
        }
        <div>
          <div class="user-menu__name">${user?.displayName || 'User'}</div>
          <div class="user-menu__email">${user?.email || ''}</div>
        </div>
      </div>
      <hr class="user-menu__divider"/>
      ${state.isAdmin ? `<button class="user-menu__item" id="menu-admin">
        <span class="material-symbols-outlined">admin_panel_settings</span> Admin Dashboard
      </button>` : ''}
      <button class="user-menu__item user-menu__item--danger" id="menu-signout">
        <span class="material-symbols-outlined">logout</span> Sign Out
      </button>
    `;

    document.body.appendChild(menu);

    // Close on outside click
    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);

    menu.querySelector('#menu-signout')?.addEventListener('click', async () => {
      menu.remove();
      await signOut();
    });

    menu.querySelector('#menu-admin')?.addEventListener('click', () => {
      menu.remove();
      this.navigate('admin');
    });
  }

  // ── Auth state change ─────────────────────────────────────────────────────
  async onAuthStateChanged(user) {
    state.currentUser = user;

    if (user) {
      state.isAdmin = await isCurrentUserAdmin();
      this.navigate('canvas');
    } else {
      state.isAdmin = false;
      this._shellBuilt = false;
      this._showLogin();
    }
  }
}

// ============================================================
// INIT
// ============================================================
function bootstrap() {
  // Shader background
  const shaderBg = document.getElementById('shader-background');
  if (shaderBg) {
    const shader = new ShaderBackground('shader-background');
    shader.init();
  }

  const appEl = document.getElementById('app');
  if (!appEl) {
    console.error('[DripRig] #app element not found!');
    return;
  }

  const router = new Router(appEl);
  router.init();

  // Firebase Auth listener — drives all routing
  initAuth(async (user) => {
    await router.onAuthStateChanged(user);
  });

  console.info('%c DripRig v0.2 ', 'background:#ffb800;color:#000;font-weight:bold;padding:2px 6px;border-radius:2px;');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}




