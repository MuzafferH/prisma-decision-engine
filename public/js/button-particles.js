/**
 * PrismaButtonParticles — Rose-tinted particle system for CTA buttons
 * Dots drift in Brownian motion, converge right on hover, form connection web
 */
class PrismaButtonParticles {
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: null, y: null, inside: false };
    this.animId = null;
    this.running = false;
    this.width = 0;
    this.height = 0;

    this.config = {
      count: config.count || 14,
      idleColor: config.idleColor || [227, 178, 179, 0.5],
      hoverColor: config.hoverColor || [227, 178, 179, 0.9],
      lineColor: config.lineColor || [227, 178, 179, 0.15],
      driftSpeed: config.driftSpeed || 0.3,
      connectionDist: config.connectionDist || 30,
      convergeSpeed: 0.03,
      returnSpeed: 0.015
    };
  }

  init() {
    // Reduced motion check
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this._resize();
    this._createParticles();
    this._bindEvents();
    this.start();
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  _createParticles() {
    this.particles = [];
    for (let i = 0; i < this.config.count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        baseX: Math.random() * this.width,
        baseY: Math.random() * this.height,
        vx: (Math.random() - 0.5) * this.config.driftSpeed,
        vy: (Math.random() - 0.5) * this.config.driftSpeed,
        size: 1.5 + Math.random() * 1,
        opacity: 0.4 + Math.random() * 0.3
      });
    }
  }

  _bindEvents() {
    const btn = this.canvas.closest('a') || this.canvas.closest('button');
    if (!btn) return;

    btn.addEventListener('mouseenter', () => { this.mouse.inside = true; });
    btn.addEventListener('mouseleave', () => {
      this.mouse.inside = false;
      this.mouse.x = null;
      this.mouse.y = null;
    });
    btn.addEventListener('mousemove', (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });

    // ResizeObserver for responsive canvas
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => {
        this._resize();
        this._createParticles();
      }).observe(btn);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  _loop() {
    if (!this.running) return;
    this._update();
    this._draw();
    this.animId = requestAnimationFrame(() => this._loop());
  }

  _update() {
    const convergeX = this.width * 0.85; // converge toward right (arrow)

    this.particles.forEach(p => {
      // Brownian drift
      p.vx += (Math.random() - 0.5) * 0.04;
      p.vy += (Math.random() - 0.5) * 0.04;

      if (this.mouse.inside) {
        // Converge toward right side of button
        p.vx += (convergeX - p.x) * this.config.convergeSpeed;
        p.vy += (this.height / 2 - p.y) * this.config.convergeSpeed * 0.5;
      } else {
        // Return to base position gently
        p.vx += (p.baseX - p.x) * this.config.returnSpeed;
        p.vy += (p.baseY - p.y) * this.config.returnSpeed;
      }

      // Damping
      p.vx *= 0.92;
      p.vy *= 0.92;

      p.x += p.vx;
      p.y += p.vy;

      // Soft bounds
      if (p.x < 4) p.vx += 0.2;
      if (p.x > this.width - 4) p.vx -= 0.2;
      if (p.y < 4) p.vy += 0.2;
      if (p.y > this.height - 4) p.vy -= 0.2;
    });
  }

  _draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    const col = this.mouse.inside ? this.config.hoverColor : this.config.idleColor;

    // Connection lines (only on hover)
    if (this.mouse.inside) {
      const cd = this.config.connectionDist;
      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          const dx = this.particles[i].x - this.particles[j].x;
          const dy = this.particles[i].y - this.particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < cd) {
            const lc = this.config.lineColor;
            const alpha = lc[3] * (1 - dist / cd);
            this.ctx.beginPath();
            this.ctx.strokeStyle = 'rgba(' + lc[0] + ',' + lc[1] + ',' + lc[2] + ',' + alpha.toFixed(3) + ')';
            this.ctx.lineWidth = 0.5;
            this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
            this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
            this.ctx.stroke();
          }
        }
      }
    }

    // Particles
    this.particles.forEach(p => {
      // Glow
      this.ctx.beginPath();
      const grad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
      grad.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (col[3] * 0.3).toFixed(2) + ')');
      grad.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)');
      this.ctx.fillStyle = grad;
      this.ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
      this.ctx.fill();

      // Core dot
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (p.opacity * col[3] / 0.5).toFixed(2) + ')';
      this.ctx.fill();
    });
  }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  window.__prismaParticles = window.__prismaParticles || [];

  // Hero button (starts immediately)
  const heroCanvas = document.getElementById('hero-canvas');
  if (heroCanvas) {
    const hero = new PrismaButtonParticles(heroCanvas, { count: 14 });
    hero.init();
    window.__prismaParticles.push(hero);
  }

  // Footer button (deferred until visible)
  const footerCanvas = document.getElementById('footer-canvas');
  if (footerCanvas) {
    const footer = new PrismaButtonParticles(footerCanvas, { count: 18 });
    footer._resize();
    footer._createParticles();
    footer._bindEvents();
    window.__prismaParticles.push(footer);

    const footerObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          footer.start();
          footerObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    footerObs.observe(footerCanvas.closest('a') || footerCanvas);
  }
});
