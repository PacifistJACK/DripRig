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

// ============================================================
// APP STATE
// ============================================================
const state = {
  currentPage: null,
  resultData: null,
  user: null,
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
    this.navigate('canvas');
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

  // ── User menu (Google Auth Dropdown) ──────────────────────────────────────
  _showUserMenu() {
    // Remove existing menu
    document.getElementById('user-menu')?.remove();

    const menu = document.createElement('div');
    menu.id = 'user-menu';
    menu.className = 'user-menu glass-card';

    const user = state.user;

    if (user) {
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
    } else {
      menu.innerHTML = `
        <div class="user-menu__profile">
          <div>
            <div class="user-menu__name">Welcome to DripRig</div>
            <div class="user-menu__email">Sign in to save your looks</div>
          </div>
        </div>
        <hr class="user-menu__divider" />
        <button class="btn-google" id="btn-google-login">
          <svg class="btn-google__icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Sign in with Google</span>
        </button>
      `;
    }

    document.body.appendChild(menu);

    // Event handlers
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

    menu.querySelector('#btn-google-login')?.addEventListener('click', async () => {
      menu.remove();
      try {
        const res = await signInWithPopup(auth, googleProvider);
        showToast(`Welcome, ${res.user.displayName || 'User'}!`, 'success');
      } catch (err) {
        console.error('Google Sign In Error:', err);
        if (err.code !== 'auth/popup-closed-by-user') {
          showToast('Google Sign In failed. Please try again.', 'error');
        }
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
  router.init();

  // Subscribe to Firebase Auth state changes
  onAuthStateChanged(auth, (user) => {
    state.user = user;
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




