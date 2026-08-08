/**
 * DripRig — Secret Admin Vault Portal Page
 * Path: /#/admin/drip-vault-772/secure-view
 * Secret Admin portal to view user profiles and their uploaded Person, Cloth, and Saved Try-On images.
 */
import { db } from '../firebase.js';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { showToast } from '../main.js';

export class AdminPortalPage {
  constructor() {
    this.el = null;
    this.usersMap = {}; // { userId: { email, personPhotos: [], clothPhotos: [], savedLooks: [] } }
    this.selectedUserId = null;
    this.activeTab = 'person'; // 'person' | 'cloth' | 'saved'
  }

  render() {
    const page = document.createElement('div');
    page.id = 'page-admin-portal';
    page.className = 'page page--active admin-portal animate-fade-in';
    page.style.cssText = 'padding: 1.5rem 1rem 5rem 1rem; max-width: 1000px; margin: 0 auto; min-height: 100vh; color: var(--on-surface);';

    page.innerHTML = `
      <div class="admin-header glass-card" style="padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; border-radius: 1rem; display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba(255,184,0,0.3); background: rgba(15,15,15,0.85);">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="material-symbols-outlined" style="color: var(--color-amber); font-size: 2rem;">admin_panel_settings</span>
          <div>
            <h2 style="font-family: var(--font-display); font-size: 1.4rem; letter-spacing: -0.02em; margin: 0; color: var(--primary);">ADMIN VAULT</h2>
            <span style="font-size: 0.75rem; color: var(--on-surface-variant); font-family: monospace;">driprig.j4du.in/admin/drip-vault-772/secure-view</span>
          </div>
        </div>
        <button id="btn-refresh-admin" class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;">
          <span class="material-symbols-outlined" style="font-size: 16px;">refresh</span>
          <span>Refresh Data</span>
        </button>
      </div>

      <div id="admin-content-area" style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div style="text-align: center; padding: 4rem 1rem; color: var(--on-surface-variant);">
          <span class="material-symbols-outlined spin" style="font-size: 2.5rem; color: var(--primary);">sync</span>
          <p style="margin-top: 1rem;">Decrypting & loading user vaults from Firestore...</p>
        </div>
      </div>

      <!-- Lightbox Modal -->
      <div id="admin-lightbox" style="display: none; position: fixed; inset: 0; z-index: 999; background: rgba(0,0,0,0.92); backdrop-filter: blur(16px); align-items: center; justify-content: center; padding: 1.5rem;">
        <button id="btn-close-lightbox" style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.1); color: #fff; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
        <div style="max-width: 90vw; max-height: 85vh; text-align: center;">
          <img id="lightbox-img" src="" alt="Full Preview" style="max-width: 100%; max-height: 75vh; border-radius: 0.75rem; border: 1px solid rgba(255,184,0,0.4); box-shadow: 0 0 50px rgba(0,0,0,0.8); object-fit: contain;" />
          <div id="lightbox-caption" style="margin-top: 1rem; font-size: 0.9rem; color: var(--on-surface-variant); font-family: monospace;"></div>
          <a id="lightbox-download" href="" download class="btn-secondary" style="display: inline-flex; margin-top: 0.75rem; padding: 8px 16px; font-size: 0.8rem; text-decoration: none;">
            <span class="material-symbols-outlined" style="font-size: 16px;">download</span>
            <span>Download High-Res</span>
          </a>
        </div>
      </div>
    `;

    page.querySelector('#btn-refresh-admin')?.addEventListener('click', () => this.loadAdminData());
    page.querySelector('#btn-close-lightbox')?.addEventListener('click', () => {
      page.querySelector('#admin-lightbox').style.display = 'none';
    });
    page.querySelector('#admin-lightbox')?.addEventListener('click', (e) => {
      if (e.target.id === 'admin-lightbox') {
        page.querySelector('#admin-lightbox').style.display = 'none';
      }
    });

    this.el = page;
    this.loadAdminData();
    return page;
  }

