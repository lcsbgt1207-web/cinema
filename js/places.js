/* CinéProche — Service Google Places */

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
      navigator.geolocation.getCurrentPosition(pos => { this.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }; resolve(this.userLocation); }, err => reject(err), { timeout: 10000, maximumAge: 300000 });
    });
  },

  geocodeAddress(address) {
    return new Promise((resolve, reject) => {
      this.geocoder.geocode({ address: address, region: 'fr' }, (results, status) => {
        if (status === 'OK' && results[0]) { const loc = results[0].geometry.location; this.userLocation = { lat: loc.lat(), lng: loc.lng() }; resolve({ location: this.userLocation, formattedAddress: results[0].formatted_address }); }
        else { reject(new Error('Adresse introuvable : ' + status)); }
      });
    });
  },

  findNearbycinemas(location, radius = CONFIG.SEARCH_RADIUS) {
    return new Promise((resolve, reject) => {
      if (!this.placesService) { reject(new Error('Service Places non initialisé')); return; }
      const request = { location: new google.maps.LatLng(location.lat, location.lng), radius: radius, type: 'movie_theater', language: 'fr' };
      this.placesService.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          const EXCLUDE = ['drive', 'drive-in', 'plein air', 'open air', 'restaurant', 'brasserie', 'thai', 'pizza', 'burger', 'sushi', 'kebab', 'hotel', 'hôtel', 'supermarché', 'boutique', 'magasin', 'coiffeur', 'pharmacie', 'boulangerie', 'tabac', 'karting', 'bowling', 'escape', 'festival', 'temporaire', 'éphémère', 'association'];
          const REQUIRE = ['ciné', 'cine', 'cinema', 'cinéma', 'ugc', 'pathé', 'pathe', 'gaumont', 'mk2', 'rex', 'megarama', 'kinépolis', 'kinepolis', 'multiplexe', 'imax', 'odéon', 'odeon', 'lumière', 'lumiere', 'majestic', 'palace', 'louxor', 'champo', 'balzac', 'wepler'];
          const filtered = results.filter(place => {
            const name = place.name.toLowerCase();
            const types = place.types || [];
            if (EXCLUDE.some(k => name.includes(k))) return false;
            if (REQUIRE.some(k => name.includes(k))) return true;
            return types.includes('movie_theater');
          });
          const cinemas = filtered.map(place => ({ id: place.place_id, nom: place.name, adresse: place.vicinity, location: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }, ouvert: place.opening_hours ? place.opening_hours.open_now : null, rating: place.rating, dist: this.calcDistance(location, { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }) }));
          cinemas.sort((a, b) => a.dist - b.dist);
          resolve(cinemas);
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          reject(new Error('Erreur Places API : ' + status));
        }
      });
    });
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
