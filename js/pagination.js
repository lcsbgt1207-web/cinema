/* ═══════════════════════════════════════
   CinéProche — Pagination partagée
   Style aligné sur le Catalogue
   ═══════════════════════════════════════ */

const PAGINATION = {
  create({ items, perPage = 5, containerId, renderFn, scrollTo = null }) {
    let currentPage = 1;
    let currentPerPage = 5;
    const allItems = Array.isArray(items) ? items : [];

    function totalPages() {
      return Math.max(1, Math.ceil(allItems.length / currentPerPage));
    }

    function getPage(page) {
      const start = (page - 1) * currentPerPage;
      return allItems.slice(start, start + currentPerPage);
    }

    function getVisiblePages(total) {
      if (total <= 4) return Array.from({ length: total }, (_, index) => index + 1);

      const start = currentPage <= 2 ? 1 : currentPage;
      const pages = [];
      for (let page = start; page <= Math.min(start + 2, total); page++) {
        pages.push(page);
      }

      if (!pages.includes(total)) {
        if (pages[pages.length - 1] < total - 1) pages.push('ellipsis');
        pages.push(total);
      }

      return pages;
    }

    function buildPager() {
      const total = totalPages();
      if (total <= 1) return '';
      const pages = getVisiblePages(total);

      return `
        <div class="catalogue-bottom pagination-bottom">
          <div class="page-state">Page ${currentPage} sur ${total}</div>
          <div class="pagination-controls">
            <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="PAGINATION._go('${containerId}', ${currentPage - 1})"><i class="ti ti-chevron-left"></i></button>
            ${pages.map(page => page === 'ellipsis'
              ? `<span class="page-ellipsis">…</span>`
              : `<button class="page-btn ${page === currentPage ? 'active' : ''}" onclick="PAGINATION._go('${containerId}', ${page})">${page}</button>`
            ).join('')}
            <button class="page-btn" ${currentPage === total ? 'disabled' : ''} onclick="PAGINATION._go('${containerId}', ${currentPage + 1})"><i class="ti ti-chevron-right"></i></button>
          </div>
        </div>`;
    }

    function render(page) {
      const total = totalPages();
      currentPage = Math.min(Math.max(Number(page) || 1, 1), total);
      const startIndex = (currentPage - 1) * currentPerPage;
      const pageItems = getPage(currentPage);
      renderFn(pageItems, buildPager(), { currentPage, totalPages: total, perPage: currentPerPage, startIndex, totalItems: allItems.length });
      if (scrollTo) {
        const el = document.getElementById(scrollTo);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    PAGINATION._instances = PAGINATION._instances || {};
    PAGINATION._instances[containerId] = {
      render,
      totalPages,
      items: allItems
    };

    render(1);
  },

  _go(containerId, page) {
    const inst = this._instances?.[containerId];
    if (!inst) return;
    inst.render(page);
  },

  _instances: {}
};
