<script>
  import WheelPicker from "./WheelPicker.svelte";

  // ── Constants ──────────────────────────────────────────────────────────────
  const PHASES = { IDLE: 'idle', RUNNING: 'running', DONE: 'done', STOPWATCH: 'stopwatch' };

  const DONE_DURATION_MS    = 20_000;
  const DONE_TICK_MS        = 50;
  const ICON_SWITCH_THRESHOLD = 0.5;

  const GREEN_RGB        = [34, 197, 94];  // #22c55e
  const RED_RGB          = [239, 68, 68];  // #ef4444
  const DONE_GLOW_ALPHA  = 0.35;
  const DONE_BG_ALPHA    = 0.12;

  const MAX_MINS = 99;
  const MAX_SECS = 59;

  let {
    initialLabel,
    initialPresets,
    arranging = false,
    onLabelChange,
    onPresetsChange,
  } = $props();

  // ── State ──────────────────────────────────────────────────────────────────
  let phase = $state(PHASES.IDLE);
  let remainingSeconds = $state(0);
  let intervalId = null;
  let doneProgress = $state(0); // 0 (green) → 1 (red) over DONE_DURATION_MS
  let doneIntervalId = null;

  let elapsedSeconds = $state(0);
  let stopwatchPaused = $state(false);
  let stopwatchIntervalId = null;

  let label = $state(initialLabel);
  let editingLabel = $state(false);
  let labelDraft = $state("");
  let labelInputEl = $state(null);

  let presets = $state([...initialPresets]);
  let editingPresets = $state(false);
  let editingPresetIndex = $state(0);
  let draftMins = $state([0, 0, 0]);
  let draftSecs = $state([0, 0, 0]);

  // Height of the pickers-row flex cell — measured after layout so the
  // WheelPicker can scale its item height to exactly fill the space.
  let pickersRowHeight = $state(0);
  let itemHeight = $derived(
    pickersRowHeight > 4 ? Math.floor(pickersRowHeight / 5) : 50,
  );

  // ── Helpers ────────────────────────────────────────────────────────────────
  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatElapsed(secs) {
    if (secs < 3600) return formatTime(secs);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // Interpolate between two RGB colours over progress [0,1]
  function lerpRgb(r1, g1, b1, r2, g2, b2, t) {
    return {
      r: Math.round(r1 + (r2 - r1) * t),
      g: Math.round(g1 + (g2 - g1) * t),
      b: Math.round(b1 + (b2 - b1) * t),
    };
  }

  function buildDoneStyle(progress) {
    const { r, g, b } = lerpRgb(...GREEN_RGB, ...RED_RGB, progress);
    return [
      `--done-color:rgb(${r},${g},${b})`,
      `--done-glow:rgba(${r},${g},${b},${DONE_GLOW_ALPHA})`,
      `--done-bg:rgba(${r},${g},${b},${DONE_BG_ALPHA})`,
    ].join(";");
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  let displayTime = $derived(formatTime(remainingSeconds));
  let displayElapsed = $derived(formatElapsed(elapsedSeconds));
  let isDone = $derived(phase === PHASES.DONE);
  let doneStyle = $derived(isDone ? buildDoneStyle(doneProgress) : "");
  let doneIcon = $derived(doneProgress < ICON_SWITCH_THRESHOLD ? "✓" : "!");

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  $effect(() => {
    return () => {
      clearInterval(intervalId);
      clearInterval(doneIntervalId);
      clearInterval(stopwatchIntervalId);
    };
  });

  // ── Auto-focus label input ─────────────────────────────────────────────────
  $effect(() => {
    if (editingLabel && labelInputEl) {
      setTimeout(() => labelInputEl?.focus(), 0);
    }
  });

  // ── State machine ──────────────────────────────────────────────────────────
  function startDoneProgress() {
    const doneStart = Date.now();
    doneIntervalId = setInterval(() => {
      doneProgress = Math.min(1, (Date.now() - doneStart) / DONE_DURATION_MS);
      if (doneProgress >= 1) {
        clearInterval(doneIntervalId);
        doneIntervalId = null;
      }
    }, DONE_TICK_MS);
  }

  function startTimer(seconds) {
    if (phase !== PHASES.IDLE) return;
    remainingSeconds = seconds;
    phase = PHASES.RUNNING;
    intervalId = setInterval(() => {
      remainingSeconds -= 1;
      if (remainingSeconds <= 0) {
        remainingSeconds = 0;
        clearInterval(intervalId);
        intervalId = null;
        doneProgress = 0;
        phase = PHASES.DONE;
        startDoneProgress();
      }
    }, 1000);
  }

  function cancelTimer() {
    clearInterval(intervalId);
    intervalId = null;
    phase = PHASES.IDLE;
    remainingSeconds = 0;
  }

  // ── Stopwatch ──────────────────────────────────────────────────────────────
  function startStopwatch() {
    if (phase !== PHASES.IDLE) return;
    elapsedSeconds = 0;
    stopwatchPaused = false;
    phase = PHASES.STOPWATCH;
    stopwatchIntervalId = setInterval(() => { elapsedSeconds += 1; }, 1000);
  }

  function toggleStopwatch() {
    if (phase !== PHASES.STOPWATCH) return;
    if (stopwatchPaused) {
      stopwatchPaused = false;
      stopwatchIntervalId = setInterval(() => { elapsedSeconds += 1; }, 1000);
    } else {
      clearInterval(stopwatchIntervalId);
      stopwatchIntervalId = null;
      stopwatchPaused = true;
    }
  }

  function cancelStopwatch() {
    clearInterval(stopwatchIntervalId);
    stopwatchIntervalId = null;
    elapsedSeconds = 0;
    stopwatchPaused = false;
    phase = PHASES.IDLE;
  }

  function acknowledgeField() {
    clearInterval(doneIntervalId);
    doneIntervalId = null;
    doneProgress = 0;
    phase = PHASES.IDLE;
    remainingSeconds = 0;
  }

  // ── Label editing ──────────────────────────────────────────────────────────
  function startEditingLabel() {
    labelDraft = label;
    editingLabel = true;
  }

  function saveLabelEdit() {
    const trimmed = labelDraft.trim();
    if (trimmed) {
      label = trimmed;
      onLabelChange(trimmed);
    }
    editingLabel = false;
  }

  function cancelLabelEdit() {
    editingLabel = false;
  }

  function handleLabelKeydown(e) {
    if (e.key === "Enter") saveLabelEdit();
    if (e.key === "Escape") cancelLabelEdit();
  }

  // ── Preset editing ─────────────────────────────────────────────────────────
  function startEditingPresets() {
    draftMins = presets.map((s) => Math.floor(s / 60));
    draftSecs = presets.map((s) => s % 60);
    editingPresetIndex = 0;
    editingPresets = true;
  }

  function savePresetsEdit() {
    const newPresets = draftMins.map((m, i) => {
      const total = m * 60 + draftSecs[i];
      return total > 0 ? total : 60;
    });
    presets = newPresets;
    onPresetsChange([...newPresets]);
    editingPresets = false;
  }

  function cancelPresetsEdit() {
    editingPresets = false;
  }
</script>

<!-- ── Template ───────────────────────────────────────────────────────────── -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="field"
  class:phase-running={phase === PHASES.RUNNING}
  class:phase-stopwatch={phase === PHASES.STOPWATCH}
  class:phase-done={isDone}
  style={doneStyle}
  role={isDone && !arranging ? "button" : undefined}
  tabindex={isDone && !arranging ? 0 : undefined}
  onclick={isDone && !arranging ? acknowledgeField : undefined}
  onkeydown={isDone && !arranging
    ? (e) => {
        if (e.key === "Enter" || e.key === " ") acknowledgeField();
      }
    : undefined}
>
  <!-- ── IDLE: normal ──────────────────────────────────────────────────── -->
  {#if phase === PHASES.IDLE && !editingPresets}
    <div class="field-header">
      {#if editingLabel}
        <input
          class="label-input"
          bind:this={labelInputEl}
          bind:value={labelDraft}
          onblur={saveLabelEdit}
          onkeydown={handleLabelKeydown}
          maxlength={24}
          aria-label="Edit timer name"
        />
      {:else}
        <button
          class="label-btn"
          onclick={startEditingLabel}
          title="Click to rename"
        >
          {label}
        </button>
      {/if}

      {#if !editingLabel}
        <button
          class="icon-btn"
          onclick={startEditingPresets}
          title="Edit presets"
          aria-label="Edit preset times"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
            />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      {/if}
    </div>

    <!-- Stacked preset buttons fill remaining card height -->
    <div class="presets">
      {#each presets as secs}
        <button class="preset-btn" onclick={() => startTimer(secs)}>
          {formatTime(secs)}
        </button>
      {/each}
      <button class="preset-btn preset-btn--stopwatch" onclick={startStopwatch} title="Count up">
        ⏱
      </button>
    </div>
  {/if}

  <!-- ── IDLE: preset editing (wheel pickers) ──────────────────────────── -->
  {#if phase === PHASES.IDLE && editingPresets}
    <div class="field-header">
      <span class="label-static">{label}</span>
    </div>

    <div class="preset-edit">
      <!-- Prev / dot-navigation / Next -->
      <div class="preset-nav">
        <button
          class="nav-btn"
          onclick={() => {
            if (editingPresetIndex > 0) editingPresetIndex--;
          }}
          disabled={editingPresetIndex === 0}
          aria-label="Previous preset">‹</button
        >

        <div class="preset-dots">
          {#each presets as _, i}
            <button
              class="dot"
              class:active={i === editingPresetIndex}
              onclick={() => {
                editingPresetIndex = i;
              }}
              aria-label={`Preset ${i + 1}`}
            ></button>
          {/each}
        </div>

        <button
          class="nav-btn"
          onclick={() => {
            if (editingPresetIndex < 2) editingPresetIndex++;
          }}
          disabled={editingPresetIndex === 2}
          aria-label="Next preset">›</button
        >
      </div>

      <!-- pickers-row: flex:1 fills remaining card space; clientHeight feeds itemHeight -->
      <div class="pickers-row" bind:clientHeight={pickersRowHeight}>
        {#key editingPresetIndex}
          <WheelPicker
            value={draftMins[editingPresetIndex]}
            min={0}
            max={MAX_MINS}
            {itemHeight}
            onChange={(v) => {
              draftMins[editingPresetIndex] = v;
            }}
          />
          <span class="picker-sep">:</span>
          <WheelPicker
            value={draftSecs[editingPresetIndex]}
            min={0}
            max={MAX_SECS}
            {itemHeight}
            onChange={(v) => {
              draftSecs[editingPresetIndex] = v;
            }}
          />
        {/key}
      </div>

      <div class="edit-actions">
        <button class="btn-save" onclick={savePresetsEdit}>Save</button>
        <button class="btn-cancel" onclick={cancelPresetsEdit}>Cancel</button>
      </div>
    </div>
  {/if}

  <!-- ── RUNNING ────────────────────────────────────────────────────────── -->
  {#if phase === PHASES.RUNNING}
    <div class="field-header">
      <span class="label-static">{label}</span>
    </div>
    <div class="presets presets--running">
      <div class="running-display">
        <div class="countdown">{displayTime}</div>
      </div>
      <button class="preset-btn btn-cancel-timer" onclick={cancelTimer}>Cancel</button>
    </div>
  {/if}

  <!-- ── STOPWATCH ──────────────────────────────────────────────────────── -->
  {#if phase === PHASES.STOPWATCH}
    <div class="field-header">
      <span class="label-static">{label}</span>
    </div>
    <div class="presets presets--running">
      <div
        class="running-display"
        role="button"
        tabindex="0"
        onclick={toggleStopwatch}
        onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') toggleStopwatch(); }}
      >
        <div class="countdown" class:is-paused={stopwatchPaused}>{displayElapsed}</div>
        {#if stopwatchPaused}
          <div class="stopwatch-hint">paused · tap to resume</div>
        {/if}
      </div>
      <button class="preset-btn btn-cancel-timer" onclick={cancelStopwatch}>Cancel</button>
    </div>
  {/if}

  <!-- ── DONE ───────────────────────────────────────────────────────────── -->
  {#if isDone}
    <div class="done-content">
      <span class="done-label">{label}</span>
      <span class="done-icon" style="color:var(--done-color)">{doneIcon}</span>
      <span class="done-hint">Tap to dismiss</span>
    </div>
  {/if}
</div>

<!-- ── Styles ──────────────────────────────────────────────────────────────── -->
<style>
  /* ── Card shell — fills fixed-size wrapper ── */
  .field {
    background: var(--bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    height: 100%;
    position: relative;
    min-width: 0;
    overflow: hidden;
    transition:
      box-shadow 250ms ease,
      border-color 250ms ease,
      background-color 250ms ease;
    cursor: default;
    user-select: none;
  }

  .field.phase-running,
  .field.phase-stopwatch {
    border-color: var(--accent);
    box-shadow:
      0 0 0 1px var(--accent),
      0 0 20px 4px var(--accent-glow);
  }


  .field.phase-done {
    display: grid;
    place-items: center;
    border-color: var(--done-color);
    animation: flash-done 1s ease-in-out infinite;
    cursor: pointer;
  }

  /* ── Header (idle modes only) ── */
  .field-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    min-height: 25px; /* icon-btn height — keeps label vertically consistent with/without icon */
  }

  /* Shared label typography (button, static span, done phase label) */
  /* Note: :is() not supported in Safari < 14, so expanded to individual selectors */
  .label-btn, .label-static, .done-label {
    color: var(--color-muted);
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .label-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 150ms ease;
    text-align: left;
    flex: 1;
  }
  .label-btn:hover {
    color: var(--color-text);
  }

  .label-static {
    flex: 1;
  }

  .label-input {
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--accent);
    color: var(--color-text);
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 0;
    outline: none;
    flex: 1;
    min-width: 0;
  }

  .icon-btn {
    background: none;
    border: none;
    color: var(--color-muted);
    cursor: pointer;
    padding: 5px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      color 150ms ease,
      background 150ms ease;
    line-height: 1;
  }
  .icon-btn:hover {
    color: var(--color-text);
    background: rgba(255, 255, 255, 0.06);
  }

  /* ── Idle: stacked preset buttons fill remaining height ── */
  .presets {
    flex: 1; /* expand to fill card after header */
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
  }


  .preset-btn {
    flex: 1; /* equal share of .presets height */
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    color: var(--color-text);
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition:
      background 150ms ease,
      border-color 150ms ease,
      transform 80ms ease;
    white-space: nowrap;
    min-height: 0;
  }
  .preset-btn:hover {
    background: rgba(59, 130, 246, 0.12);
    border-color: var(--accent);
  }
  .preset-btn:active {
    transform: scale(0.97);
  }

  .preset-btn--stopwatch {
    font-size: 1.4rem;
    color: var(--color-muted);
    border-color: rgba(255, 255, 255, 0.08);
  }
  .preset-btn--stopwatch:hover {
    background: rgba(34, 197, 94, 0.1);
    border-color: var(--color-green);
    color: var(--color-green);
  }

  /* ── Preset edit: wheel picker layout ── */
  .preset-edit {
    flex: 1; /* fills card after header */
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
  }

  .preset-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .nav-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text);
    font-size: 1.4rem;
    line-height: 1;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 150ms ease;
    flex-shrink: 0;
  }
  .nav-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
  }
  .nav-btn:disabled {
    opacity: 0.2;
    cursor: default;
  }

  .preset-dots {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.18);
    cursor: pointer;
    padding: 0;
    transition:
      background 200ms ease,
      transform 200ms ease;
  }
  .dot.active {
    background: var(--accent);
    transform: scale(1.4);
  }

  /* Pickers row — expands to absorb all remaining height */
  .pickers-row {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: stretch; /* children fill the full row height */
    gap: 8px;
  }

  /* Each WheelPicker wrapper gets equal width */
  .pickers-row :global(.picker) {
    flex: 1;
    width: auto;
  }

  .picker-sep {
    font-family: var(--font-mono);
    font-size: 2rem;
    font-weight: 700;
    color: rgba(232, 232, 232, 0.25);
    line-height: 1;
    width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .edit-actions {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
  }

  .btn-save {
    flex: 1;
    background: var(--accent);
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 0.88rem;
    font-weight: 600;
    padding: 10px 20px;
    cursor: pointer;
    transition: opacity 150ms ease;
  }
  .btn-save:hover {
    opacity: 0.85;
  }

  .btn-cancel {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-muted);
    font-size: 0.88rem;
    padding: 10px 18px;
    cursor: pointer;
    transition: background 150ms ease;
  }
  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  /* ── Running / stopwatch: countdown fills space above cancel button ── */
  .running-display {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    cursor: default;
  }

  .countdown {
    font-family: var(--font-mono);
    font-size: 5rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
    letter-spacing: -0.03em;
    line-height: 1;
    animation: fade-in 200ms ease;
    transition: opacity 200ms ease;
  }

  .countdown.is-paused {
    opacity: 0.45;
  }

  .stopwatch-hint {
    position: absolute;
    bottom: 8px;
    left: 0; right: 0;
    text-align: center;
    font-size: 0.72rem;
    color: var(--color-muted);
    letter-spacing: 0.06em;
    pointer-events: none;
  }

  /* Cancel button shares preset-btn shape; these rules override only color/font/size.
     flex-basis is derived from idle mode: (container-height - 3×gap) / 4 buttons.
     100% resolves to the flex container's main size (height) per CSS spec. */
  .btn-cancel-timer {
    flex: 0 0 calc((100% - 30px) / 4);
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.2);
    color: rgba(239, 68, 68, 0.7);
    font-family: inherit;
    font-size: 0.88rem;
  }
  .btn-cancel-timer:hover {
    background: rgba(239, 68, 68, 0.16);
    border-color: rgba(239, 68, 68, 0.4);
    color: var(--color-red);
  }

  /* ── Done phase ── */
  .done-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }

  /* .done-label typography comes from the shared :is() rule above */

  .done-icon {
    font-size: 3rem;
    line-height: 1;
    font-weight: 700;
  }

  .done-hint {
    font-size: 0.75rem;
    color: var(--color-muted);
    letter-spacing: 0.04em;
  }
</style>
