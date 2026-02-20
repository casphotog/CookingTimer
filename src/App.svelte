<script>
  import CookingField from './lib/CookingField.svelte';

  const DEFAULT_LABELS     = ['Timer 1', 'Timer 2', 'Timer 3', 'Timer 4'];
  const DEFAULT_PRESET_ROW = [180, 300, 600];
  const DEFAULT_PRESETS    = Array.from({ length: DEFAULT_LABELS.length }, () => [...DEFAULT_PRESET_ROW]);
  const DEFAULT_CARD_SIZE  = 320;  // px — multiple of GRID
  const MIN_SIZE           = 180;  // px — multiple of GRID
  const GRID               = 20;   // px — snap granularity
  const WIGGLE_DELAY       = 0.07; // seconds — stagger per card

  function snap(v) { return Math.round(v / GRID) * GRID; }

  // ── Storage ────────────────────────────────────────────────────────────────
  const STORAGE = {
    labels:    'cooking-labels',
    presets:   'cooking-presets',
    positions: 'cooking-positions',
    sizes:     'cooking-sizes',
  };

  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

  function loadFromStorage(key, validate, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (validate(parsed)) return parsed;
      }
    } catch {}
    return fallback();
  }

  function isValidPositions(v) {
    return Array.isArray(v) && v.length >= 1 &&
      v.every(p => p && typeof p.x === 'number' && typeof p.y === 'number');
  }

  function isValidSizes(v) {
    return Array.isArray(v) && v.length >= 1 &&
      v.every(s => s && typeof s.w === 'number' && typeof s.h === 'number');
  }

  function defaultSizes(n) {
    return Array.from({ length: n }, () => ({ w: DEFAULT_CARD_SIZE, h: DEFAULT_CARD_SIZE }));
  }

  function defaultPositions(n) {
    const cols   = 2;
    const gap    = GRID;
    const rows   = Math.ceil(n / cols);
    const blockW = cols * DEFAULT_CARD_SIZE + (cols - 1) * gap;
    const blockH = rows * DEFAULT_CARD_SIZE + (rows - 1) * gap;
    const ox     = snap(Math.max(0, (window.innerWidth  - blockW) / 2));
    const oy     = snap(Math.max(0, (window.innerHeight - blockH) / 2));
    return Array.from({ length: n }, (_, i) => ({
      x: ox + (i % cols) * (DEFAULT_CARD_SIZE + gap),
      y: oy + Math.floor(i / cols) * (DEFAULT_CARD_SIZE + gap),
    }));
  }

  function clampPositions(ps, szs) {
    return ps.map((p, i) => ({
      x: Math.max(0, Math.min(window.innerWidth  - szs[i].w, p.x)),
      y: Math.max(0, Math.min(window.innerHeight - szs[i].h, p.y)),
    }));
  }

  // ── Load state (labels drives N; others must match N or reset) ─────────────
  const loadedLabels = loadFromStorage(
    STORAGE.labels,
    v => Array.isArray(v) && v.length >= 1,
    () => [...DEFAULT_LABELS],
  );
  const N = loadedLabels.length;

  const loadedPresets = loadFromStorage(
    STORAGE.presets,
    v => Array.isArray(v) && v.length === N,
    () => Array.from({ length: N }, (_, i) => [...(DEFAULT_PRESETS[i] ?? DEFAULT_PRESET_ROW)]),
  );

  const loadedSizes = loadFromStorage(
    STORAGE.sizes,
    v => isValidSizes(v) && v.length === N,
    () => defaultSizes(N),
  );

  let labels    = $state(loadedLabels);
  let presets   = $state(loadedPresets);
  let sizes     = $state(loadedSizes);
  let positions = $state(
    clampPositions(
      loadFromStorage(
        STORAGE.positions,
        v => isValidPositions(v) && v.length === N,
        () => defaultPositions(N),
      ),
      loadedSizes,
    )
  );

  let arranging = $state(false);

  // dragIndex used in template for class:is-dragging → needs $state
  let dragIndex  = $state(-1);
  let dragStartX = 0, dragStartY = 0;
  let cardStartX = 0, cardStartY = 0;

  let resizeIndex  = -1;
  let resizeStartX = 0, resizeStartY = 0;
  let cardStartW   = 0, cardStartH   = 0;

  // ── Field CRUD ────────────────────────────────────────────────────────────
  function handleLabelChange(index, newLabel) {
    labels[index] = newLabel;
    save(STORAGE.labels, labels);
  }

  function handlePresetsChange(index, newPresets) {
    presets[index] = newPresets;
    save(STORAGE.presets, presets);
  }

  function deleteField(i) {
    if (labels.length <= 1) return;
    labels    = labels.filter((_, j) => j !== i);
    presets   = presets.filter((_, j) => j !== i);
    positions = positions.filter((_, j) => j !== i);
    sizes     = sizes.filter((_, j) => j !== i);
    save(STORAGE.labels, labels);
    save(STORAGE.presets, presets);
    save(STORAGE.positions, positions);
    save(STORAGE.sizes, sizes);
  }

  function addField() {
    const i = labels.length;
    labels    = [...labels,    `Timer ${i + 1}`];
    presets   = [...presets,   [...DEFAULT_PRESET_ROW]];
    sizes     = [...sizes,     { w: DEFAULT_CARD_SIZE, h: DEFAULT_CARD_SIZE }];
    positions = [...positions, {
      x: snap(Math.max(0, (window.innerWidth  - DEFAULT_CARD_SIZE) / 2)),
      y: snap(Math.max(0, (window.innerHeight - DEFAULT_CARD_SIZE) / 2)),
    }];
    save(STORAGE.labels, labels);
    save(STORAGE.presets, presets);
    save(STORAGE.positions, positions);
    save(STORAGE.sizes, sizes);
  }

  function cleanUp() {
    const n = labels.length;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, positions[i].x);
      minY = Math.min(minY, positions[i].y);
      maxX = Math.max(maxX, positions[i].x + sizes[i].w);
      maxY = Math.max(maxY, positions[i].y + sizes[i].h);
    }
    const dx = snap(window.innerWidth  / 2 - (minX + maxX) / 2);
    const dy = snap(window.innerHeight / 2 - (minY + maxY) / 2);
    positions = positions.map(p => ({ x: p.x + dx, y: p.y + dy }));
    save(STORAGE.positions, positions);
  }

  // ── Drag ──────────────────────────────────────────────────────────────────
  function onPointerDown(e, i) {
    if (!arranging) return;
    dragIndex  = i;
    dragStartX = e.clientX; dragStartY = e.clientY;
    cardStartX = positions[i].x; cardStartY = positions[i].y;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (dragIndex === -1) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    positions[dragIndex] = {
      x: Math.max(0, Math.min(window.innerWidth  - sizes[dragIndex].w, snap(cardStartX + dx))),
      y: Math.max(0, Math.min(window.innerHeight - sizes[dragIndex].h, snap(cardStartY + dy))),
    };
  }

  function onPointerUp() {
    if (dragIndex === -1) return;
    save(STORAGE.positions, positions);
    dragIndex = -1;
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  function onResizeDown(e, i) {
    resizeIndex  = i;
    resizeStartX = e.clientX; resizeStartY = e.clientY;
    cardStartW   = sizes[i].w; cardStartH = sizes[i].h;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  }

  function onResizeMove(e) {
    if (resizeIndex === -1) return;
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;
    sizes[resizeIndex] = {
      w: Math.max(MIN_SIZE, snap(cardStartW + dx)),
      h: Math.max(MIN_SIZE, snap(cardStartH + dy)),
    };
  }

  function onResizeUp() {
    if (resizeIndex === -1) return;
    save(STORAGE.sizes, sizes);
    resizeIndex = -1;
  }
</script>

<div class="canvas">
  {#each labels as _, i}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="card-wrapper"
      class:is-dragging={dragIndex === i}
      style="transform: translate({positions[i].x}px, {positions[i].y}px); width: {sizes[i].w}px; height: {sizes[i].h}px"
      onpointerdown={(e) => onPointerDown(e, i)}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
    >
      <div
        class="card-inner"
        class:is-arranging={arranging}
        class:is-dragging={dragIndex === i}
        style="animation-delay: {i * WIGGLE_DELAY}s"
      >
        <CookingField
          initialLabel={labels[i]}
          initialPresets={presets[i]}
          {arranging}
          onLabelChange={(label) => handleLabelChange(i, label)}
          onPresetsChange={(p) => handlePresetsChange(i, p)}
        />
      </div>

      {#if arranging}
        {#if labels.length > 1}
          <button
            class="delete-btn"
            onpointerdown={(e) => e.stopPropagation()}
            onclick={() => deleteField(i)}
            aria-label="Delete timer"
          >×</button>
        {/if}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="resize-handle"
          onpointerdown={(e) => onResizeDown(e, i)}
          onpointermove={onResizeMove}
          onpointerup={onResizeUp}
          onpointercancel={onResizeUp}
        ></div>
      {/if}
    </div>
  {/each}

  {#if arranging}
    <div class="arrange-controls">
      <button class="add-btn" onclick={addField} title="Add timer">+</button>
      <button class="arrange-btn" onclick={cleanUp}>Clean Up</button>
      <button
        class="arrange-btn arrange-btn--active"
        onclick={() => { arranging = false; save(STORAGE.positions, positions); save(STORAGE.sizes, sizes); }}
      >Done</button>
    </div>
  {:else}
    <div class="arrange-controls">
      <button class="arrange-btn" onclick={() => { arranging = true; }}>Arrange</button>
    </div>
  {/if}
</div>

<style>
  .canvas {
    position: relative;
    width: 100%;
    height: 100dvh;
    overflow: hidden;
  }

  .card-wrapper {
    position: absolute;
    top: 0; left: 0;
    touch-action: none;
    will-change: transform;
  }

  .card-wrapper.is-dragging { z-index: 10; }

  .card-inner {
    width: 100%;
    height: 100%;
  }

  .card-inner.is-arranging {
    animation: wiggle 0.65s ease-in-out infinite;
    cursor: grab;
  }

  .card-inner.is-dragging {
    animation: none;
    cursor: grabbing;
  }

  .delete-btn {
    position: absolute;
    top: -12px; left: -12px;
    width: 28px; height: 28px;
    border-radius: 50%;
    background: var(--color-red);
    border: 2px solid var(--bg-page);
    color: #fff;
    font-size: 1.15rem; line-height: 1;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    z-index: 5;
    padding: 0;
    transition: transform 100ms ease;
  }

  .delete-btn:hover { transform: scale(1.15); }

  .resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 28px;
    height: 28px;
    cursor: nwse-resize;
    z-index: 5;
    background-image: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 2px,
      rgba(255, 255, 255, 0.22) 2px,
      rgba(255, 255, 255, 0.22) 3px
    );
    border-radius: 0 0 var(--radius) 0;
  }

  /* ── Arrange mode controls (bottom-right) ── */
  .arrange-controls {
    position: fixed;
    bottom: 20px; right: 20px;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .arrange-btn {
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    color: var(--color-muted);
    font-size: 0.8rem; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: 8px 16px;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
  }

  .arrange-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: var(--color-text);
  }

  .arrange-btn--active {
    background: rgba(59, 130, 246, 0.15);
    border-color: var(--accent);
    color: var(--accent);
  }

  .arrange-btn--active:hover { background: rgba(59, 130, 246, 0.25); }

  .add-btn {
    width: 34px; height: 34px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid var(--color-border);
    border-radius: 50%;
    color: var(--color-muted);
    font-size: 1.3rem; line-height: 1;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
  }

  .add-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--color-text);
    color: var(--color-text);
  }
</style>
