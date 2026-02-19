<script>
  import WheelPicker from "./WheelPicker.svelte";

  let {
    fieldIndex,
    initialLabel,
    initialPresets,
    onLabelChange,
    onPresetsChange,
  } = $props();

  // ── State ──────────────────────────────────────────────────────────────────
  let phase = $state("idle"); // 'idle' | 'running' | 'done'
  let remainingSeconds = $state(0);
  let intervalId = $state(null);
  let doneProgress = $state(0); // 0 (green) → 1 (red) over 20s
  let doneIntervalId = $state(null);

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

  // ── Derived ────────────────────────────────────────────────────────────────
  let displayTime = $derived(formatTime(remainingSeconds));
  let isDone = $derived(phase === "done");

  // Interpolate green (#22c55e) → red (#ef4444) based on doneProgress
  let doneR = $derived(Math.round(34 + (239 - 34) * doneProgress));
  let doneG = $derived(Math.round(197 + (68 - 197) * doneProgress));
  let doneB = $derived(Math.round(94 + (68 - 94) * doneProgress));
  let doneColor = $derived(`rgb(${doneR}, ${doneG}, ${doneB})`);
  let doneGlow = $derived(`rgba(${doneR}, ${doneG}, ${doneB}, 0.35)`);
  let doneBg = $derived(`rgba(${doneR}, ${doneG}, ${doneB}, 0.12)`);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  $effect(() => {
    return () => {
      clearInterval(intervalId);
      clearInterval(doneIntervalId);
    };
  });

  // ── Auto-focus label input ─────────────────────────────────────────────────
  $effect(() => {
    if (editingLabel && labelInputEl) {
      setTimeout(() => labelInputEl?.focus(), 0);
    }
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // ── State machine ──────────────────────────────────────────────────────────
  function startTimer(seconds) {
    if (phase !== "idle") return;
    remainingSeconds = seconds;
    phase = "running";
    intervalId = setInterval(() => {
      remainingSeconds -= 1;
      if (remainingSeconds <= 0) {
        remainingSeconds = 0;
        clearInterval(intervalId);
        intervalId = null;
        doneProgress = 0;
        phase = "done";
        const doneStart = Date.now();
        const DONE_DURATION = 20000;
        doneIntervalId = setInterval(() => {
          const elapsed = Date.now() - doneStart;
          doneProgress = Math.min(1, elapsed / DONE_DURATION);
          if (doneProgress >= 1) {
            clearInterval(doneIntervalId);
            doneIntervalId = null;
          }
        }, 50);
      }
    }, 1000);
  }

  function cancelTimer() {
    clearInterval(intervalId);
    intervalId = null;
    phase = "idle";
    remainingSeconds = 0;
  }

  function acknowledgeField() {
    clearInterval(doneIntervalId);
    doneIntervalId = null;
    doneProgress = 0;
    phase = "idle";
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
  class:phase-running={phase === "running"}
  class:phase-done={isDone}
  style={isDone ? `--done-color:${doneColor};--done-glow:${doneGlow};--done-bg:${doneBg}` : ''}
  role={isDone ? "button" : undefined}
  tabindex={isDone ? 0 : undefined}
  onclick={isDone ? acknowledgeField : undefined}
  onkeydown={isDone
    ? (e) => {
        if (e.key === "Enter" || e.key === " ") acknowledgeField();
      }
    : undefined}
>
  <!-- ── IDLE: normal ──────────────────────────────────────────────────── -->
  {#if phase === "idle" && !editingPresets}
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
    </div>
  {/if}

  <!-- ── IDLE: preset editing (wheel pickers) ──────────────────────────── -->
  {#if phase === "idle" && editingPresets}
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
          {#each [0, 1, 2] as i}
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
            max={99}
            {itemHeight}
            onChange={(v) => {
              draftMins[editingPresetIndex] = v;
            }}
          />
          <span class="picker-sep">:</span>
          <WheelPicker
            value={draftSecs[editingPresetIndex]}
            min={0}
            max={59}
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
  {#if phase === "running"}
    <div class="running-content">
      <span class="label-static">{label}</span>
      <div class="countdown">{displayTime}</div>
    </div>
    <button class="btn-cancel-timer" onclick={cancelTimer}>Cancel</button>
  {/if}

  <!-- ── DONE ───────────────────────────────────────────────────────────── -->
  {#if isDone}
    <div class="done-content">
      <span class="done-label">{label}</span>
      <span class="done-icon" style="color:{doneColor}">{doneProgress < 0.5 ? "✓" : "!"}</span>
      <span class="done-hint">Tap to dismiss</span>
    </div>
  {/if}
</div>

<!-- ── Styles ──────────────────────────────────────────────────────────────── -->
<style>
  /* ── Card shell — fixed size always ── */
  .field {
    background: var(--bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 32px 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    /* Square — height always equals width, regardless of phase.
       max-height/max-width keep both rows on screen: (100vh - 32px padding - 32px gap) / 2.
       width:100% fills the grid column; max-width caps it for tall viewports.
       justify/align-self center the card in its grid cell. */
    aspect-ratio: 1 / 1;
    width: 100%;
    max-height: calc(50vh - 32px);
    max-width: calc(50vh - 32px);
    justify-self: center;
    align-self: center;
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

  .field.phase-running {
    display: grid;
    grid-template: 1fr / 1fr;
    place-items: center;
    padding: 0;
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
  }

  .label-btn {
    background: none;
    border: none;
    color: var(--color-muted);
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
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
    color: var(--color-muted);
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
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

  /* ── Running phase — centred over the full card ── */
  .running-content {
    grid-area: 1 / 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 32px 28px;
  }

  .countdown {
    font-family: var(--font-mono);
    font-size: clamp(3rem, 7vw, 6.5rem);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
    letter-spacing: -0.03em;
    line-height: 1;
    animation: fade-in 200ms ease;
  }

  .btn-cancel-timer {
    grid-area: 1 / 1;
    justify-self: stretch;
    align-self: end;
    z-index: 1;
    background: rgba(239, 68, 68, 0.08);
    border: none;
    border-top: 1px solid rgba(239, 68, 68, 0.15);
    border-radius: 0 0 var(--radius) var(--radius);
    color: rgba(239, 68, 68, 0.7);
    font-size: 0.88rem;
    font-weight: 600;
    padding: 22px;
    cursor: pointer;
    transition:
      background 150ms ease,
      color 150ms ease;
  }
  .btn-cancel-timer:hover {
    background: rgba(239, 68, 68, 0.16);
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

  .done-label {
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-muted);
  }

  .done-icon {
    font-size: 5rem;
    line-height: 1;
    font-weight: 700;
  }

  .done-hint {
    font-size: 0.75rem;
    color: var(--color-muted);
    letter-spacing: 0.04em;
  }
</style>
