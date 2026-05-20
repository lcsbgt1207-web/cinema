/* ═══════════════════════════════════════
   CinéProche — Données & utilitaires partagés
   ═══════════════════════════════════════ */

// ── Couleurs affiches ──
const POSTER_COLORS = {
  p1: '#c9bfb0', p2: '#b0bec9', p3: '#c9b0bc',
  p4: '#b0c9c2', p5: '#c4c9b0', p6: '#bdb0c9'
};

// ── Films ──
const FILMS = [
  {
    id: 0, titre: 'Le Dernier Voyage', original: '', genre: 'Drame', duree: '1h58',
    real: 'Claire Moreau', acteurs: 'Léa Seydoux, Vincent Lindon',
    synopsis: "Un homme retrouve les carnets de voyage de son père disparu et décide de refaire son itinéraire à travers l'Europe pour comprendre qui il était vraiment.",
    color: 'p1', badge: 'Nouveau',
    lb: 4.2, imdb: 7.8, sc: 7.4,
    cinemas: [
      { nom: 'Cinéma du Panthéon', dist: '0,2 km', seances: { "Aujourd'hui": ['14h00','17h15','20h30'], 'Demain': ['15h00','20h00'] } },
      { nom: 'MK2 Odéon', dist: '0,8 km', seances: { "Aujourd'hui": ['15h30','21h00'], 'Demain': ['14h00','19h30'] } },
      { nom: 'Le Champo', dist: '1,1 km', seances: { "Aujourd'hui": ['16h00','20h15'], 'Demain': ['15h30'] } }
    ]
  },
  {
    id: 1, titre: 'Fracture', original: '', genre: 'Thriller', duree: '2h10',
    real: 'David Szabo', acteurs: 'Tahar Rahim, Adèle Exarchopoulos',
    synopsis: "Une procureure découvre que l'affaire qu'elle instruit depuis des mois pourrait impliquer des membres de sa propre famille.",
    color: 'p2', badge: 'Nouveau',
    lb: 4.1, imdb: 7.6, sc: 7.2,
    cinemas: [
      { nom: 'Pathé Wepler', dist: '1,2 km', seances: { "Aujourd'hui": ['15h30','19h00','21h45'], 'Demain': ['14h30','18h45'] } },
      { nom: 'UGC Odéon', dist: '1,7 km', seances: { "Aujourd'hui": ['17h00','20h15'], 'Demain': ['16h00','20h30'] } },
      { nom: 'Le Grand Rex', dist: '2,5 km', seances: { 'Demain': ['14h00','19h30','22h00'] } }
    ]
  },
  {
    id: 2, titre: "Lumière d'Août", original: '', genre: 'Romance', duree: '1h45',
    real: 'Sofia Andreani', acteurs: 'Timothée Chalamet, Zendaya',
    synopsis: "Deux artistes se croisent dans un village du sud de la France durant l'été. Entre eux naît une relation aussi intense qu'éphémère.",
    color: 'p3', badge: 'Nouveau',
    lb: 4.3, imdb: 8.0, sc: 7.8,
    cinemas: [
      { nom: 'Cinéma du Panthéon', dist: '0,2 km', seances: { "Aujourd'hui": ['14h45','18h00'], 'Demain': ['15h30','19h00'] } },
      { nom: 'Le Champo', dist: '1,1 km', seances: { "Aujourd'hui": ['15h45','20h00'], 'Demain': ['14h30','18h30'] } }
    ]
  },
  {
    id: 3, titre: 'Nova', original: '', genre: 'Science-fiction', duree: '2h22',
    real: 'James Okafor', acteurs: 'Oscar Isaac, Lupita Nyong\'o',
    synopsis: "En 2087, une astronome reçoit un signal qui ne peut venir que d'une civilisation disparue il y a 10 000 ans. Sa découverte va bouleverser l'histoire de l'humanité.",
    color: 'p4', badge: 'Bientôt',
    lb: 4.4, imdb: 8.2, sc: 8.0,
    cinemas: [
      { nom: 'UGC Ciné Cité Bercy', dist: '1,5 km', seances: { "Aujourd'hui": ['14h00','17h30','21h15'], 'Demain': ['13h45','17h00','20h30'] } },
      { nom: 'Pathé La Villette', dist: '3,2 km', seances: { "Aujourd'hui": ['15h15','19h45'], 'Demain': ['14h30','20h00'] } }
    ]
  },
  {
    id: 4, titre: 'Les Invisibles', original: '', genre: 'Comédie', duree: '1h35',
    real: 'Éric Toledano', acteurs: 'Omar Sy, Pio Marmaï',
    synopsis: "Deux frères que tout oppose héritent d'une boulangerie familiale en faillite. Pour la sauver, ils vont devoir apprendre à travailler ensemble malgré eux.",
    color: 'p5', badge: 'Nouveau',
    lb: 3.9, imdb: 7.3, sc: 7.0,
    cinemas: [
      { nom: 'Gaumont Opéra', dist: '0,9 km', seances: { "Aujourd'hui": ['13h00','15h00','17h00','19h00','21h00'], 'Demain': ['13h30','15h30','17h30','19h30'] } },
      { nom: 'UGC Normandie', dist: '1,6 km', seances: { "Aujourd'hui": ['14h30','17h00','20h15'], 'Demain': ['14h00','16h30','20h00'] } }
    ]
  },
  {
    id: 5, titre: 'Le Bruit du Monde', original: '', genre: 'Documentaire', duree: '1h50',
    real: 'Marie-Hélène Dupont', acteurs: '—',
    synopsis: "Un voyage sonore et visuel à travers cinq continents, à la rencontre de communautés qui résistent au silence imposé par la modernité.",
    color: 'p6', badge: 'Bientôt',
    lb: 4.0, imdb: 7.5, sc: 7.6,
    cinemas: [
      { nom: 'Forum des Images', dist: '1,1 km', seances: { "Aujourd'hui": ['14h00','17h30','20h00'], 'Demain': ['15h00','19h00'] } },
      { nom: 'Le Louxor', dist: '2,8 km', seances: { "Aujourd'hui": ['15h30','19h00'], 'Demain': ['14h30','18h30'] } }
    ]
  },
  // Films catalogue supplémentaires
  {
    id: 6, titre: 'Le Parrain', original: 'The Godfather', genre: 'Drame', duree: '2h55',
    real: 'Francis Ford Coppola', acteurs: 'Marlon Brando, Al Pacino',
    synopsis: "La saga de la famille Corleone, l'une des plus puissantes familles de la mafia américaine.",
    color: 'p1', badge: null,
    lb: 4.6, imdb: 9.2, sc: 8.4, annee: 1972, cinemas: []
  },
  {
    id: 7, titre: '12 hommes en colère', original: '12 Angry Men', genre: 'Drame', duree: '1h36',
    real: 'Sidney Lumet', acteurs: 'Henry Fonda, Lee J. Cobb',
    synopsis: "Douze jurés doivent décider du sort d'un jeune accusé de meurtre. Un seul d'entre eux émet un doute.",
    color: 'p2', badge: null,
    lb: 4.6, imdb: 9.0, sc: 8.7, annee: 1957, cinemas: []
  },
  {
    id: 8, titre: 'Interstellar', original: '', genre: 'Science-fiction', duree: '2h49',
    real: 'Christopher Nolan', acteurs: 'Matthew McConaughey, Anne Hathaway',
    synopsis: "Des explorateurs utilisent un trou de ver pour dépasser les limites des voyages spatiaux interstellaires.",
    color: 'p3', badge: null,
    lb: 4.4, imdb: 8.7, sc: 7.9, annee: 2014, cinemas: []
  },
  {
    id: 9, titre: 'Parasite', original: 'Gisaengchung', genre: 'Thriller', duree: '2h12',
    real: 'Bong Joon-ho', acteurs: 'Song Kang-ho, Lee Sun-kyun',
    synopsis: "Toute la famille Ki-taek est au chômage et s'intéresse fortement à la richesse de la famille Park.",
    color: 'p4', badge: null,
    lb: 4.4, imdb: 8.5, sc: 8.0, annee: 2019, cinemas: []
  },
  {
    id: 10, titre: 'Fenêtre sur cour', original: 'Rear Window', genre: 'Thriller', duree: '1h52',
    real: 'Alfred Hitchcock', acteurs: 'James Stewart, Grace Kelly',
    synopsis: "Un photographe immobilisé par une jambe cassée observe ses voisins et croit avoir été témoin d'un meurtre.",
    color: 'p5', badge: null,
    lb: 4.4, imdb: 8.4, sc: 8.1, annee: 1954, cinemas: []
  },
  {
    id: 11, titre: 'Mommy', original: '', genre: 'Drame', duree: '2h19',
    real: 'Xavier Dolan', acteurs: 'Anne Dorval, Antoine-Olivier Pilon',
    synopsis: "Une veuve se retrouve seule pour gérer son fils turbulent. Une voisine mystérieuse va changer leur vie.",
    color: 'p6', badge: null,
    lb: 4.3, imdb: 8.0, sc: 7.9, annee: 2014, cinemas: []
  },
  {
    id: 12, titre: 'Portrait de la jeune fille en feu', original: '', genre: 'Romance', duree: '2h01',
    real: 'Céline Sciamma', acteurs: 'Noémie Merlant, Adèle Haenel',
    synopsis: "En Bretagne, à la fin du XVIIIe siècle, une peintre est chargée de réaliser le portrait nuptial d'une jeune femme.",
    color: 'p1', badge: null,
    lb: 4.3, imdb: 8.1, sc: 7.6, annee: 2019, cinemas: []
  }
];

