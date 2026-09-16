// Apply the saved theme before the first paint to avoid a flash of the wrong colours.
try {
  var saved = JSON.parse(localStorage.getItem('settings') || '{}').theme;
  var dark = saved === 'dark' || (saved !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch (e) {}
