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

    // Keyword search filter — whole-word, multi-token (all tokens must match)
    var searchInput = container.querySelector('.ge-search');
    var noResults = container.querySelector('.ge-no-results');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        var query = searchInput.value.trim().toLowerCase();
        var tokens = query ? query.split(/\s+/) : [];
        var regexes = tokens.map(function (tok) {
          var escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp('\\b' + escaped + '\\b');
        });
        var visibleCount = 0;
        cols.forEach(function (col) {
          var haystack = col.getAttribute('data-search') || '';
          var match = regexes.length === 0 || regexes.every(function (re) { return re.test(haystack); });
          col.style.display = match ? '' : 'none';
          if (match) visibleCount++;
        });
        if (noResults) noResults.hidden = visibleCount > 0;
      });
    }

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
