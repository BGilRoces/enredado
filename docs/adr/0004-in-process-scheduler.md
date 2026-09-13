# Publicación programada: scheduler propio dentro del proceso de Next.js, no una cola externa

El VPS no tiene crontab de usuario ni de root, y ningún proyecto de Coolify usa hoy una feature de tareas programadas ni una cola (Redis/BullMQ) para este tipo de trabajo.

Decidimos implementar la Publicación programada con un scheduler liviano corriendo dentro del propio proceso Next.js (el contenedor que despliega Coolify es persistente, no serverless): cada pocos minutos revisa la tabla de Publicaciones por las que ya llegaron a su horario y las dispara.

Por qué: no suma ningún servicio nuevo — sin Redis, sin cron de sistema, sin tocar Coolify — y como el contenedor ya corre 24/7, un intervalo en memoria alcanza sobra para el volumen de este panel (4 a 10 Cuentas de Instagram).
