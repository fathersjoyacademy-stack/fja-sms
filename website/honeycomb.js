/**
 * School Management System - Honeycomb Background Engine
 * Creates a fixed, non-intrusive hexagonal background that smoothly crossfades
 * between school campus, academic, student, and gallery photos at 60 FPS.
 *
 * Optimized for desktop (1920x1080) and mobile (1080x1920) with zero scroll lag.
 */

// Curated academic & campus imagery (WebP, ~25KB each, no distortion)
const DEFAULT_SCHOOL_IMAGES = [
  // Classrooms & Collaborative Learning
  'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=400&q=80',
  
  // Science, Robotics & STEM Lab
  'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=400&q=80',

  // Library & Reading
  'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=400&q=80',

  // Sports, Athletics & Campus Life
  'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=400&q=80',

  // Arts, Music & Creative Expression
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1460518451285-97b6aa326961?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=400&q=80',

  // Graduation & Achievement
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=400&q=80'
];

class SchoolHoneycombEngine {
  constructor(container, options = {}) {
    this.container = container;
    this.options = Object.assign({
      hexWidth: 160,          // Hexagon width (adapts on mobile screens)
      gap: 5,                 // Gap between hexagons
      fadeDuration: 1500,     // Smooth CSS transition time (ms)
      intervalSpeed: 1400,    // Time between transition ticks
      concurrentFades: 2,     // Max cells fading concurrently
      images: [...DEFAULT_SCHOOL_IMAGES]
    }, options);

    this.cells = [];
    this.timer = null;
    this.isPaused = false;
    this.activeFades = 0;
    this.imageCache = new Set();
    this.resizeObserver = null;

    this.init();
  }

  init() {
    this.preloadBatch(this.options.images.slice(0, 12));
    this.setupResizeObserver();
    this.setupVisibilityListener();
    this.rebuildGrid();
    this.startScheduler();
  }

  setImages(newImages) {
    if (!newImages || newImages.length === 0) return;
    // Combine custom/CMS images with fallback images to maintain rich diversity
    this.options.images = Array.from(new Set([...newImages, ...DEFAULT_SCHOOL_IMAGES]));
    this.preloadBatch(newImages.slice(0, 10));
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

        const initialImgUrl = this.getRandomImage();

        const imgA = document.createElement('img');
        imgA.className = 'school-hex-img active';
        imgA.src = initialImgUrl;
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
