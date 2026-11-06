/* DSH lazy-CJS browser half; intentionally no ESM import or shared React copy. */
window.__ModuleLoader__.load({
  id: 'dsh-pseudo-insideout',
  factory(require) {
    const React = require('react')
    const panelId = 'pseudo-insideout'
    function InsideOutConsole() {
      return React.createElement('div', {
        style: { width: '100%', minHeight: 0, height: '100%' },
      }, React.createElement('iframe', {
        src: '/pseudo-insideout/',
        title: 'Pseudo Inside Out 记忆总部控制台',
        style: { display: 'block', width: '100%', height: '100%', minHeight: 0, border: '0', borderRadius: '12px' },
        referrerPolicy: 'same-origin',
      }))
    }
    function InsideOutPanel() {
      return React.createElement('section', {
        'aria-label': '记忆总部',
        style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: 0, minWidth: 0 },
      }, React.createElement('header', {
        'data-window-drag': '',
        style: {
          display: 'flex', alignItems: 'center', flexShrink: 0,
          height: 'max(44px, var(--dsh-frame-top-clearance, 0px))',
          // The host reserves this inset for its collapsed-sidebar/window controls.
          paddingInlineStart: 'max(20px, var(--dsh-frame-leading-clearance, 0px))',
          paddingInlineEnd: '20px', fontSize: '14px', fontWeight: 600,
        },
      }, '记忆总部'), React.createElement('div', {
        style: { flex: 1, minHeight: 0 },
      }, React.createElement(InsideOutConsole)))
    }
    function MemoryIcon({ size = 16 } = {}) {
      return React.createElement('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
        'aria-hidden': true, focusable: false,
      }, React.createElement('circle', { cx: 12, cy: 12, r: 8 }),
      React.createElement('circle', { cx: 12, cy: 12, r: 3 }),
      React.createElement('path', { d: 'M5 5 3 3m16 16 2 2M19 5l2-2M5 19l-2 2' }))
    }
    return {
      name: 'pseudo-insideout-client',
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: panelId,
        }, InsideOutPanel))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: panelId,
          order: 20,
          label: '记忆总部',
        }, MemoryIcon))
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: panelId,
          order: 45,
          label: '记忆总部 · Pseudo Inside Out',
        }, InsideOutConsole))
      },
    }
  },
})
