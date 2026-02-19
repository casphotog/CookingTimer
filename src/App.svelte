<script>
  import CookingField from './lib/CookingField.svelte';

  const DEFAULT_LABELS = ['Timer 1', 'Timer 2', 'Timer 3', 'Timer 4'];
  const DEFAULT_PRESETS = [
    [180, 300, 600],
    [180, 300, 600],
    [180, 300, 600],
    [180, 300, 600],
  ];
  const FIELD_COUNT = DEFAULT_LABELS.length;

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

  const isValidArray = (v) => Array.isArray(v) && v.length === FIELD_COUNT;

  let labels = $state(loadFromStorage(
    'cooking-labels',
    isValidArray,
    () => [...DEFAULT_LABELS],
  ));

  let presets = $state(loadFromStorage(
    'cooking-presets',
    isValidArray,
    () => DEFAULT_PRESETS.map(row => [...row]),
  ));

  function handleLabelChange(index, newLabel) {
    labels[index] = newLabel;
    try {
      localStorage.setItem('cooking-labels', JSON.stringify(labels));
    } catch {}
  }

  function handlePresetsChange(index, newPresets) {
    presets[index] = newPresets;
    try {
      localStorage.setItem('cooking-presets', JSON.stringify(presets));
    } catch {}
  }
</script>

<main>
  {#each labels as _, i}
    <CookingField
      initialLabel={labels[i]}
      initialPresets={presets[i]}
      onLabelChange={(label) => handleLabelChange(i, label)}
      onPresetsChange={(p) => handlePresetsChange(i, p)}
    />
  {/each}
</main>

<style>
  main {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 32px;
    /* Max-width matches 2 field max-widths + gap so columns hug the fields tightly,
       keeping horizontal and vertical spacing equal. */
    width: 100%;
    max-width: calc(2 * (50vh - 32px) + 32px);
    margin: 0 auto;
  }

  @media (max-width: 500px) {
    main {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
