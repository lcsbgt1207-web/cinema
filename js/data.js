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
  {
    id: 33, titre: "Gladiator", original: "Gladiator", genre: "Action", duree: "2h35",
    real: "Ridley Scott", acteurs: "Russell Crowe, Joaquin Phoenix, Connie Nielsen",
    synopsis: "Un général romain trahi devient gladiateur et cherche à venger sa famille face à l’empereur corrompu.",
    color: 'p3', badge: null,
    lb: 4.2, imdb: 8.5, sc: 8.2, annee: 2000, imdbID: "tt0172495", cinemas: []
  },
  {
    id: 34, titre: "Les Infiltrés", original: "The Departed", genre: "Policier", duree: "2h31",
    real: "Martin Scorsese", acteurs: "Leonardo DiCaprio, Matt Damon, Jack Nicholson",
    synopsis: "Un policier infiltré et une taupe de la mafia tentent chacun de découvrir l’identité de l’autre.",
    color: 'p4', badge: null,
    lb: 4.2, imdb: 8.5, sc: 8.1, annee: 2006, imdbID: "tt0407887", cinemas: []
  },
  {
    id: 35, titre: "Whiplash", original: "Whiplash", genre: "Drame", duree: "1h47",
    real: "Damien Chazelle", acteurs: "Miles Teller, J.K. Simmons, Melissa Benoist",
    synopsis: "Un jeune batteur ambitieux subit l’entraînement brutal d’un professeur obsédé par l’excellence.",
    color: 'p5', badge: null,
    lb: 4.3, imdb: 8.5, sc: 8.2, annee: 2014, imdbID: "tt2582802", cinemas: []
  },
  {
    id: 36, titre: "Le Prestige", original: "The Prestige", genre: "Thriller", duree: "2h10",
    real: "Christopher Nolan", acteurs: "Christian Bale, Hugh Jackman, Scarlett Johansson",
    synopsis: "Deux magiciens rivaux se livrent une guerre d’illusions qui tourne à l’obsession destructrice.",
    color: 'p6', badge: null,
    lb: 4.3, imdb: 8.5, sc: 8.2, annee: 2006, imdbID: "tt0482571", cinemas: []
  },
  {
    id: 37, titre: "Les Intouchables", original: "Intouchables", genre: "Comédie", duree: "1h52",
    real: "Olivier Nakache, Éric Toledano", acteurs: "François Cluzet, Omar Sy, Anne Le Ny",
    synopsis: "Un aristocrate tétraplégique engage un aide à domicile issu d’un milieu opposé, et une amitié inattendue naît.",
    color: 'p1', badge: null,
    lb: 4.2, imdb: 8.5, sc: 8.0, annee: 2011, imdbID: "tt1675434", cinemas: []
  },
  {
    id: 38, titre: "Harakiri", original: "Harakiri", genre: "Drame", duree: "2h13",
    real: "Masaki Kobayashi", acteurs: "Tatsuya Nakadai, Akira Ishihama",
    synopsis: "Un rônin demande à se donner la mort dans la demeure d’un clan, révélant peu à peu une terrible injustice.",
    color: 'p2', badge: null,
    lb: 4.6, imdb: 8.6, sc: 8.7, annee: 1962, imdbID: "tt0056058", cinemas: []
  },
  {
    id: 39, titre: "Il était une fois dans l’Ouest", original: "Once Upon a Time in the West", genre: "Western", duree: "2h46",
    real: "Sergio Leone", acteurs: "Henry Fonda, Charles Bronson, Claudia Cardinale",
    synopsis: "Dans l’Ouest américain, plusieurs destins se croisent autour d’une terre convoitée et d’une vengeance silencieuse.",
    color: 'p3', badge: null,
    lb: 4.4, imdb: 8.5, sc: 8.5, annee: 1968, imdbID: "tt0064116", cinemas: []
  },
  {
    id: 40, titre: "Usual Suspects", original: "The Usual Suspects", genre: "Policier", duree: "1h46",
    real: "Bryan Singer", acteurs: "Kevin Spacey, Gabriel Byrne, Chazz Palminteri",
    synopsis: "Un survivant raconte l’étrange histoire d’un groupe de criminels lié au mystérieux Keyser Söze.",
    color: 'p4', badge: null,
    lb: 4.1, imdb: 8.5, sc: 8.2, annee: 1995, imdbID: "tt0114814", cinemas: []
  },,
  {
    id: 41, titre: "Alien", original: "Alien", genre: "Science-fiction", duree: "1h57",
    real: "Ridley Scott", acteurs: "Sigourney Weaver, Tom Skerritt, John Hurt",
    synopsis: "Dans l’espace, l’équipage du Nostromo répond à un signal de détresse et découvre une menace extraterrestre mortelle.",
    color: 'p5', badge: null,
    lb: 4.3, imdb: 8.5, sc: 8.4, annee: 1979, imdbID: "tt0078748", cinemas: []
  },
  {
    id: 42, titre: "Apocalypse Now", original: "Apocalypse Now", genre: "Guerre", duree: "2h27",
    real: "Francis Ford Coppola", acteurs: "Martin Sheen, Marlon Brando, Robert Duvall",
    synopsis: "Pendant la guerre du Vietnam, un capitaine remonte un fleuve pour retrouver un colonel devenu incontrôlable.",
    color: 'p6', badge: null,
    lb: 4.4, imdb: 8.4, sc: 8.4, annee: 1979, imdbID: "tt0078788", cinemas: []
  },
  {
    id: 43, titre: "Memento", original: "Memento", genre: "Thriller", duree: "1h53",
    real: "Christopher Nolan", acteurs: "Guy Pearce, Carrie-Anne Moss, Joe Pantoliano",
    synopsis: "Un homme incapable de former de nouveaux souvenirs traque l’assassin de sa femme à l’aide de notes et de tatouages.",
    color: 'p1', badge: null,
    lb: 4.2, imdb: 8.4, sc: 8.2, annee: 2000, imdbID: "tt0209144", cinemas: []
  },
  {
    id: 44, titre: "American History X", original: "American History X", genre: "Drame", duree: "1h59",
    real: "Tony Kaye", acteurs: "Edward Norton, Edward Furlong",
    synopsis: "Un ancien néonazi tente d’empêcher son jeune frère de suivre le même chemin de haine et de violence.",
    color: 'p2', badge: null,
    lb: 4.1, imdb: 8.5, sc: 8.1, annee: 1998, imdbID: "tt0120586", cinemas: []
  },
  {
    id: 45, titre: "Le Tombeau des lucioles", original: "Grave of the Fireflies", genre: "Animation", duree: "1h29",
    real: "Isao Takahata", acteurs: "Tsutomu Tatsumi, Ayano Shiraishi",
    synopsis: "Au Japon, deux enfants tentent de survivre seuls pendant les derniers mois de la Seconde Guerre mondiale.",
    color: 'p3', badge: null,
    lb: 4.4, imdb: 8.5, sc: 8.6, annee: 1988, imdbID: "tt0095327", cinemas: []
  },
  {
    id: 46, titre: "Le Dictateur", original: "The Great Dictator", genre: "Comédie", duree: "2h05",
    real: "Charlie Chaplin", acteurs: "Charlie Chaplin, Paulette Goddard",
    synopsis: "Un barbier juif et un dictateur tyrannique se ressemblent étrangement dans une satire politique devenue classique.",
    color: 'p4', badge: null,
    lb: 4.3, imdb: 8.4, sc: 8.3, annee: 1940, imdbID: "tt0032553", cinemas: []
  },
  {
    id: 47, titre: "Les Temps modernes", original: "Modern Times", genre: "Comédie", duree: "1h27",
    real: "Charlie Chaplin", acteurs: "Charlie Chaplin, Paulette Goddard",
    synopsis: "Charlot affronte la mécanisation du travail et la misère avec humour, tendresse et révolte.",
    color: 'p5', badge: null,
    lb: 4.3, imdb: 8.5, sc: 8.2, annee: 1936, imdbID: "tt0027977", cinemas: []
  },
  {
    id: 48, titre: "Fenêtre sur cour", original: "Rear Window", genre: "Thriller", duree: "1h52",
    real: "Alfred Hitchcock", acteurs: "James Stewart, Grace Kelly",
    synopsis: "Immobilisé chez lui, un photographe soupçonne l’un de ses voisins d’avoir commis un meurtre.",
    color: 'p6', badge: null,
    lb: 4.3, imdb: 8.5, sc: 8.4, annee: 1954, imdbID: "tt0047396", cinemas: []
  },
  {
    id: 49, titre: "Les Sentiers de la gloire", original: "Paths of Glory", genre: "Guerre", duree: "1h28",
    real: "Stanley Kubrick", acteurs: "Kirk Douglas, Ralph Meeker",
    synopsis: "Pendant la Première Guerre mondiale, un colonel défend des soldats accusés de lâcheté après une attaque impossible.",
    color: 'p1', badge: null,
    lb: 4.4, imdb: 8.4, sc: 8.6, annee: 1957, imdbID: "tt0050825", cinemas: []
  },
  {
    id: 50, titre: "Casablanca", original: "Casablanca", genre: "Romance", duree: "1h42",
    real: "Michael Curtiz", acteurs: "Humphrey Bogart, Ingrid Bergman",
    synopsis: "Dans un café de Casablanca, un homme retrouve l’amour perdu alors que la guerre bouleverse les destins.",
    color: 'p2', badge: null,
    lb: 4.2, imdb: 8.5, sc: 8.3, annee: 1942, imdbID: "tt0034583", cinemas: []
  },
  {
    id: 51, titre: "Il était une fois en Amérique", original: "Once Upon a Time in America", genre: "Policier", duree: "3h49",
    real: "Sergio Leone", acteurs: "Robert De Niro, James Woods",
    synopsis: "Un gangster vieillissant se souvient de son amitié, de ses trahisons et de son passé dans le crime organisé.",
    color: 'p3', badge: null,
    lb: 4.4, imdb: 8.3, sc: 8.5, annee: 1984, imdbID: "tt0087843", cinemas: []
  },
  {
    id: 52, titre: "Cinéma Paradiso", original: "Cinema Paradiso", genre: "Drame", duree: "2h35",
    real: "Giuseppe Tornatore", acteurs: "Philippe Noiret, Salvatore Cascio",
    synopsis: "Un cinéaste repense à son enfance sicilienne et à l’amitié qui l’a lié au projectionniste de son village.",
    color: 'p4', badge: null,
    lb: 4.4, imdb: 8.5, sc: 8.4, annee: 1988, imdbID: "tt0095765", cinemas: []
  },
  {
    id: 53, titre: "La Haine", original: "La Haine", genre: "Drame", duree: "1h38",
    real: "Mathieu Kassovitz", acteurs: "Vincent Cassel, Hubert Koundé, Saïd Taghmaoui",
    synopsis: "Après une nuit d’émeutes, trois jeunes de banlieue vivent une journée sous tension.",
    color: 'p5', badge: null,
    lb: 4.3, imdb: 8.1, sc: 8.3, annee: 1995, imdbID: "tt0113247", cinemas: []
  },
  {
    id: 54, titre: "Old Boy", original: "Oldboy", genre: "Thriller", duree: "2h00",
    real: "Park Chan-wook", acteurs: "Choi Min-sik, Yoo Ji-tae, Kang Hye-jung",
    synopsis: "Un homme libéré après quinze ans de captivité cherche à comprendre qui l’a enfermé et pourquoi.",
    color: 'p6', badge: null,
    lb: 4.4, imdb: 8.3, sc: 8.5, annee: 2003, imdbID: "tt0364569", cinemas: []
  },
  {
    id: 55, titre: "Princesse Mononoké", original: "Princess Mononoke", genre: "Animation", duree: "2h14",
    real: "Hayao Miyazaki", acteurs: "Yōji Matsuda, Yuriko Ishida",
    synopsis: "Un jeune prince se retrouve au cœur d’un conflit entre les humains, la forêt et les dieux anciens.",
    color: 'p1', badge: null,
    lb: 4.4, imdb: 8.3, sc: 8.5, annee: 1997, imdbID: "tt0119698", cinemas: []
  },
  {
    id: 56, titre: "WALL·E", original: "WALL·E", genre: "Animation", duree: "1h38",
    real: "Andrew Stanton", acteurs: "Ben Burtt, Elissa Knight",
    synopsis: "Un petit robot solitaire continue sa mission sur une Terre abandonnée et découvre une nouvelle raison d’espérer.",
    color: 'p2', badge: null,
    lb: 4.2, imdb: 8.4, sc: 8.2, annee: 2008, imdbID: "tt0910970", cinemas: []
  },
  {
    id: 57, titre: "Coco", original: "Coco", genre: "Animation", duree: "1h45",
    real: "Lee Unkrich, Adrian Molina", acteurs: "Anthony Gonzalez, Gael García Bernal",
    synopsis: "Un jeune musicien rejoint le monde des morts pour découvrir le secret de sa famille.",
    color: 'p3', badge: null,
    lb: 4.2, imdb: 8.4, sc: 8.2, annee: 2017, imdbID: "tt2380307", cinemas: []
  },
  {
    id: 58, titre: "Toy Story", original: "Toy Story", genre: "Animation", duree: "1h21",
    real: "John Lasseter", acteurs: "Tom Hanks, Tim Allen",
    synopsis: "Dans la chambre d’un enfant, les jouets prennent vie et voient arriver un nouveau rival venu de l’espace.",
    color: 'p4', badge: null,
    lb: 4.1, imdb: 8.3, sc: 8.1, annee: 1995, imdbID: "tt0114709", cinemas: []
  },
  {
    id: 59, titre: "Toy Story 3", original: "Toy Story 3", genre: "Animation", duree: "1h43",
    real: "Lee Unkrich", acteurs: "Tom Hanks, Tim Allen",
    synopsis: "Alors qu’Andy grandit, ses jouets se retrouvent donnés par erreur à une garderie.",
    color: 'p5', badge: null,
    lb: 4.2, imdb: 8.3, sc: 8.2, annee: 2010, imdbID: "tt0435761", cinemas: []
  },
  {
    id: 60, titre: "Spider-Man: New Generation", original: "Spider-Man: Into the Spider-Verse", genre: "Animation", duree: "1h57",
    real: "Bob Persichetti, Peter Ramsey, Rodney Rothman", acteurs: "Shameik Moore, Jake Johnson, Hailee Steinfeld",
    synopsis: "Miles Morales découvre ses pouvoirs et rencontre d’autres Spider-Men venus de dimensions parallèles.",
    color: 'p6', badge: null,
    lb: 4.4, imdb: 8.4, sc: 8.3, annee: 2018, imdbID: "tt4633694", cinemas: []
  },
  {
    id: 61, titre: "Your Name.", original: "Your Name.", genre: "Animation", duree: "1h46",
    real: "Makoto Shinkai", acteurs: "Ryunosuke Kamiki, Mone Kamishiraishi",
    synopsis: "Deux adolescents qui ne se connaissent pas échangent mystérieusement leurs corps à travers le temps et l’espace.",
    color: 'p1', badge: null,
    lb: 4.2, imdb: 8.4, sc: 8.2, annee: 2016, imdbID: "tt5311514", cinemas: []
  },
  {
    id: 62, titre: "Le Château ambulant", original: "Howl’s Moving Castle", genre: "Animation", duree: "1h59",
    real: "Hayao Miyazaki", acteurs: "Chieko Baisho, Takuya Kimura",
    synopsis: "Transformée en vieille femme, Sophie trouve refuge dans le château magique d’un sorcier énigmatique.",
    color: 'p2', badge: null,
    lb: 4.3, imdb: 8.2, sc: 8.2, annee: 2004, imdbID: "tt0347149", cinemas: []
  },
  {
    id: 63, titre: "Akira", original: "Akira", genre: "Animation", duree: "2h04",
    real: "Katsuhiro Ōtomo", acteurs: "Mitsuo Iwata, Nozomu Sasaki",
    synopsis: "Dans un Tokyo futuriste, un adolescent développe des pouvoirs incontrôlables qui menacent la ville.",
    color: 'p3', badge: null,
    lb: 4.2, imdb: 8.0, sc: 8.2, annee: 1988, imdbID: "tt0094625", cinemas: []
  },
  {
    id: 64, titre: "Blade Runner", original: "Blade Runner", genre: "Science-fiction", duree: "1h57",
    real: "Ridley Scott", acteurs: "Harrison Ford, Rutger Hauer, Sean Young",
    synopsis: "Un ancien policier traque des androïdes fugitifs dans un Los Angeles sombre et futuriste.",
    color: 'p4', badge: null,
    lb: 4.2, imdb: 8.1, sc: 8.3, annee: 1982, imdbID: "tt0083658", cinemas: []
  },
  {
    id: 65, titre: "Blade Runner 2049", original: "Blade Runner 2049", genre: "Science-fiction", duree: "2h44",
    real: "Denis Villeneuve", acteurs: "Ryan Gosling, Harrison Ford, Ana de Armas",
    synopsis: "Un blade runner découvre un secret capable d’ébranler les fondations de la société.",
    color: 'p5', badge: null,
    lb: 4.1, imdb: 8.0, sc: 8.1, annee: 2017, imdbID: "tt1856101", cinemas: []
  },
  {
    id: 66, titre: "Mad Max: Fury Road", original: "Mad Max: Fury Road", genre: "Action", duree: "2h00",
    real: "George Miller", acteurs: "Tom Hardy, Charlize Theron",
    synopsis: "Dans un désert post-apocalyptique, une fuite explosive oppose des rebelles à un tyran lancé à leurs trousses.",
    color: 'p6', badge: null,
    lb: 4.2, imdb: 8.1, sc: 8.1, annee: 2015, imdbID: "tt1392190", cinemas: []
  },
  {
    id: 67, titre: "Django Unchained", original: "Django Unchained", genre: "Western", duree: "2h45",
    real: "Quentin Tarantino", acteurs: "Jamie Foxx, Christoph Waltz, Leonardo DiCaprio",
    synopsis: "Un esclave libéré s’allie à un chasseur de primes pour retrouver sa femme.",
    color: 'p1', badge: null,
    lb: 4.1, imdb: 8.5, sc: 8.0, annee: 2012, imdbID: "tt1853728", cinemas: []
  },
  {
    id: 68, titre: "Reservoir Dogs", original: "Reservoir Dogs", genre: "Policier", duree: "1h39",
    real: "Quentin Tarantino", acteurs: "Harvey Keitel, Tim Roth, Michael Madsen",
    synopsis: "Après un braquage raté, des criminels se soupçonnent mutuellement d’avoir été trahis.",
    color: 'p2', badge: null,
    lb: 4.1, imdb: 8.3, sc: 8.1, annee: 1992, imdbID: "tt0105236", cinemas: []
  },
  {
    id: 69, titre: "Kill Bill : Volume 1", original: "Kill Bill: Vol. 1", genre: "Action", duree: "1h51",
    real: "Quentin Tarantino", acteurs: "Uma Thurman, Lucy Liu, Vivica A. Fox",
    synopsis: "Une ancienne tueuse sort du coma et part se venger de ceux qui l’ont trahie.",
    color: 'p3', badge: null,
    lb: 4.1, imdb: 8.2, sc: 8.0, annee: 2003, imdbID: "tt0266697", cinemas: []
  },
  {
    id: 70, titre: "Inglourious Basterds", original: "Inglourious Basterds", genre: "Guerre", duree: "2h33",
    real: "Quentin Tarantino", acteurs: "Brad Pitt, Christoph Waltz, Mélanie Laurent",
    synopsis: "Pendant l’Occupation, plusieurs plans convergent pour renverser le cours de la guerre dans un cinéma parisien.",
    color: 'p4', badge: null,
    lb: 4.3, imdb: 8.4, sc: 8.3, annee: 2009, imdbID: "tt0361748", cinemas: []
  },
  {
    id: 71, titre: "Le Loup de Wall Street", original: "The Wolf of Wall Street", genre: "Comédie", duree: "3h00",
    real: "Martin Scorsese", acteurs: "Leonardo DiCaprio, Jonah Hill, Margot Robbie",
    synopsis: "L’ascension excessive et délirante d’un courtier devenu symbole de la démesure financière.",
    color: 'p5', badge: null,
    lb: 4.0, imdb: 8.2, sc: 7.8, annee: 2013, imdbID: "tt0993846", cinemas: []
  },
  {
    id: 72, titre: "Taxi Driver", original: "Taxi Driver", genre: "Drame", duree: "1h54",
    real: "Martin Scorsese", acteurs: "Robert De Niro, Jodie Foster",
    synopsis: "Un vétéran solitaire dérive dans les nuits new-yorkaises et nourrit une obsession violente.",
    color: 'p6', badge: null,
    lb: 4.2, imdb: 8.2, sc: 8.4, annee: 1976, imdbID: "tt0075314", cinemas: []
  },
  {
    id: 73, titre: "Raging Bull", original: "Raging Bull", genre: "Drame", duree: "2h09",
    real: "Martin Scorsese", acteurs: "Robert De Niro, Joe Pesci",
    synopsis: "La carrière et l’autodestruction du boxeur Jake LaMotta, rongé par la jalousie et la violence.",
    color: 'p1', badge: null,
    lb: 4.2, imdb: 8.1, sc: 8.2, annee: 1980, imdbID: "tt0081398", cinemas: []
  },
  {
    id: 74, titre: "Shutter Island", original: "Shutter Island", genre: "Thriller", duree: "2h18",
    real: "Martin Scorsese", acteurs: "Leonardo DiCaprio, Mark Ruffalo",
    synopsis: "Deux marshals enquêtent sur une disparition dans un hôpital psychiatrique isolé.",
    color: 'p2', badge: null,
    lb: 4.0, imdb: 8.2, sc: 7.9, annee: 2010, imdbID: "tt1130884", cinemas: []
  },
  {
    id: 75, titre: "Le Fabuleux Destin d’Amélie Poulain", original: "Amélie", genre: "Romance", duree: "2h02",
    real: "Jean-Pierre Jeunet", acteurs: "Audrey Tautou, Mathieu Kassovitz",
    synopsis: "Une jeune serveuse montmartroise décide d’améliorer discrètement la vie des gens qui l’entourent.",
    color: 'p3', badge: null,
    lb: 4.1, imdb: 8.3, sc: 8.2, annee: 2001, imdbID: "tt0211915", cinemas: []
  },
  {
    id: 76, titre: "Les Diaboliques", original: "Diabolique", genre: "Thriller", duree: "1h57",
    real: "Henri-Georges Clouzot", acteurs: "Simone Signoret, Véra Clouzot, Paul Meurisse",
    synopsis: "Deux femmes préparent un meurtre parfait, mais le corps disparaît mystérieusement.",
    color: 'p4', badge: null,
    lb: 4.2, imdb: 8.1, sc: 8.2, annee: 1955, imdbID: "tt0046911", cinemas: []
  },
  {
    id: 77, titre: "Le Salaire de la peur", original: "The Wages of Fear", genre: "Thriller", duree: "2h11",
    real: "Henri-Georges Clouzot", acteurs: "Yves Montand, Charles Vanel",
    synopsis: "Quatre hommes acceptent de transporter de la nitroglycérine sur des routes dangereuses.",
    color: 'p5', badge: null,
    lb: 4.3, imdb: 8.2, sc: 8.4, annee: 1953, imdbID: "tt0046268", cinemas: []
  },
  {
    id: 78, titre: "La Grande Illusion", original: "La Grande Illusion", genre: "Guerre", duree: "1h54",
    real: "Jean Renoir", acteurs: "Jean Gabin, Pierre Fresnay, Erich von Stroheim",
    synopsis: "Pendant la Première Guerre mondiale, des prisonniers français préparent une évasion dans un camp allemand.",
    color: 'p6', badge: null,
    lb: 4.2, imdb: 8.1, sc: 8.2, annee: 1937, imdbID: "tt0028950", cinemas: []
  },
  {
    id: 79, titre: "Les 400 Coups", original: "The 400 Blows", genre: "Drame", duree: "1h39",
    real: "François Truffaut", acteurs: "Jean-Pierre Léaud, Albert Rémy",
    synopsis: "Un adolescent parisien incompris cherche sa liberté entre fugues, école et solitude.",
    color: 'p1', badge: null,
    lb: 4.2, imdb: 8.1, sc: 8.3, annee: 1959, imdbID: "tt0053198", cinemas: []
  },
  {
    id: 80, titre: "Persona", original: "Persona", genre: "Drame", duree: "1h23",
    real: "Ingmar Bergman", acteurs: "Bibi Andersson, Liv Ullmann",
    synopsis: "Une actrice muette et son infirmière s’isolent au bord de la mer, brouillant peu à peu leurs identités.",
    color: 'p2', badge: null,
    lb: 4.3, imdb: 8.1, sc: 8.4, annee: 1966, imdbID: "tt0060827", cinemas: []
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
  const title = film.titre || film.title || 'Film sans titre';
  const posterHTML = film.poster
    ? `<img src="${escapeHTML(film.poster)}" alt="Affiche du film ${escapeHTML(title)}" loading="lazy">`
    : '<i class="ti ti-photo"></i>';

  const ratingValue = getPopupBestRating(film);
  const ratingSource = film.bestNoteSource || film.nearbyRatingSource || film.ratingSource || (film.imdb ? 'IMDb' : film.tmdb ? 'TMDB' : film.lb ? 'Letterboxd' : film.sc ? 'Note' : '');
  const ratingHTML = ratingValue !== null
    ? `<span class="popup-rating-pill"><i class="ti ti-star-filled"></i> ${escapeHTML(ratingValue.toFixed(1))}/10${ratingSource ? ` · ${escapeHTML(ratingSource)}` : ''}</span>`
    : '';

  const genre = film.genre || (Array.isArray(film.genres) ? film.genres.join(', ') : '') || 'Genre inconnu';
  const duree = film.duree || (film.runtime ? `${film.runtime} min` : '') || 'Durée inconnue';
  const annee = film.annee || film.year || '';
  const cinemas = getPopupCinemas(film);
  console.log('[Popup] ZIP 3.6.6 : cinémas utilisés pour la fiche film', title, cinemas);
  const seancesHTML = buildPopupSeancesHTML(cinemas);

  return `
    <div class="film-popup-layout">
      <div class="film-popup-poster" style="background:${bg};">
        ${posterHTML}
      </div>

      <div class="film-popup-main">
        <div class="film-popup-title-zone">
          <div class="popup-title-row">
            ${film.badge ? `<span class="popup-badge">${escapeHTML(film.badge)}</span>` : ''}
            ${film.isNearbyShowing ? '<span class="popup-badge popup-badge-nearby">À l’affiche près de toi</span>' : ''}
          </div>
          <div class="popup-title">${escapeHTML(title)}</div>
          ${film.original ? `<div class="popup-original-title">${escapeHTML(film.original)}</div>` : ''}
          ${ratingHTML}
        </div>

        <div class="film-popup-meta-zone">
          <span class="popup-tag">${escapeHTML(genre)}</span>
          <span class="popup-tag">${escapeHTML(duree)}</span>
          ${annee ? `<span class="popup-tag">${escapeHTML(annee)}</span>` : ''}
        </div>

        <div class="film-popup-crew-zone">
          <div class="popup-crew-row"><strong>Réalisateur ·</strong> ${escapeHTML(film.real || film.realisateur || film.director || 'Non renseigné')}</div>
          <div class="popup-crew-row"><strong>Avec ·</strong> ${escapeHTML(film.acteurs || film.cast || 'Non renseigné')}</div>
        </div>

        <div class="film-popup-synopsis-zone">
          <div class="section-label">Synopsis</div>
          <div class="popup-synopsis">${escapeHTML(film.synopsis || film.overview || 'Synopsis indisponible pour le moment.')}</div>
        </div>
      </div>

      <div class="film-popup-seances-zone">
        <div class="section-label">Séances proches</div>
        ${seancesHTML}
      </div>
    </div>

    <button class="popup-close-btn" onclick="closeFilmPopup()">Fermer</button>
  `;
}

