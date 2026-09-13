# Persistir en la Postgres de Supabase self-hosted compartida, no en una base nueva

El panel necesita guardar Cuentas de Instagram conectadas, tokens, historial de Publicaciones y (más adelante) Colaboradores. La opción liviana por defecto para un proyecto chico sería SQLite; la alternativa era levantar una base nueva dedicada.

Decidimos reutilizar la instancia de Supabase self-hosted (Postgres) que ya corre 24/7 en el VPS para proyectos no críticos, en vez de sumar SQLite o una Postgres dedicada. Ese proceso ya está pago en RAM independientemente de este proyecto; agregar otro motor de base de datos solo sumaría consumo sin necesidad, y este panel encaja exactamente en el perfil de carga liviana que esa infra compartida está pensada para alojar.
