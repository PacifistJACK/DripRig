/**
 * DripRig — Admin Dashboard Page
 * Only accessible to users with the Firebase 'admin' custom claim.
 * Shows: all registered users + their stats, and a feed of recent AI generations.
 */
import { authFetch } from '../services/firebase.js';
import { showToast } from '../main.js';

export class AdminPage {
  constructor({ onBack } = {}) {
    this.onBack = onBack || (() => {});
    this.el = null;
  }

  render() {
    const page = document.createElement('div');
    page.id = 'page-admin';
    page.className = 'page page--active page-content admin-page';

    page.innerHTML = `
      <div class="admin-header slide-up">
        <button class="admin-back-btn" id="admin-back">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h2 class="admin-header__title">
            <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;color:var(--color-amber)">admin_panel_settings</span>
            Owner Dashboard
          </h2>
          <p class="admin-header__sub">All users and their generated outfits</p>
        </div>
        <button class="admin-refresh-btn" id="admin-refresh" title="Refresh">
          <span class="material-symbols-outlined">refresh</span>
        </button>
      </div>

      <!-- Stats summary row -->
      <div class="admin-stats-row slide-up delay-100" id="admin-stats">
        <div class="admin-stat-card glass-card">
          <span class="material-symbols-outlined admin-stat-card__icon" style="color:#6ee7f7">group</span>
          <div>
            <div class="admin-stat-card__value" id="stat-total-users">—</div>
            <div class="admin-stat-card__label">Total Users</div>
          </div>
        </div>
        <div class="admin-stat-card glass-card">
          <span class="material-symbols-outlined admin-stat-card__icon" style="color:#ffb800">auto_awesome</span>
          <div>
            <div class="admin-stat-card__value" id="stat-total-gens">—</div>
            <div class="admin-stat-card__label">Generations</div>
          </div>
        </div>
      </div>

      <!-- Recent Generations -->
      <section class="admin-section slide-up delay-200">
        <h3 class="admin-section__title">
          <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">image_search</span>
          Recent Generations
        </h3>
        <div class="admin-generations-grid" id="admin-gens-grid">
          <div class="admin-loading">
            <div class="generating-spinner" style="width:32px;height:32px"></div>
            <span>Loading generations…</span>
          </div>
        </div>
      </section>

      <!-- Users Table -->
      <section class="admin-section slide-up delay-300">
        <h3 class="admin-section__title">
          <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">manage_accounts</span>
          All Users
        </h3>
        <div class="admin-table-wrap">
          <table class="admin-table" id="admin-users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Generations</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody id="admin-users-body">
              <tr><td colspan="5" class="admin-loading">
                <div class="generating-spinner" style="width:24px;height:24px;display:inline-block"></div>
                Loading users…
              </td></tr>
            </tbody>
          </table>
        </div>
      </section>
    `;

    this.el = page;
    this._attachEvents();
    this._loadData();
    return page;
  }

  _attachEvents() {
    this.el.querySelector('#admin-back').addEventListener('click', () => this.onBack());
    this.el.querySelector('#admin-refresh').addEventListener('click', () => this._loadData());
  }

  async _loadData() {
    await Promise.all([
      this._loadGenerations(),
      this._loadUsers(),
    ]);
  }

  async _loadGenerations() {
    const grid = this.el.querySelector('#admin-gens-grid');
    try {
      const res = await authFetch('/api/admin/generations?limit=12');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // Update total stat
      const statEl = this.el.querySelector('#stat-total-gens');
      if (statEl) statEl.textContent = data.count;

      grid.innerHTML = '';
      if (data.generations.length === 0) {
        grid.innerHTML = '<p class="admin-empty">No generations yet.</p>';
        return;
      }

      data.generations.forEach(gen => {
        const card = document.createElement('div');
        card.className = 'admin-gen-card glass-card';
        const timeAgo = this._timeAgo(gen.createdAt?._seconds);
        card.innerHTML = `
          <div class="admin-gen-card__images">
            <img class="admin-gen-card__img" src="${gen.personUrl || ''}" alt="Person" loading="lazy" onerror="this.style.background='#333'"/>
            <span class="material-symbols-outlined admin-gen-card__plus">add</span>
            <img class="admin-gen-card__img" src="${gen.outfitUrl || ''}" alt="Outfit" loading="lazy" onerror="this.style.background='#333'"/>
            <span class="material-symbols-outlined admin-gen-card__arrow">arrow_forward</span>
            <img class="admin-gen-card__img admin-gen-card__img--result" src="${gen.resultUrl || ''}" alt="Result" loading="lazy" onerror="this.style.background='#333'"/>
          </div>
          <div class="admin-gen-card__meta">
            <span class="admin-gen-card__email">${gen.email || gen.uid?.slice(0, 8) + '…'}</span>
            <span class="admin-gen-card__time">${timeAgo}</span>
            <span class="admin-gen-card__perf">${((gen.processingTimeMs || 0) / 1000).toFixed(1)}s</span>
          </div>
        `;
        grid.appendChild(card);
      });
    } catch (err) {
      grid.innerHTML = `<p class="admin-error">Failed to load generations: ${err.message}</p>`;
    }
  }

  async _loadUsers() {
    const tbody = this.el.querySelector('#admin-users-body');
    try {
      const res = await authFetch('/api/admin/users');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // Update total stat
      const statEl = this.el.querySelector('#stat-total-users');
      if (statEl) statEl.textContent = data.total;

      tbody.innerHTML = '';
      if (data.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">No users yet.</td></tr>';
        return;
      }

      data.users.forEach(user => {
        const tr = document.createElement('tr');
        const joined = user.createdAt
          ? new Date(user.createdAt).toLocaleDateString()
          : '—';
        tr.innerHTML = `
          <td>
            <div class="admin-user-cell">
              ${user.photoURL
                ? `<img class="admin-user-avatar" src="${user.photoURL}" alt="" />`
                : `<div class="admin-user-avatar admin-user-avatar--placeholder">${(user.displayName || user.email || '?')[0].toUpperCase()}</div>`
              }
              <span>${user.displayName || '—'}</span>
            </div>
          </td>
          <td class="admin-cell-muted">${user.email}</td>
          <td class="admin-cell-muted">${joined}</td>
          <td><span class="admin-badge">${user.generationCount}</span></td>
          <td>${user.isAdmin ? '<span class="admin-badge admin-badge--admin">Admin</span>' : '<span class="admin-badge admin-badge--user">User</span>'}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-error">Failed to load users: ${err.message}</td></tr>`;
    }
  }

  _timeAgo(seconds) {
    if (!seconds) return '—';
    const diff = Math.floor(Date.now() / 1000) - seconds;
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  mount(parent) {
    if (!this.el) this.render();
    parent.appendChild(this.el);
  }

  unmount() {
    if (this.el) this.el.remove();
  }
}
