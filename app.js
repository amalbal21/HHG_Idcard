/* ==========================================================================
   HH Goa 2026 Builder Pass Studio — App Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ── STATE ── */
  let airportsData = [], rolesData = {}, jokesData = { two_liners: [] };
  let ticketSvgTemplate = '';
  let rawPhotoImg = null;
  let zoomVal = 1, panX = 0, panY = 0;
  let isDragging = false, startX = 0, startY = 0;
  let liveTimer = null;
  let currentJoke = null;
  let currentRoleTitleMap = {};

  function pickRandomJoke() {
    const allJokes = [
      ...(jokesData.two_liners || []),
      ...(jokesData.one_liners || []).map(line => ({ top: line, bottom: '' }))
    ];
    if (allJokes.length > 0) {
      currentJoke = allJokes[Math.floor(Math.random() * allJokes.length)];
    }
  }

  function getRoleTitle(roleKey) {
    if (currentRoleTitleMap[roleKey]) {
      return currentRoleTitleMap[roleKey];
    }
    const titles = rolesData[roleKey] || ['CODE SCULPTOR'];
    const picked = titles[Math.floor(Math.random() * titles.length)];
    currentRoleTitleMap[roleKey] = picked;
    return picked;
  }

  /* ── SCROLL REVEAL ── */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  /* ── DOM ── */
  const photoInput    = document.getElementById('photo-input');
  const dropZone      = document.getElementById('drop-zone');
  const dzEmpty       = document.getElementById('upload-placeholder');
  const dzPreview     = document.getElementById('upload-preview');
  const avatarVp      = document.getElementById('avatar-viewport');
  const avatarImg     = document.getElementById('avatar-img');
  const removeBtn     = document.getElementById('remove-photo-btn');
  const changeBtn     = document.getElementById('change-photo-btn');
  const zoomSlider    = document.getElementById('zoom-slider');
  const zoomReset     = document.getElementById('zoom-reset-btn');

  const nameInput     = document.getElementById('name-input');
  const nameCounter   = document.getElementById('name-counter');

  const airportWrap   = document.getElementById('airport-wrap');
  const airportFace   = document.getElementById('airport-trigger');
  const airportSelTxt = document.getElementById('airport-selected');
  const airportPanel  = document.getElementById('airport-panel');
  const airportSearch = document.getElementById('airport-search');
  const airportList   = document.getElementById('airport-list');
  const selCity       = document.getElementById('sel-city');
  const selIata       = document.getElementById('sel-iata');

  const roleWrap      = document.getElementById('role-wrap');
  const roleFace      = document.getElementById('role-trigger');
  const roleSelTxt    = document.getElementById('role-selected');
  const rolePanel     = document.getElementById('role-panel');
  const roleSearch    = document.getElementById('role-search');
  const roleList      = document.getElementById('role-list');
  const selRole       = document.getElementById('sel-role');

  const fmtPills      = document.querySelectorAll('.fmt-pill');
  const modeRadios    = document.querySelectorAll('input[name="mode"]');

  const livePreview   = document.getElementById('live-preview');
  const previewEmpty  = document.getElementById('preview-empty');
  const renderStatus  = document.getElementById('render-status');
  const renderCanvas  = document.getElementById('render-canvas');
  const downloadBtn   = document.getElementById('download-btn');
  const copyBtn       = document.getElementById('copy-btn');
  const shareBtn      = document.getElementById('share-btn');

  /* ── INIT ── */
  async function init() {
    try {
      const [airports, roles, jokes, svg] = await Promise.all([
        fetch('airports.json').then(r => r.json()),
        fetch('roles.json').then(r => r.json()),
        fetch('jokes.json').then(r => r.json()),
        fetch('ticket.svg').then(r => r.text()),
      ]);
      airportsData = airports;
      rolesData = roles;
      jokesData = jokes;
      ticketSvgTemplate = svg;

      pickRandomJoke();

      buildList(airportList, airports.map(a => ({
        label: a.city,
        badge: a.iata,
        onSelect: () => {
          selCity.value = a.city;
          selIata.value = a.iata;
          airportSelTxt.innerHTML = `${a.city} <span class="iata-badge">${a.iata}</span>`;
          closeAll();
          trigger();
        }
      })));

      buildList(roleList, Object.keys(roles).map(k => ({
        label: k,
        badge: null,
        onSelect: () => {
          selRole.value = k;
          roleSelTxt.textContent = k;
          // Re-pick title for newly selected role
          const titles = roles[k] || ['CODE SCULPTOR'];
          currentRoleTitleMap[k] = titles[Math.floor(Math.random() * titles.length)];
          closeAll();
          trigger();
        }
      })));

      // Defaults
      const defAirport = airports.find(a => a.iata === 'TRZ') || airports[0];
      if (defAirport) {
        selCity.value = defAirport.city;
        selIata.value = defAirport.iata;
        airportSelTxt.innerHTML = `${defAirport.city} <span class="iata-badge">${defAirport.iata}</span>`;
      }
      const defRole = Object.keys(roles)[0];
      if (defRole) { selRole.value = defRole; roleSelTxt.textContent = defRole; }

      trigger();
    } catch (e) { console.error('[Studio] Init failed:', e); }
  }

  init();

  function buildList(container, items) {
    container.innerHTML = '';
    items.forEach(({ label, badge, onSelect }) => {
      const el = document.createElement('div');
      el.className = 'drop-opt';
      el.innerHTML = `<span>${label}</span>${badge ? `<span class="iata-badge">${badge}</span>` : ''}`;
      el.addEventListener('click', onSelect);
      container.appendChild(el);
    });
  }

  /* ── DROPDOWN CONTROLS ── */
  function openDropdown(face, panel, searchEl) {
    closeAll();
    face.classList.add('open');
    const wrap = face.closest('.dropdown-wrap');
    const block = face.closest('.ctl-block');
    if (wrap) wrap.classList.add('is-open');
    if (block) block.classList.add('is-open');
    face.setAttribute('aria-expanded', 'true');
    panel.classList.remove('hidden');
    searchEl?.focus();
  }

  function closeDropdown(face, panel) {
    face.classList.remove('open');
    const wrap = face.closest('.dropdown-wrap');
    const block = face.closest('.ctl-block');
    if (wrap) wrap.classList.remove('is-open');
    if (block) block.classList.remove('is-open');
    face.setAttribute('aria-expanded', 'false');
    panel.classList.add('hidden');
  }

  function closeAll() {
    closeDropdown(airportFace, airportPanel);
    closeDropdown(roleFace, rolePanel);
    document.querySelectorAll('.dropdown-wrap.is-open, .ctl-block.is-open').forEach(el => el.classList.remove('is-open'));
  }

  airportFace.addEventListener('click', e => {
    e.stopPropagation();
    airportPanel.classList.contains('hidden')
      ? openDropdown(airportFace, airportPanel, airportSearch)
      : closeDropdown(airportFace, airportPanel);
  });

  roleFace.addEventListener('click', e => {
    e.stopPropagation();
    rolePanel.classList.contains('hidden')
      ? openDropdown(roleFace, rolePanel, roleSearch)
      : closeDropdown(roleFace, rolePanel);
  });

  document.addEventListener('click', e => {
    if (!airportWrap.contains(e.target) && !roleWrap.contains(e.target)) closeAll();
  });

  airportSearch.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    airportList.querySelectorAll('.drop-opt').forEach((el, i) => {
      const ap = airportsData[i];
      el.style.display = (ap.city.toLowerCase().includes(q) || ap.iata.toLowerCase().includes(q)) ? 'flex' : 'none';
    });
  });

  roleSearch.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    roleList.querySelectorAll('.drop-opt').forEach(el => {
      el.style.display = el.querySelector('span').textContent.toLowerCase().includes(q) ? 'flex' : 'none';
    });
  });

  /* ── FORMAT PILLS ── */
  fmtPills.forEach(p => p.addEventListener('click', () => {
    fmtPills.forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    trigger();
  }));

  /* ── NAME COUNTER ── */
  nameInput.addEventListener('input', () => {
    nameCounter.textContent = `${nameInput.value.length} / 20`;
    trigger();
  });

  /* ── MODE RADIOS ── */
  modeRadios.forEach(r => r.addEventListener('change', trigger));

  /* ═══════════════════════════════════════════════════════
     PHOTO EDITOR
  ═══════════════════════════════════════════════════════ */

  dropZone.addEventListener('click', e => {
    if (dzPreview.classList.contains('hidden')) photoInput.click();
  });

  changeBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); photoInput.click(); });
  removeBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); clearPhoto(); });

  photoInput.addEventListener('change', e => { if (e.target.files?.[0]) loadFile(e.target.files[0]); });

  ['dragenter','dragover'].forEach(ev => dropZone.addEventListener(ev, e => {
    e.preventDefault();
    if (dzPreview.classList.contains('hidden')) dropZone.classList.add('dragover');
  }, false));

  ['dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  }, false));

  dropZone.addEventListener('drop', e => {
    if (dzPreview.classList.contains('hidden') && e.dataTransfer.files?.[0]) loadFile(e.dataTransfer.files[0]);
  });

  function loadFile(file) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        rawPhotoImg = img;
        zoomVal = 1; panX = 0; panY = 0;
        zoomSlider.value = 1;
        avatarImg.src = ev.target.result;
        applyTransform();
        dzEmpty.classList.add('hidden');
        dzPreview.classList.remove('hidden');
        trigger();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    rawPhotoImg = null;
    photoInput.value = '';
    avatarImg.src = '';
    zoomVal = 1; panX = 0; panY = 0;
    zoomSlider.value = 1;
    dzPreview.classList.add('hidden');
    dzEmpty.classList.remove('hidden');
    trigger();
  }

  zoomSlider.addEventListener('input', e => {
    e.stopPropagation();
    zoomVal = parseFloat(e.target.value);
    applyTransform();
    trigger();
  });

  zoomReset.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    zoomVal = 1; panX = 0; panY = 0; zoomSlider.value = 1;
    applyTransform(); trigger();
  });

  function coords(e) {
    return e.touches?.length ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
  }

  avatarVp.addEventListener('mousedown', e => {
    if (!rawPhotoImg) return; e.stopPropagation();
    isDragging = true;
    const c = coords(e); startX = c.x - panX; startY = c.y - panY;
  });

  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const c = coords(e); panX = c.x - startX; panY = c.y - startY;
    applyTransform(); trigger();
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  avatarVp.addEventListener('touchstart', e => {
    if (!rawPhotoImg) return; e.stopPropagation();
    isDragging = true;
    const c = coords(e); startX = c.x - panX; startY = c.y - panY;
  }, { passive: false });

  window.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const c = coords(e); panX = c.x - startX; panY = c.y - startY;
    applyTransform(); trigger();
  }, { passive: false });

  window.addEventListener('touchend', () => { isDragging = false; });

  function applyTransform() {
    if (avatarImg) avatarImg.style.transform = `scale(${zoomVal}) translate(${panX/zoomVal}px, ${panY/zoomVal}px)`;
  }

  function getPhotoBase64(name) {
    if (!rawPhotoImg) return makeInitialsAvatar(name);
    const c = document.createElement('canvas');
    c.width = 400; c.height = 400;
    const ctx = c.getContext('2d');
    const iw = rawPhotoImg.naturalWidth || rawPhotoImg.width;
    const ih = rawPhotoImg.naturalHeight || rawPhotoImg.height;
    const bs = Math.max(400/iw, 400/ih);
    const sw = iw * bs * zoomVal;
    const sh = ih * bs * zoomVal;
    const sf = 400 / 84;
    const dx = (400-sw)/2 + panX*sf;
    const dy = (400-sh)/2 + panY*sf;
    ctx.fillStyle = '#032115';
    ctx.fillRect(0,0,400,400);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(rawPhotoImg, dx, dy, sw, sh);
    return c.toDataURL('image/png');
  }

  function makeInitialsAvatar(name) {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 400;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0,0,400,400);
    g.addColorStop(0, '#0F6640'); g.addColorStop(1, '#032115');
    ctx.fillStyle = g; ctx.fillRect(0,0,400,400);
    ctx.strokeStyle = '#FEE101'; ctx.lineWidth = 10;
    ctx.strokeRect(5,5,390,390);
    const ini = (name||'HH').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    ctx.fillStyle = '#FFFDF5';
    ctx.font = '900 140px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ini, 200, 200);
    return c.toDataURL('image/png');
  }

  /* ═══════════════════════════════════════════════════════
     RENDER ENGINE
  ═══════════════════════════════════════════════════════ */

  function setStatus(s) { if (renderStatus) renderStatus.textContent = s; }

  async function buildSvg() {
    let name = nameInput.value.trim().toUpperCase() || 'ANONYMOUS DEV';
    name = name.slice(0, 20);

    const city = selCity.value || 'Trichy';
    const iata = (selIata.value || 'TRZ').toUpperCase();
    const roleKey = selRole.value || Object.keys(rolesData)[0] || 'Frontend';
    const title = getRoleTitle(roleKey);
    const roleJoke = ('#' + title).toUpperCase();
    const mode = document.querySelector('input[name="mode"]:checked');
    const soloTeam = (mode?.value === 'Solo') ? 'SOLO BUILDER' : 'SQUAD GOALS';
    if (!currentJoke) pickRandomJoke();
    const jokeTop = currentJoke?.top ?? '// ready for hacker house goa';
    const jokeBottom = currentJoke?.bottom ?? '';
    const photoB64 = getPhotoBase64(name);

    if (!ticketSvgTemplate) ticketSvgTemplate = await fetch('ticket.svg').then(r => r.text());

    let svg = ticketSvgTemplate;
    svg = svg.replace(/href="\{\{PHOTO_BASE64\}\}"/g, `href="${photoB64}" xlink:href="${photoB64}"`);
    svg = svg.replace(/\{\{PHOTO_BASE64\}\}/g, photoB64);
    svg = svg.replace(/\{\{NAME\}\}/g, xe(name));
    svg = svg.replace(/\{\{IATA\}\}/g, xe(iata));
    svg = svg.replace(/\{\{CITY\}\}/g, xe(city.toUpperCase()));
    svg = svg.replace(/\{\{ROLE_TITLE\}\}/g, xe(roleKey.toUpperCase()));
    svg = svg.replace(/\{\{ROLES_JOKES?\}\}/g, xe(roleJoke));
    svg = svg.replace(/\{\{SOLO_TEAM\}\}/g, xe(soloTeam));
    svg = svg.replace(/\{\{JOKE_TOP\}\}/g, xe(jokeTop));
    svg = svg.replace(/\{\{JOKE_BOTTOM\}\}/g, xe(jokeBottom));

    return { svg, name };
  }

  function trigger() {
    clearTimeout(liveTimer);
    setStatus('RENDERING…');
    liveTimer = setTimeout(async () => {
      try {
        const { svg } = await buildSvg();
        const png = await svgToPng(svg, 1080, 1920);
        livePreview.src = png;
        previewEmpty?.classList.add('hidden');
        livePreview.classList.remove('hidden');
        setStatus('READY');
      } catch (e) {
        console.error('[Studio] Render error:', e);
        setStatus('ERR');
      }
    }, 90);
  }

  function svgToPng(svgStr, w=1080, h=1920) {
    return new Promise(resolve => {
      if (!svgStr.includes('xmlns=')) svgStr = svgStr.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      if (!svgStr.includes('xmlns:xlink')) svgStr = svgStr.replace('<svg ', '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ');
      svgStr = svgStr.replace(/@import url\([^)]+\);?/g, '');

      renderCanvas.width = w; renderCanvas.height = h;
      const ctx = renderCanvas.getContext('2d');

      const utf = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
      let b64 = '';
      try { b64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr))); } catch(_){}

      const srcs = [utf, b64].filter(Boolean);
      let i = 0;

      function next() {
        if (i >= srcs.length) {
          try {
            const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => { ctx.drawImage(img,0,0,w,h); URL.revokeObjectURL(url); resolve(renderCanvas.toDataURL('image/png')); };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(utf); };
            img.src = url;
          } catch(_) { resolve(utf); }
          return;
        }
        const src = srcs[i++];
        const img = new Image();
        img.onload = () => {
          try { ctx.clearRect(0,0,w,h); ctx.drawImage(img,0,0,w,h); resolve(renderCanvas.toDataURL('image/png')); }
          catch(_) { resolve(utf); }
        };
        img.onerror = next;
        img.src = src;
      }
      next();
    });
  }


  downloadBtn?.addEventListener('click', async () => {
    setStatus('SAVING…');
    const { svg, name } = await buildSvg();
    const png = await svgToPng(svg, 1080, 1920);
    const a = document.createElement('a');
    a.href = png;
    a.download = `HHGoa2026_${name.replace(/\s+/g,'_')}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setStatus('READY');
  });

  // Make preview image clickable for download too
  if (livePreview) {
    livePreview.style.cursor = 'pointer';
    livePreview.addEventListener('click', () => downloadBtn?.click());
  }

  /* ── TOAST NOTIFICATION ── */
  function showToast(msg) {
    let toast = document.getElementById('studio-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'studio-toast';
      toast.className = 'studio-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4500);
  }

  copyBtn?.addEventListener('click', async () => {
    setStatus('COPYING…');
    try {
      const { svg } = await buildSvg();
      const pngDataUrl = await svgToPng(svg, 1080, 1920);
      const res = await fetch(pngDataUrl);
      const blob = await res.blob();

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('✓ Boarding pass copied to clipboard!');
      } else {
        showToast('Clipboard image copy not supported on this browser.');
      }
    } catch (e) {
      console.error('Copy failed:', e);
      showToast('Failed to copy image to clipboard.');
    }
    setStatus('READY');
  });

  shareBtn.addEventListener('click', async () => {
    setStatus('PREPARING…');
    const fullTweetText = `Just got my boarding pass for the ultimate hacker getaway... ✈️🌴

👉 Want to see what your hacker passenger profile looks like?
https://hhg-idcard.vercel.app/
Drop your stack/role below or spin up the generator, and reply with your ticket using #FrameInGoa! 
#Goa #Hackathon`;

    try {
      const { svg, name } = await buildSvg();
      const pngDataUrl = await svgToPng(svg, 1080, 1920);
      const filename = `HHGoa2026_${name.replace(/\s+/g,'_')}.png`;

      // 1. Download PNG automatically so user has image in downloads
      const a = document.createElement('a');
      a.href = pngDataUrl;
      a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);

      // 2. Try copying PNG blob to clipboard
      const res = await fetch(pngDataUrl);
      const blob = await res.blob();
      if (navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch (_) {}
      }
    } catch (e) {
      console.log('Share prep:', e);
    }

    // 3. Open X Intent directly in browser tab
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullTweetText)}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
    showToast('✓ PNG downloaded & image copied to clipboard! Paste or attach it on X.');
    setStatus('READY');
  });

  function xe(s) {
    return String(s).replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
  }

  /* ═══════════════════════════════════════════════════════
     HERO CARD DECK CYCLER
  ═══════════════════════════════════════════════════════ */
  (function initCardDeck() {
    const deck = document.getElementById('card-deck');
    if (!deck) return;

    const cards = Array.from(deck.querySelectorAll('.pass-card'));
    const dots  = Array.from(document.querySelectorAll('.deck-dot'));
    let current = 0;
    let timer   = null;

    function goTo(next) {
      if (next === current) return;

      // Exit current
      const leaving = cards[current];
      leaving.classList.add('exit');
      leaving.classList.remove('active');

      setTimeout(() => {
        leaving.classList.remove('exit');
      }, 450);

      // Enter next
      current = next;
      const entering = cards[current];
      entering.classList.add('active');

      // Sync dots
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
    }

    function advance() {
      goTo((current + 1) % cards.length);
    }

    function startTimer() {
      clearInterval(timer);
      timer = setInterval(advance, 2800);
    }

    // Clickable dots
    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        goTo(i);
        startTimer(); // reset timer on manual click
      });
    });

    startTimer();
  })();

});