function getPopupBestRating(film) {
  const candidates = [film?.bestNote, film?.nearbyRatingValue, film?.imdb, film?.tmdb, film?.sc];
  for (const value of candidates) {
    const rating = Number(value);
    if (Number.isFinite(rating) && rating > 0) return Math.round(rating * 10) / 10;
  }
  const lb = Number(film?.lb);
  if (Number.isFinite(lb) && lb > 0) return Math.round(lb * 20) / 10;
  return null;
}

function getPopupCinemas(film) {
  const nearby = Array.isArray(film?.nearbyCinemas) ? film.nearbyCinemas : [];
  const cinemas = nearby.length ? nearby : (Array.isArray(film?.cinemas) ? film.cinemas : []);
  return cinemas.filter(cinema => cinema && (cinema.nom || cinema.name));
}


function getStartOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizePopupVersion(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw.includes('VOST')) return 'VOST';
  if (raw.includes('SUB') || raw.includes('ORIGINAL') || raw === 'VO') return 'VO';
  if (raw.includes('DUB') || raw.includes('VF') || raw.includes('FRENCH') || raw.includes('FRANCAIS') || raw.includes('FRANÇAIS')) return 'VF';
  return raw.length <= 8 ? raw : '';
}

function getPopupShowtimeRaw(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) return value;
  return value.startsAt || value.startAt || value.datetime || value.dateTime || value.showtime || value.showTime || value.time || value.horaire || value.hour || value.heure || value.date || value.label || '';
}

