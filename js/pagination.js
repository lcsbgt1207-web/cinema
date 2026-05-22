/* ═══════════════════════════════════════
   CinéProche — Pagination partagée
   ═══════════════════════════════════════ */

const PAGINATION = {

  // Crée un composant pagination
  // items = tableau complet, perPage = nb par page, renderFn = fonction qui affiche les items
  create({ items, perPage, containerId, renderFn, scrollTo = null }) {
    let currentPage = 1;
    const totalPages = () => Math.ceil(items.length / perPage);

    function getPage(page) {
      const start = (page - 1) * perPage;
      return items.slice(start, start + perPage);
    }

    function buildPager() {
      const total = totalPages();
      if (total <= 1) return '';

      let pages = [];
      if (total <= 4) {
        pages = Array.from({ length: total }, (_, index) => index + 1);
      } else {
        const startPage = currentPage <= 2 ? 1 : currentPage;
        for (let page = startPage; page <= Math.min(startPage + 2, total); page++) {
          pages.push(page);
        }
        if (!pages.includes(total)) {
          if (pages[pages.length - 1] < total - 1) pages.push('ellipsis');
          pages.push(total);
        }
      }

      let html = '<div class="catalogue-bottom nouveautes-bottom">';
      html += `<div class="page-state">Page ${currentPage} sur ${total}</div>`;
      html += '<div class="pagination-controls">';
      html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="PAGINATION._go('${containerId}', ${currentPage - 1})"><i class="ti ti-chevron-left"></i></button>`;

      html += pages.map(page => page === 'ellipsis'
        ? `<span class="page-ellipsis">…</span>`
        : `<button class="page-btn ${page === currentPage ? 'active' : ''}" onclick="PAGINATION._go('${containerId}', ${page})">${page}</button>`
      ).join('');

      html += `<button class="page-btn" ${currentPage === total ? 'disabled' : ''} onclick="PAGINATION._go('${containerId}', ${currentPage + 1})"><i class="ti ti-chevron-right"></i></button>`;
      html += '</div>';
      html += `<select class="page-size-select" onchange="PAGINATION._changePageSize('${containerId}', this.value)">
        <option value="8" ${perPage === 8 ? 'selected' : ''}>8 par page</option>
        <option value="12" ${perPage === 12 ? 'selected' : ''}>12 par page</option>
        <option value="25" ${perPage === 25 ? 'selected' : ''}>25 par page</option>
      </select>`;
      html += '</div>';
      return html;
    }

    function render(page) {
      currentPage = page;
      const pageItems = getPage(page);
      renderFn(pageItems, buildPager());
      if (scrollTo) {
        const el = document.getElementById(scrollTo);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    // Stocker l'instance pour les callbacks
    PAGINATION._instances = PAGINATION._instances || {};
    PAGINATION._instances[containerId] = { render, totalPages, items, get perPage() { return perPage; }, setPageSize(value) { perPage = Number(value) || 8; render(1); } };

    // Premier rendu
    render(1);
  },

  _go(containerId, page) {
    const inst = this._instances[containerId];
    if (!inst) return;
    const total = inst.totalPages();
    if (page < 1 || page > total) return;
    inst.render(page);
  },

  _changePageSize(containerId, value) {
    const inst = this._instances[containerId];
    if (!inst || typeof inst.setPageSize !== 'function') return;
    inst.setPageSize(value);
  },

  _instances: {}
};
