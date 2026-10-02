/**
 * School Management System - Honeycomb Background Engine
 * Creates a fixed, non-intrusive hexagonal background that smoothly crossfades
 * between school campus, academic, student, and gallery photos at 60 FPS.
 *
 * Optimized for desktop (1920x1080) and mobile (1080x1920) with zero scroll lag.
 */

// Dynamic preloaded real gallery photos from static manifest or indexedDB
let REAL_GALLERY_IMAGES = [];

async function fetchRealGalleryImages() {
  if (REAL_GALLERY_IMAGES.length > 0) return REAL_GALLERY_IMAGES;
  try {
    if (window.db && typeof window.db.get === "function") {
      const gKey = await window.db.get("cms_content", "gallery_images");
      if (gKey && gKey.value) {
        const parsed = JSON.parse(gKey.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          REAL_GALLERY_IMAGES = parsed.map(item => item.url).filter(Boolean);
          return REAL_GALLERY_IMAGES;
        }
      }
    }
  } catch (e) {}

  try {
    const resp = await fetch("./assets/gallery-data.json");
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        REAL_GALLERY_IMAGES = data.map(item => item.url).filter(Boolean);
        return REAL_GALLERY_IMAGES;
      }
    }
  } catch (e) {}

  return REAL_GALLERY_IMAGES;
}

// Pre-fetch immediately in background on script evaluation
fetchRealGalleryImages().then(imgs => {
  if (imgs && imgs.length > 0 && window.schoolHoneycomb) {
    window.schoolHoneycomb.setImages(imgs);
  }
});

class SchoolHoneycombEngine {
  constructor(container, options = {}) {
    this.container = container;
    this.options = Object.assign({
      hexWidth: 160,          // Hexagon width (adapts on mobile screens)
      gap: 5,                 // Gap between hexagons
      fadeDuration: 1500,     // Smooth CSS transition time (ms)
      intervalSpeed: 1400,    // Time between transition ticks
      concurrentFades: 2,     // Max cells fading concurrently
      images: REAL_GALLERY_IMAGES.length > 0 ? [...REAL_GALLERY_IMAGES] : []
    }, options);

    this.cells = [];
    this.timer = null;
    this.isPaused = false;
    this.activeFades = 0;
    this.imageCache = new Set();
    this.resizeObserver = null;

    this.init();
  }

  async init() {
    if (this.options.images.length === 0) {
      const imgs = await fetchRealGalleryImages();
      if (imgs && imgs.length > 0) {
        this.options.images = [...imgs];
      }
    }
    this.preloadBatch(this.options.images.slice(0, 15));
    this.setupResizeObserver();
    this.setupVisibilityListener();
    this.rebuildGrid();
    this.startScheduler();
  }

  setImages(newImages) {
    if (!newImages || newImages.length === 0) return;
    // Strictly replace with real gallery images - NO DEFAULT SYSTEM/UNSPLASH PICTURES!
    this.options.images = Array.from(new Set(newImages.filter(Boolean)));
    this.refreshCellImages();
    this.preloadBatch(this.options.images.slice(0, 15));
  }

  refreshCellImages() {
    if (!this.cells || this.cells.length === 0 || !this.options.images || this.options.images.length === 0) return;
    let idx = 0;
    this.cells.forEach(cell => {
      if (!cell.currentImage || !this.options.images.includes(cell.currentImage)) {
        const nextImg = this.options.images[idx % this.options.images.length];
        idx++;
        cell.currentImage = nextImg;
        if (cell.layerA) cell.layerA.src = nextImg;
        if (cell.layerB) cell.layerB.src = '';
        cell.activeLayer = 'A';
      }
    });
  }

  preloadBatch(urls) {
    urls.forEach(url => {
      if (this.imageCache.has(url)) return;
      const img = new Image();
      img.src = url;
      img.onload = () => this.imageCache.add(url);
    });
  }

