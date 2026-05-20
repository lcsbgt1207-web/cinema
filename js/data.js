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
    id: 1, titre: "Les Évadés", original: "The Shawshank Redemption", genre: "Drame", duree: "2h22",
    real: "Frank Darabont", acteurs: "Tim Robbins, Morgan Freeman",
    synopsis: "Deux hommes emprisonnés tissent une amitié profonde et trouvent chacun une manière de survivre derrière les murs de Shawshank.",
    color: 'p1', badge: null,
    lb: 4.7, imdb: 9.3, sc: 9.3, annee: 1994, imdbID: "tt0111161", cinemas: []
  },
  {
    id: 2, titre: "Le Parrain", original: "The Godfather", genre: "Drame", duree: "2h55",
    real: "Francis Ford Coppola", acteurs: "Marlon Brando, Al Pacino, James Caan",
    synopsis: "Le patriarche vieillissant d’une dynastie criminelle new-yorkaise transmet peu à peu son empire clandestin à son fils réticent.",
    color: 'p2', badge: null,
    lb: 4.6, imdb: 9.2, sc: 8.4, annee: 1972, imdbID: "tt0068646", cinemas: []
  },
  {
    id: 3, titre: "The Dark Knight : Le Chevalier noir", original: "The Dark Knight", genre: "Action", duree: "2h32",
    real: "Christopher Nolan", acteurs: "Christian Bale, Heath Ledger, Aaron Eckhart",
    synopsis: "Batman affronte le Joker, un criminel imprévisible qui plonge Gotham dans le chaos.",
    color: 'p3', badge: null,
    lb: 4.5, imdb: 9.0, sc: 9.0, annee: 2008, imdbID: "tt0468569", cinemas: []
  },
  {
    id: 4, titre: "Le Parrain, 2e partie", original: "The Godfather Part II", genre: "Drame", duree: "3h22",
    real: "Francis Ford Coppola", acteurs: "Al Pacino, Robert De Niro, Robert Duvall",
    synopsis: "La jeunesse de Vito Corleone et l’ascension tourmentée de Michael à la tête de la famille se répondent à travers deux époques.",
    color: 'p4', badge: null,
    lb: 4.6, imdb: 9.0, sc: 8.9, annee: 1974, imdbID: "tt0071562", cinemas: []
  },
  {
    id: 5, titre: "12 hommes en colère", original: "12 Angry Men", genre: "Drame", duree: "1h36",
    real: "Sidney Lumet", acteurs: "Henry Fonda, Lee J. Cobb",
    synopsis: "Dans une salle de délibération, douze jurés débattent du destin d’un jeune homme accusé de meurtre.",
    color: 'p5', badge: null,
    lb: 4.6, imdb: 9.0, sc: 8.7, annee: 1957, imdbID: "tt0050083", cinemas: []
  },
  {
    id: 6, titre: "Le Seigneur des anneaux : Le Retour du roi", original: "The Lord of the Rings: The Return of the King", genre: "Aventure", duree: "3h21",
    real: "Peter Jackson", acteurs: "Elijah Wood, Viggo Mortensen, Ian McKellen",
    synopsis: "Tandis que la bataille finale approche, Frodon poursuit sa marche vers le Mordor pour détruire l’Anneau.",
    color: 'p6', badge: null,
    lb: 4.4, imdb: 9.0, sc: 8.9, annee: 2003, imdbID: "tt0167260", cinemas: []
  },
  {
    id: 7, titre: "La Liste de Schindler", original: "Schindler's List", genre: "Drame", duree: "3h15",
    real: "Steven Spielberg", acteurs: "Liam Neeson, Ben Kingsley, Ralph Fiennes",
    synopsis: "Oskar Schindler, industriel allemand, sauve plus d’un millier de Juifs pendant la Seconde Guerre mondiale.",
    color: 'p1', badge: null,
    lb: 4.5, imdb: 9.0, sc: 8.8, annee: 1993, imdbID: "tt0108052", cinemas: []
  },
  {
    id: 8, titre: "Le Seigneur des anneaux : La Communauté de l’anneau", original: "The Lord of the Rings: The Fellowship of the Ring", genre: "Aventure", duree: "2h58",
    real: "Peter Jackson", acteurs: "Elijah Wood, Ian McKellen, Viggo Mortensen",
    synopsis: "Un jeune Hobbit quitte la Comté pour entreprendre une quête qui décidera du sort de la Terre du Milieu.",
    color: 'p2', badge: null,
    lb: 4.4, imdb: 8.9, sc: 8.7, annee: 2001, imdbID: "tt0120737", cinemas: []
  },
  {
    id: 9, titre: "Pulp Fiction", original: "Pulp Fiction", genre: "Policier", duree: "2h34",
    real: "Quentin Tarantino", acteurs: "John Travolta, Uma Thurman, Samuel L. Jackson",
    synopsis: "À Los Angeles, des criminels, un boxeur et plusieurs destins se croisent dans un récit éclaté et nerveux.",
    color: 'p3', badge: null,
    lb: 4.4, imdb: 8.9, sc: 8.8, annee: 1994, imdbID: "tt0110912", cinemas: []
  },
  {
    id: 10, titre: "Le Bon, la Brute et le Truand", original: "The Good, the Bad and the Ugly", genre: "Western", duree: "2h58",
    real: "Sergio Leone", acteurs: "Clint Eastwood, Eli Wallach, Lee Van Cleef",
    synopsis: "Trois hommes sans foi ni loi cherchent un trésor caché pendant la guerre de Sécession.",
    color: 'p4', badge: null,
    lb: 4.5, imdb: 8.8, sc: 8.7, annee: 1966, imdbID: "tt0060196", cinemas: []
  },
  {
    id: 11, titre: "Forrest Gump", original: "Forrest Gump", genre: "Drame", duree: "2h22",
    real: "Robert Zemeckis", acteurs: "Tom Hanks, Robin Wright, Gary Sinise",
    synopsis: "Un homme au cœur simple traverse plusieurs décennies d’histoire américaine sans jamais perdre son innocence.",
    color: 'p5', badge: null,
    lb: 4.3, imdb: 8.8, sc: 8.8, annee: 1994, imdbID: "tt0109830", cinemas: []
  },
  {
    id: 12, titre: "Le Seigneur des anneaux : Les Deux Tours", original: "The Lord of the Rings: The Two Towers", genre: "Aventure", duree: "2h59",
    real: "Peter Jackson", acteurs: "Elijah Wood, Viggo Mortensen, Ian McKellen",
    synopsis: "La Communauté est divisée, mais la lutte contre les forces de Sauron continue sur plusieurs fronts.",
    color: 'p6', badge: null,
    lb: 4.4, imdb: 8.8, sc: 8.6, annee: 2002, imdbID: "tt0167261", cinemas: []
  },
  {
    id: 13, titre: "Fight Club", original: "Fight Club", genre: "Drame", duree: "2h19",
    real: "David Fincher", acteurs: "Brad Pitt, Edward Norton, Helena Bonham Carter",
    synopsis: "Un employé insomniaque rencontre un homme charismatique avec qui il fonde un club de combat clandestin.",
    color: 'p1', badge: null,
    lb: 4.4, imdb: 8.8, sc: 8.6, annee: 1999, imdbID: "tt0137523", cinemas: []
  },
  {
    id: 14, titre: "Inception", original: "Inception", genre: "Science-fiction", duree: "2h28",
    real: "Christopher Nolan", acteurs: "Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page",
    synopsis: "Un voleur capable d’infiltrer les rêves accepte une mission impossible : implanter une idée dans l’esprit d’un homme.",
    color: 'p2', badge: null,
    lb: 4.3, imdb: 8.8, sc: 8.6, annee: 2010, imdbID: "tt1375666", cinemas: []
  },
  {
    id: 15, titre: "Star Wars : L’Empire contre-attaque", original: "The Empire Strikes Back", genre: "Science-fiction", duree: "2h04",
    real: "Irvin Kershner", acteurs: "Mark Hamill, Harrison Ford, Carrie Fisher",
    synopsis: "L’Alliance rebelle est traquée par l’Empire tandis que Luke Skywalker poursuit son apprentissage Jedi.",
    color: 'p3', badge: null,
    lb: 4.4, imdb: 8.7, sc: 8.5, annee: 1980, imdbID: "tt0080684", cinemas: []
  },
  {
    id: 16, titre: "Matrix", original: "The Matrix", genre: "Science-fiction", duree: "2h16",
    real: "Lana Wachowski, Lilly Wachowski", acteurs: "Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss",
    synopsis: "Un pirate informatique découvre que le monde qu’il connaît n’est qu’une simulation contrôlée par des machines.",
    color: 'p4', badge: null,
    lb: 4.3, imdb: 8.7, sc: 8.5, annee: 1999, imdbID: "tt0133093", cinemas: []
  },
  {
    id: 17, titre: "Les Affranchis", original: "Goodfellas", genre: "Policier", duree: "2h25",
    real: "Martin Scorsese", acteurs: "Robert De Niro, Ray Liotta, Joe Pesci",
    synopsis: "Henry Hill raconte son ascension puis sa chute dans le milieu de la mafia new-yorkaise.",
    color: 'p5', badge: null,
    lb: 4.4, imdb: 8.7, sc: 8.5, annee: 1990, imdbID: "tt0099685", cinemas: []
  },
  {
    id: 18, titre: "Vol au-dessus d’un nid de coucou", original: "One Flew Over the Cuckoo's Nest", genre: "Drame", duree: "2h13",
    real: "Miloš Forman", acteurs: "Jack Nicholson, Louise Fletcher",
    synopsis: "Un détenu transféré dans un hôpital psychiatrique s’oppose à l’autorité glaciale de l’infirmière Ratched.",
    color: 'p6', badge: null,
    lb: 4.4, imdb: 8.7, sc: 8.6, annee: 1975, imdbID: "tt0073486", cinemas: []
  },
  {
    id: 19, titre: "Interstellar", original: "Interstellar", genre: "Science-fiction", duree: "2h49",
    real: "Christopher Nolan", acteurs: "Matthew McConaughey, Anne Hathaway, Jessica Chastain",
    synopsis: "Face à une Terre mourante, une équipe d’explorateurs traverse un trou de ver pour chercher un nouveau foyer pour l’humanité.",
    color: 'p1', badge: null,
    lb: 4.4, imdb: 8.7, sc: 7.9, annee: 2014, imdbID: "tt0816692", cinemas: []
  },
  {
    id: 20, titre: "Seven", original: "Se7en", genre: "Thriller", duree: "2h07",
    real: "David Fincher", acteurs: "Brad Pitt, Morgan Freeman, Gwyneth Paltrow",
    synopsis: "Deux inspecteurs traquent un tueur en série qui met en scène ses crimes autour des sept péchés capitaux.",
    color: 'p2', badge: null,
    lb: 4.3, imdb: 8.6, sc: 8.3, annee: 1995, imdbID: "tt0114369", cinemas: []
  },
  {
    id: 21, titre: "La Vie est belle", original: "Life Is Beautiful", genre: "Drame", duree: "1h56",
    real: "Roberto Benigni", acteurs: "Roberto Benigni, Nicoletta Braschi",
    synopsis: "Un père transforme l’horreur d’un camp de concentration en jeu pour protéger son fils.",
    color: 'p3', badge: null,
    lb: 4.3, imdb: 8.6, sc: 8.4, annee: 1997, imdbID: "tt0118799", cinemas: []
  },
  {
    id: 22, titre: "Les Sept Samouraïs", original: "Seven Samurai", genre: "Action", duree: "3h27",
    real: "Akira Kurosawa", acteurs: "Toshirô Mifune, Takashi Shimura",
    synopsis: "Des paysans engagent sept samouraïs pour défendre leur village contre des bandits.",
    color: 'p4', badge: null,
    lb: 4.5, imdb: 8.6, sc: 8.7, annee: 1954, imdbID: "tt0047478", cinemas: []
  },
  {
    id: 23, titre: "Le Silence des agneaux", original: "The Silence of the Lambs", genre: "Thriller", duree: "1h58",
    real: "Jonathan Demme", acteurs: "Jodie Foster, Anthony Hopkins",
    synopsis: "Une jeune agente du FBI sollicite l’aide d’un brillant psychiatre criminel pour arrêter un tueur en série.",
    color: 'p5', badge: null,
    lb: 4.3, imdb: 8.6, sc: 8.4, annee: 1991, imdbID: "tt0102926", cinemas: []
  },
  {
    id: 24, titre: "Il faut sauver le soldat Ryan", original: "Saving Private Ryan", genre: "Guerre", duree: "2h49",
    real: "Steven Spielberg", acteurs: "Tom Hanks, Matt Damon, Tom Sizemore",
    synopsis: "Après le Débarquement, un groupe de soldats reçoit l’ordre de retrouver un parachutiste derrière les lignes ennemies.",
    color: 'p6', badge: null,
    lb: 4.3, imdb: 8.6, sc: 8.3, annee: 1998, imdbID: "tt0120815", cinemas: []
  },
  {
    id: 25, titre: "La Cité de Dieu", original: "City of God", genre: "Policier", duree: "2h10",
    real: "Fernando Meirelles, Kátia Lund", acteurs: "Alexandre Rodrigues, Leandro Firmino",
    synopsis: "Dans une favela de Rio, deux garçons prennent des chemins opposés entre photographie et criminalité.",
    color: 'p1', badge: null,
    lb: 4.4, imdb: 8.6, sc: 8.5, annee: 2002, imdbID: "tt0317248", cinemas: []
  },
  {
    id: 26, titre: "La Ligne verte", original: "The Green Mile", genre: "Drame", duree: "3h09",
    real: "Frank Darabont", acteurs: "Tom Hanks, Michael Clarke Duncan",
    synopsis: "Un gardien de prison rencontre un condamné à mort doté d’un don mystérieux.",
    color: 'p2', badge: null,
    lb: 4.3, imdb: 8.6, sc: 8.4, annee: 1999, imdbID: "tt0120689", cinemas: []
  },
  {
    id: 27, titre: "Terminator 2 : Le Jugement dernier", original: "Terminator 2: Judgment Day", genre: "Action", duree: "2h17",
    real: "James Cameron", acteurs: "Arnold Schwarzenegger, Linda Hamilton",
    synopsis: "Un cyborg est envoyé pour protéger John Connor d’un nouveau Terminator quasi indestructible.",
    color: 'p3', badge: null,
    lb: 4.2, imdb: 8.6, sc: 8.2, annee: 1991, imdbID: "tt0103064", cinemas: []
  },
  {
    id: 28, titre: "Star Wars : Un nouvel espoir", original: "Star Wars", genre: "Science-fiction", duree: "2h01",
    real: "George Lucas", acteurs: "Mark Hamill, Harrison Ford, Carrie Fisher",
    synopsis: "Luke Skywalker rejoint la Rébellion pour combattre l’Empire et sauver la princesse Leia.",
    color: 'p4', badge: null,
    lb: 4.3, imdb: 8.6, sc: 8.4, annee: 1977, imdbID: "tt0076759", cinemas: []
  },
  {
    id: 29, titre: "Retour vers le futur", original: "Back to the Future", genre: "Science-fiction", duree: "1h56",
    real: "Robert Zemeckis", acteurs: "Michael J. Fox, Christopher Lloyd",
    synopsis: "Un adolescent voyage accidentellement en 1955 et doit réparer le passé pour sauver son avenir.",
    color: 'p5', badge: null,
    lb: 4.2, imdb: 8.5, sc: 8.1, annee: 1985, imdbID: "tt0088763", cinemas: []
  },
  {
    id: 30, titre: "Le Voyage de Chihiro", original: "Spirited Away", genre: "Animation", duree: "2h05",
    real: "Hayao Miyazaki", acteurs: "Rumi Hiiragi, Miyu Irino",
    synopsis: "Une fillette se retrouve piégée dans un monde d’esprits et cherche à sauver ses parents transformés.",
    color: 'p6', badge: null,
    lb: 4.5, imdb: 8.6, sc: 8.6, annee: 2001, imdbID: "tt0245429", cinemas: []
  },
  {
    id: 31, titre: "Psychose", original: "Psycho", genre: "Thriller", duree: "1h49",
    real: "Alfred Hitchcock", acteurs: "Anthony Perkins, Janet Leigh",
    synopsis: "Une jeune femme en fuite s’arrête dans un motel isolé tenu par un propriétaire inquiétant.",
    color: 'p1', badge: null,
    lb: 4.3, imdb: 8.5, sc: 8.4, annee: 1960, imdbID: "tt0054215", cinemas: []
  },
  {
    id: 32, titre: "Parasite", original: "Parasite", genre: "Thriller", duree: "2h12",
    real: "Bong Joon-ho", acteurs: "Song Kang-ho, Lee Sun-kyun",
    synopsis: "Une famille pauvre s’infiltre progressivement dans le quotidien d’une famille aisée.",
    color: 'p2', badge: null,
    lb: 4.4, imdb: 8.5, sc: 8.0, annee: 2019, imdbID: "tt6751668", cinemas: []
  },
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

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildPopupHTML(film) {
  const bg = POSTER_COLORS[film.color] || '#ccc';
  const posterHTML = film.poster
    ? `<img src="${escapeHTML(film.poster)}" alt="Affiche du film ${escapeHTML(film.titre)}" loading="lazy">`
    : '<i class="ti ti-photo"></i>';

  return `
    <button class="popup-x-btn" onclick="closeFilmPopup()" aria-label="Fermer">×</button>
    <div class="film-popup-layout">
      <div class="film-popup-poster" style="background:${bg};">
        ${posterHTML}
      </div>

      <div class="film-popup-main">
        <div class="film-popup-title-zone">
          ${film.badge ? `<span class="popup-badge">${escapeHTML(film.badge)}</span>` : ''}
          <div class="popup-title">${escapeHTML(film.titre)}</div>
        </div>

        <div class="film-popup-meta-zone">
          <span class="popup-tag">${escapeHTML(film.genre || 'Genre inconnu')}</span>
          <span class="popup-tag">${escapeHTML(film.duree || 'Durée inconnue')}</span>
          ${film.annee ? `<span class="popup-tag">${escapeHTML(film.annee)}</span>` : ''}
        </div>

        <div class="film-popup-crew-zone">
          <div class="popup-crew-row"><strong>Réalisateur ·</strong> ${escapeHTML(film.real || 'Non renseigné')}</div>
          <div class="popup-crew-row"><strong>Avec ·</strong> ${escapeHTML(film.acteurs || 'Non renseigné')}</div>
        </div>

        <div class="film-popup-synopsis-zone">
          <div class="section-label">Synopsis</div>
          <div class="popup-synopsis">${escapeHTML(film.synopsis || 'Synopsis indisponible pour le moment.')}</div>
        </div>
      </div>

      <div class="film-popup-seances-zone">
        <div class="section-label">Séances</div>
        <div class="empty-seances">
          Aucune séance réelle n’est encore branchée pour ce film. Cette zone sera connectée plus tard au scraping des cinémas indépendants, avec le cinéma, l’horaire, la VF/VO et le lien de réservation.
        </div>
      </div>
    </div>

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
