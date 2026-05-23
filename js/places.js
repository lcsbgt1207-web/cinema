/* CinéProche — Service Google Places v5 */

const PLACES = {
  map: null, placesService: null, geocoder: null, userLocation: null,

  init() {
    this.geocoder = new google.maps.Geocoder();
    const mapDiv = document.getElementById('map-hidden');
    if (mapDiv) {
      this.map = new google.maps.Map(mapDiv, { center: { lat: 48.8566, lng: 2.3522 }, zoom: 13 });
      this.placesService = new google.maps.places.PlacesService(this.map);
    }
  },

  geolocate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Géolocalisation non disponible')); return; }
      navigator.geolocation.getCurrentPosition(
        pos => { this.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }; resolve(this.userLocation); },
        err => reject(err), { timeout: 10000, maximumAge: 300000 }
      );
    });
  },

  geocodeAddress(address) {
    return new Promise((resolve, reject) => {
      this.geocoder.geocode({ address: address, region: 'fr' }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const loc = results[0].geometry.location;
          this.userLocation = { lat: loc.lat(), lng: loc.lng() };
          resolve({ location: this.userLocation, formattedAddress: results[0].formatted_address });
        } else { reject(new Error('Adresse introuvable : ' + status)); }
      });
    });
  },

  _searchRadius(location, radius) {
    return new Promise((resolve) => {
      if (!this.placesService) { resolve([]); return; }
      const request = {
        location: new google.maps.LatLng(location.lat, location.lng),
        radius: radius,
        type: 'movie_theater',
        language: 'fr'
      };
      let allResults = [];
      const handlePage = (results, status, pagination) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          allResults = allResults.concat(results);
          if (pagination && pagination.hasNextPage && allResults.length < 60) {
            setTimeout(() => pagination.nextPage(), 300);
          } else { resolve(allResults); }
        } else { resolve(allResults); }
      };
      this.placesService.nearbySearch(request, handlePage);
    });
  },

  async findNearbycinemas(location, radius = 15000) {
    const CLOSE_RADIUS = Math.min(5000, radius);
    let results;
    if (radius <= 5000) {
      results = await this._searchRadius(location, radius);
    } else {
      const [closeResults, farResults] = await Promise.all([
        this._searchRadius(location, CLOSE_RADIUS),
        this._searchRadius(location, radius)
      ]);
      const seen = new Set();
      results = [];
      for (const r of [...closeResults, ...farResults]) {
        if (!seen.has(r.place_id)) { seen.add(r.place_id); results.push(r); }
      }
    }

    // ── MOTS À EXCLURE ABSOLUMENT ──
    const EXCLUDE = [
      // Commerce / service
      'carrefour','leclerc','fnac','cultura','super u','intermarché','auchan','lidl','casino',
      'coiffeur','coiffure','wecasa','barbier','salon','beauty','nail','spa','massage',
      'pharmacie','optique','dentiste','médecin','docteur',
      'boulangerie','pâtisserie','restaurant','brasserie','bistrot','café','bar','pub',
      'kebab','pizza','sushi','thai','burger','traiteur','snack','épicerie',
      'hotel','hôtel','auberge','gîte','chambre',
      'boutique','magasin','vêtement','chaussure','librairie','tabac','presse',
      'supermarché','supermarche','hypermarché',
      // Lieux culturels non-cinéma
      'théâtre','theatre','opéra','opera','concert','musique','danse','cirque',
      'musée','musee','exposition','galerie','bibliothèque',
      'spectacles','billetterie','salle de spectacle',
      'laboratoire','labo','diffusion','production','studio de',
      'association','collectif','atelier','cours de',
      'polygone','étoilé','etoile',
      // Plein air / drive
      'drive','drive-in','plein air','plein-air','open air','itinérant','itinerant',
      'toiles','cinétoile','festival','temporaire','éphémère','estival',
      // Loisirs
      'karting','bowling','escape','laser','paintball','trampoline','accrobranche',
      'aqua','parc','zoo','jardin',
      // Faux positifs connus
      'hallucinecran','halluciné','dodeskaden'
    ];

    // ── MOTS QUI GARANTISSENT QUE C'EST UN VRAI CINÉMA ──
    const REQUIRE = [
      'ciné','cine','cinema','cinéma',
      'ugc','pathé','pathe','gaumont','mk2','megarama','kinépolis','kinepolis',
      'imax','multiplexe',
      'odéon','odeon','lumière','lumiere','majestic','palace','louxor',
      'champo','balzac','wepler','brady','select','conti','beaumont',
      'utopia','ariel','studio 28','grand rex','rex','entrepôt','entrepot',
      'magic','ciné-club','cineclub'
    ];

    const filtered = results.filter(place => {
      const name = place.name.toLowerCase();
      const types = place.types || [];

      // 1. Exclure si contient un mot interdit
      if (EXCLUDE.some(k => name.includes(k))) return false;

      // 2. Accepter immédiatement si contient un mot cinéma reconnu
      if (REQUIRE.some(k => name.includes(k))) return true;

      // 3. Rejeter si types suspects
      const suspectTypes = ['supermarket','store','food','restaurant','lodging','bar',
                            'beauty_salon','hair_care','health','doctor','pharmacy'];
      if (suspectTypes.some(t => types.includes(t))) return false;

      // 4. N'accepter que si Google confirme movie_theater ET rating > 0
      // (évite les lieux mal catégorisés)
      if (!types.includes('movie_theater')) return false;
      if (place.rating && place.rating < 2.0) return false;

      return true;
    });

    const cinemas = filtered.map(place => ({
      id: place.place_id,
      nom: place.name,
      adresse: place.vicinity,
      location: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
      ouvert: place.opening_hours ? place.opening_hours.open_now : null,
      rating: place.rating,
      dist: this.calcDistance(location, { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() })
    }));

    cinemas.sort((a, b) => a.dist - b.dist);
    return cinemas;
  },

  calcDistance(from, to) {
    const R = 6371, dLat = (to.lat - from.lat) * Math.PI / 180, dLng = (to.lng - from.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(from.lat*Math.PI/180) * Math.cos(to.lat*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  formatDist(km) { return km < 1 ? Math.round(km*1000)+' m' : km.toFixed(1).replace('.',',')+' km'; },
  getMapsUrl(c) { return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.nom+' '+c.adresse)}&destination_place_id=${c.id}`; },
  getWazeUrl(c) { return `https://waze.com/ul?ll=${c.location.lat},${c.location.lng}&navigate=yes`; }
};


// Expose le service pour les autres fichiers (catalogue proche, console, etc.)
window.PLACES = PLACES;
