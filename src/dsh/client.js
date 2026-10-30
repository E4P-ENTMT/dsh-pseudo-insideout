/* DSH lazy-CJS browser half; intentionally no ESM import or shared React copy. */
window.__ModuleLoader__.load({
  id: 'dsh-pseudo-insideout',
  factory(require) {
    const React = require('react')
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
    return {
      name: 'pseudo-insideout-client',
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'pseudo-insideout',
          order: 45,
          label: '记忆总部 · Pseudo Inside Out',
        }, InsideOutConsole))
      },
    }
  },
})
