/** Qianchang Site Core — fused from 6 reference projects */
(function () {
  'use strict';

  // ===== Theme System (healthjian) =====
  const THEME_KEY = 'qc-theme';
  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
  }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(THEME_KEY, t);
    updateThemeIcon(t);
  }
  function toggleTheme() {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }
  function updateThemeIcon(t) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.innerHTML = t === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
  setTheme(getTheme());

  // ===== Navigation Injection =====
  const NAV_HTML = `
    <nav class="site-nav">
      <div class="nav-inner">
        <a href="/" class="brand">Qian<span>chang</span></a>
        <ul class="nav-links" id="nav-links">
          <li><a href="/" data-nav="home"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> 首页</a></li>
          <li><a href="/audio/" data-nav="audio"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> 音源</a></li>
          <li><a href="/projects.html" data-nav="projects"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> 项目</a></li>
          <li><a href="/post.html?slug=balar-bayesian-agentic-loop" data-nav="blog"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> 博客</a></li>
          <li><a href="/about.html" data-nav="about"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> 关于</a></li>
        </ul>
        <div class="nav-actions">
          <button class="btn-icon" id="theme-toggle" onclick="window.QCApp.toggleTheme()" title="切换主题"></button>
          <button class="mobile-menu-btn" onclick="document.getElementById('nav-links').classList.toggle('show')">☰</button>
        </div>
      </div>
    </nav>`;

  function injectNav() {
    if (document.querySelector('.site-nav')) return;
    const div = document.createElement('div');
    div.innerHTML = NAV_HTML;
    document.body.insertBefore(div.firstElementChild, document.body.firstChild);
    // Active link
    const path = location.pathname;
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === '/' ? path === '/' : path.startsWith(href.replace(/\.html$/, '')) || path.includes(href)) {
        a.classList.add('active');
      }
    });
  }

  // ===== Scroll Progress =====
  function initScrollProgress() {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.style.width = '0%';
    document.body.appendChild(bar);
    window.addEventListener('scroll', function () {
      const h = document.documentElement;
      const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
      bar.style.width = Math.min(pct, 100) + '%';
    });
  }

  // ===== Scroll to Top =====
  function initScrollTop() {
    const btn = document.createElement('button');
    btn.className = 'scroll-top';
    btn.innerHTML = '↑';
    btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.appendChild(btn);
    window.addEventListener('scroll', function () {
      btn.classList.toggle('visible', window.scrollY > 400);
    });
  }

  // ===== Footer Injection =====
  function injectFooter() {
    if (document.querySelector('.site-footer')) return;
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = '<div class="container">© Qianchang · <a href="https://github.com/QianChang-official" target="_blank" rel="noopener">GitHub</a></div>';
    document.body.appendChild(footer);
  }

  // ===== Markdown Renderer =====
  async function renderMarkdown(el, url) {
    if (!window.marked) {
      await loadScript('https://cdn.jsdelivr.net/npm/marked@12/marked.min.js');
    }
    if (!window.hljs) {
      await loadScript('https://cdn.jsdelivr.net/npm/highlight.js@11/lib/highlight.min.js');
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdn.jsdelivr.net/npm/highlight.js@11/styles/atom-one-dark.min.css';
      document.head.appendChild(css);
    }
    const res = await fetch(url);
    const md = await res.text();
    el.innerHTML = window.marked.parse(md);
    // Highlight code blocks
    el.querySelectorAll('pre code').forEach(block => {
      const pre = block.parentElement;
      pre.classList.add('code-block');
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy';
      copyBtn.textContent = '复制';
      copyBtn.onclick = function () {
        navigator.clipboard.writeText(block.textContent);
        copyBtn.textContent = '已复制';
        setTimeout(() => copyBtn.textContent = '复制', 1500);
      };
      pre.appendChild(copyBtn);
      window.hljs.highlightElement(block);
    });
    // Generate TOC
    generateTOC(el);
    // Animate headings
    el.querySelectorAll('h2, h3').forEach(h => {
      h.id = h.textContent.trim().replace(/\s+/g, '-').replace(/[^\w一-龥-]/g, '');
    });
  }

  // ===== TOC Generator (docsify style) =====
  function generateTOC(contentEl) {
    const tocEl = document.getElementById('toc-content');
    if (!tocEl) return;
    const headings = contentEl.querySelectorAll('h2, h3');
    if (!headings.length) { tocEl.parentElement.style.display = 'none'; return; }
    const ul = document.createElement('ul');
    headings.forEach(h => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      a.className = 'toc-' + h.tagName.toLowerCase();
      a.onclick = function (e) {
        e.preventDefault();
        document.getElementById(h.id).scrollIntoView({ behavior: 'smooth' });
        history.replaceState(null, null, '#' + h.id);
      };
      li.appendChild(a);
      ul.appendChild(li);
    });
    tocEl.innerHTML = '';
    tocEl.appendChild(ul);
    // Highlight active
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tocEl.querySelectorAll('a').forEach(a => a.classList.remove('active'));
          const link = tocEl.querySelector('a[href="#' + entry.target.id + '"]');
          if (link) link.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    headings.forEach(h => observer.observe(h));
  }

  // ===== Search (healthjian + docsify) =====
  let postIndex = null;
  async function initSearch() {
    if (!postIndex) {
      try {
        const res = await fetch('/content/posts.json');
        postIndex = (await res.json()).posts;
      } catch (e) { postIndex = []; }
    }
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    if (!input || !results) return;

    input.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase();
      if (!q) { results.classList.remove('show'); return; }
      const matches = postIndex.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
      results.innerHTML = matches.length
        ? matches.map(p => `
          <div class="search-result-item" onclick="location.href='/post.html?slug=${p.slug}'">
            <h4>${p.title}</h4>
            <p>${p.excerpt}</p>
          </div>`).join('')
        : '<div class="search-result-item"><p>无匹配结果</p></div>';
      results.classList.add('show');
    });

    document.addEventListener('click', e => {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.classList.remove('show');
      }
    });
  }

  // ===== Utils =====
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function getParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  // ===== Init =====
  window.QCApp = {
    toggleTheme,
    renderMarkdown,
    generateTOC,
    getParam,
    postIndex
  };

  document.addEventListener('DOMContentLoaded', function () {
    injectNav();
    injectFooter();
    initScrollProgress();
    initScrollTop();
    initSearch();
  });
})();
