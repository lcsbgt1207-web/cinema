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

  _offsetLocation(origin, distanceKm, bearingDegrees) {
    const R = 6371;
    const bearing = bearingDegrees * Math.PI / 180;
    const lat1 = origin.lat * Math.PI / 180;
    const lng1 = origin.lng * Math.PI / 180;
    const angularDistance = distanceKm / R;
    const sinLat1 = Math.sin(lat1);
    const cosLat1 = Math.cos(lat1);
    const sinAd = Math.sin(angularDistance);
    const cosAd = Math.cos(angularDistance);

    const lat2 = Math.asin(sinLat1 * cosAd + cosLat1 * sinAd * Math.cos(bearing));
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * sinAd * cosLat1,
      cosAd - sinLat1 * Math.sin(lat2)
    );

    return {
      lat: lat2 * 180 / Math.PI,
      lng: ((lng2 * 180 / Math.PI) + 540) % 360 - 180
    };
  },

  _buildSearchPlan(location, radiusMeters) {
    const radiusKm = Math.max(1, Number(radiusMeters || 0) / 1000);
    if (radiusKm <= 5) {
      return [{ location, radius: Math.max(1500, Math.round(radiusMeters)) }];
    }

    const plan = [];
    const pushPoint = (distanceKm, bearing, searchRadiusKm) => {
      plan.push({
        location: distanceKm > 0 ? this._offsetLocation(location, distanceKm, bearing) : location,
        radius: Math.max(2500, Math.round(searchRadiusKm * 1000))
      });
    };

    // Toujours chercher le centre pour garder les cinémas les plus proches.
    pushPoint(0, 0, Math.min(8, Math.max(4.5, radiusKm * 0.32)));

    if (radiusKm <= 15) {
      for (let bearing = 0; bearing < 360; bearing += 60) {
        pushPoint(Math.max(3, radiusKm * 0.55), bearing, Math.min(7, Math.max(4.5, radiusKm * 0.42)));
      }
      return plan;
    }

    // Rayon moyen/large : un anneau intermédiaire.
    for (let bearing = 0; bearing < 360; bearing += 60) {
      pushPoint(Math.max(5, radiusKm * 0.42), bearing, Math.min(9, Math.max(5.5, radiusKm * 0.28)));
    }

    // Grand rayon : un anneau extérieur pour casser l'effet "mêmes cinémas centraux".
    const outerStep = 45;
    const outerDistance = Math.max(10, radiusKm * 0.78);
    const outerSearchRadius = Math.min(12, Math.max(6.5, radiusKm * 0.24));
    for (let bearing = 0; bearing < 360; bearing += outerStep) {
      pushPoint(outerDistance, bearing, outerSearchRadius);
    }

    return plan;
  },

  async _searchMultiplePlan(plan) {
    const aggregated = [];
    const concurrency = 3;
    for (let index = 0; index < plan.length; index += concurrency) {
      const chunk = plan.slice(index, index + concurrency);
      const results = await Promise.all(chunk.map(step => this._searchRadius(step.location, step.radius)));
      aggregated.push(...results.flat());
    }
    return aggregated;
  },

  async findNearbycinemas(location, radius = 15000) {
    const plan = this._buildSearchPlan(location, radius);
    const results = await this._searchMultiplePlan(plan);

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

    const byPlaceId = new Map();
    for (const place of results) {
      if (!place?.place_id || byPlaceId.has(place.place_id)) continue;
      byPlaceId.set(place.place_id, place);
    }

    const filtered = Array.from(byPlaceId.values()).filter(place => {
      const name = String(place.name || '').toLowerCase();
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

    const exactRadiusKm = Math.max(1, radius / 1000);
    const cinemas = filtered
      .map(place => ({
        id: place.place_id,
        nom: place.name,
        adresse: place.vicinity,
        location: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
        ouvert: place.opening_hours ? place.opening_hours.open_now : null,
        rating: place.rating,
        dist: this.calcDistance(location, { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() })
      }))
      .filter(cinema => cinema.dist <= exactRadiusKm + 0.35);

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