  setupResizeObserver() {
    let debounceTimer = null;
    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.rebuildGrid();
      }, 150);
    });
    this.resizeObserver.observe(this.container);
  }

  setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    });
  }

  pause() {
    this.isPaused = true;
    this.stopScheduler();
  }

  resume() {
    this.isPaused = false;
    this.startScheduler();
  }

  rebuildGrid() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (width === 0 || height === 0) return;

    // Dynamically adjust hexagon size for mobile screens (portrait 1080x1920)
    let W = this.options.hexWidth;
    if (width < 768) {
      W = 120; // Slightly smaller hexagons for clean mobile layout
    } else if (width > 1800) {
      W = 180; // Crisp sizing for wide 1920px+ displays
    }

    const s = W / Math.sqrt(3);
    const H = 2 * s;
    const gap = this.options.gap;

    const dx = W + gap;
    const dy = 1.5 * s + (Math.sqrt(3) / 2) * gap;

    // Generous bleeds so grid covers every pixel of the window during scrolling
    const minX = -W * 1.5;
    const maxX = width + W * 1.5;
    const minY = -H * 1.5;
    const maxY = height + H * 1.5;

    const cols = Math.ceil((maxX - minX) / dx) + 1;
    const rows = Math.ceil((maxY - minY) / dy) + 1;

    this.container.innerHTML = '';
    this.cells = [];

    const fragment = document.createDocumentFragment();
    let cellIndex = 0;

    for (let r = 0; r < rows; r++) {
      const y = minY + r * dy;
      const xOffset = (r % 2 === 1) ? dx * 0.5 : 0;

      for (let c = 0; c < cols; c++) {
        const x = minX + c * dx + xOffset;

        const cellEl = document.createElement('div');
        cellEl.className = 'school-hex-cell';
        cellEl.style.width = `${W}px`;
        cellEl.style.height = `${H}px`;
        cellEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;

        const inner = document.createElement('div');
        inner.className = 'school-hex-inner';

        const hasImages = this.options.images && this.options.images.length > 0;
        const initialImgUrl = hasImages 
          ? this.options.images[cellIndex % this.options.images.length] 
          : '';

        const imgA = document.createElement('img');
        imgA.className = 'school-hex-img active';
        if (initialImgUrl) imgA.src = initialImgUrl;
        imgA.alt = '';
        imgA.loading = 'lazy';

        const imgB = document.createElement('img');
        imgB.className = 'school-hex-img standby';
        imgB.alt = '';

        const overlay = document.createElement('div');
        overlay.className = 'school-hex-overlay';

        inner.appendChild(imgA);
        inner.appendChild(imgB);
        inner.appendChild(overlay);
        cellEl.appendChild(inner);

        fragment.appendChild(cellEl);

        this.cells.push({
          id: cellIndex++,
          el: cellEl,
          layerA: imgA,
          layerB: imgB,
          activeLayer: 'A',
          currentImage: initialImgUrl,
          isFading: false
        });
      }
    }

    this.container.appendChild(fragment);
  }

  getRandomImage(exclude = '') {
    const list = this.options.images;
    if (!list || list.length === 0) return '';
    if (list.length === 1) return list[0];

    let choice = list[Math.floor(Math.random() * list.length)];
    let attempts = 0;
    while (choice === exclude && attempts < 5) {
      choice = list[Math.floor(Math.random() * list.length)];
      attempts++;
    }
    return choice;
  }

  startScheduler() {
    this.stopScheduler();
    this.timer = setInterval(() => {
      if (this.isPaused || this.cells.length === 0) return;
      this.tick();
    }, this.options.intervalSpeed);
  }

  stopScheduler() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  tick() {
    const available = this.cells.filter(c => !c.isFading);
    if (available.length === 0) return;

    const count = Math.min(this.options.concurrentFades, available.length);
    const pool = [...available];

    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const cell = pool[idx];
      pool.splice(idx, 1);
      this.transitionCell(cell);
    }
  }

  transitionCell(cell) {
    if (cell.isFading) return;

    const nextImage = this.getRandomImage(cell.currentImage);
    if (!nextImage || nextImage === cell.currentImage) return;

    cell.isFading = true;
    this.activeFades++;

    const preloader = new Image();
    preloader.src = nextImage;

    const proceedFade = () => {
      const activeEl = cell.activeLayer === 'A' ? cell.layerA : cell.layerB;
      const nextEl = cell.activeLayer === 'A' ? cell.layerB : cell.layerA;

      nextEl.src = nextImage;
      nextEl.className = 'school-hex-img standby preparing';

      // Force reflow
      void nextEl.offsetWidth;

      activeEl.className = 'school-hex-img standby fade-out';
      nextEl.className = 'school-hex-img active fade-in';

      cell.activeLayer = cell.activeLayer === 'A' ? 'B' : 'A';
      cell.currentImage = nextImage;

      setTimeout(() => {
        activeEl.className = 'school-hex-img standby';
        nextEl.className = 'school-hex-img active';
        cell.isFading = false;
        this.activeFades = Math.max(0, this.activeFades - 1);
      }, this.options.fadeDuration);
    };

    if (preloader.complete) {
      proceedFade();
    } else {
      preloader.onload = proceedFade;
      preloader.onerror = () => {
        cell.isFading = false;
        this.activeFades = Math.max(0, this.activeFades - 1);
      };
    }
  }
}

window.SchoolHoneycombEngine = SchoolHoneycombEngine;
