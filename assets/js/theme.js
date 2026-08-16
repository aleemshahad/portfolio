(function(){
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');

  // init from saved preference or system
  const saved = localStorage.getItem('site-theme');
  function applyTheme(theme){
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      btn.setAttribute('aria-pressed','true');
      icon.className = 'fa-solid fa-sun';
    } else {
      document.documentElement.classList.remove('light');
      btn.setAttribute('aria-pressed','false');
      icon.className = 'fa-regular fa-moon';
    }
  }

  if (saved) applyTheme(saved);
  else {
    const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light':'dark';
    applyTheme(prefers);
  }

  btn.addEventListener('click', function(){
    const isLight = document.documentElement.classList.toggle('light');
    const theme = isLight ? 'light' : 'dark';
    localStorage.setItem('site-theme', theme);
    applyTheme(theme);
  });
})();
