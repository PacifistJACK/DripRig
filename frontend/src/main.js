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
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';
import { LoginPage } from './pages/login.js';

// ============================================================
// APP STATE
// ============================================================
const state = {
  currentPage: 'canvas',
  resultData: null,
  user: null,
  authInitialized: false,
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
    this.updateAuthView();
  }

  // ── Render Auth View or App Shell ─────────────────────────────────────────
  updateAuthView() {
    if (!state.user) {
      // User not logged in -> Render mandatory login screen
      this._shellBuilt = false;
      this.appEl.innerHTML = '';
      const loginPage = new LoginPage({
        onLoginSuccess: (user) => {
          state.user = user;
          this.updateAuthView();
        },
      });
      this.appEl.appendChild(loginPage.render());
      return;
    }

    // User logged in -> Build shell and navigate to current page
    this._buildShell();
    this.navigate(state.currentPage || 'canvas');
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
    if (!state.user) {
      this.updateAuthView();
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

    }
  }

  // ── User menu (Profile & Sign Out Dropdown) ────────────────────────────────
  _showUserMenu() {
    document.getElementById('user-menu')?.remove();

    const user = state.user;
    if (!user) return;

    const menu = document.createElement('div');
    menu.id = 'user-menu';
    menu.className = 'user-menu glass-card';

    const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
    const avatarHtml = user.photoURL
      ? `<img class="user-menu__avatar" src="${user.photoURL}" alt="${user.displayName || 'User'}" />`
      : `<div class="user-menu__avatar user-menu__avatar--placeholder">${initial}</div>`;

    menu.innerHTML = `
      <div class="user-menu__profile">
        ${avatarHtml}
        <div>
          <div class="user-menu__name">${user.displayName || 'User'}</div>
          <div class="user-menu__email">${user.email || ''}</div>
        </div>
      </div>
      <hr class="user-menu__divider" />
      <button class="user-menu__item" id="btn-saved-looks">
        <span class="material-symbols-outlined">bookmark</span>
        <span>Saved Looks</span>
      </button>
      <button class="user-menu__item user-menu__item--danger" id="btn-logout">
        <span class="material-symbols-outlined">logout</span>
        <span>Sign Out</span>
      </button>
    `;

    document.body.appendChild(menu);

    menu.querySelector('#btn-saved-looks')?.addEventListener('click', () => {
      menu.remove();
      showToast('Saved looks coming soon!', 'info');
    });

    menu.querySelector('#btn-logout')?.addEventListener('click', async () => {
      menu.remove();
      try {
        await signOut(auth);
        showToast('Signed out successfully', 'info');
      } catch (err) {
        showToast('Failed to sign out', 'error');
      }
    });

    // Close on outside click
    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
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

  // Subscribe to Firebase Auth state changes
  onAuthStateChanged(auth, (user) => {
    state.user = user;
    state.authInitialized = true;
    router.updateAuthView();
    if (user) {
      console.info(`[DripRig Auth] User signed in: ${user.email}`);
    } else {
      console.info('[DripRig Auth] No user signed in');
    }
  });

  console.info('%c DripRig v0.2 ', 'background:#ffb800;color:#000;font-weight:bold;padding:2px 6px;border-radius:2px;');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}




