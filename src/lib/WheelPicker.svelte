<script>
  import { untrack } from 'svelte';

  // itemHeight is passed by the parent so the picker scales to any container size.
  // Default 50 is used only on the very first render before clientHeight resolves.
  let { value, min, max, pad = 2, itemHeight = 50, onChange } = $props();

  // min/max are static constants in this app — compute once
  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  let scrollEl  = $state(null);
  let scrollTimer = null;
  let settling  = false; // prevents the sync-effect from fighting a snap in flight

  // Re-position scroll whenever the element mounts OR itemHeight changes
  // (height changes shift all snap points, so we must recalculate scrollTop).
  // untrack(value/min) to avoid a reactive loop: onChange → value → effect → scroll.
  $effect(() => {
    const el = scrollEl;    // tracked — fires on mount
    const h  = itemHeight;  // tracked — fires when container resizes
    if (!el || h <= 0) return;
    const v = untrack(() => value);
    const m = untrack(() => min);
    el.scrollTop = (v - m) * h;
  });

  function onScroll() {
    if (settling) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (!scrollEl) return;
      const h       = itemHeight;
      const index   = Math.round(scrollEl.scrollTop / h);
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      settling = true;
      scrollEl.scrollTo({ top: clamped * h, behavior: 'smooth' });
      setTimeout(() => { settling = false; }, 350);
      const newVal = min + clamped;
      if (newVal !== value) onChange(newVal);
    }, 80);
  }

  // Derived inline-style values (heights depend on itemHeight prop)
  let spacerH    = $derived(itemHeight * 2);
  let pickerH    = $derived(itemHeight * 5);
  let fontSize   = $derived(`${Math.max(0.9, itemHeight * 0.036)}rem`);
</script>

<div class="picker" style="height:{pickerH}px">
  <!-- Gradient masks fade the non-selected rows into the card background -->
  <div class="mask mask-top"    style="height:{spacerH}px"></div>
  <div class="mask mask-bottom" style="height:{spacerH}px"></div>
  <!-- Highlight box sits behind the centre item -->
  <div class="highlight" style="top:{spacerH}px; height:{itemHeight}px"></div>

  <div class="scroll" bind:this={scrollEl} onscroll={onScroll}>
    <div class="spacer" style="height:{spacerH}px"></div>
    {#each items as item}
      <div class="item" class:selected={item === value} style="height:{itemHeight}px; font-size:{fontSize}">
        {String(item).padStart(pad, '0')}
      </div>
    {/each}
    <div class="spacer" style="height:{spacerH}px"></div>
  </div>
</div>

<style>
  .picker {
    position: relative;
    width: 100%;          /* fills its flex cell; parent controls width */
    overflow: hidden;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    flex-shrink: 0;
  }

  .scroll {
    height: 100%;
    overflow-y: scroll;
    scroll-snap-type: y mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .scroll::-webkit-scrollbar { display: none; }

  .spacer { flex-shrink: 0; }

  .item {
    display: flex;
    align-items: center;
    justify-content: center;
    scroll-snap-align: center;
    font-family: var(--font-mono);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: rgba(232, 232, 232, 0.18);
    user-select: none;
    transition: color 100ms ease;
  }
  .item.selected {
    color: var(--color-text);
    font-weight: 700;
  }

  .highlight {
    position: absolute;
    left: 10px;
    right: 10px;
    border-radius: 10px;
    background: rgba(59, 130, 246, 0.1);
    border-top: 1px solid rgba(59, 130, 246, 0.28);
    border-bottom: 1px solid rgba(59, 130, 246, 0.28);
    pointer-events: none;
    z-index: 1;
  }

  .mask {
    position: absolute;
    left: 0;
    right: 0;
    pointer-events: none;
    z-index: 2;
  }
  .mask-top {
    top: 0;
    background: linear-gradient(to bottom, #1a1a1a 15%, rgba(26, 26, 26, 0));
  }
  .mask-bottom {
    bottom: 0;
    background: linear-gradient(to top, #1a1a1a 15%, rgba(26, 26, 26, 0));
  }
</style>