  async loadAdminData() {
    const area = this.el.querySelector('#admin-content-area');
    area.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--on-surface-variant);">
        <span class="material-symbols-outlined spin" style="font-size: 2.5rem; color: var(--primary);">sync</span>
        <p style="margin-top: 1rem;">Decrypting & loading user vaults from Firestore...</p>
      </div>
    `;

    this.usersMap = {};

    try {
      // 1. Fetch admin_uploads (all person & cloth uploads)
      const uploadsRef = collection(db, 'admin_uploads');
      const uploadsQ = query(uploadsRef, orderBy('uploadedAt', 'desc'));
      const uploadsSnap = await getDocs(uploadsQ);

      uploadsSnap.docs.forEach(doc => {
        const d = doc.data();
        const uid = d.userId || 'anonymous';
        if (!this.usersMap[uid]) {
          this.usersMap[uid] = {
            id: uid,
            email: d.userEmail || 'Anonymous User',
            personPhotos: [],
            clothPhotos: [],
            savedLooks: [],
          };
        }
        if (d.personUrl) {
          this.usersMap[uid].personPhotos.push({ url: d.personUrl, date: d.uploadedAt });
        }
        if (d.outfitUrl) {
          this.usersMap[uid].clothPhotos.push({ url: d.outfitUrl, date: d.uploadedAt });
        }
      });

      // 2. Fetch saved_looks for each user by scanning user collections if available
      // Render Users view
      this.renderUsersView();
    } catch (err) {
      console.error('Admin Portal Error:', err);
      area.innerHTML = `
        <div class="glass-card" style="padding: 2rem; text-align: center; color: #ff5252; border-color: rgba(255,82,82,0.3);">
          <span class="material-symbols-outlined" style="font-size: 3rem;">error</span>
          <h4 style="margin-top: 0.5rem;">Failed to Load Admin Vault Data</h4>
          <p style="font-size: 0.85rem; color: var(--on-surface-variant);">${err.message || err}</p>
        </div>
      `;
    }
  }

  renderUsersView() {
    const area = this.el.querySelector('#admin-content-area');
    const uids = Object.keys(this.usersMap);

    if (uids.length === 0) {
      area.innerHTML = `
        <div class="glass-card" style="padding: 3rem; text-align: center; color: var(--on-surface-variant);">
          <span class="material-symbols-outlined" style="font-size: 3rem; color: rgba(255,184,0,0.3);">no_accounts</span>
          <h4 style="color: var(--on-surface); font-size: 1.1rem; margin-top: 0.5rem;">No User Activity Found</h4>
          <p style="font-size: 0.85rem;">Uploads will automatically appear here once users upload person or outfit photos.</p>
        </div>
      `;
      return;
    }

    if (!this.selectedUserId || !this.usersMap[this.selectedUserId]) {
      this.selectedUserId = uids[0];
    }

    const selectedUser = this.usersMap[this.selectedUserId];

    area.innerHTML = `
      <!-- User Selector Strip -->
      <div style="display: flex; gap: 0.75rem; overflow-x: auto; padding-bottom: 0.5rem; scrollbar-width: thin;">
        ${uids.map(uid => {
          const u = this.usersMap[uid];
          const isActive = uid === this.selectedUserId;
          const initial = (u.email || 'U').charAt(0).toUpperCase();
          return `
            <div data-uid="${uid}" class="btn-user-card glass-card" style="flex-shrink: 0; padding: 0.75rem 1.25rem; border-radius: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.75rem; border: 1px solid ${isActive ? 'var(--color-amber)' : 'rgba(255,255,255,0.08)'}; background: ${isActive ? 'rgba(255,184,0,0.12)' : 'rgba(20,20,20,0.6)'}; transition: all 0.2s;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--color-amber), var(--color-magenta)); color: #000; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                ${initial}
              </div>
              <div style="text-align: left;">
                <div style="font-weight: 700; font-size: 0.88rem; color: ${isActive ? 'var(--color-amber)' : 'var(--on-surface)'};">${u.email}</div>
                <div style="font-size: 0.72rem; color: var(--on-surface-variant);">${u.personPhotos.length} Person • ${u.clothPhotos.length} Cloth</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Selected User Vault Detail -->
      <div class="glass-card" style="padding: 1.5rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(18,18,18,0.75);">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
          <div>
            <h3 style="font-family: var(--font-display); font-size: 1.2rem; margin: 0; color: var(--on-surface);">${selectedUser.email}</h3>
            <span style="font-size: 0.75rem; color: var(--on-surface-variant); font-family: monospace;">UID: ${selectedUser.id}</span>
          </div>

          <!-- Sub-Division Tabs: Person | Cloth | Saved -->
          <div style="display: flex; gap: 0.5rem; background: rgba(0,0,0,0.4); padding: 4px; border-radius: 0.6rem; border: 1px solid rgba(255,255,255,0.08);">
            <button data-tab="person" class="btn-admin-tab ${this.activeTab === 'person' ? 'btn-admin-tab--active' : ''}">
              👤 Person (${selectedUser.personPhotos.length})
            </button>
            <button data-tab="cloth" class="btn-admin-tab ${this.activeTab === 'cloth' ? 'btn-admin-tab--active' : ''}">
              👕 Cloth (${selectedUser.clothPhotos.length})
            </button>
          </div>
        </div>

        <!-- Target Images Grid -->
        <div id="admin-gallery-grid"></div>
      </div>
    `;

    // Attach User card selection handlers
    area.querySelectorAll('.btn-user-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedUserId = card.getAttribute('data-uid');
        this.renderUsersView();
      });
    });

