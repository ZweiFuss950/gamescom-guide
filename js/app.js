(() => {
  'use strict';

  const STORAGE = {
    favorites: 'gc26:favorites:v3',
    notes: 'gc26:notes:v3',
    currentHall: 'gc26:currentHall:v3',
    filters: 'gc26:filters:v3'
  };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const EVENT_DAYS = ['2026-08-27', '2026-08-28'];
  const QUICK_HALLS = ['all', '5', '6', '7', '8', '9', '10', 'confex'];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const state = {
    data: null,
    baseEntries: [],
    notes: [],
    favorites: new Set(),
    filters: {
      search: '',
      categories: new Set(),
      day: 'all',
      hall: 'all',
      goodie: false,
      highlight: false,
      favorites: false
    },
    view: 'home',
    quickHall: 'all',
    scheduleDay: '2026-08-27',
    mapHighlightFavorites: false,
    currentHall: '',
    focusedEntryId: '',
    userCoordinates: null,
    geolocationWatchId: null,
    installPrompt: null,
    clockTimer: null,
    isReady: false
  };

  const els = {};

  function cacheElements() {
    const ids = [
      'app', 'network-banner', 'home-button', 'brand-button', 'install-button', 'notes-button',
      'notes-count', 'filter-shell', 'global-search', 'filter-open-button', 'active-filter-count',
      'result-count', 'filter-summary', 'filter-reset-inline', 'filter-panel', 'category-filters',
      'day-filter', 'hall-filter', 'goodie-filter', 'highlight-filter', 'favorites-filter',
      'filter-reset-button', 'home-source-status', 'home-hall-grid', 'route-grid', 'home-top-picks',
      'home-reality-grid', 'map-favorites-toggle', 'location-title', 'location-text',
      'geolocation-button', 'manual-hall-select', 'map-marker-count', 'map-scroll', 'map-halls',
      'map-routes', 'map-markers', 'map-user-location', 'map-preview', 'hall-quick-nav',
      'current-hall-label', 'set-current-hall-button', 'hall-results', 'clock-pill', 'next-up-card',
      'schedule-results', 'flexible-favorites', 'favorites-results', 'export-plan-button',
      'favorite-nav-count', 'add-note-fab', 'entry-dialog', 'entry-dialog-content', 'note-dialog',
      'note-form', 'note-id', 'note-dialog-title', 'note-title', 'note-hall', 'note-stand',
      'note-day', 'note-time', 'note-text', 'note-favorite', 'notes-drawer', 'notes-add-button',
      'notes-export-button', 'notes-import-input', 'notes-list', 'hall-picker-dialog',
      'hall-picker-buttons', 'clear-current-hall', 'install-dialog', 'toast-region'
    ];
    ids.forEach(id => { els[id] = document.getElementById(id); });
    els.views = $$('.view');
    els.navButtons = $$('[data-nav]');
    els.bottomNavButtons = $$('.bottom-nav [data-nav]');
    els.scheduleDayButtons = $$('[data-schedule-day]');
  }

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function readStorage() {
    const favorites = safeParse(localStorage.getItem(STORAGE.favorites), []);
    state.favorites = new Set(Array.isArray(favorites) ? favorites.filter(Boolean) : []);
    const notes = safeParse(localStorage.getItem(STORAGE.notes), []);
    state.notes = Array.isArray(notes) ? notes : [];
    state.currentHall = localStorage.getItem(STORAGE.currentHall) || '';
    const savedFilters = safeParse(localStorage.getItem(STORAGE.filters), null);
    if (savedFilters && typeof savedFilters === 'object') {
      state.filters.search = String(savedFilters.search || '');
      state.filters.categories = new Set(Array.isArray(savedFilters.categories) ? savedFilters.categories : []);
      state.filters.day = EVENT_DAYS.includes(savedFilters.day) ? savedFilters.day : 'all';
      state.filters.hall = savedFilters.hall || 'all';
      state.filters.goodie = Boolean(savedFilters.goodie);
      state.filters.highlight = Boolean(savedFilters.highlight);
      state.filters.favorites = Boolean(savedFilters.favorites);
    }
  }

  function persistFavorites() {
    localStorage.setItem(STORAGE.favorites, JSON.stringify([...state.favorites]));
  }

  function persistNotes() {
    localStorage.setItem(STORAGE.notes, JSON.stringify(state.notes));
  }

  function persistFilters() {
    localStorage.setItem(STORAGE.filters, JSON.stringify({
      ...state.filters,
      categories: [...state.filters.categories]
    }));
  }

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      if (['https:', 'http:'].includes(url.protocol)) return url.href;
    } catch { /* ignore */ }
    return '#';
  }

  function formatDay(day, short = false) {
    if (day === '2026-08-27') return short ? 'Do 27.08.' : 'Donnerstag, 27. August';
    if (day === '2026-08-28') return short ? 'Fr 28.08.' : 'Freitag, 28. August';
    return day || 'Beide Tage';
  }

  function formatTime(iso) {
    if (!iso) return '';
    return new Intl.DateTimeFormat('de-DE', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
    }).format(new Date(iso));
  }

  function hallBase(hall = '') {
    const value = String(hall).toLowerCase();
    if (value === 'confex') return 'confex';
    const match = value.match(/^\d+/);
    return match ? match[0] : '';
  }

  function hallInfo(hallValue) {
    const base = hallBase(hallValue);
    return state.data?.halls.find(h => h.id === base) || null;
  }

  function hallLabel(hallValue, compact = false) {
    if (!hallValue) return 'ohne Halle';
    if (String(hallValue).toLowerCase() === 'confex') return 'Confex';
    return compact ? `H${escapeHtml(hallValue)}` : `Halle ${escapeHtml(hallValue)}`;
  }

  function categoryById(id) {
    return state.data?.categories.find(category => category.id === id) || null;
  }

  function primaryCategory(entry) {
    const preferred = ['nintendo', 'big-player', 'indie', 'retro', 'goodies', 'community', 'talk', 'hardware', 'reality'];
    const id = preferred.find(item => entry.kategorien?.includes(item)) || entry.kategorien?.[0];
    return categoryById(id) || { color: '#2563eb', icon: '•', shortLabel: 'Eintrag' };
  }

  function entries() {
    return [...state.baseEntries, ...state.notes];
  }

  function getEntry(id) {
    return entries().find(entry => entry.id === id) || null;
  }

  function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function matchesFilters(entry, options = {}) {
    const filters = state.filters;
    const haystack = normalizeText([
      entry.name, entry.beschreibung, entry.warumInteressant, entry.halle, entry.stand,
      ...(entry.details || []), ...(entry.platforms || []), ...(entry.speaker || [])
    ].join(' '));
    if (filters.search && !haystack.includes(normalizeText(filters.search))) return false;
    if (filters.categories.size && !entry.kategorien?.some(category => filters.categories.has(category))) return false;
    if (filters.day !== 'all' && !entry.tage?.includes(filters.day)) return false;
    if (filters.hall !== 'all' && hallBase(entry.halle) !== filters.hall) return false;
    if (filters.goodie && !entry.goodie) return false;
    if (filters.highlight && !entry.highlight && !entry.mustSee) return false;
    if (filters.favorites && !state.favorites.has(entry.id)) return false;
    if (options.mapOnly && (entry.mapVisible === false || !entry.kartenposition)) return false;
    if (options.timedOnly && !entry.startzeit) return false;
    return true;
  }

  function filteredEntries(options = {}) {
    return entries()
      .filter(entry => matchesFilters(entry, options))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.name.localeCompare(b.name, 'de'));
  }

  function normalizeNote(note) {
    if (!note || typeof note !== 'object' || !note.id || !note.name || !note.halle) return null;
    const day = EVENT_DAYS.includes(note.day || note.tage?.[0]) ? (note.day || note.tage[0]) : EVENT_DAYS[0];
    const time = typeof note.time === 'string' ? note.time : '';
    const startzeit = time ? `${day}T${time}:00+02:00` : null;
    let endzeit = null;
    if (startzeit) {
      const end = new Date(new Date(startzeit).getTime() + 30 * 60 * 1000);
      endzeit = toBerlinIso(end);
    }
    return {
      id: String(note.id),
      name: String(note.name).slice(0, 90),
      typ: 'note',
      kategorien: ['community'],
      halle: String(note.halle),
      stand: String(note.stand || '').slice(0, 40),
      kartenposition: note.kartenposition || noteMapPosition(note.id, note.halle),
      beschreibung: String(note.text || 'Eigener lokaler Eintrag.').slice(0, 700),
      warumInteressant: String(note.text || 'Persönlich auf der Messe gespeichert.').slice(0, 700),
      bildUrl: './assets/illustrations/community.svg',
      gamescomLink: '',
      gamescomLinkLabel: '',
      officialSearchTerm: '',
      externeLinks: [],
      tage: [day],
      day,
      time,
      goodie: false,
      goodieText: '',
      highlight: false,
      mustSee: false,
      andrang: '',
      andrangTipp: '',
      bestaetigung: 'eigener-eintrag',
      bestaetigungLabel: 'Eigener Fund',
      sourceChecked: '',
      sourceNote: 'Nur lokal auf diesem Gerät gespeichert.',
      details: [],
      platforms: [],
      locationNote: '',
      startzeit,
      endzeit,
      stage: `${hallLabel(note.halle)}${note.stand ? ` · Stand ${note.stand}` : ''}`,
      speaker: [],
      remote: false,
      mapVisible: true,
      priority: 110,
      userCreated: true,
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: note.updatedAt || note.createdAt || new Date().toISOString()
    };
  }

  function toBerlinIso(date) {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(date).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+02:00`;
  }

  function noteMapPosition(id, hall) {
    const h = hallInfo(hall);
    if (!h) return { x: 50, y: 36 };
    let hash = 0;
    for (const char of String(id)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    const rx = ((Math.abs(hash) % 100) / 100 - 0.5) * Math.max(2, h.w * 0.45);
    const ry = (((Math.abs(hash >> 8) % 100) / 100) - 0.5) * Math.max(2, h.h * 0.45);
    return {
      x: +(h.x + h.w / 2 + rx).toFixed(2),
      y: +(h.y + h.h / 2 + ry).toFixed(2)
    };
  }

  async function loadData() {
    const response = await fetch('./data/data.json');
    if (!response.ok) throw new Error(`Daten konnten nicht geladen werden (${response.status}).`);
    const data = await response.json();
    if (!Array.isArray(data.entries) || !Array.isArray(data.halls) || !Array.isArray(data.categories)) {
      throw new Error('data.json enthält nicht die erwartete Struktur.');
    }
    state.data = data;
    state.baseEntries = data.entries;
  }

  function populateControls() {
    const halls = state.data.halls.filter(h => ['5', '6', '7', '8', '9', '10', 'confex'].includes(h.id));
    const options = halls.map(h => `<option value="${escapeHtml(h.id)}">${escapeHtml(h.label)}</option>`).join('');
    els['hall-filter'].insertAdjacentHTML('beforeend', options);
    els['manual-hall-select'].insertAdjacentHTML('beforeend', options);
    els['note-hall'].innerHTML = options;
    els['global-search'].value = state.filters.search;
    els['day-filter'].value = state.filters.day;
    els['hall-filter'].value = state.filters.hall;
    els['goodie-filter'].checked = state.filters.goodie;
    els['highlight-filter'].checked = state.filters.highlight;
    els['favorites-filter'].checked = state.filters.favorites;
    els['manual-hall-select'].value = state.currentHall;

    els['category-filters'].innerHTML = state.data.categories.map(category => `
      <button class="filter-chip" type="button" data-category="${escapeHtml(category.id)}"
        aria-pressed="${state.filters.categories.has(category.id)}" title="${escapeHtml(category.description)}"
        style="--chip-color:${escapeHtml(category.color)}">
        <span class="chip-color" aria-hidden="true"></span>
        <span>${escapeHtml(category.shortLabel)}</span>
        <span class="info-mark" aria-hidden="true">i</span>
      </button>`).join('');

    els['hall-picker-buttons'].innerHTML = halls.map(h => `
      <button type="button" data-current-hall="${escapeHtml(h.id)}" class="${state.currentHall === h.id ? 'active' : ''}">${escapeHtml(h.shortLabel)}</button>`
    ).join('');
  }

  function bindEvents() {
    window.addEventListener('hashchange', routeFromHash);
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      state.installPrompt = event;
      els['install-button'].hidden = false;
    });
    window.addEventListener('appinstalled', () => {
      state.installPrompt = null;
      els['install-button'].hidden = true;
      toast('App wurde installiert.');
    });

    els['home-button'].addEventListener('click', () => navigate('home'));
    els['brand-button'].addEventListener('click', () => navigate('home'));
    els['install-button'].addEventListener('click', installApp);
    els['notes-button'].addEventListener('click', openNotesDrawer);
    els['add-note-fab'].addEventListener('click', () => openNoteDialog());
    els['notes-add-button'].addEventListener('click', () => {
      closeDialog(els['notes-drawer']);
      openNoteDialog();
    });
    els['notes-export-button'].addEventListener('click', exportPlan);
    els['export-plan-button'].addEventListener('click', exportPlan);
    els['notes-import-input'].addEventListener('change', importPlan);
    els['note-form'].addEventListener('submit', saveNoteFromForm);
    els['set-current-hall-button'].addEventListener('click', () => showDialog(els['hall-picker-dialog']));
    els['clear-current-hall'].addEventListener('click', () => setCurrentHall(''));
    els['geolocation-button'].addEventListener('click', startGeolocation);
    els['manual-hall-select'].addEventListener('change', event => setCurrentHall(event.target.value));
    els['map-favorites-toggle'].addEventListener('click', () => {
      state.mapHighlightFavorites = !state.mapHighlightFavorites;
      els['map-favorites-toggle'].setAttribute('aria-pressed', String(state.mapHighlightFavorites));
      els['map-favorites-toggle'].textContent = state.mapHighlightFavorites ? '♥ Fokus aktiv' : '♥ hervorheben';
      renderMap();
    });

    els['filter-open-button'].addEventListener('click', () => {
      const open = els['filter-panel'].hidden;
      els['filter-panel'].hidden = !open;
      els['filter-open-button'].setAttribute('aria-expanded', String(open));
    });
    els['global-search'].addEventListener('input', event => {
      state.filters.search = event.target.value.trim();
      applyFilterChange();
    });
    els['day-filter'].addEventListener('change', event => {
      state.filters.day = event.target.value;
      applyFilterChange();
    });
    els['hall-filter'].addEventListener('change', event => {
      state.filters.hall = event.target.value;
      applyFilterChange();
    });
    els['goodie-filter'].addEventListener('change', event => { state.filters.goodie = event.target.checked; applyFilterChange(); });
    els['highlight-filter'].addEventListener('change', event => { state.filters.highlight = event.target.checked; applyFilterChange(); });
    els['favorites-filter'].addEventListener('change', event => { state.filters.favorites = event.target.checked; applyFilterChange(); });
    els['filter-reset-button'].addEventListener('click', resetFilters);
    els['filter-reset-inline'].addEventListener('click', resetFilters);

    els.scheduleDayButtons.forEach(button => button.addEventListener('click', () => {
      state.scheduleDay = button.dataset.scheduleDay;
      renderSchedule();
      renderResultMeta();
    }));

    document.addEventListener('click', event => {
      const nav = event.target.closest('[data-nav]');
      if (nav) {
        event.preventDefault();
        navigate(nav.dataset.nav);
        return;
      }
      const close = event.target.closest('[data-close-dialog]');
      if (close) {
        closeDialog(close.closest('dialog'));
        return;
      }
      const category = event.target.closest('[data-category]');
      if (category) {
        const id = category.dataset.category;
        state.filters.categories.has(id) ? state.filters.categories.delete(id) : state.filters.categories.add(id);
        applyFilterChange();
        return;
      }
      const favorite = event.target.closest('[data-favorite]');
      if (favorite) {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(favorite.dataset.favorite);
        return;
      }
      const openEntry = event.target.closest('[data-open-entry]');
      if (openEntry) {
        event.preventDefault();
        openEntryDialog(openEntry.dataset.openEntry);
        return;
      }
      const mapEntry = event.target.closest('[data-map-entry]');
      if (mapEntry) {
        event.preventDefault();
        navigate('map', mapEntry.dataset.mapEntry);
        return;
      }
      const scheduleEntry = event.target.closest('[data-schedule-entry]');
      if (scheduleEntry) {
        event.preventDefault();
        navigate('schedule', scheduleEntry.dataset.scheduleEntry);
        return;
      }
      const hallQuick = event.target.closest('[data-hall-quick]');
      if (hallQuick) {
        state.quickHall = hallQuick.dataset.hallQuick;
        renderHalls();
        renderResultMeta();
        return;
      }
      const currentHall = event.target.closest('[data-current-hall]');
      if (currentHall) {
        setCurrentHall(currentHall.dataset.currentHall);
        return;
      }
      const edit = event.target.closest('[data-edit-note]');
      if (edit) {
        event.preventDefault();
        const note = state.notes.find(item => item.id === edit.dataset.editNote);
        if (note) {
          closeDialog(edit.closest('dialog'));
          openNoteDialog(note);
        }
        return;
      }
      const remove = event.target.closest('[data-delete-note]');
      if (remove) {
        event.preventDefault();
        deleteNote(remove.dataset.deleteNote);
        return;
      }
      const hallHome = event.target.closest('[data-home-hall]');
      if (hallHome) {
        state.quickHall = hallHome.dataset.homeHall;
        navigate('halls');
        return;
      }
      const route = event.target.closest('[data-route]');
      if (route) {
        const routeData = state.data.routes.find(item => item.id === route.dataset.route);
        if (routeData) {
          resetFilters(false);
          routeData.entryIds.forEach(id => state.favorites.add(id));
          persistFavorites();
          renderAll();
          toast(`${routeData.name}: ${routeData.entryIds.length} Stopps als Favoriten gespeichert.`);
          navigate('favorites');
        }
      }
    });

    $$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
      if (event.target === dialog) closeDialog(dialog);
    }));

    document.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key)) return;
      const interactive = event.target.closest('[data-open-entry], [data-home-hall]');
      if (!interactive) return;
      event.preventDefault();
      interactive.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  function applyFilterChange() {
    persistFilters();
    renderFilterControls();
    renderCurrentView();
    renderResultMeta();
  }

  function resetFilters(render = true) {
    state.filters = {
      search: '', categories: new Set(), day: 'all', hall: 'all', goodie: false, highlight: false, favorites: false
    };
    persistFilters();
    renderFilterControls();
    if (render) {
      renderCurrentView();
      renderResultMeta();
    }
  }

  function renderFilterControls() {
    els['global-search'].value = state.filters.search;
    els['day-filter'].value = state.filters.day;
    els['hall-filter'].value = state.filters.hall;
    els['goodie-filter'].checked = state.filters.goodie;
    els['highlight-filter'].checked = state.filters.highlight;
    els['favorites-filter'].checked = state.filters.favorites;
    $$('.filter-chip', els['category-filters']).forEach(button => {
      button.setAttribute('aria-pressed', String(state.filters.categories.has(button.dataset.category)));
    });
  }

  function activeFilterCount() {
    return Number(Boolean(state.filters.search)) + state.filters.categories.size +
      Number(state.filters.day !== 'all') + Number(state.filters.hall !== 'all') +
      Number(state.filters.goodie) + Number(state.filters.highlight) + Number(state.filters.favorites);
  }

  function renderResultMeta() {
    const count = state.view === 'map' ? filteredEntries({ mapOnly: true }).length
      : state.view === 'schedule' ? filteredEntries({ timedOnly: true }).filter(scheduleDayMatch).length
      : state.view === 'favorites' ? filteredEntries().filter(entry => state.favorites.has(entry.id)).length
      : state.view === 'halls' ? filteredEntries().filter(entry => state.quickHall === 'all' || hallBase(entry.halle) === state.quickHall).length
      : filteredEntries().length;
    els['result-count'].textContent = `${count} ${count === 1 ? 'Treffer' : 'Treffer'}`;
    const parts = [];
    if (state.filters.categories.size) parts.push([...state.filters.categories].map(id => categoryById(id)?.shortLabel || id).join(', '));
    else parts.push('Alle Themen');
    parts.push(state.filters.day === 'all' ? 'beide Tage' : formatDay(state.filters.day, true));
    if (state.filters.hall !== 'all') parts.push(hallInfo(state.filters.hall)?.shortLabel || state.filters.hall);
    if (state.filters.goodie) parts.push('Goodies');
    if (state.filters.highlight) parts.push('Highlights');
    if (state.filters.favorites) parts.push('Favoriten');
    els['filter-summary'].textContent = parts.join(' · ');
    const active = activeFilterCount();
    els['active-filter-count'].hidden = active === 0;
    els['active-filter-count'].textContent = String(active);
    els['filter-reset-inline'].hidden = active === 0;
  }

  function navigate(view, id = '') {
    const nextHash = id ? `#${view}/${encodeURIComponent(id)}` : `#${view}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
    // Render immediately as well as on hashchange. This avoids a blank intermediate
    // view after a cold/offline PWA start on slower iOS devices.
    routeFromHash();
  }

  function routeFromHash() {
    if (!state.isReady) return;
    const raw = window.location.hash.replace(/^#/, '') || 'home';
    const [requestedView, encodedId] = raw.split('/');
    const allowed = ['home', 'map', 'halls', 'schedule', 'favorites'];
    state.view = allowed.includes(requestedView) ? requestedView : 'home';
    state.focusedEntryId = encodedId ? decodeURIComponent(encodedId) : '';
    if (state.view === 'halls' && state.focusedEntryId && QUICK_HALLS.includes(hallBase(state.focusedEntryId))) {
      state.quickHall = hallBase(state.focusedEntryId);
      state.focusedEntryId = '';
    }
    showView();
    renderCurrentView();
    renderResultMeta();
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (state.focusedEntryId) requestAnimationFrame(() => focusDeepLink(state.focusedEntryId));
  }

  function showView() {
    els.views.forEach(view => { view.hidden = view.dataset.view !== state.view; });
    els['filter-shell'].hidden = state.view === 'home';
    els.bottomNavButtons.forEach(button => button.classList.toggle('active', button.dataset.nav === state.view));
    document.title = state.view === 'home' ? 'Gamescom 2026 – Zwei-Tage-Guide' : `${viewLabel(state.view)} · GC26 Guide`;
  }

  function viewLabel(view) {
    return ({ map: 'Karte', halls: 'Hallen', schedule: 'Zeitplan', favorites: 'Favoriten', home: 'Start' })[view] || 'GC26 Guide';
  }

  function renderAll() {
    renderHome();
    renderFilterControls();
    renderCurrentView();
    renderCounts();
    renderLocationState();
    renderResultMeta();
  }

  function renderCurrentView() {
    if (state.view === 'map') renderMap();
    if (state.view === 'halls') renderHalls();
    if (state.view === 'schedule') renderSchedule();
    if (state.view === 'favorites') renderFavorites();
  }

  function renderHome() {
    els['home-source-status'].innerHTML = `<span class="status-dot"></span><span>${escapeHtml(state.data.meta.lastUpdatedLabel)} · ${state.baseEntries.length} redaktionelle Einträge · offlinefähig</span>`;
    const featuredHalls = state.data.halls.filter(h => ['5', '6', '7', '8', '9', '10', 'confex'].includes(h.id));
    els['home-hall-grid'].innerHTML = featuredHalls.map(h => `
      <button class="home-hall-card" type="button" data-home-hall="${escapeHtml(h.id)}" style="--hall-color:${escapeHtml(h.accent)}">
        <strong>${escapeHtml(h.shortLabel)}</strong><b>${escapeHtml(h.area)}</b><p>${escapeHtml(h.description)}</p>
      </button>`).join('');

    els['route-grid'].innerHTML = state.data.routes.map(route => `
      <article class="route-card" style="--route-color:${escapeHtml(route.color)}">
        <div class="route-top"><h3>${escapeHtml(route.name)}</h3><span class="route-duration">${escapeHtml(route.duration)}</span></div>
        <div class="route-halls">${route.halls.map(h => `<span>H${escapeHtml(h)}</span>`).join('')}</div>
        <p>${escapeHtml(route.tip)}</p>
        <button class="secondary-button compact" type="button" data-route="${escapeHtml(route.id)}">Route als Favoriten speichern</button>
      </article>`).join('');

    const topIds = ['xbox', 'nintendo', 'netease', 'bandai-namco', 'level-infinite', 'capcom', 'indie-arena', 'ubisoft'];
    els['home-top-picks'].innerHTML = topIds.map(getEntry).filter(Boolean).map(entry => entryCard(entry, 'home')).join('');
    const realityIds = ['playstation-route', 'xbox-ikea', 'gta6-netflix', 'big-n-club-watch'];
    els['home-reality-grid'].innerHTML = realityIds.map(getEntry).filter(Boolean).map(entry => `
      <article class="reality-card">
        <h3>${escapeHtml(entry.name)}</h3><p>${escapeHtml(entry.beschreibung)}</p>
        <button class="text-button" type="button" data-open-entry="${escapeHtml(entry.id)}">Einordnung öffnen</button>
      </article>`).join('');
  }

  function statusClass(entry) {
    if (entry.userCreated) return 'confirmed';
    if (['bestaetigt', 'stand-bestaetigt', 'bereich'].includes(entry.bestaetigung)) return 'confirmed';
    if (['teilweise', 'parallel'].includes(entry.bestaetigung)) return 'watch';
    return 'reality';
  }

  function tagsHtml(entry, limit = 5) {
    return (entry.kategorien || []).slice(0, limit).map(id => {
      const category = categoryById(id);
      if (!category) return '';
      return `<span class="tag" style="--tag-color:${escapeHtml(category.color)}">${escapeHtml(category.shortLabel)}</span>`;
    }).join('');
  }

  function favoriteButton(entry) {
    const favorite = state.favorites.has(entry.id);
    return `<button class="favorite-button" type="button" data-favorite="${escapeHtml(entry.id)}" aria-pressed="${favorite}" aria-label="${favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20S4 15 4 9a4 4 0 0 1 7-3 4 4 0 0 1 7 3c0 6-6 11-6 11Z"/></svg>
    </button>`;
  }

  function entryCard(entry, context = 'hall') {
    const user = entry.userCreated;
    const external = entry.externeLinks?.[0];
    const timed = Boolean(entry.startzeit);
    const location = entry.halle ? `${hallLabel(entry.halle)}${entry.stand ? ` · ${escapeHtml(entry.stand)}` : ''}` : (entry.remote ? 'Nur online / parallel' : 'geländeweit / Route');
    const cardId = `entry-${context}-${entry.id}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    const details = (entry.details || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
    return `<article class="entry-card ${entry.highlight ? 'is-highlight' : ''} ${user ? 'user-created' : ''}" id="${cardId}" data-entry-card="${escapeHtml(entry.id)}">
      <div class="entry-image">
        <img src="${escapeHtml(entry.bildUrl || './assets/illustrations/community.svg')}" alt="" loading="lazy" width="800" height="370">
        <div class="entry-image-overlay">
          <span class="entry-status ${statusClass(entry)}">${escapeHtml(entry.bestaetigungLabel || 'Geprüft')}</span>
          ${favoriteButton(entry)}
        </div>
      </div>
      <div class="entry-content">
        <div class="entry-location"><span class="location-pill">${location}</span>${entry.tage?.map(day => `<span>${escapeHtml(formatDay(day, true))}</span>`).join('') || ''}</div>
        <h3>${escapeHtml(entry.name)}</h3>
        <p class="summary">${escapeHtml(entry.beschreibung)}</p>
        <div class="tag-row">${tagsHtml(entry)}</div>
        ${(entry.goodie || entry.andrangTipp) ? `<div class="signal-row">
          ${entry.goodie ? `<div class="signal goodie"><span aria-hidden="true">✦</span><span><strong>Goodie:</strong> ${escapeHtml(entry.goodieText || 'Aktion vor Ort – Verfügbarkeit beachten.')}</span></div>` : ''}
          ${entry.andrangTipp ? `<div class="signal crowd"><span aria-hidden="true">↗</span><span><strong>Timing:</strong> ${escapeHtml(entry.andrangTipp)}</span></div>` : ''}
        </div>` : ''}
        <details class="expand-details">
          <summary>${user ? 'Notiz vollständig lesen' : 'Warum interessant & Details'}</summary>
          <div class="details-body">
            <p>${escapeHtml(entry.warumInteressant || entry.beschreibung)}</p>
            ${details ? `<ul class="details-list">${details}</ul>` : ''}
            ${entry.locationNote ? `<p><strong>Ort:</strong> ${escapeHtml(entry.locationNote)}</p>` : ''}
            <div class="source-note">${escapeHtml(entry.sourceNote || (user ? 'Nur lokal gespeichert.' : `Quelle geprüft: ${entry.sourceChecked || state.data.meta.sourceReviewDate}`))}</div>
          </div>
        </details>
        <div class="entry-actions">
          ${user ? `
            <button class="action-button" type="button" data-map-entry="${escapeHtml(entry.id)}">Auf Karte</button>
            <button class="action-button edit-note" type="button" data-edit-note="${escapeHtml(entry.id)}">Bearbeiten</button>
            ${timed ? `<button class="action-button full" type="button" data-schedule-entry="${escapeHtml(entry.id)}">Im Zeitplan</button>` : ''}
          ` : `
            <a class="action-link primary-source" href="${escapeHtml(safeUrl(entry.gamescomLink))}" target="_blank" rel="noopener">Gamescom ↗</a>
            ${external ? `<a class="action-link external-source" href="${escapeHtml(safeUrl(external.url))}" target="_blank" rel="noopener">Externe Quelle ↗</a>` : ''}
            ${entry.mapVisible && entry.kartenposition ? `<button class="action-button" type="button" data-map-entry="${escapeHtml(entry.id)}">Auf Karte</button>` : ''}
            ${timed ? `<button class="action-button" type="button" data-schedule-entry="${escapeHtml(entry.id)}">Im Zeitplan</button>` : ''}
            <button class="action-button ${(!entry.mapVisible || !timed) ? 'full' : ''}" type="button" data-open-entry="${escapeHtml(entry.id)}">Alle Infos</button>
          `}
        </div>
        ${!user && entry.officialSearchTerm ? `<div class="source-note">Im Ausstellerportal suchen nach: <strong>${escapeHtml(entry.officialSearchTerm)}</strong></div>` : ''}
      </div>
    </article>`;
  }

  function openEntryDialog(id) {
    const entry = getEntry(id);
    if (!entry) return;
    els['entry-dialog-content'].innerHTML = entryCard(entry, 'dialog');
    showDialog(els['entry-dialog']);
  }

  function renderMap() {
    renderMapHalls();
    const visible = filteredEntries({ mapOnly: true });
    els['map-marker-count'].textContent = `${visible.length} ${visible.length === 1 ? 'Marker' : 'Marker'}`;
    els['map-markers'].innerHTML = visible.map(entry => {
      const category = primaryCategory(entry);
      const favorite = state.favorites.has(entry.id);
      const dimmed = state.mapHighlightFavorites && !favorite;
      const focused = state.focusedEntryId === entry.id;
      const x = Number(entry.kartenposition.x);
      const y = Number(entry.kartenposition.y);
      return `<g class="map-marker ${favorite ? 'favorite' : ''} ${entry.userCreated ? 'user-note' : ''} ${dimmed ? 'dimmed' : ''} ${focused ? 'focused' : ''}"
        transform="translate(${x} ${y})" data-open-entry="${escapeHtml(entry.id)}" role="button" tabindex="0" aria-label="${escapeHtml(entry.name)}">
        ${favorite ? '<circle class="pin-ring" r="4.8"></circle>' : ''}
        <circle class="pin-core" r="3.6" style="--marker-color:${escapeHtml(category.color)}"></circle>
        <text y=".15">${entry.userCreated ? '+' : escapeHtml(category.icon)}</text>
        ${favorite ? '<text class="favorite-heart" x="3.8" y="-3.4">♥</text>' : ''}
      </g>`;
    }).join('');
    renderUserLocation();
    renderMapPreview();
  }

  function renderMapHalls() {
    els['map-halls'].innerHTML = state.data.halls.map(h => `
      <g class="map-hall" data-home-hall="${escapeHtml(h.id)}" role="button" tabindex="0" aria-label="${escapeHtml(h.label)} öffnen">
        <rect x="${h.x}" y="${h.y}" width="${h.w}" height="${h.h}" rx="2.2" fill="${escapeHtml(h.accent)}" opacity=".18" stroke="${escapeHtml(h.accent)}" stroke-width=".7"></rect>
        <text x="${h.x + h.w / 2}" y="${h.y + h.h / 2 - .7}" text-anchor="middle" font-size="3.6" font-weight="900" fill="#0f172a">${escapeHtml(h.shortLabel)}</text>
        <text x="${h.x + h.w / 2}" y="${h.y + h.h / 2 + 3}" text-anchor="middle" font-size="1.9" font-weight="700" fill="#475569">${escapeHtml(h.area.slice(0, 20))}</text>
      </g>`).join('');
    els['map-routes'].innerHTML = `
      <path d="M17 42 L17 49 M38 42 L32 49 M59 42 L53 49 M80 42 L80 50" fill="none" stroke="#cbd5e1" stroke-width="1.2" stroke-dasharray="2 1"></path>
      <path d="M26 34 L29 34 M47 34 L50 34 M68 34 L71 34 M41 56 L45 56 M70 56 L74 56" fill="none" stroke="#cbd5e1" stroke-width="1.2"></path>`;
  }

  function renderMapPreview() {
    const entry = state.focusedEntryId ? getEntry(state.focusedEntryId) : null;
    if (!entry || !entry.kartenposition) {
      els['map-preview'].hidden = true;
      els['map-preview'].innerHTML = '';
      return;
    }
    els['map-preview'].hidden = false;
    els['map-preview'].innerHTML = `<div class="compact-item selected-flash">
      <img src="${escapeHtml(entry.bildUrl)}" alt=""><div><strong>${escapeHtml(entry.name)}</strong><span>${hallLabel(entry.halle)}${entry.stand ? ` · ${escapeHtml(entry.stand)}` : ''}</span></div>
      <button class="icon-button" type="button" data-open-entry="${escapeHtml(entry.id)}" aria-label="Details öffnen">›</button>
    </div>`;
  }

  function focusDeepLink(id) {
    const entry = getEntry(id);
    if (!entry) return;
    if (state.view === 'map' && entry.kartenposition) {
      renderMap();
      els['map-preview'].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (state.view === 'schedule') {
      const target = document.querySelector(`[data-timeline-id="${CSS.escape(id)}"]`);
      if (target) {
        target.classList.add('selected-flash');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (state.view === 'halls') {
      state.quickHall = hallBase(entry.halle) || 'all';
      renderHalls();
      const target = document.querySelector(`[data-entry-card="${CSS.escape(id)}"]`);
      if (target) {
        target.classList.add('selected-flash');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  function renderHalls() {
    const halls = QUICK_HALLS.map(id => id === 'all' ? { id: 'all', shortLabel: 'Alle', accent: '#2563eb' } : hallInfo(id)).filter(Boolean);
    els['hall-quick-nav'].innerHTML = halls.map(h => `
      <button class="hall-jump-button ${state.currentHall === h.id ? 'is-here' : ''}" type="button" data-hall-quick="${escapeHtml(h.id)}" role="tab"
        aria-selected="${state.quickHall === h.id}" style="--hall-color:${escapeHtml(h.accent)}">${escapeHtml(h.shortLabel)}</button>`).join('');
    renderLocationState();

    const visible = filteredEntries().filter(entry => entry.halle && (state.quickHall === 'all' || hallBase(entry.halle) === state.quickHall));
    const groups = new Map();
    visible.forEach(entry => {
      const base = hallBase(entry.halle) || 'other';
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base).push(entry);
    });
    const ordered = state.data.halls.map(h => h.id).filter(id => groups.has(id));
    if (!ordered.length) {
      els['hall-results'].innerHTML = emptyState('Keine Treffer', 'Für diese Halle und Filterkombination gibt es derzeit keinen Eintrag.', 'Filter zurücksetzen', 'reset-filters');
      bindSpecialEmptyActions();
      return;
    }
    els['hall-results'].innerHTML = ordered.map(id => {
      const h = hallInfo(id);
      const groupEntries = groups.get(id).sort((a, b) => (b.priority || 0) - (a.priority || 0));
      return `<section class="hall-group" id="hall-group-${escapeHtml(id)}" style="--hall-color:${escapeHtml(h.accent)}">
        <header class="hall-group-header"><span class="hall-number">${escapeHtml(h.shortLabel)}</span><div><h2>${escapeHtml(h.area)}</h2><p>${escapeHtml(h.description)}</p>${state.currentHall === id ? '<div class="here-label">● Du hast diese Halle als aktuellen Standort gesetzt</div>' : ''}</div></header>
        <div class="card-grid">${groupEntries.map(entry => entryCard(entry, 'hall')).join('')}</div>
      </section>`;
    }).join('');
  }

  function currentTime() {
    const debug = new URLSearchParams(window.location.search).get('debugTime');
    if (debug) {
      const parsed = new Date(debug);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }

  function scheduleDayMatch(entry) {
    if (state.scheduleDay === 'all') return true;
    return entry.tage?.includes(state.scheduleDay);
  }

  function scheduleStatus(entry, now, nextId) {
    const start = new Date(entry.startzeit);
    const end = new Date(entry.endzeit || new Date(start.getTime() + 60 * 60 * 1000));
    if (now >= start && now < end) return 'running';
    if (entry.id === nextId) return 'next';
    if (now >= end) return 'past';
    return 'future';
  }

  function renderSchedule() {
    els.scheduleDayButtons.forEach(button => button.classList.toggle('active', button.dataset.scheduleDay === state.scheduleDay));
    const now = currentTime();
    const timed = filteredEntries({ timedOnly: true }).filter(scheduleDayMatch).sort((a, b) => new Date(a.startzeit) - new Date(b.startzeit));
    const future = timed.filter(entry => new Date(entry.endzeit || entry.startzeit) > now);
    const next = future.find(entry => new Date(entry.startzeit) > now) || null;
    const running = timed.find(entry => now >= new Date(entry.startzeit) && now < new Date(entry.endzeit || entry.startzeit)) || null;
    const nextId = next?.id || '';

    const duringEvent = now >= new Date(state.data.meta.stay.start) && now <= new Date(state.data.meta.stay.end);
    els['clock-pill'].classList.toggle('live', duringEvent || Boolean(new URLSearchParams(location.search).get('debugTime')));
    els['clock-pill'].textContent = duringEvent ? new Intl.DateTimeFormat('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(now) : 'Vorschau';

    const prominent = running || next;
    if (prominent) {
      const start = new Date(prominent.startzeit);
      const minutes = Math.max(0, Math.round((start - now) / 60000));
      els['next-up-card'].hidden = false;
      els['next-up-card'].innerHTML = `<span class="next-label">${running ? 'Läuft gerade' : minutes <= 120 ? `Als Nächstes in ${minutes} Min.` : 'Nächster fester Termin'}</span><h2>${escapeHtml(prominent.name)}</h2><p>${formatTime(prominent.startzeit)} · ${escapeHtml(prominent.stage || hallLabel(prominent.halle))}</p>`;
    } else {
      els['next-up-card'].hidden = true;
      els['next-up-card'].innerHTML = '';
    }

    if (!timed.length) {
      els['schedule-results'].innerHTML = emptyState('Keine festen Termine', 'Passe die Filter an oder lege über das Plus einen eigenen Eintrag mit Uhrzeit an.', 'Eigenen Termin anlegen', 'add-note');
      bindSpecialEmptyActions();
    } else {
      const byDay = new Map();
      timed.forEach(entry => {
        const day = entry.tage?.[0] || entry.startzeit.slice(0, 10);
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day).push(entry);
      });
      els['schedule-results'].innerHTML = [...byDay.entries()].map(([day, dayEntries]) => `
        <section class="schedule-day-group"><h2>${escapeHtml(formatDay(day))}</h2><div class="timeline">
          ${dayEntries.map(entry => timelineItem(entry, scheduleStatus(entry, now, nextId))).join('')}
        </div></section>`).join('');
    }
    const flexible = filteredEntries().filter(entry => !entry.startzeit && state.favorites.has(entry.id)).slice(0, 8);
    els['flexible-favorites'].innerHTML = flexible.length ? flexible.map(compactItem).join('') : '<p class="muted-copy">Noch keine flexiblen Favoriten. Herze Stände in Karte oder Hallenansicht.</p>';
  }

  function timelineItem(entry, status) {
    const category = primaryCategory(entry);
    const statusLabel = status === 'running' ? 'Läuft gerade' : status === 'next' ? 'Als Nächstes' : entry.remote ? 'Online' : entry.userCreated ? 'Eigener Termin' : entry.typ === 'talk' ? 'Panel' : 'Show';
    const what = entry.typ === 'talk' ? 'Talk / Panel' : entry.typ === 'show' ? 'Show / Stream' : entry.userCreated ? 'Eigener Eintrag' : 'Programmpunkt';
    return `<article class="timeline-item ${status}" data-timeline-id="${escapeHtml(entry.id)}" style="--timeline-color:${escapeHtml(category.color)}">
      <time class="timeline-time" datetime="${escapeHtml(entry.startzeit)}">${formatTime(entry.startzeit)}</time><span class="timeline-dot"></span>
      <div class="timeline-card"><div class="timeline-top"><h3>${escapeHtml(entry.name)}</h3><span class="live-label ${status}">${escapeHtml(statusLabel)}</span></div>
        <div class="timeline-meta"><span>${escapeHtml(what)}</span><span>·</span><span>${formatTime(entry.startzeit)}–${formatTime(entry.endzeit)}</span><span>·</span><span>${escapeHtml(entry.stage || hallLabel(entry.halle))}</span></div>
        <div class="timeline-actions">
          ${entry.kartenposition ? `<button class="text-button" type="button" data-map-entry="${escapeHtml(entry.id)}">Auf Karte</button>` : ''}
          ${entry.userCreated ? `<button class="text-button" type="button" data-edit-note="${escapeHtml(entry.id)}">Bearbeiten</button>` : `<button class="text-button" type="button" data-open-entry="${escapeHtml(entry.id)}">Details & Quellen</button>`}
          <button class="text-button" type="button" data-favorite="${escapeHtml(entry.id)}">${state.favorites.has(entry.id) ? '♥ Favorit' : '♡ Merken'}</button>
        </div>
      </div>
    </article>`;
  }

  function compactItem(entry) {
    return `<div class="compact-item"><img src="${escapeHtml(entry.bildUrl)}" alt=""><div><strong>${escapeHtml(entry.name)}</strong><span>${hallLabel(entry.halle)}${entry.stand ? ` · ${escapeHtml(entry.stand)}` : ''}</span></div><button class="icon-button" type="button" data-open-entry="${escapeHtml(entry.id)}" aria-label="Details">›</button></div>`;
  }

  function favoriteTimedItem(entry) {
    const external = entry.externeLinks?.[0];
    return `<article class="favorite-timed-item" data-entry-card="${escapeHtml(entry.id)}">
      <div class="favorite-timed-main">
        <time datetime="${escapeHtml(entry.startzeit)}"><strong>${formatTime(entry.startzeit)}</strong><span>${formatDay(entry.tage?.[0], true)}</span></time>
        <div class="favorite-timed-copy"><strong>${escapeHtml(entry.name)}</strong><span>${escapeHtml(entry.stage || hallLabel(entry.halle))}</span></div>
        <button class="favorite-button" type="button" data-favorite="${escapeHtml(entry.id)}" aria-pressed="true" aria-label="Aus Favoriten entfernen">♥</button>
      </div>
      <div class="favorite-timed-actions">
        ${!entry.userCreated && entry.gamescomLink ? `<a href="${escapeHtml(safeUrl(entry.gamescomLink))}" target="_blank" rel="noopener">Gamescom ↗</a>` : ''}
        ${!entry.userCreated && external ? `<a href="${escapeHtml(safeUrl(external.url))}" target="_blank" rel="noopener">Quelle ↗</a>` : ''}
        ${entry.kartenposition ? `<button type="button" data-map-entry="${escapeHtml(entry.id)}">Auf Karte</button>` : ''}
        <button type="button" data-schedule-entry="${escapeHtml(entry.id)}">Im Zeitplan</button>
      </div>
    </article>`;
  }

  function renderFavorites() {
    const favoriteEntries = filteredEntries().filter(entry => state.favorites.has(entry.id));
    if (!favoriteEntries.length) {
      els['favorites-results'].innerHTML = emptyState('Noch keine Favoriten', 'Tippe bei einem Stand oder Termin auf das Herz. Deine Auswahl erscheint hier und wird auf der Karte hervorgehoben.', 'Hallen entdecken', 'go-halls');
      bindSpecialEmptyActions();
      return;
    }
    const timed = favoriteEntries.filter(entry => entry.startzeit).sort((a, b) => new Date(a.startzeit) - new Date(b.startzeit));
    const flexible = favoriteEntries.filter(entry => !entry.startzeit);
    const sections = [];
    if (timed.length) {
      sections.push(`<section class="favorite-section"><h2>Feste Termine</h2><div class="favorite-timed-list">${timed.map(favoriteTimedItem).join('')}</div></section>`);
    }
    const grouped = new Map();
    flexible.forEach(entry => {
      const base = hallBase(entry.halle) || 'route';
      if (!grouped.has(base)) grouped.set(base, []);
      grouped.get(base).push(entry);
    });
    const order = ['5', '6', '7', '8', '9', '10', 'confex', 'route'];
    order.filter(key => grouped.has(key)).forEach(key => {
      const h = hallInfo(key);
      const title = h ? `${h.shortLabel} · ${h.area}` : 'Geländeweit & Routen';
      sections.push(`<section class="favorite-section"><h2>${escapeHtml(title)}</h2><div class="card-grid">${grouped.get(key).map(entry => entryCard(entry, 'favorite')).join('')}</div></section>`);
    });
    els['favorites-results'].innerHTML = sections.join('');
  }

  function emptyState(title, text, buttonText, action) {
    return `<div class="empty-state"><div class="empty-icon" aria-hidden="true">♡</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p><button class="primary-button compact" type="button" data-empty-action="${escapeHtml(action)}">${escapeHtml(buttonText)}</button></div>`;
  }

  function bindSpecialEmptyActions() {
    $$('[data-empty-action]').forEach(button => {
      button.onclick = () => {
        const action = button.dataset.emptyAction;
        if (action === 'reset-filters') resetFilters();
        if (action === 'add-note') openNoteDialog();
        if (action === 'go-halls') navigate('halls');
      };
    });
  }

  function toggleFavorite(id) {
    if (!getEntry(id)) return;
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      toast('Aus Favoriten entfernt.');
    } else {
      state.favorites.add(id);
      toast('Als Favorit gespeichert.');
    }
    persistFavorites();
    renderCounts();
    renderCurrentView();
    if (state.view === 'home') renderHome();
    renderResultMeta();
  }

  function renderCounts() {
    const count = state.favorites.size;
    els['favorite-nav-count'].hidden = count === 0;
    els['favorite-nav-count'].textContent = String(count);
    els['notes-count'].textContent = String(state.notes.length);
    els['notes-count'].setAttribute('aria-label', `${state.notes.length} eigene Einträge`);
  }

  function renderLocationState() {
    const h = hallInfo(state.currentHall);
    els['manual-hall-select'].value = state.currentHall;
    if (h) {
      els['location-title'].textContent = `Manuell gesetzt: ${h.label}`;
      els['location-text'].textContent = `${h.area}. Diese Auswahl ist für Indoor-Navigation zuverlässiger als GPS.`;
      els['current-hall-label'].textContent = `Aktuell gesetzt: ${h.label} · ${h.area}`;
      els['set-current-hall-button'].textContent = 'Ändern';
    } else if (state.userCoordinates) {
      els['location-title'].textContent = `GPS grob · ±${Math.round(state.userCoordinates.accuracy || 0)} m`;
      els['location-text'].textContent = 'Die Position wird nur ungefähr auf den Messeplan projiziert.';
      els['current-hall-label'].textContent = 'GPS aktiv, aber keine Halle manuell gesetzt';
      els['set-current-hall-button'].textContent = 'Halle setzen';
    } else {
      els['location-title'].textContent = 'Standort noch nicht aktiv';
      els['location-text'].textContent = 'Indoor-GPS ist nur grob. Am zuverlässigsten ist die manuelle Hallenauswahl.';
      els['current-hall-label'].textContent = 'Noch keine aktuelle Halle gewählt';
      els['set-current-hall-button'].textContent = 'Standort setzen';
    }
    $$('#hall-picker-buttons [data-current-hall]').forEach(button => button.classList.toggle('active', button.dataset.currentHall === state.currentHall));
  }

  function setCurrentHall(id) {
    state.currentHall = id || '';
    if (state.currentHall) localStorage.setItem(STORAGE.currentHall, state.currentHall);
    else localStorage.removeItem(STORAGE.currentHall);
    closeDialog(els['hall-picker-dialog']);
    renderLocationState();
    if (state.view === 'map') renderMap();
    if (state.view === 'halls') renderHalls();
    toast(state.currentHall ? `${hallInfo(state.currentHall)?.label || state.currentHall} als Standort gesetzt.` : 'Manuellen Standort entfernt.');
  }

  function startGeolocation() {
    if (!navigator.geolocation) {
      toast('Geolocation wird von diesem Browser nicht unterstützt.');
      return;
    }
    els['geolocation-button'].textContent = 'GPS läuft …';
    if (state.geolocationWatchId !== null) navigator.geolocation.clearWatch(state.geolocationWatchId);
    state.geolocationWatchId = navigator.geolocation.watchPosition(position => {
      state.userCoordinates = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      els['geolocation-button'].textContent = 'GPS aktualisieren';
      renderLocationState();
      renderUserLocation();
    }, error => {
      els['geolocation-button'].textContent = 'GPS versuchen';
      const messages = {
        1: 'Standortzugriff wurde abgelehnt. Nutze die Hallenauswahl.',
        2: 'Standort ist gerade nicht verfügbar. Nutze die Hallenauswahl.',
        3: 'GPS-Abfrage dauerte zu lange. Nutze die Hallenauswahl.'
      };
      toast(messages[error.code] || 'Standort konnte nicht ermittelt werden.');
    }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 });
  }

  function renderUserLocation() {
    let x = null;
    let y = null;
    let label = '';
    const h = hallInfo(state.currentHall);
    if (h) {
      x = h.x + h.w / 2;
      y = h.y + h.h / 2;
      label = h.shortLabel;
    } else if (state.userCoordinates) {
      const bounds = { minLat: 50.9418, maxLat: 50.9522, minLon: 6.9750, maxLon: 6.9920 };
      x = ((state.userCoordinates.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 100;
      y = (1 - (state.userCoordinates.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 72;
      x = Math.min(97, Math.max(3, x));
      y = Math.min(69, Math.max(3, y));
      label = 'GPS';
    }
    if (x === null) {
      els['map-user-location'].innerHTML = '';
      return;
    }
    els['map-user-location'].innerHTML = `<g class="user-location" transform="translate(${x} ${y})"><circle r="5.1" fill="#2563eb" opacity=".18"></circle><circle r="2.7" fill="#2563eb" stroke="white" stroke-width=".8"></circle><text y="-6" text-anchor="middle" font-size="2.2" font-weight="900" fill="#1d4ed8">${escapeHtml(label)}</text></g>`;
  }

  function openNoteDialog(note = null) {
    const existing = note?.userCreated ? note : null;
    els['note-dialog-title'].textContent = existing ? 'Fund bearbeiten' : 'Fund hinzufügen';
    els['note-id'].value = existing?.id || '';
    els['note-title'].value = existing?.name || '';
    els['note-hall'].value = hallBase(existing?.halle || state.currentHall || '7') || '7';
    els['note-stand'].value = existing?.stand || '';
    const preferredDay = existing?.tage?.[0] || (state.filters.day !== 'all' ? state.filters.day : EVENT_DAYS[0]);
    els['note-day'].value = preferredDay;
    if (!EVENT_DAYS.includes(els['note-day'].value)) els['note-day'].value = EVENT_DAYS[0];
    els['note-time'].value = existing?.time || (existing?.startzeit ? formatTimeInput(existing.startzeit) : '');
    els['note-text'].value = existing?.beschreibung === 'Eigener lokaler Eintrag.' ? '' : (existing?.beschreibung || '');
    els['note-favorite'].checked = existing ? state.favorites.has(existing.id) : true;
    showDialog(els['note-dialog']);
    setTimeout(() => els['note-title'].focus(), 80);
  }

  function formatTimeInput(iso) {
    const date = new Date(iso);
    return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Berlin' }).format(date);
  }

  function saveNoteFromForm(event) {
    event.preventDefault();
    if (!els['note-form'].reportValidity()) return;
    const existingId = els['note-id'].value;
    const old = state.notes.find(note => note.id === existingId);
    const id = existingId || `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const raw = {
      id,
      name: els['note-title'].value.trim(),
      halle: els['note-hall'].value,
      stand: els['note-stand'].value.trim(),
      day: els['note-day'].value,
      time: els['note-time'].value,
      text: els['note-text'].value.trim(),
      createdAt: old?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      kartenposition: old && hallBase(old.halle) === els['note-hall'].value ? old.kartenposition : noteMapPosition(id, els['note-hall'].value)
    };
    const normalized = normalizeNote(raw);
    if (!normalized) return;
    const index = state.notes.findIndex(note => note.id === id);
    if (index >= 0) state.notes[index] = normalized;
    else state.notes.push(normalized);
    if (els['note-favorite'].checked) state.favorites.add(id);
    else state.favorites.delete(id);
    persistNotes();
    persistFavorites();
    closeDialog(els['note-dialog']);
    renderAll();
    toast(index >= 0 ? 'Eigener Eintrag aktualisiert.' : 'Eigener Fund gespeichert.');
  }

  function deleteNote(id) {
    const note = state.notes.find(item => item.id === id);
    if (!note) return;
    if (!window.confirm(`„${note.name}“ wirklich löschen?`)) return;
    state.notes = state.notes.filter(item => item.id !== id);
    state.favorites.delete(id);
    persistNotes();
    persistFavorites();
    renderAll();
    renderNotesDrawer();
    toast('Eigener Eintrag gelöscht.');
  }

  function openNotesDrawer() {
    renderNotesDrawer();
    showDialog(els['notes-drawer']);
  }

  function renderNotesDrawer() {
    const sorted = [...state.notes].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    if (!sorted.length) {
      els['notes-list'].innerHTML = `<div class="empty-state"><div class="empty-icon">＋</div><h3>Noch keine eigenen Funde</h3><p>Nutze den Plus-Button, wenn du auf der Messe spontan einen Stand, Treffpunkt oder Reminder speichern willst.</p></div>`;
      return;
    }
    els['notes-list'].innerHTML = sorted.map(note => `<article class="note-list-item"><h3>${escapeHtml(note.name)}</h3><p>${hallLabel(note.halle)}${note.stand ? ` · ${escapeHtml(note.stand)}` : ''} · ${formatDay(note.tage[0], true)}${note.time ? ` · ${escapeHtml(note.time)}` : ''}</p>${note.beschreibung ? `<p>${escapeHtml(note.beschreibung)}</p>` : ''}<div class="note-list-actions"><button class="text-button" type="button" data-map-entry="${escapeHtml(note.id)}">Auf Karte</button><button class="text-button" type="button" data-edit-note="${escapeHtml(note.id)}">Bearbeiten</button><button class="text-button danger" type="button" data-delete-note="${escapeHtml(note.id)}">Löschen</button></div></article>`).join('');
  }

  function exportPlan() {
    const payload = {
      app: 'GC26 Guide',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      dataVersion: state.data?.meta.dataVersion,
      favorites: [...state.favorites],
      notes: state.notes.map(note => ({
        id: note.id, name: note.name, halle: note.halle, stand: note.stand,
        day: note.tage[0], time: note.time || '', text: note.beschreibung,
        createdAt: note.createdAt, updatedAt: note.updatedAt, kartenposition: note.kartenposition
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gamescom-plan-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast('Plan als JSON exportiert.');
  }

  async function importPlan(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!Array.isArray(payload.notes) || !Array.isArray(payload.favorites)) throw new Error('Format nicht erkannt.');
      const normalized = payload.notes.map(normalizeNote).filter(Boolean);
      const byId = new Map(state.notes.map(note => [note.id, note]));
      normalized.forEach(note => byId.set(note.id, note));
      state.notes = [...byId.values()];
      payload.favorites.forEach(id => state.favorites.add(id));
      persistNotes();
      persistFavorites();
      renderAll();
      renderNotesDrawer();
      toast(`${normalized.length} eigene Einträge importiert.`);
    } catch (error) {
      console.error(error);
      toast('Import fehlgeschlagen: keine gültige GC26-JSON-Datei.');
    }
  }

  function showDialog(dialog) {
    if (!dialog) return;
    document.body.classList.add('dialog-open');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    if (!$$('dialog[open]').length) document.body.classList.remove('dialog-open');
  }

  async function installApp() {
    if (state.installPrompt) {
      state.installPrompt.prompt();
      await state.installPrompt.userChoice;
      state.installPrompt = null;
      els['install-button'].hidden = true;
    } else {
      showDialog(els['install-dialog']);
    }
  }

  function updateNetworkStatus() {
    els['network-banner'].hidden = navigator.onLine;
  }

  function toast(message) {
    const element = document.createElement('div');
    element.className = 'toast';
    element.textContent = message;
    els['toast-region'].appendChild(element);
    setTimeout(() => element.classList.add('show'), 10);
    setTimeout(() => {
      element.classList.remove('show');
      setTimeout(() => element.remove(), 220);
    }, 2800);
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    try {
      await navigator.serviceWorker.register('./sw.js', { scope: './' });
    } catch (error) {
      console.warn('Service Worker konnte nicht registriert werden:', error);
    }
  }

  async function init() {
    cacheElements();
    readStorage();
    bindEvents();
    updateNetworkStatus();
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone) els['install-button'].hidden = true;
    try {
      await loadData();
      state.notes = state.notes.map(normalizeNote).filter(Boolean);
      populateControls();
      state.isReady = true;
      renderAll();
      routeFromHash();
      renderCounts();
      els['app'].setAttribute('aria-busy', 'false');
      state.clockTimer = window.setInterval(() => {
        if (state.view === 'schedule') renderSchedule();
      }, 30000);
      registerServiceWorker();
      window.__GC_APP__ = {
        state,
        navigate,
        renderAll,
        getEntry,
        version: state.data.meta.version
      };
    } catch (error) {
      console.error(error);
      els['app'].setAttribute('aria-busy', 'false');
      document.getElementById('main-content').innerHTML = `<div class="content-view"><div class="empty-state"><div class="empty-icon">!</div><h1>Daten konnten nicht geladen werden</h1><p>${escapeHtml(error.message)}</p><p>Beim allerersten Aufruf ist eine Internetverbindung nötig. Danach übernimmt der Offline-Cache.</p><button class="primary-button" onclick="location.reload()">Neu laden</button></div></div>`;
    }
  }

  init();
})();
