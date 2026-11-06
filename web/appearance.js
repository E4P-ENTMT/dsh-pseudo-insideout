/* Apply the saved palette before styles paint, including inside the DSH webview. */
(() => {
  'use strict';
  const storageKey = 'insideout.appearance.v1';
  const themes = [
    { id: 'nebula', name: '星云紫', description: '熟悉的紫色总部与暖金微光', scheme: 'dark', colors: { bg: '#17152b', sidebar: '#141224', panel: '#242038', 'panel-2': '#302a46', field: '#1c192f', border: '#49415f', 'border-strong': '#76698e', text: '#f6f0ff', muted: '#c6bdd8', dim: '#afa3c5', accent: '#f3d780', 'accent-hover': '#ffe7a2', 'on-accent': '#30250c', purple: '#c5aff4', gold: '#f3d780' } },
    { id: 'ocean', name: '深海蓝', description: '沉静海军蓝，点亮一抹冰蓝', scheme: 'dark', colors: { bg: '#101d2c', sidebar: '#0c1724', panel: '#192b3d', 'panel-2': '#23394f', field: '#122335', border: '#355069', 'border-strong': '#637f98', text: '#edf5ff', muted: '#b4ccdf', dim: '#97b4cc', accent: '#83d9ef', 'accent-hover': '#b0ecfa', 'on-accent': '#102a36', purple: '#b1bff2', gold: '#efcf8a' } },
    { id: 'forest', name: '松林绿', description: '墨绿与柔和鼠尾草，安静专注', scheme: 'dark', colors: { bg: '#141f1c', sidebar: '#101a17', panel: '#20312a', 'panel-2': '#2c4036', field: '#18261f', border: '#405c4c', 'border-strong': '#718f7c', text: '#eef6e9', muted: '#bfd0bf', dim: '#a3bba7', accent: '#c3dda2', 'accent-hover': '#deefc4', 'on-accent': '#24301b', purple: '#cab9e4', gold: '#e4d394' } },
    { id: 'dawn', name: '晨光白', description: '暖白纸面与琥珀色，适合白天', scheme: 'light', colors: { bg: '#f5f1e9', sidebar: '#eee8dc', panel: '#fffcf6', 'panel-2': '#eee6d8', field: '#fffdf9', border: '#d6ccba', 'border-strong': '#a8987d', text: '#342d25', muted: '#65594b', dim: '#71614c', accent: '#83541b', 'accent-hover': '#684214', 'on-accent': '#ffffff', purple: '#74558c', gold: '#83541b' } },
    { id: 'mist', name: '雾月灰', description: '清爽冷灰与靛蓝，留白更轻盈', scheme: 'light', colors: { bg: '#f1f4f8', sidebar: '#e8edf4', panel: '#ffffff', 'panel-2': '#e9eef7', field: '#fafcff', border: '#cbd4e2', 'border-strong': '#8c9bb4', text: '#263249', muted: '#53627a', dim: '#5d6b83', accent: '#455bb0', 'accent-hover': '#32458e', 'on-accent': '#ffffff', purple: '#7956a4', gold: '#86600e' } },
  ];
  for (const theme of themes) { Object.freeze(theme.colors); Object.freeze(theme); }
  Object.freeze(themes);
  const defaults = { theme: 'nebula', density: 'comfortable', memoryView: 'orbs' };
  const normalize = value => ({
    theme: value?.theme === 'system' || themes.some(theme => theme.id === value?.theme) ? value.theme : defaults.theme,
    density: value?.density === 'compact' ? 'compact' : defaults.density,
    memoryView: ['orbs', 'grid', 'list'].includes(value?.memoryView) ? value.memoryView : defaults.memoryView,
  });
  const read = () => { try { return normalize(JSON.parse(localStorage.getItem(storageKey))); } catch { return { ...defaults }; } };
  let preferences = read();
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  const resolved = () => themes.find(theme => theme.id === (preferences.theme === 'system' ? system?.matches ? 'nebula' : 'dawn' : preferences.theme));
  function apply() {
    const theme = resolved(), root = document.documentElement;
    root.dataset.theme = theme.id;
    root.dataset.colorScheme = theme.scheme;
    root.dataset.density = preferences.density;
    root.style.colorScheme = theme.scheme;
    for (const [name, color] of Object.entries(theme.colors)) root.style.setProperty(`--${name}`, color);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors.bg);
    document.dispatchEvent(new CustomEvent('insideout:appearance', { detail: { ...preferences } }));
  }
  window.InsideOutAppearance = Object.freeze({
    themes,
    get preferences() { return { ...preferences }; },
    get resolved() { return resolved(); },
    set(patch) {
      preferences = normalize({ ...preferences, ...patch });
      let saved = true;
      try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { saved = false; }
      apply();
      return { saved, ...preferences };
    },
  });
  system?.addEventListener?.('change', () => { if (preferences.theme === 'system') apply(); });
  window.addEventListener('storage', event => { if (event.key === storageKey || event.key === null) { preferences = read(); apply(); } });
  apply();
})();
