/**
 * DripRig — Keep-Alive Dashboard Modal Component
 * Renders an interactive modal displaying real-time Render server health, ping stats, logs, and manual ping control.
 */
import { pingService } from '../services/pingService.js';
import { showToast } from '../main.js';

export function openPingModal() {
  // Remove existing modal if open
  document.getElementById('ping-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'ping-modal';
  modal.className = 'ping-modal-overlay';
  modal.innerHTML = `
    <div class="ping-modal-content glass-card animate-fade-in">
      <div class="ping-modal-header">
        <div class="ping-modal-title">
          <span class="material-symbols-outlined ping-icon-pulse">radar</span>
          <span>Render Keep-Alive Dashboard</span>
        </div>
        <button class="ping-close-btn" id="ping-modal-close" aria-label="Close">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="ping-modal-body">
        <!-- Live Status Bar -->
        <div class="ping-status-banner" id="ping-status-banner">
          <div class="ping-pulse-indicator" id="ping-pulse-dot"></div>
          <div class="ping-status-text">
            <strong id="ping-status-title">Checking Server Status...</strong>
            <span id="ping-status-sub">Connecting to DripRig backend...</span>
          </div>
        </div>

        <!-- Metrics Grid -->
        <div class="ping-metrics-grid">
          <div class="ping-metric-card">
            <span class="ping-metric-label">Client Latency</span>
            <span class="ping-metric-value" id="ping-val-latency">-- ms</span>
          </div>
          <div class="ping-metric-card">
            <span class="ping-metric-label">Server Uptime</span>
            <span class="ping-metric-value" id="ping-val-uptime">--</span>
          </div>
          <div class="ping-metric-card">
            <span class="ping-metric-label">Self-Pings Sent</span>
            <span class="ping-metric-value" id="ping-val-pings">--</span>
          </div>
          <div class="ping-metric-card">
            <span class="ping-metric-label">Success Rate</span>
            <span class="ping-metric-value" id="ping-val-success">--%</span>
          </div>
        </div>

        <!-- Render Target Info -->
        <div class="ping-info-card">
          <div class="ping-info-row">
            <span>Ping Target URL:</span>
            <code id="ping-target-url">Loading...</code>
          </div>
          <div class="ping-info-row">
            <span>Background Loop:</span>
            <span id="ping-loop-status">Checking...</span>
          </div>
        </div>

        <!-- Control Buttons -->
        <div class="ping-actions">
          <button class="ping-action-btn ping-btn-primary" id="btn-trigger-ping">
            <span class="material-symbols-outlined">send</span>
            <span>Send Self-Ping Now</span>
          </button>
          <button class="ping-action-btn ping-btn-secondary" id="btn-refresh-stats">
            <span class="material-symbols-outlined">refresh</span>
            <span>Refresh Stats</span>
          </button>
        </div>

        <!-- Recent Ping Log Table -->
        <div class="ping-logs-section">
          <h4 class="ping-logs-title">Recent Ping Execution Log</h4>
          <div class="ping-logs-container" id="ping-logs-list">
            <div class="ping-logs-empty">Loading ping history...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Handlers
  const closeBtn = modal.querySelector('#ping-modal-close');
  closeBtn?.addEventListener('click', () => modal.remove());

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  const triggerBtn = modal.querySelector('#btn-trigger-ping');
  triggerBtn?.addEventListener('click', async () => {
    triggerBtn.disabled = true;
    triggerBtn.querySelector('span:last-child').textContent = 'Pinging...';
    try {
      const res = await pingService.triggerServerPing();
      if (res && res.ping_result) {
        showToast(`Keep-alive ping sent! (${res.ping_result.latency_ms}ms)`, 'success');
      } else {
        showToast('Self-ping completed', 'info');
      }
    } catch (e) {
      showToast('Failed to send ping', 'error');
    } finally {
      triggerBtn.disabled = false;
      triggerBtn.querySelector('span:last-child').textContent = 'Send Self-Ping Now';
      updateUI();
    }
  });

  const refreshBtn = modal.querySelector('#btn-refresh-stats');
  refreshBtn?.addEventListener('click', async () => {
    await pingService.pingNow();
    await pingService.fetchServerStats();
    showToast('Keep-alive metrics refreshed', 'info');
    updateUI();
  });

  // UI Updater
  async function updateUI() {
    const stats = await pingService.fetchServerStats();
    const clientState = pingService.state;

    const banner = modal.querySelector('#ping-status-banner');
    const pulseDot = modal.querySelector('#ping-pulse-dot');
    const titleEl = modal.querySelector('#ping-status-title');
    const subEl = modal.querySelector('#ping-status-sub');

    if (clientState.status === 'online' || clientState.status === 'slow') {
      banner.className = 'ping-status-banner ping-status-banner--online';
      pulseDot.className = 'ping-pulse-indicator ping-pulse-indicator--green';
      titleEl.textContent = 'Render Backend Warm & Active';
      subEl.textContent = `Server responsive. Last checked: ${clientState.lastPingTime || 'Just now'}`;
    } else {
      banner.className = 'ping-status-banner ping-status-banner--offline';
      pulseDot.className = 'ping-pulse-indicator ping-pulse-indicator--red';
      titleEl.textContent = 'Server Disconnected / Paused';
      subEl.textContent = 'Render service may be sleeping. Triggering a ping will wake it up.';
    }

    modal.querySelector('#ping-val-latency').textContent = clientState.latencyMs != null ? `${clientState.latencyMs} ms` : '--';

    if (stats) {
      const hours = Math.floor(stats.uptime_seconds / 3600);
      const mins = Math.floor((stats.uptime_seconds % 3600) / 60);
      const secs = Math.floor(stats.uptime_seconds % 60);
      modal.querySelector('#ping-val-uptime').textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m ${secs}s`;

      modal.querySelector('#ping-val-pings').textContent = stats.total_pings;
      modal.querySelector('#ping-val-success').textContent = `${stats.success_rate_percent}%`;
      modal.querySelector('#ping-target-url').textContent = stats.target_url;
      modal.querySelector('#ping-loop-status').textContent = stats.enabled
        ? `Active (every ${Math.round(stats.interval_seconds / 60)} mins)`
        : 'Disabled';

      // Render Logs
      const logsContainer = modal.querySelector('#ping-logs-list');
      if (stats.recent_logs && stats.recent_logs.length > 0) {
        logsContainer.innerHTML = stats.recent_logs
          .map((log) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString();
            const badgeClass = log.success ? 'ping-log-badge--success' : 'ping-log-badge--fail';
            return `
              <div class="ping-log-item">
                <span class="ping-log-time">${timeStr}</span>
                <span class="ping-log-badge ${badgeClass}">${log.status_code || 'ERR'}</span>
                <span class="ping-log-msg">${log.message}</span>
                <span class="ping-log-latency">${log.latency_ms != null ? log.latency_ms + 'ms' : ''}</span>
              </div>
            `;
          })
          .join('');
      } else {
        logsContainer.innerHTML = '<div class="ping-logs-empty">No ping logs recorded yet.</div>';
      }
    }
  }

  // Initial load
  updateUI();
}
