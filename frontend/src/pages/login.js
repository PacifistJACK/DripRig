/**
 * DripRig — Login Page
 * Google Sign-In only.
 */
import { signInWithGoogle } from '../services/firebase.js';

export class LoginPage {
  constructor({ onAuthSuccess } = {}) {
    this.onAuthSuccess = onAuthSuccess || (() => {});
    this.el = null;
  }

  render() {
    const page = document.createElement('div');
    page.id = 'page-login';
    page.className = 'login-page';

    page.innerHTML = `
      <div class="login-glow"></div>

      <div class="login-card glass-card">
        <div class="login-logo">
          <img src="/logo.jpg" alt="DripRig Logo" style="width: 48px; height: 48px; border-radius: 8px; object-fit: contain;">
          <span class="login-logo__text">DRIPRIG</span>
        </div>
        <p class="login-tagline">AI Virtual Try-On — See it before you wear it.</p>

        <div class="auth-error" id="auth-error" style="display:none"></div>

        <button class="btn-google btn-google--large" id="btn-google">
          <svg class="btn-google__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p class="login-footer">By continuing you agree to our Terms of Service.</p>
      </div>
    `;

    this.el = page;
    this._attachEvents();
    return page;
  }

  _attachEvents() {
    this.el.querySelector('#btn-google').addEventListener('click', async () => {
      this._setLoading(true);
      this._clearError();
      try {
        await signInWithGoogle();
      } catch (err) {
        if (err.code !== 'auth/popup-closed-by-user') {
          this._showError('Sign-in failed. Please try again.');
        }
      } finally {
        this._setLoading(false);
      }
    });
  }

  _showError(msg) {
    const el = this.el.querySelector('#auth-error');
    el.textContent = msg;
    el.style.display = 'block';
  }

  _clearError() {
    const el = this.el.querySelector('#auth-error');
    el.style.display = 'none';
  }

  _setLoading(loading) {
    const btn = this.el.querySelector('#btn-google');
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.6' : '';
  }

  mount(parent) {
    if (!this.el) this.render();
    parent.appendChild(this.el);
  }

  unmount() {
    if (this.el) this.el.remove();
  }
}
