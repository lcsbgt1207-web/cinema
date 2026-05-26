// ZIP 4.9 — Rendu du catalogue.
// Rôle : construire uniquement le HTML visible du tableau catalogue et de la pagination.
// Important : ce fichier ne lit pas localStorage, ne contacte pas TMDB et ne modifie pas les données.

(function () {
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    }[char] || char));
  }

  function setHtml(id, html) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = html;
  }

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function updateTableHeaders(nearbyMode) {
    const headers = {
      lb: document.getElementById('header-lb'),
      imdb: document.getElementById('header-imdb'),
      sc: document.getElementById('header-sc')
    };

    if (nearbyMode) {
      if (headers.lb) headers.lb.innerHTML = '<span class="source-dot dot-sc"></span> Note <i class="ti ti-selector" id="icon-lb"></i>';
      if (headers.imdb) headers.imdb.innerHTML = '<span class="source-dot dot-imdb"></span> Source <i class="ti ti-selector" id="icon-imdb"></i>';
      if (headers.sc) headers.sc.innerHTML = '<span class="source-dot dot-lb"></span> Cinéma <i class="ti ti-selector" id="icon-sc"></i>';
      return;
    }

    if (headers.lb) headers.lb.innerHTML = '<span class="source-dot dot-lb"></span> Letterboxd <i class="ti ti-selector" id="icon-lb"></i>';
    if (headers.imdb) headers.imdb.innerHTML = '<span class="source-dot dot-imdb"></span> IMDb <i class="ti ti-selector" id="icon-imdb"></i>';
    if (headers.sc) headers.sc.innerHTML = '<span class="source-dot dot-sc"></span> SensCritique <i class="ti ti-selector" id="icon-sc"></i>';
  }

  function renderEmptyNearbyCatalogue(lookaheadDays = 14) {
    setHtml('table-body', `
      <tr>
        <td colspan="8">
          <div class="catalogue-empty-row">
            <strong>Aucun film proche trouvé pour le moment</strong>
            Lance une recherche depuis l’accueil ou réessaie avec un rayon plus large. Le Catalogue vérifie les séances des ${lookaheadDays} prochains jours.
          </div>
        </td>
      </tr>`);
    setText('count-label', '0 film proche');
    setText('film-count', '0 film proche');
    renderPagination(1, 1);
  }

  function buildFilmRow(film, context) {
    const {
      nearbyMode,
      favs,
      formatNearbyBestNote,
      getNearbyRatingSource,
      getNearbyCinemaLabel,
      getNearbyNextShowtimeLabel,
      formatClassicRating,
      formatImdbNote
    } = context;

    const id = String(film.id);
    const poster = film.poster
      ? `<img src="${escapeHtml(film.poster)}" alt="Affiche ${escapeHtml(film.titre)}" loading="lazy">`
      : '<i class="ti ti-photo"></i>';
    const nearbyCinemaText = getNearbyCinemaLabel(film);
    const nextShowtimeText = typeof getNearbyNextShowtimeLabel === 'function' ? getNearbyNextShowtimeLabel(film) : '';

    return `
      <tr onclick='openCatalogueFilmPopup(${JSON.stringify(id)})'>
        <td><button class="fav-btn ${favs.has(id) ? 'active' : ''}" onclick='event.stopPropagation(); toggleFav(${JSON.stringify(id)}, this)'>
          <i class="ti ti-bookmark"></i></button></td>
        <td class="td-title">
          <div class="film-cell">
            <div class="film-thumb">${poster}</div>
            <div>
              <div class="film-name">${film.lbRank ? '#' + escapeHtml(film.lbRank) + ' · ' : ''}${escapeHtml(film.titre)}</div>
              ${film.original ? `<div class="film-original">${escapeHtml(film.original)}</div>` : ''}
              ${film.isNearbyShowing ? `<div class="film-original">Près de toi · ${escapeHtml(nearbyCinemaText)}</div>` : ''}
              ${nextShowtimeText ? `<div class="film-original">Prochaine séance · ${escapeHtml(nextShowtimeText)}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="td-real">${escapeHtml(film.real)}</td>
        <td><span class="genre-pill">${escapeHtml(film.genre)}</span></td>
        ${nearbyMode ? `
          <td class="td-note sep-left"><span class="nearby-note-main">${escapeHtml(formatNearbyBestNote(film))}</span></td>
          <td class="td-source"><span class="nearby-source-pill">${escapeHtml(getNearbyRatingSource(film))}</span></td>
          <td class="td-cinema"><span class="nearby-cinema-pill"><i class="ti ti-map-pin"></i>${escapeHtml(getNearbyCinemaLabel(film))}</span></td>
        ` : `
          <td class="td-note sep-left"><span class="note note-lb">${escapeHtml(formatClassicRating(film.lb, ' ★'))}</span></td>
          <td class="td-note"><span class="note note-imdb">${escapeHtml(formatImdbNote(film))}</span></td>
          <td class="td-note"><span class="note note-sc">${escapeHtml(formatClassicRating(film.sc))}</span></td>
        `}
        <td class="td-year">${escapeHtml(film.annee || '—')}</td>
      </tr>`;
  }

  function getVisiblePaginationPages(currentPage, totalPages) {
    if (totalPages <= 4) return Array.from({ length: totalPages }, (_, index) => index + 1);

    const start = currentPage <= 2 ? 1 : currentPage;
    const pages = [];
    for (let page = start; page <= Math.min(start + 2, totalPages); page++) pages.push(page);

    if (!pages.includes(totalPages)) {
      if (pages[pages.length - 1] < totalPages - 1) pages.push('ellipsis');
      pages.push(totalPages);
    }

    return pages;
  }

  function renderPagination(currentPage, totalPages, pageSize = 8) {
    const bottom = document.getElementById('catalogue-bottom');
    if (!bottom) return;

    const pages = getVisiblePaginationPages(currentPage, totalPages);
    bottom.innerHTML = `
      <div class="page-state">Page ${currentPage} sur ${totalPages}</div>
      <div class="pagination-controls">
        <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})"><i class="ti ti-chevron-left"></i></button>
        ${pages.map(page => page === 'ellipsis'
          ? '<span class="page-ellipsis">…</span>'
          : `<button class="page-btn ${page === currentPage ? 'active' : ''}" onclick="changePage(${page})">${page}</button>`
        ).join('')}
        <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})"><i class="ti ti-chevron-right"></i></button>
      </div>
      <select class="page-size-select" onchange="changePageSize(this.value)">
        <option value="8" ${pageSize === 8 ? 'selected' : ''}>8 par page</option>
        <option value="12" ${pageSize === 12 ? 'selected' : ''}>12 par page</option>
        <option value="25" ${pageSize === 25 ? 'selected' : ''}>25 par page</option>
      </select>
    `;
  }

  function renderTable(options) {
    const data = Array.isArray(options.data) ? options.data : [];
    const currentPage = Number(options.currentPage) || 1;
    const pageSize = Number(options.pageSize) || 8;
    const nearbyMode = Boolean(options.nearbyMode);
    const catalogueMode = options.catalogueMode || 'nearby';
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    const pageData = data.slice(start, start + pageSize);

    updateTableHeaders(nearbyMode);

    if (!data.length && catalogueMode === 'nearby') {
      renderEmptyNearbyCatalogue(Number(options.lookaheadDays) || 14);
      return;
    }

    setHtml('table-body', pageData.map(film => buildFilmRow(film, options)).join(''));

    if (!options.preserveCountLabels) {
      const label = data.length + ' film' + (data.length > 1 ? 's' : '') + (nearbyMode ? ' proches' : '');
      setText('count-label', label);
      setText('film-count', label);
    }
    renderPagination(safePage, totalPages, pageSize);
  }

  window.CINEPRO_CATALOGUE_RENDER = {
    renderTable,
    renderPagination,
    updateTableHeaders,
    escapeHtml
  };
})();
