/**
 * DripRig — Secret Admin Vault Portal Page
 * Path: /#/admin/drip-vault-772/secure-view
 * Secret Admin portal to view user profiles and their uploaded Person, Cloth, and Saved Try-On images.
 */
import { db } from '../firebase.js';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

function formatImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:image') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${window.location.origin}${path}`;
}

// Sleek dark placeholder icon (zero text overlay clutter)
const PLACEHOLDER_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23141414"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23333333" font-family="sans-serif" font-size="36">🖼️</text></svg>`;

export class AdminPortalPage {
  constructor() {
    this.el = null;
    this.usersMap = {}; // { userId: { id, email, personPhotos: [], clothPhotos: [], savedLooks: [], credits: null } }
    this.selectedUserId = null;
    this.activeTab = 'person'; // 'person' | 'cloth' | 'saved' | 'credits'
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
            <span style="font-size: 0.75rem; color: var(--on-surface-variant); font-family: monospace;">driprig.j4du.in/#/admin/drip-vault-772/secure-view</span>
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
          <a id="lightbox-download" href="" target="_blank" download class="btn-secondary" style="display: inline-flex; margin-top: 0.75rem; padding: 8px 16px; font-size: 0.8rem; text-decoration: none;">
            <span class="material-symbols-outlined" style="font-size: 16px;">download</span>
            <span>Download Image</span>
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

    // ── Admin Auth Gate ───────────────────────────────────────────────────────
    const { auth } = await import('../firebase.js');
    const user = auth.currentUser;
    const ADMIN_EMAIL = 'utkarshsharma3600@gmail.com';

    if (!user || user.email !== ADMIN_EMAIL) {
      area.innerHTML = `
        <div class="glass-card" style="text-align: center; padding: 4rem 2rem; border-radius: 1rem; border: 1px solid rgba(255,82,82,0.3); background: rgba(255,82,82,0.05);">
          <span class="material-symbols-outlined" style="font-size: 4rem; color: #ff5252;">lock</span>
          <h3 style="margin-top: 1rem; color: #ff5252; font-family: var(--font-display);">Access Denied</h3>
          <p style="color: var(--on-surface-variant); font-size: 0.9rem; margin-top: 0.5rem;">
            You are not authorized to view this page.
          </p>
        </div>
      `;
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    area.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--on-surface-variant);">
        <span class="material-symbols-outlined spin" style="font-size: 2.5rem; color: var(--primary);">sync</span>
        <p style="margin-top: 1rem;">Decrypting &amp; loading user vaults from Firestore...</p>
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
          const formattedUrl = formatImageUrl(d.personUrl);
          if (formattedUrl && !this.usersMap[uid].personPhotos.some(p => p.url === formattedUrl)) {
            this.usersMap[uid].personPhotos.push({ url: formattedUrl, date: d.uploadedAt });
          }
        }
        if (d.outfitUrl) {
          const formattedUrl = formatImageUrl(d.outfitUrl);
          if (formattedUrl && !this.usersMap[uid].clothPhotos.some(p => p.url === formattedUrl)) {
            this.usersMap[uid].clothPhotos.push({ url: formattedUrl, date: d.uploadedAt });
          }
        }
      });

      // 2. Fetch saved_looks for each user (deduplicated)
      for (const uid of Object.keys(this.usersMap)) {
        try {
          const looksRef = collection(db, `users/${uid}/saved_looks`);
          const looksSnap = await getDocs(looksRef);
          looksSnap.docs.forEach(doc => {
            const d = doc.data();
            if (d.resultUrl) {
              const formattedUrl = formatImageUrl(d.resultUrl);
              if (formattedUrl && !this.usersMap[uid].savedLooks.some(p => p.url === formattedUrl)) {
                this.usersMap[uid].savedLooks.push({ url: formattedUrl, date: d.savedAt });
              }
            }
          });
        } catch (e) {}

        // 3. Fetch user profile doc for credits
        try {
          const profileSnap = await getDoc(doc(db, 'users', uid));
          if (profileSnap.exists()) {
            this.usersMap[uid].credits         = profileSnap.data().credits ?? 0;
            this.usersMap[uid].totalGenerations = profileSnap.data().totalGenerations ?? 0;
          } else {
            this.usersMap[uid].credits         = null; // never signed in to app
            this.usersMap[uid].totalGenerations = 0;
          }
        } catch (e) {
          this.usersMap[uid].credits = null;
        }
      }


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
                <div style="font-weight: 700; font-size: 0.88rem; color: ${isActive ? 'var(--color-amber)' : 'var(--on-surface)'};"}>${u.email}</div>
                <div style="font-size: 0.72rem; color: var(--on-surface-variant);">${u.personPhotos.length} Person &bull; ${u.clothPhotos.length} Cloth &bull; ${u.savedLooks.length} Saved &bull; <span style="color:${u.credits === null ? 'var(--on-surface-variant)' : u.credits <= 2 ? '#ffb800' : '#00d9e7'}">${u.credits === null ? '? credits' : u.credits + ' credits'}</span></div>
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

          <!-- 3 Sub-Division Tabs: Person | Cloth | Saved | Credits -->
          <div style="display: flex; gap: 0.5rem; background: rgba(0,0,0,0.4); padding: 4px; border-radius: 0.6rem; border: 1px solid rgba(255,255,255,0.08); flex-wrap: wrap;">
            <button data-tab="person" class="btn-admin-tab ${this.activeTab === 'person' ? 'btn-admin-tab--active' : ''}">
              👤 Person (${selectedUser.personPhotos.length})
            </button>
            <button data-tab="cloth" class="btn-admin-tab ${this.activeTab === 'cloth' ? 'btn-admin-tab--active' : ''}">
              👕 Cloth (${selectedUser.clothPhotos.length})
            </button>
            <button data-tab="saved" class="btn-admin-tab ${this.activeTab === 'saved' ? 'btn-admin-tab--active' : ''}">
              ✨ Saved (${selectedUser.savedLooks.length})
            </button>
            <button data-tab="credits" class="btn-admin-tab ${this.activeTab === 'credits' ? 'btn-admin-tab--active' : ''}" style="${this.activeTab === 'credits' ? '' : 'color:#00d9e7;'}">
              🪙 Credits
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
    if (this.activeTab === 'credits') {
      this.renderCreditsEditor(selectedUser);
    } else {
      this.renderGalleryGrid(selectedUser);
    }
  }

  async renderCreditsEditor(user) {
    const gridEl = this.el.querySelector('#admin-gallery-grid');
    const currentCredits = user.credits ?? 0;
    const totalGens      = user.totalGenerations ?? 0;

    gridEl.innerHTML = `
      <div style="max-width: 420px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.25rem; padding: 0.5rem 0;">

        <!-- Stats row -->
        <div style="display: flex; gap: 1rem;">
          <div style="flex:1; background: rgba(0,217,231,0.07); border: 1px solid rgba(0,217,231,0.2); border-radius: 0.75rem; padding: 1rem; text-align: center;">
            <div style="font-size: 2rem; font-weight: 800; color: #00d9e7; font-family: var(--font-display);" id="admin-credit-val">${currentCredits === null ? '—' : currentCredits}</div>
            <div style="font-size: 0.72rem; color: var(--on-surface-variant); letter-spacing: 0.1em; margin-top: 4px;">CURRENT CREDITS</div>
          </div>
          <div style="flex:1; background: rgba(255,184,0,0.07); border: 1px solid rgba(255,184,0,0.2); border-radius: 0.75rem; padding: 1rem; text-align: center;">
            <div style="font-size: 2rem; font-weight: 800; color: #ffb800; font-family: var(--font-display);">${totalGens}</div>
            <div style="font-size: 0.72rem; color: var(--on-surface-variant); letter-spacing: 0.1em; margin-top: 4px;">TOTAL GENERATIONS</div>
          </div>
        </div>

        <!-- Set credits -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.75rem; padding: 1.25rem;">
          <div style="font-size: 0.8rem; font-weight: 700; letter-spacing: 0.1em; color: var(--on-surface-variant); margin-bottom: 0.75rem;">SET EXACT BALANCE</div>
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <input id="admin-set-amount" type="number" min="0" max="9999" value="${currentCredits ?? 0}"
              style="flex:1; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); border-radius: 0.5rem; color: var(--on-surface); font-size: 1.1rem; font-weight: 700; padding: 10px 14px; outline: none; font-family: var(--font-display);" />
            <button id="btn-set-credits" style="background: var(--color-amber); color: #000; font-weight: 800; font-size: 0.85rem; padding: 10px 20px; border-radius: 0.5rem; border: none; cursor: pointer; letter-spacing: 0.05em; white-space: nowrap;">SET</button>
          </div>
        </div>

        <!-- Quick adjust -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.75rem; padding: 1.25rem;">
          <div style="font-size: 0.8rem; font-weight: 700; letter-spacing: 0.1em; color: var(--on-surface-variant); margin-bottom: 0.75rem;">QUICK ADJUST</div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${[1, 5, 10, 25, 50].map(n => `
              <button class="btn-add-credits" data-amount="${n}"
                style="background: rgba(0,217,231,0.1); border: 1px solid rgba(0,217,231,0.3); color: #00d9e7; font-weight: 700; padding: 8px 16px; border-radius: 0.5rem; cursor: pointer; font-size: 0.85rem;">+${n}</button>
            `).join('')}
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
            ${[1, 5, 10].map(n => `
              <button class="btn-sub-credits" data-amount="${n}"
                style="background: rgba(255,82,82,0.1); border: 1px solid rgba(255,82,82,0.3); color: #ff5252; font-weight: 700; padding: 8px 16px; border-radius: 0.5rem; cursor: pointer; font-size: 0.85rem;">−${n}</button>
            `).join('')}
          </div>
        </div>

        <div id="admin-credits-msg" style="font-size: 0.8rem; color: var(--on-surface-variant); text-align: center; min-height: 1.2rem;"></div>
      </div>
    `;

    const creditValEl = gridEl.querySelector('#admin-credit-val');
    const msgEl       = gridEl.querySelector('#admin-credits-msg');
    const userDocRef  = doc(db, 'users', user.id);

    const flash = (msg, color = '#00d9e7') => {
      msgEl.style.color = color;
      msgEl.textContent = msg;
      setTimeout(() => { msgEl.textContent = ''; }, 2500);
    };

    const refreshVal = (newVal) => {
      user.credits = newVal;
      this.usersMap[user.id].credits = newVal;
      if (creditValEl) creditValEl.textContent = newVal;
    };

    // SET
    gridEl.querySelector('#btn-set-credits')?.addEventListener('click', async () => {
      const val = parseInt(gridEl.querySelector('#admin-set-amount').value, 10);
      if (isNaN(val) || val < 0) { flash('Enter a valid number', '#ff5252'); return; }
      try {
        await setDoc(userDocRef, { credits: val }, { merge: true });
        refreshVal(val);
        flash(`✓ Credits set to ${val}`);
      } catch (e) { flash('Failed: ' + e.message, '#ff5252'); }
    });

    // ADD
    gridEl.querySelectorAll('.btn-add-credits').forEach(btn => {
      btn.addEventListener('click', async () => {
        const n = parseInt(btn.dataset.amount, 10);
        try {
          await updateDoc(userDocRef, { credits: increment(n) });
          const snap = await getDoc(userDocRef);
          const newVal = snap.data()?.credits ?? 0;
          refreshVal(newVal);
          flash(`✓ Added ${n} credit${n > 1 ? 's' : ''} → now ${newVal}`);
        } catch (e) { flash('Failed: ' + e.message, '#ff5252'); }
      });
    });

    // SUBTRACT
    gridEl.querySelectorAll('.btn-sub-credits').forEach(btn => {
      btn.addEventListener('click', async () => {
        const n = parseInt(btn.dataset.amount, 10);
        try {
          const snap = await getDoc(userDocRef);
          const cur  = snap.data()?.credits ?? 0;
          const newVal = Math.max(0, cur - n);
          await setDoc(userDocRef, { credits: newVal }, { merge: true });
          refreshVal(newVal);
          flash(`✓ Removed ${n} credit${n > 1 ? 's' : ''} → now ${newVal}`);
        } catch (e) { flash('Failed: ' + e.message, '#ff5252'); }
      });
    });
  }

  renderGalleryGrid(user) {
    const gridEl = this.el.querySelector('#admin-gallery-grid');
    let photos = [];
    if (this.activeTab === 'person') photos = user.personPhotos;
    else if (this.activeTab === 'cloth') photos = user.clothPhotos;
    else if (this.activeTab === 'saved') photos = user.savedLooks;

    if (photos.length === 0) {
      gridEl.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--on-surface-variant);">
          <span class="material-symbols-outlined" style="font-size: 2.5rem; opacity: 0.4;">image_not_supported</span>
          <p style="margin-top: 0.5rem; font-size: 0.85rem;">No ${this.activeTab} images available for this user yet.</p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem;">
        ${photos.map((item, idx) => `
          <div data-url="${item.url}" class="admin-photo-card glass-card" style="position: relative; border-radius: 0.75rem; overflow: hidden; border: 1px solid rgba(255,184,0,0.25); background: #000; cursor: pointer; transition: transform 0.2s;">
            <img class="admin-photo-img" src="${item.url}" alt="${this.activeTab} photo" style="width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block;" />
            <div style="position: absolute; bottom: 0; inset-x: 0; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent); padding: 8px 6px 4px 6px; font-size: 10px; color: var(--on-surface-variant); font-family: monospace; display: flex; align-items: center; justify-content: space-between;">
              <span>#${idx + 1} ${this.activeTab.toUpperCase()}</span>
              <span class="material-symbols-outlined" style="font-size: 14px; color: var(--color-amber);">zoom_in</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Safely attach error handler in JS
    gridEl.querySelectorAll('.admin-photo-img').forEach(img => {
      img.addEventListener('error', () => {
        img.onerror = null;
        img.src = PLACEHOLDER_SVG;
      });
    });

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
    img.onerror = () => { img.src = PLACEHOLDER_SVG; };
    cap.textContent = caption;
    dl.href = url;
    lightbox.style.display = 'flex';
  }
}
