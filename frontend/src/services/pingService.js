/**
 * DripRig — Client-side Keep-Alive Ping Service
 * Periodically pings /api/ping while the app is active in browser to keep connection warm.
 */

class PingService {
  constructor() {
    this.intervalMs = 5 * 60 * 1000; // 5 minutes
    this.timer = null;
    this.listeners = new Set();
    this.state = {
      status: 'idle', // 'online' | 'slow' | 'offline' | 'idle'
      lastPingTime: null,
      latencyMs: null,
      uptimeSeconds: null,
      keepAliveActive: false,
      serverStats: null,
    };
  }

  /**
   * Starts periodic keep-alive pinging.
   */
  start() {
    if (this.timer) return;
    this.pingNow();
    this.timer = setInterval(() => this.pingNow(), this.intervalMs);
  }

  /**
   * Stops periodic pinging.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Subscribe to status updates.
   */
  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.state);
    return () => this.listeners.delete(callback);
  }

  _notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.state);
      } catch (e) {
        console.error('[PingService] Listener error:', e);
      }
    });
  }

  /**
   * Executes a client-to-server keep-alive ping.
   */
  async pingNow() {
    const startTime = performance.now();
    try {
      const response = await fetch('/api/ping', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (response.ok) {
        const data = await response.json();
        this.state = {
          ...this.state,
          status: latencyMs > 2500 ? 'slow' : 'online',
          lastPingTime: new Date().toLocaleTimeString(),
          latencyMs: latencyMs,
          uptimeSeconds: data.uptime_seconds,
          keepAliveActive: data.keep_alive_active,
        };
      } else {
        this.state = {
          ...this.state,
          status: 'offline',
          lastPingTime: new Date().toLocaleTimeString(),
          latencyMs: latencyMs,
        };
      }
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startTime);
      this.state = {
        ...this.state,
        status: 'offline',
        lastPingTime: new Date().toLocaleTimeString(),
        latencyMs: latencyMs,
      };
    }
    this._notify();
    return this.state;
  }

  /**
   * Fetches detailed server-side keep-alive statistics.
   */
  async fetchServerStats() {
    try {
      const response = await fetch('/api/ping/stats');
      if (response.ok) {
        const stats = await response.json();
        this.state.serverStats = stats;
        this._notify();
        return stats;
      }
    } catch (err) {
      console.warn('[PingService] Failed to fetch server stats:', err);
    }
    return null;
  }

  /**
   * Triggers an immediate server self-ping on the backend.
   */
  async triggerServerPing() {
    try {
      const response = await fetch('/api/ping/trigger', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        await this.fetchServerStats();
        await this.pingNow();
        return data;
      }
    } catch (err) {
      console.error('[PingService] Trigger server ping failed:', err);
    }
    return null;
  }
}

export const pingService = new PingService();
