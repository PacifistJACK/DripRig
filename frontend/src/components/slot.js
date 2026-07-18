/**
 * DripRig — Upload Slot Component
 *
 * Manages one clothing slot: empty → uploading → loaded states.
 * Handles click-to-upload, drag-and-drop, remove button.
 */



export class SlotComponent {
  /**
   * @param {string} slotKey - 'top' | 'bottom' | 'shoes' | 'person'
   * @param {object} config  - { label, sublabel, icon }
   * @param {function} onUpload   - called with (slotKey, filename, url) on success
   * @param {function} onRemove   - called with (slotKey) on removal
   * @param {function} onError    - called with (message) on failure
   */
  constructor(slotKey, config, { onUpload, onRemove, onError } = {}) {
    this.slotKey = slotKey;
    this.config = config;
    this.onUpload = onUpload || (() => { });
    this.onRemove = onRemove || (() => { });
    this.onError = onError || (() => { });

    this.state = 'empty'; // 'empty' | 'uploading' | 'loaded'
    this.filename = null;
    this.url = null;

    this.el = null;
    this.fileInput = null;
    this._render();
  }

  _render() {
    this.el = document.createElement('div');
    this.el.className = 'slot slide-up';
    this.el.setAttribute('tabindex', '0');
    this.el.setAttribute('role', 'button');
    this.el.setAttribute('aria-label', `Upload ${this.config.label}`);
    this.el.dataset.slot = this.slotKey;

    // Hidden file input
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/jpeg,image/png,image/webp';
    this.fileInput.className = 'sr-only';
    this.fileInput.setAttribute('aria-hidden', 'true');
    this.fileInput.addEventListener('change', (e) => this._handleFileSelect(e));
    this.el.appendChild(this.fileInput);

    this._renderEmptyState();
    this._bindEvents();
    return this.el;
  }

  _renderEmptyState() {
    // Clear dynamic content (keep fileInput)
    Array.from(this.el.children).forEach((child) => {
      if (child !== this.fileInput) child.remove();
    });

    this.el.className = 'slot';

    const empty = document.createElement('div');
    empty.className = 'slot__empty';
    empty.innerHTML = `
      <span class="material-symbols-outlined slot__icon" style="font-variation-settings:'FILL' 0">${this.config.icon}</span>
      <span class="slot__label">${this.config.label}</span>
      <span class="slot__sublabel">Tap to upload</span>
    `;

    const plus = document.createElement('div');
    plus.className = 'slot__plus';
    plus.innerHTML = `<span class="material-symbols-outlined">add</span>`;

    this.el.appendChild(empty);
    this.el.appendChild(plus);
    this.state = 'empty';
    this.filename = null;
    this.url = null;
  }

  _renderUploadingState() {
    Array.from(this.el.children).forEach((child) => {
      if (child !== this.fileInput) child.remove();
    });

    this.el.className = 'slot slot--uploading';

    const prog = document.createElement('div');
    prog.className = 'slot__upload-progress';
    prog.innerHTML = `
      <div class="slot__spinner"></div>
      <span class="slot__upload-text">Uploading…</span>
    `;
    this.el.appendChild(prog);
    this.state = 'uploading';
  }

  _renderLoadedState(url) {
    Array.from(this.el.children).forEach((child) => {
      if (child !== this.fileInput) child.remove();
    });

    this.el.className = 'slot slot--loaded';

    const img = document.createElement('img');
    img.src = url;
    img.alt = `${this.config.label} preview`;
    img.className = 'slot__thumbnail';
    img.draggable = false;

    const overlay = document.createElement('div');
    overlay.className = 'slot__loaded-overlay';
    overlay.innerHTML = `<span class="slot__loaded-label">${this.config.label}</span>`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'slot__remove-btn';
    removeBtn.setAttribute('aria-label', `Remove ${this.config.label}`);
    removeBtn.innerHTML = `<span class="material-symbols-outlined">close</span>`;
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._handleRemove();
    });

    this.el.appendChild(img);
    this.el.appendChild(overlay);
    this.el.appendChild(removeBtn);
    this.state = 'loaded';
  }

  _bindEvents() {
    // Click / Enter / Space → open file picker (only when not loaded)
    this.el.addEventListener('click', (e) => {
      if (this.state === 'uploading') return;
      if (e.target.closest('.slot__remove-btn')) return;
      if (this.state === 'loaded') {
        // Re-upload on click when loaded
        this.fileInput.click();
        return;
      }
      this.fileInput.click();
    });

    this.el.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && this.state !== 'uploading') {
        e.preventDefault();
        this.fileInput.click();
      }
    });

    // Drag-and-drop
    this.el.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.el.classList.add('slot--drag-over');
    });

    this.el.addEventListener('dragleave', () => {
      this.el.classList.remove('slot--drag-over');
    });

    this.el.addEventListener('drop', (e) => {
      e.preventDefault();
      this.el.classList.remove('slot--drag-over');
      const file = e.dataTransfer.files?.[0];
      if (file) this._uploadFile(file);
    });
  }

  _handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) this._uploadFile(file);
    // Reset input so same file can be re-selected
    this.fileInput.value = '';
  }

  async _uploadFile(file) {
    // Basic client-side validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.onError('Invalid file type. Please upload a JPEG, PNG, or WEBP image.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      this.onError('File too large. Maximum size is 20MB.');
      return;
    }

    this._renderUploadingState();

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/upload/${this.slotKey}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Upload failed.' }));
        throw new Error(err.detail || 'Upload failed.');
      }

      const data = await response.json();
      this.filename = data.filename;
      this.url = data.url;

      this._renderLoadedState(data.url);
      this.onUpload(this.slotKey, data.filename, data.url);
    } catch (err) {
      this._renderEmptyState();
      this.onError(err.message || 'Upload failed. Please try again.');
    }
  }

  async _handleRemove() {
    if (this.filename) {
      // Fire-and-forget delete
      fetch(`/api/upload/${this.slotKey}/${this.filename}`, { method: 'DELETE' }).catch(() => { });
    }
    this._renderEmptyState();
    this.onRemove(this.slotKey);
  }

  /** Mount the slot element into a parent container */
  mount(parent) {
    parent.appendChild(this.el);
  }

  /** Returns the current filename (null if not uploaded) */
  getFilename() {
    return this.filename;
  }

  /** Returns true if an image has been uploaded */
  isLoaded() {
    return this.state === 'loaded';
  }
}
