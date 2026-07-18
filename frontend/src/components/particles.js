/**
 * DripRig — Particles.js Wrapper
 * Initializes the particle system inside the Rig Canvas card.
 */

const PARTICLES_CONFIG = {
  particles: {
    number: { value: 35, density: { enable: true, value_area: 800 } },
    color: { value: ['#ffb800', '#ff0df5', '#00d9e7'] },
    shape: { type: 'circle' },
    opacity: {
      value: 0.45,
      random: true,
      anim: { enable: true, speed: 0.8, opacity_min: 0.05, sync: false },
    },
    size: {
      value: 2.5,
      random: true,
      anim: { enable: false },
    },
    line_linked: {
      enable: false, // Disabled to fix UI lag (saves massive CPU overhead)
      distance: 130,
      color: '#2a2a2a',
      opacity: 0.35,
      width: 1,
    },
    move: {
      enable: true,
      speed: 1.5,
      direction: 'none',
      random: true,
      straight: false,
      out_mode: 'out',
      bounce: false,
    },
  },
  interactivity: {
    detect_on: 'canvas',
    events: {
      onhover: { enable: false },
      onclick: { enable: false },
      resize: true,
    },
  },
  retina_detect: true,
};

export function initParticles(containerId = 'particles-js') {
  if (typeof window.particlesJS === 'function') {
    window.particlesJS(containerId, PARTICLES_CONFIG);
  } else {
    console.warn('[Particles] particlesJS not loaded yet. Will retry...');
    // Retry once the script loads
    window.addEventListener('load', () => {
      if (typeof window.particlesJS === 'function') {
        window.particlesJS(containerId, PARTICLES_CONFIG);
      }
    }, { once: true });
  }
}

export function destroyParticles() {
  if (window.pJSDom && window.pJSDom.length > 0) {
    window.pJSDom.forEach((dom) => {
      if (dom.pJS && dom.pJS.fn && dom.pJS.fn.vendors) {
        dom.pJS.fn.vendors.destroypJS();
      }
    });
    window.pJSDom = [];
  }
}