// ── Cinémas ──
const CINEMAS = [
  {
    id: 0, nom: 'Cinéma du Panthéon', adresse: '13 rue Victor Cousin, Paris 5e',
    dist: 0.2, ouvert: true, equips: ['Art & Essai'], filmIds: [0, 2, 4]
  },
  {
    id: 1, nom: 'MK2 Odéon', adresse: '27 boulevard des Italiens, Paris 2e',
    dist: 0.8, ouvert: true, equips: ['Dolby Atmos'], filmIds: [0, 1, 3]
  },
  {
    id: 2, nom: 'Le Champo', adresse: '51 rue des Écoles, Paris 5e',
    dist: 1.1, ouvert: true, equips: ['Art & Essai', 'Répertoire'], filmIds: [0, 2, 5]
  },
  {
    id: 3, nom: 'Filmothèque du Quartier Latin', adresse: '9 rue Champollion, Paris 5e',
    dist: 1.4, ouvert: false, equips: ['Répertoire'], filmIds: [1, 3, 5]
  },
  {
    id: 4, nom: 'UGC Odéon', adresse: '124 boulevard Saint-Germain, Paris 6e',
    dist: 1.7, ouvert: true, equips: ['UGC Illimité'], filmIds: [1, 3]
  },
  {
    id: 5, nom: 'Gaumont Parnasse', adresse: '3 rue du Départ, Paris 14e',
    dist: 2.3, ouvert: true, equips: ['IMAX', 'Dolby Atmos'], filmIds: [0, 1, 3, 4]
  }
];