    // Attach Tab handlers
    area.querySelectorAll('.btn-admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.getAttribute('data-tab');
        this.renderUsersView();
      });
    });

    // Render Gallery Images for active tab
    this.renderGalleryGrid(selectedUser);
  }

  renderGalleryGrid(user) {
    const gridEl = this.el.querySelector('#admin-gallery-grid');
    let photos = [];
    if (this.activeTab === 'person') photos = user.personPhotos;
    else if (this.activeTab === 'cloth') photos = user.clothPhotos;

    if (photos.length === 0) {
      gridEl.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--on-surface-variant);">
          <span class="material-symbols-outlined" style="font-size: 2.5rem; opacity: 0.4;">image_not_supported</span>
          <p style="margin-top: 0.5rem; font-size: 0.85rem;">No ${this.activeTab} images uploaded by this user yet.</p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem;">
        ${photos.map((item, idx) => `
          <div data-url="${item.url}" class="admin-photo-card glass-card" style="position: relative; border-radius: 0.75rem; overflow: hidden; border: 1px solid rgba(255,184,0,0.25); background: #000; cursor: pointer; transition: transform 0.2s;">
            <img src="${item.url}" alt="${this.activeTab} photo" style="width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block;" onerror="this.onerror=null; this.src='/static/placeholder.jpg';" />
            <div style="position: absolute; bottom: 0; inset-x: 0; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent); padding: 8px 6px 4px 6px; font-size: 10px; color: var(--on-surface-variant); font-family: monospace; display: flex; align-items: center; justify-content: space-between;">
              <span>#${idx + 1}</span>
              <span class="material-symbols-outlined" style="font-size: 14px; color: var(--color-amber);">zoom_in</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Click image to open Lightbox
    gridEl.querySelectorAll('.admin-photo-card').forEach(card => {
      card.addEventListener('click', () => {
        const url = card.getAttribute('data-url');
        this.openLightbox(url, `${this.activeTab.toUpperCase()} Image • User: ${user.email}`);
      });
    });
  }

  openLightbox(url, caption) {
    const lightbox = this.el.querySelector('#admin-lightbox');
    const img = this.el.querySelector('#lightbox-img');
    const cap = this.el.querySelector('#lightbox-caption');
    const dl = this.el.querySelector('#lightbox-download');

    img.src = url;
    cap.textContent = caption;
    dl.href = url;
    lightbox.style.display = 'flex';
  }
}
