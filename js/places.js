/* ═══════════════════════════════════════
   CinéProche — Service Google Places
   Trouve les cinémas proches
   ═══════════════════════════════════════ */

const PLACES = {

  map: null,
  placesService: null,
  geocoder: null,
  userLocation: null,

  // Initialiser Google Maps
  init() {
    this.geocoder = new google.maps.Geocoder();
    // Map invisible juste pour le service Places
    const mapDiv = document.getElementById('map-hidden');
    if (mapDiv) {
      this.map = new google.maps.Map(mapDiv, { center: { lat: 48.8566, lng: 2.3522 }, zoom: 13 });
      this.placesService = new google.maps.places.PlacesService(this.map);
    }
  },

  // Géolocalisation navigateur
  geolocate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Géolocalisation non disponible'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          this.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          resolve(this.userLocation);
        },
        err => reject(err),
        { timeout: 10000, maximumAge: 300000 }
      );
    });
  },

  // Géocoder une adresse en coordonnées
  geocodeAddress(address) {
    return new Promise((resolve, reject) => {
      this.geocoder.geocode({ address: address, region: 'fr' }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const loc = results[0].geometry.location;
          this.userLocation = { lat: loc.lat(), lng: loc.lng() };
          resolve({
            location: this.userLocation,
            formattedAddress: results[0].formatted_address
          });
        } else {
          reject(new Error('Adresse introuvable : ' + status));
        }
      });
    });
  },

  // Chercher les cinémas proches
  findNearbycinemas(location, radius = CONFIG.SEARCH_RADIUS) {
    return new Promise((resolve, reject) => {
      if (!this.placesService) {
        reject(new Error('Service Places non initialisé'));
        return;
      }
      const request = {
        location: new google.maps.LatLng(location.lat, location.lng),
        radius: radius,
        type: 'movie_theater',
        language: 'fr'
      };
      this.placesService.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          const cinemas = results.map(place => ({
            id: place.place_id,
            nom: place.name,
            adresse: place.vicinity,
            location: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            },
            ouvert: place.opening_hours ? place.opening_hours.open_now : null,
            rating: place.rating,
            photo: place.photos ? place.photos[0].getUrl({ maxWidth: 400 }) : null,
            dist: this.calcDistance(location, {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            })
          }));
          // Trier par distance
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

  // Détails d'un cinéma (téléphone, horaires complets)
  getCinemaDetails(placeId) {
    return new Promise((resolve, reject) => {
      this.placesService.getDetails({
        placeId: placeId,
        fields: ['name', 'formatted_address', 'formatted_phone_number', 'opening_hours', 'website', 'url', 'rating', 'photos'],
        language: 'fr'
      }, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          resolve(place);
        } else {
          reject(new Error('Détails introuvables : ' + status));
        }
      });
    });
  },

  // Calculer la distance en km entre deux points
  calcDistance(from, to) {
    const R = 6371;
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  // Formater la distance
  formatDist(km) {
    if (km < 1) return Math.round(km * 1000) + ' m';
    return km.toFixed(1).replace('.', ',') + ' km';
  },

  // Lien Google Maps itinéraire
  getMapsUrl(cinema) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cinema.nom + ' ' + cinema.adresse)}&destination_place_id=${cinema.id}`;
  },

  // Lien Waze
  getWazeUrl(cinema) {
    return `https://waze.com/ul?ll=${cinema.location.lat},${cinema.location.lng}&navigate=yes`;
  }
};