function parsePopupShowtimeDate(value) {
  const raw = getPopupShowtimeRaw(value);
  if (!raw) return null;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;

  const text = String(raw).trim();
  if (!text) return null;
  const normalizedLower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const timeMatch = text.match(/(\d{1,2})[h:](\d{2})/);

  if (timeMatch && /aujourd/.test(normalizedLower)) {
    const d = getStartOfLocalDay(new Date());
    d.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    return d;
  }
  if (timeMatch && /demain/.test(normalizedLower)) {
    const d = getStartOfLocalDay(new Date());
    d.setDate(d.getDate() + 1);
    d.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    return d;
  }

  const isoMatch = text.match(/(20\d{2}-\d{2}-\d{2})(?:[T\s]+(\d{1,2})[:h](\d{2}))?/);
  if (isoMatch) {
    const [, day, hour = '0', minute = '0'] = isoMatch;
    const d = new Date(`${day}T${String(hour).padStart(2, '0')}:${minute}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Cas simple : heure seule comme 13h10. Le jour sera géré par le groupe "Séances".
  if (/^\d{1,2}[h:]\d{2}$/i.test(text)) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isPopupShowtimeInNextSevenDays(value) {
  const date = parsePopupShowtimeDate(value);
  if (!date) return true;

  const today = getStartOfLocalDay(new Date());
  const showtimeDay = getStartOfLocalDay(date);
  const maxDay = new Date(today);
  maxDay.setDate(today.getDate() + 7);

  return showtimeDay >= today && showtimeDay <= maxDay;
}

function getPopupShowtimeVersion(value) {
  if (!value || typeof value !== 'object') return '';
  return normalizePopupVersion(
    value.version || value.diffusionVersion || value.format || value.language || value.lang ||
    value.versionLabel || value.localizedVersion || value.projectionVersion || value?.version?.label || value?.version?.name
  );
}

function formatPopupShowtime(value) {
  const raw = getPopupShowtimeRaw(value);
  const text = String(raw || '').trim();
  const date = parsePopupShowtimeDate(value);

  if (!date) {
    return text.replace('T', ' · ').replace(/\s+à\s+/i, ' · ');
  }

  const today = getStartOfLocalDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const showtimeDay = getStartOfLocalDay(date);
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date).replace(':', 'h');

  if (showtimeDay.getTime() === today.getTime()) return `Aujourd’hui · ${time}`;
  if (showtimeDay.getTime() === tomorrow.getTime()) return `Demain · ${time}`;

  const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  return `${day} · ${time}`;
}

function getPopupDayLabel(date, fallbackText = '') {
  const text = String(fallbackText || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/aujourd/.test(text)) return 'Aujourd’hui';
  if (/demain/.test(text)) return 'Demain';

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'Séances';
  const today = getStartOfLocalDay(new Date());
  const day = getStartOfLocalDay(date);
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Demain';
  const label = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1).replace('.', '');
}

function getPopupDayKey(date, fallbackText = '') {
  const label = getPopupDayLabel(date, fallbackText);
  if (date instanceof Date && !Number.isNaN(date.getTime())) return getStartOfLocalDay(date).toISOString().slice(0, 10);
  return label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
}

function getPopupShowtimeTime(date, fallback = '') {
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date).replace(':', 'h');
  }
  const match = String(fallback || '').match(/(\d{1,2})[h:](\d{2})/);
  return match ? `${match[1].padStart(2, '0')}h${match[2]}` : String(fallback || '').trim();
}

function collectPopupCinemaShowtimes(cinema) {
  const collected = [];
  const seenObjects = new WeakSet();

  function add(value, inheritedVersion = '') {
    if (value === null || value === undefined || value === '') return;
    const raw = getPopupShowtimeRaw(value);
    const rawText = String(raw || value || '').trim();
    if (!rawText) return;

    const date = parsePopupShowtimeDate(value);
    if (date && !isPopupShowtimeInNextSevenDays(value)) return;

    const version = getPopupShowtimeVersion(value) || inheritedVersion || '';
    const time = getPopupShowtimeTime(date, rawText);
    if (!time) return;

    collected.push({
      raw: value,
      date,
      dayKey: getPopupDayKey(date, rawText),
      dayLabel: getPopupDayLabel(date, rawText),
      time,
      version,
      sortTime: date ? date.getTime() : Number.MAX_SAFE_INTEGER,
      rawText
    });
  }

  function visit(node, inheritedVersion = '', depth = 0) {
    if (node === null || node === undefined || depth > 8) return;
    if (typeof node === 'string' || typeof node === 'number' || node instanceof Date) {
      add(node, inheritedVersion);
      return;
    }

    // ZIP 3.6.5 : les horaires arrivent souvent directement sous forme de tableau
    // ex: ["Aujourd’hui à 10h50", "Demain à 13h10"].
    // Avant, un tableau était traité comme un objet et ses éléments n'étaient jamais parcourus.
    if (Array.isArray(node)) {
      node.forEach(child => visit(child, inheritedVersion, depth + 1));
      return;
    }

    if (typeof node !== 'object') return;
    if (seenObjects.has(node)) return;
    seenObjects.add(node);

    const version = getPopupShowtimeVersion(node) || inheritedVersion;
    const direct = getPopupShowtimeRaw(node);
    if (direct) add(node, version);

    for (const key of ['structuredHoraires', 'horaires', 'showtimes', 'seances', 'séances', 'sessions', 'times', 'rawShowtimes']) {
      const value = node[key];
      if (Array.isArray(value)) value.forEach(child => visit(child, version, depth + 1));
    }
  }

  // ZIP 3.6.5 : on donne la priorité aux horaires déjà présents dans la fiche.
  // Le bug 3.6.3 venait d'un rendu trop strict qui pouvait ignorer des chaînes
  // pourtant valides comme "Aujourd’hui à 10h50".
  visit(cinema?.structuredHoraires || []);
  visit(cinema?.horaires || []);
  visit(cinema?.showtimes || []);
  visit(cinema?.rawShowtimes || []);
  visit(cinema?.seances || []);
  visit(cinema?.sessions || []);
  visit(cinema?.times || []);

  const unique = [];
  const seen = new Set();
  for (const item of collected.sort((a, b) => a.sortTime - b.sortTime || a.time.localeCompare(b.time, 'fr'))) {
    const key = `${item.dayKey}|${item.time}|${item.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function groupPopupShowtimesByDay(showtimes) {
  const groups = [];
  const byKey = new Map();
  for (const showtime of showtimes) {
    if (!byKey.has(showtime.dayKey)) {
      const group = { key: showtime.dayKey, label: showtime.dayLabel, showtimes: [] };
      byKey.set(showtime.dayKey, group);
      groups.push(group);
    }
    byKey.get(showtime.dayKey).showtimes.push(showtime);
  }
  return groups;
}

function buildPopupSeancesHTML(cinemas) {
  if (!cinemas.length) {
    return `<div class="empty-seances">Aucune séance proche n’est encore associée à ce film. Lance une recherche de cinémas proches pour remplir cette zone.</div>`;
  }

  return `<div class="popup-seances-list">${cinemas
    .slice()
    .sort((a, b) => Number(a.distanceKm ?? a.dist ?? 9999) - Number(b.distanceKm ?? b.dist ?? 9999))
    .slice(0, 8)
    .map((cinema, cinemaIndex) => {
      const nom = cinema.nom || cinema.name || 'Cinéma';
      const distance = Number(cinema.distanceKm ?? cinema.dist);
      const distanceLabel = Number.isFinite(distance) ? ` · ${distance.toFixed(1)} km` : '';
      const showtimes = collectPopupCinemaShowtimes(cinema);
      const groups = groupPopupShowtimesByDay(showtimes);
      const next = showtimes[0] || null;
      const nextLabel = next ? `${next.dayLabel} · ${next.time}${next.version ? ` ${next.version}` : ''}` : '';
      const uid = `popup-${cinemaIndex}-${String(nom).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

      const horairesHTML = groups.length
        ? `<div class="popup-next-showtime">🎬 Prochaine séance : <strong>${escapeHTML(nextLabel)}</strong></div>
           <div class="popup-showtime-day-tabs" role="tablist">${groups.map((group, index) => `
             <button type="button" class="popup-day-tab${index === 0 ? ' active' : ''}" data-day-target="${escapeHTML(uid)}-${index}">${escapeHTML(group.label)}</button>
           `).join('')}</div>
           ${groups.map((group, index) => `
             <div class="popup-day-panel${index === 0 ? ' active' : ''}" data-day-panel="${escapeHTML(uid)}-${index}">
               <div class="popup-showtimes">${group.showtimes.map(item => `
                 <span class="popup-showtime-pill"><strong>${escapeHTML(item.time)}</strong>${item.version ? `<em>${escapeHTML(item.version)}</em>` : ''}</span>
               `).join('')}</div>
             </div>
           `).join('')}`
        : '<div class="popup-showtimes-muted">Aucune séance dans les 7 prochains jours.</div>';
      return `<div class="popup-cinema-row">
        <div class="popup-cinema-name"><i class="ti ti-map-pin"></i>${escapeHTML(nom)}${distanceLabel}</div>
        ${horairesHTML}
      </div>`;
    }).join('')}</div>`;
}

document.addEventListener('click', function(event) {
  const tab = event.target.closest?.('.popup-day-tab');
  if (!tab) return;
  const target = tab.dataset.dayTarget;
  const row = tab.closest('.popup-cinema-row');
  if (!target || !row) return;
  row.querySelectorAll('.popup-day-tab').forEach(button => button.classList.toggle('active', button === tab));
  row.querySelectorAll('.popup-day-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.dayPanel === target));
});

async function loadCachedSynopsisForCatalogue(film) {
  const imdbId = String(film?.imdbID || film?.imdbId || '').trim();
  const title = String(film?.titre || film?.title || '').trim();
  const originalTitle = String(film?.original || film?.original_title || '').trim();
  const year = String(film?.annee || film?.year || '').trim();
  const localFallback = String(film?.synopsis || '').trim();
  if (!imdbId && !title) return localFallback;

  try {
    const params = new URLSearchParams();
    if (imdbId) params.set('imdbId', imdbId);
    if (title) params.set('title', title);
    if (originalTitle) params.set('originalTitle', originalTitle);
    if (year) params.set('year', year);
    params.set('mode', 'cache-imdb-then-local');
    params.set('_', String(Date.now()));

    const response = await fetch(`http://localhost:3000/api/imdb-synopsis?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) return localFallback;
    const data = await response.json();
    const synopsis = String(data?.synopsis || '').trim();
    return synopsis || localFallback;
  } catch {
    return localFallback;
  }
}

function setCataloguePopupSynopsis(popup, text) {
  const node = popup?.querySelector?.('.popup-synopsis');
  if (node) node.textContent = text || 'Aucun synopsis disponible pour ce film.';
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

  // Catalogue aussi : cache IMDb local d'abord, puis synopsis local data.js.
  loadCachedSynopsisForCatalogue(film).then((synopsis) => {
    setCataloguePopupSynopsis(popup, synopsis || film.synopsis || 'Aucun synopsis disponible pour ce film.');
  });
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
