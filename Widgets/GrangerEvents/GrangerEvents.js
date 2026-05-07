(function () {
  'use strict';

  // --- ?s= query-string -> @Keyword data-param ---
  (function applyKeywordParam() {
    var keyword = new URLSearchParams(window.location.search).get('s');
    if (!keyword) return;

    function apply() {
      var widget = document.getElementById('GrangerEvents');
      if (!widget) return;
      var existing = widget.getAttribute('data-params') || '';
      widget.setAttribute('data-params', existing + (existing ? ',' : '') + '@Keyword=' + keyword);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply);
    } else {
      apply();
    }
  })();

  // --- Fuse.js loader (fuzzy/typo/prefix client search) ---
  // Templates render via innerHTML so <script> tags inside the Liquid template are inert;
  // we inject the loader from here. Kicked off immediately so Fuse loads in parallel
  // with the widget's data fetch and is ready by the time widgetLoaded fires.
  var fusePromise = (function loadFuse() {
    if (typeof Fuse !== 'undefined') return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js';
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        console.error('GrangerEvents: failed to load Fuse.js');
        reject(new Error('Fuse load failed'));
      };
      document.head.appendChild(script);
    });
  })();

  // --- Search index helpers ---
  // Validated via Widgets/GrangerEvents/compare-search.html. Stop words and synonyms
  // are applied in app code, not via library term-processor hooks (MiniSearch's
  // processTerm proved unreliable — campus leaked into the index). Pre-strip the
  // indexed text at source instead.
  var GE_FIELDS = ['Event_Title', 'Description', 'Additional_Description', 'Location_Name', 'Program_Name'];
  var GE_STOP_WORDS = new Set(['campus', 'campuses']);
  var GE_SYNONYMS = {
    kid: 'child', kids: 'child', children: 'child',
    men: 'man', women: 'woman',
    youth: 'teen', teens: 'teen', teenager: 'teen', teenagers: 'teen'
  };

  function geApplySynonym(term) {
    var t = String(term).toLowerCase();
    return Object.prototype.hasOwnProperty.call(GE_SYNONYMS, t) ? GE_SYNONYMS[t] : t;
  }

  function geExpandQuery(q) {
    return String(q).toLowerCase().split(/\s+/)
      .filter(Boolean)
      .filter(function (t) { return !GE_STOP_WORDS.has(t); })
      .map(geApplySynonym)
      .join(' ');
  }

  var GE_STOP_WORD_RE = (function () {
    if (GE_STOP_WORDS.size === 0) return null;
    var alts = Array.from(GE_STOP_WORDS)
      .map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); })
      .join('|');
    return new RegExp('\\b(?:' + alts + ')\\b', 'gi');
  })();

  function geStripStopWords(s) {
    var str = String(s || '');
    if (!GE_STOP_WORD_RE) return str;
    return str.replace(GE_STOP_WORD_RE, ' ').replace(/\s+/g, ' ').trim();
  }

  function geDebounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function geBindFuseSearch(searchInput, noResults, cols, events) {
    if (!searchInput) return;

    var sanitized = events.map(function (ev) {
      var copy = { Event_ID: ev.Event_ID };
      GE_FIELDS.forEach(function (f) { copy[f] = geStripStopWords(ev[f]); });
      return copy;
    });
    var fuse = new Fuse(sanitized, {
      keys: GE_FIELDS,
      threshold: 0.3,
      ignoreLocation: true,
      includeScore: true
    });

    function showAll() {
      cols.forEach(function (c) { c.style.display = ''; });
      if (noResults) noResults.hidden = true;
    }

    function runSearch(rawQuery) {
      var raw = String(rawQuery || '').trim();
      if (!raw) return showAll();

      var expanded = geExpandQuery(raw);
      var tokens = expanded.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return showAll();

      var matchIds = null;
      tokens.forEach(function (tok) {
        // Stricter score cutoff for short tokens — Fuse's default threshold lets
        // too many edit-distance neighbors through on 4-char queries.
        var maxScore = tok.length <= 4 ? 0.2 : 0.3;
        var ids = new Set(fuse.search(tok)
          .filter(function (r) { return r.score == null || r.score <= maxScore; })
          .map(function (r) { return String(r.item.Event_ID); }));
        if (matchIds === null) matchIds = ids;
        else matchIds = new Set(Array.from(matchIds).filter(function (x) { return ids.has(x); }));
      });

      var visibleCount = 0;
      cols.forEach(function (col) {
        var card = col.querySelector('.ge-card');
        var id = card && card.getAttribute('data-event-id');
        var match = matchIds && id && matchIds.has(String(id));
        col.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });
      if (noResults) noResults.hidden = visibleCount > 0;
    }

    searchInput.addEventListener('input', geDebounce(function () { runSearch(searchInput.value); }, 150));
  }

  // --- Date formatting utilities ---
  // MP API returns naive ISO strings with a misleading 'Z' suffix that actually
  // represent local time. Strip the suffix, re-append 'Z', then format with
  // timeZone:'UTC' so values display unchanged regardless of browser timezone.
  function geParse(isoStr) {
    if (!isoStr) return null;
    var cleaned = String(isoStr).replace(/\.?\d*Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
    var d = new Date(cleaned + 'Z');
    if (isNaN(d.getTime())) {
      console.warn('geParse: unable to parse date:', isoStr);
      return null;
    }
    return d;
  }

  function geFormatDate(isoStr, options) {
    var d = geParse(isoStr);
    if (!d) return '';
    return new Intl.DateTimeFormat('en-US', Object.assign({}, options, { timeZone: 'UTC' })).format(d);
  }

  // Granger time style: no :00, lowercase a.m./p.m. — "5 p.m.", "9:30 a.m."
  function geFormatTime(isoStr) {
    var d = geParse(isoStr);
    if (!d) return '';
    var h = d.getUTCHours();
    var m = d.getUTCMinutes();
    var hour12 = h % 12 || 12;
    var period = h < 12 ? 'a.m.' : 'p.m.';
    return m === 0 ? hour12 + ' ' + period : hour12 + ':' + String(m).padStart(2, '0') + ' ' + period;
  }

  // Same-day range: "5-6:30 p.m.", "9:30 a.m.-1 p.m."
  function geFormatTimeRange(startIso, endIso) {
    var ds = geParse(startIso);
    var de = geParse(endIso);
    if (!ds || !de) return geFormatTime(startIso);
    var sH = ds.getUTCHours(), sM = ds.getUTCMinutes();
    var eH = de.getUTCHours(), eM = de.getUTCMinutes();
    var sHour12 = sH % 12 || 12, eHour12 = eH % 12 || 12;
    var sPeriod = sH < 12 ? 'a.m.' : 'p.m.';
    var ePeriod = eH < 12 ? 'a.m.' : 'p.m.';
    var sTime = sM === 0 ? String(sHour12) : sHour12 + ':' + String(sM).padStart(2, '0');
    var eTime = eM === 0 ? String(eHour12) : eHour12 + ':' + String(eM).padStart(2, '0');

    if (sPeriod === ePeriod) {
      return sTime + '-' + eTime + ' ' + ePeriod;
    }
    return sTime + ' ' + sPeriod + '-' + eTime + ' ' + ePeriod;
  }

  function geFormatDateBadges(container) {
    container.querySelectorAll('.ge-date-badge[data-start]').forEach(function (badge) {
      var start = badge.getAttribute('data-start');
      var end = badge.getAttribute('data-end');
      var startMonth = geFormatDate(start, { month: 'short' });
      var startDay = geFormatDate(start, { day: 'numeric' });

      if (end) {
        var endMonth = geFormatDate(end, { month: 'short' });
        var endDay = geFormatDate(end, { day: 'numeric' });
        var startYmd = start.slice(0, 10);
        var endYmd = end.slice(0, 10);

        if (startYmd !== endYmd) {
          if (startMonth !== endMonth) {
            badge.classList.add('ge-date-badge-crossmonth');
            badge.innerHTML =
              '<span class="ge-badge-date-start">' +
                '<span class="ge-badge-cm-month">' + startMonth + '</span>' +
                '<span class="ge-badge-cm-day">' + startDay + '</span>' +
              '</span>' +
              '<span class="ge-badge-cm-divider">&ndash;</span>' +
              '<span class="ge-badge-date-end">' +
                '<span class="ge-badge-cm-month">' + endMonth + '</span>' +
                '<span class="ge-badge-cm-day">' + endDay + '</span>' +
              '</span>';
            return;
          }
          badge.innerHTML =
            '<span class="ge-badge-month">' + startMonth + '</span>' +
            '<span class="ge-badge-day">' + startDay + '&ndash;' + endDay + '</span>';
          return;
        }
      }

      badge.innerHTML =
        '<span class="ge-badge-month">' + startMonth + '</span>' +
        '<span class="ge-badge-day">' + startDay + '</span>';
    });
  }

  function geFormatModalDatetimes(container) {
    container.querySelectorAll('.ge-modal-datetime[data-start]').forEach(function (el) {
      var start = el.getAttribute('data-start');
      var end = el.getAttribute('data-end');
      var startYmd = start ? start.slice(0, 10) : '';
      var endYmd = end ? end.slice(0, 10) : '';

      if (end && endYmd !== startYmd) {
        el.textContent =
          geFormatDate(start, { weekday: 'long', month: 'long', day: 'numeric' }) + ', ' +
          geFormatTime(start) + ' to ' +
          geFormatDate(end, { weekday: 'long', month: 'long', day: 'numeric' }) + ', ' +
          geFormatTime(end);
      } else if (end) {
        el.textContent =
          geFormatDate(start, { weekday: 'long', month: 'long', day: 'numeric' }) + ', ' +
          geFormatTimeRange(start, end);
      } else {
        el.textContent =
          geFormatDate(start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ' • ' +
          geFormatTime(start);
      }
    });
  }

  // --- Widget initialization ---
  var escapeBound = false;

  window.addEventListener('widgetLoaded', function (e) {
    var container = document.getElementById(e.detail.widgetId);
    if (!container) return;

    var grid = container.querySelector('[id^="ge-card-grid"]');
    if (!grid) return;

    var maxSeriesAttr = container.getAttribute('data-max-series-events');
    var maxSeries = maxSeriesAttr ? parseInt(maxSeriesAttr, 10) : NaN;
    if (!isNaN(maxSeries) && maxSeries > 0) {
      grid.querySelectorAll('.ge-col').forEach(function (col) {
        var order = parseInt(col.getAttribute('data-sequence-order'), 10);
        if (!isNaN(order) && order > maxSeries) {
          var card = col.querySelector('.ge-card');
          var eventId = card && card.getAttribute('data-event-id');
          if (eventId) {
            var modal = document.getElementById('ge-modal-' + eventId);
            if (modal) modal.remove();
          }
          col.remove();
        }
      });
    }

    try {
      geFormatDateBadges(container);
      geFormatModalDatetimes(container);
    } catch (err) {
      console.error('Date formatting error:', err);
    }

    var cols = Array.from(grid.querySelectorAll('.ge-col'));
    cols.sort(function (a, b) {
      return (a.getAttribute('data-sort') || '').localeCompare(b.getAttribute('data-sort') || '');
    });
    cols.forEach(function (col) { grid.appendChild(col); });

    // Fuzzy search filter — Fuse.js with stop words, synonyms, multi-token AND.
    // Index is built from the raw event data (DataSet1) on the widgetLoaded event,
    // filtered to whatever survived series-capping above so the index agrees with the DOM.
    var searchInput = container.querySelector('.ge-search');
    var noResults = container.querySelector('.ge-no-results');
    var rawEvents = (e.detail && e.detail.data && e.detail.data.DataSet1) || [];
    var surviving = new Set(cols.map(function (col) {
      var card = col.querySelector('.ge-card');
      return card && card.getAttribute('data-event-id');
    }).filter(Boolean));
    var liveEvents = rawEvents.filter(function (ev) { return surviving.has(String(ev.Event_ID)); });

    fusePromise.then(function () {
      geBindFuseSearch(searchInput, noResults, cols, liveEvents);
    }).catch(function () {
      // Fuse failed to load — leave the input inert rather than fall back silently.
      // The console error from the loader is already logged.
    });

    function openModal(eventId) {
      var modal = document.getElementById('ge-modal-' + eventId);
      if (modal) {
        if (modal.parentNode !== document.body) document.body.appendChild(modal);
        modal.classList.add('ge-open');
        document.body.style.overflow = 'hidden';
        history.replaceState(null, '', '#' + eventId);
      }
    }

    function closeAllModals() {
      document.querySelectorAll('.ge-overlay.ge-open').forEach(function (m) {
        m.classList.remove('ge-open');
      });
      document.body.style.overflow = '';
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    container.querySelectorAll('.ge-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        e.preventDefault();
        openModal(card.getAttribute('data-event-id'));
      });
    });

    container.querySelectorAll('.ge-close').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeAllModals();
      });
    });

    container.querySelectorAll('.ge-overlay').forEach(function (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeAllModals();
      });
    });

    if (!escapeBound) {
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAllModals();
      });
      escapeBound = true;
    }

    var hash = window.location.hash.replace('#', '');
    if (hash) openModal(hash);
  });
})();
