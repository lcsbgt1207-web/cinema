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
      // Toujours afficher première page
      pages.push(1);
      // Pages autour de la page courante
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(total - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      // Toujours afficher dernière page
      if (total > 1) pages.push(total);
      // Dédupliquer
      pages = [...new Set(pages)].sort((a, b) => a - b);

      let html = '<div class="pager">';
      // Bouton précédent
      html += `<button class="pager-btn ${currentPage === 1 ? 'disabled' : ''}" onclick="PAGINATION._go('${containerId}', ${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
        <i class="ti ti-chevron-left"></i>
      </button>`;

      // Pages avec ellipses
      let prev = 0;
      for (const p of pages) {
        if (p - prev > 1) html += '<span class="pager-ellipsis">…</span>';
        html += `<button class="pager-btn ${p === currentPage ? 'active' : ''}" onclick="PAGINATION._go('${containerId}', ${p})">${p}</button>`;
        prev = p;
      }

      // Bouton suivant
      html += `<button class="pager-btn ${currentPage === total ? 'disabled' : ''}" onclick="PAGINATION._go('${containerId}', ${currentPage + 1})" ${currentPage === total ? 'disabled' : ''}>
        <i class="ti ti-chevron-right"></i>
      </button>`;

      html += `<span class="pager-info">Page ${currentPage} / ${total}</span>`;
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
    PAGINATION._instances[containerId] = { render, totalPages, items, perPage };

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

  _instances: {}
};
