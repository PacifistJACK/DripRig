/**
 * DripRig — Mandatory Login Page Component
 * Full-screen Google Authentication gate for accessing the application.
 */
import { auth, googleProvider, signInWithPopup } from '../firebase.js';
import { showToast } from '../main.js';

export class LoginPage {
  constructor({ onLoginSuccess } = {}) {
    this.onLoginSuccess = onLoginSuccess;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'login-page animate-fade-in';
    container.id = 'login-page';
    container.innerHTML = `
      <div class="login-glow"></div>
      <div class="login-card glass-card">
        <div class="login-logo">
          <span class="material-symbols-outlined login-logo__icon">checkroom</span>
          <h1 class="login-logo__text">DRIPRIG</h1>
        </div>
        <p class="login-tagline">Virtual Try-On — Sign in to create your rig & save your looks</p>

        <button class="btn-google btn-google--large" id="login-btn-google">
          <svg class="btn-google__icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <div class="login-footer">Protected by DripRig AI & Firebase Security</div>
      </div>
    `;

    const btn = container.querySelector('#login-btn-google');
    btn?.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await signInWithPopup(auth, googleProvider);
        showToast(`Welcome, ${res.user.displayName || 'User'}!`, 'success');
        if (this.onLoginSuccess) {
          this.onLoginSuccess(res.user);
        }
      } catch (err) {
        console.error('[DripRig Login Error]', err);
        if (err.code === 'auth/unauthorized-domain') {
          showToast('Domain not authorized in Firebase Console! Please add domain in Authorized Domains.', 'error');
        } else if (err.code !== 'auth/popup-closed-by-user') {
          showToast(`Google Sign In error (${err.code || 'failed'})`, 'error');
        }
      } finally {
        btn.disabled = false;
      }
    });

    return container;
  }
}
