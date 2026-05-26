ZIP 2.9.2

Correctif urgent du Catalogue proche :
- extraction robuste des IDs cinéma dans la réponse /search-cinema ;
- extraction profonde des tableaux de séances dans la réponse /seances ;
- conservation des badges Classé IMDb / TMDB / À enrichir ;
- variable window.NEARBY_CATALOGUE_MISSING_DRAFT disponible pour les films absents.

Test :
getNearbyRankedMovies({ address: 'Cergy', radius: 15000 })

Tu dois voir dans la console :
[Catalogue proche] ZIP 2.9.2 actif.
force pages redeploy Tue May 26 14:09:58     2026
force pages rebuild second try %date% %time%
