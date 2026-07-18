/**
 * DripRig — WebGL Shader Background
 * New smooth aurora / nebula effect — less busy than the prototype liquid shader.
 * Slow, organic color waves with amber, magenta, and cyan.
 */
export class ShaderBackground {
  constructor(containerId) {
    this.containerId = containerId;
    this.canvas = null;
    this.gl = null;
    this.prog = null;
    this.rafId = null;
    this.mouse = { x: 0, y: 0 };
  }

  init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;';
    container.appendChild(this.canvas);

    this._syncSize();

    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._syncSize());
      this._ro.observe(this.canvas);
    }

    const gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
    if (!gl) {
      container.style.background = 'radial-gradient(ellipse at 30% 60%, rgba(255,184,0,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 40%, rgba(255,13,245,0.08) 0%, transparent 60%)';
      return;
    }
    this.gl = gl;

    const vs = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // New aurora/nebula shader — smoother, more organic, less scanline noise
    const fs = `
      precision highp float;
      varying vec2 v_texCoord;
      uniform float u_time;
      uniform vec2 u_resolution;

      // Smooth noise function
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));

        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        for(int i = 0; i < 2; i++) { // Optimized from 5 to 2 for massive performance gain
          val += amp * noise(p);
          p *= 2.0;
          amp *= 0.5;
        }
        return val;
      }

      void main() {
        vec2 uv = v_texCoord;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.15; // Very slow movement

        // Organic flowing noise layers
        float n1 = fbm(p * 1.2 + vec2(t * 0.3, t * 0.2));
        float n2 = fbm(p * 0.8 + vec2(-t * 0.2, t * 0.4) + n1 * 0.5);
        float n3 = fbm(p * 1.5 + vec2(t * 0.1, -t * 0.3) + n2 * 0.3);

        // Color channels — warm amber, magenta, cool cyan
        vec3 amber   = vec3(1.0, 0.72, 0.0);
        vec3 magenta = vec3(1.0, 0.05, 0.96);
        vec3 cyan    = vec3(0.0, 0.85, 0.91);
        vec3 bg      = vec3(0.031, 0.031, 0.031);

        // Blend organic noise into color
        vec3 color = bg;
        color = mix(color, amber,   smoothstep(0.35, 0.65, n1) * 0.25);
        color = mix(color, magenta, smoothstep(0.4, 0.7, n2) * 0.18);
        color = mix(color, cyan,    smoothstep(0.45, 0.75, n3) * 0.12);

        // Subtle vignette
        float vig = 1.0 - length(p) * 0.35;
        vig = clamp(vig, 0.0, 1.0);
        color *= vig;

        // Very subtle grain
        float grain = (hash(uv * u_time) - 0.5) * 0.02;
        color += grain;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    this.prog = this._createProgram(vs, fs);
    gl.useProgram(this.prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(this.prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    this.uTime = gl.getUniformLocation(this.prog, 'u_time');
    this.uRes = gl.getUniformLocation(this.prog, 'u_resolution');

    this._render(0);
  }

  _syncSize() {
    if (!this.canvas) return;
    const w = this.canvas.clientWidth || 390;
    const h = this.canvas.clientHeight || 844;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  _createShader(type, src) {
    const s = this.gl.createShader(type);
    this.gl.shaderSource(s, src);
    this.gl.compileShader(s);
    return s;
  }

  _createProgram(vs, fs) {
    const prog = this.gl.createProgram();
    this.gl.attachShader(prog, this._createShader(this.gl.VERTEX_SHADER, vs));
    this.gl.attachShader(prog, this._createShader(this.gl.FRAGMENT_SHADER, fs));
    this.gl.linkProgram(prog);
    return prog;
  }

  _render(t) {
    const { gl, canvas } = this;
    if (!gl || !canvas) return;
    if (typeof ResizeObserver === 'undefined') this._syncSize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (this.uTime) gl.uniform1f(this.uTime, t * 0.001);
    if (this.uRes) gl.uniform2f(this.uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.rafId = requestAnimationFrame((ts) => this._render(ts));
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this._ro) this._ro.disconnect();
  }
}
