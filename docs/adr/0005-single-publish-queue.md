# Publicaciones procesadas de a una, nunca en paralelo

El VPS es compartido con proyectos de producción más serios (tropero, saume, bertha, liso) en 22GB de RAM. El paso más pesado de este panel es publicar un Reel/video: bajarlo de Drive, subirlo a Supabase Storage y esperar a que Meta lo procese.

Decidimos encolar las Publicaciones (Posts, Historias, Reels, sean inmediatas o programadas) y procesarlas de a una por vez con una cola simple en memoria dentro del propio proceso Next.js, nunca en paralelo.

Por qué: prioriza no competir por CPU/red con los otros sitios del mismo VPS por sobre la velocidad de publicación de este panel — que es un "chiche" de bajo tráfico, no un servicio con SLA.
