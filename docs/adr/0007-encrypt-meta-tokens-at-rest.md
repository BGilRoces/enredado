# Cifrar el access token de Meta antes de guardarlo, no en texto plano

Cada Cuenta necesita persistir su token de acceso de Meta para poder publicar en su nombre. La opción simple sería guardarlo tal cual en la columna, confiando en el control de acceso de la Postgres de `shared-infra` (ADR-0002/0003).

Decidimos cifrarlo (AES-256-GCM) con una clave que vive solo en una variable de entorno del propio panel (`TOKEN_ENCRYPTION_KEY`, nunca en la base) antes de guardarlo, y descifrarlo recién en memoria al momento de usarlo para publicar.

Por qué: esa Postgres es compartida con `tropero`, `sistemas` y `bertha` — un acceso de lectura a esa base (un dump, una query mal alcanzada, una futura integración) no debería entregar automáticamente el token real de una Cuenta de Instagram real. El costo extra (una clave más para administrar) es bajo comparado con lo que protege.