// ── Utilitaires ──
function getFilmById(id) { return FILMS.find(f => f.id === id); }

function buildPopupHTML(film) {
  const bg = POSTER_COLORS[film.color] || '#ccc';
  const posterHTML = film.poster
    ? `<img src="${film.poster}" alt="Affiche du film ${film.titre}" loading="lazy">`
    : '<i class="ti ti-photo"></i>';
  const seancesEmptyHTML = `
    <div class="popup-cinemas popup-cinemas-empty">
      <div class="popup-cinemas-label">Séances proches</div>
      <div class="empty-seances">
        Les cinémas et horaires seront branchés ici quand on ajoutera le scraping des cinémas indépendants.
      </div>
    </div>`;
  const cinemasHTML = film.cinemas.length === 0 ? seancesEmptyHTML : `
    <div class="popup-cinemas">
      <div class="popup-cinemas-label">Cinémas les plus proches</div>
      ${film.cinemas.map((c, ci) => `
        <div class="cinema-block" id="cb-${film.id}-${ci}">
          <div class="cinema-block-header" onclick="toggleCinemaBlock('cb-${film.id}-${ci}')">
            <div class="cinema-block-left">
              <i class="ti ti-building"></i>
              <div>
                <div class="cinema-block-name">${c.nom}</div>
                <div class="cinema-block-dist">${c.dist}</div>
              </div>
            </div>
            <div class="cinema-block-right">
              <button class="btn-itineraire" onclick="event.stopPropagation(); openItineraire('${c.nom}')">
                <i class="ti ti-navigation"></i> Y aller
              </button>
              <i class="ti ti-chevron-down chevron"></i>
            </div>
          </div>
          <div class="seances-panel">
            ${Object.entries(c.seances).map(([jour, horaires]) => `
              <div class="seances-day">
                <div class="day-label">${jour}</div>
                <div class="horaires">
                  ${horaires.map(h => `
                    <button class="horaire-btn" onclick="openReservation('${film.titre}', '${c.nom}', '${h}')">${h}</button>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>`;

  return `
    <div class="popup-top">
      <div class="popup-poster" style="background:${bg};">
        ${posterHTML}
      </div>
      <div class="popup-header">
        ${film.badge ? `<span class="popup-badge">${film.badge}</span>` : ''}
        <div class="popup-title">${film.titre}</div>
        <div class="popup-tags">
          <span class="popup-tag">${film.genre}</span>
          <span class="popup-tag">${film.duree}</span>
          ${film.annee ? `<span class="popup-tag">${film.annee}</span>` : ''}
        </div>
        <div class="popup-crew">
          <div class="popup-crew-row"><strong>Réalisateur ·</strong> ${film.real}</div>
          <div class="popup-crew-row"><strong>Avec ·</strong> ${film.acteurs}</div>
        </div>
      </div>
    </div>
    <div class="popup-synopsis-block">
      <div class="section-label">Synopsis</div>
      <div class="popup-synopsis">${film.synopsis}</div>
    </div>
    ${cinemasHTML}
    <button class="popup-close-btn" onclick="closeFilmPopup()">Fermer</button>
  `;
}

function toggleCinemaBlock(id) {
  document.getElementById(id).classList.toggle('open');
}

function openFilmPopup(filmId) {
  const film = getFilmById(filmId);
  if (!film) return;
  const popup = document.getElementById('film-popup');
  const overlay = document.getElementById('film-overlay');
  if (!popup || !overlay) return;
  popup.innerHTML = buildPopupHTML(film);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeFilmPopup() {
  const overlay = document.getElementById('film-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function openItineraire(nomCinema) {
  const query = encodeURIComponent(nomCinema + ' Paris');
  window.open('https://www.google.com/maps/search/' + query, '_blank');
}

// ── Réservation ──
let pendingReservation = null;

function openReservation(film, cinema, heure) {
  pendingReservation = { film, cinema, heure };
  const overlay = document.getElementById('resa-overlay');
  if (!overlay) return;
  document.getElementById('resa-film').textContent = film;
  document.getElementById('resa-cinema').textContent = cinema;
  document.getElementById('resa-heure').textContent = heure;
  const today = new Date();
  document.getElementById('resa-date').textContent = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeResaOverlay() {
  const overlay = document.getElementById('resa-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function confirmReservation() {
  if (!pendingReservation) return;
  const query = encodeURIComponent(pendingReservation.film + ' ' + pendingReservation.cinema + ' allocine');
  // Simule l'ouverture AlloCiné
  window.open('https://www.allocine.fr/recherche/?q=' + query, '_blank');
  closeResaOverlay();
  // Affiche popup de retour après délai simulé
  setTimeout(() => showRetourPopup(), 800);
}

function showRetourPopup() {
  const overlay = document.getElementById('retour-overlay');
  if (!overlay || !pendingReservation) return;
  document.getElementById('retour-film').textContent = pendingReservation.film;
  document.getElementById('retour-cinema').textContent = pendingReservation.cinema;
  document.getElementById('retour-heure').textContent = pendingReservation.heure;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeRetourOverlay() {
  const overlay = document.getElementById('retour-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  pendingReservation = null;
}

function addToAgenda() {
  const btn = document.getElementById('btn-add-agenda');
  if (!btn) return;
  btn.innerHTML = '<i class="ti ti-check"></i> Ajouté à votre agenda !';
  btn.style.background = 'var(--green-bg)';
  btn.style.color = 'var(--green)';
  btn.style.border = '0.5px solid #c8e6c9';
  btn.onclick = null;
  // Sauvegarde en localStorage
  if (pendingReservation) {
    const billets = JSON.parse(localStorage.getItem('cinepro_billets') || '[]');
    billets.push({ ...pendingReservation, date: new Date().toLocaleDateString('fr-FR') });
    localStorage.setItem('cinepro_billets', JSON.stringify(billets));
  }
}

// ── Fermer overlay au clic extérieur ──
document.addEventListener('click', function(e) {
  ['film-overlay', 'resa-overlay', 'retour-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el && e.target === el) {
      el.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
});
