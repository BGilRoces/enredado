# Un tercer Estado de la Cuenta: "necesita reconexión", distinto de "desconectada"

Hasta el ticket 06, una Cuenta era `conectada` o `desconectada` — y `desconectada` siempre significaba una sola cosa: el dueño del panel decidió dejar de operarla ahí (`desconectarCuenta`, acción manual).

El ticket 07 agrega renovación automática del token de Meta (dura ~60 días). Puede fallar por un motivo que no tiene nada que ver con una decisión del dueño: Meta rechaza la renovación porque el acceso se revocó del lado de Meta (o el usuario cambió la contraseña, o la Página se desvinculó, etc.). Si ese caso se marcara también como `desconectada`, se perdería la distinción entre "yo la desconecté a propósito" y "el panel detectó que ya no puede publicarle y hace falta que alguien vuelva a autorizarla".

Decidimos agregar `necesitaReconexion` como tercer valor de `EstadoCuenta`. El Publicador (ticket 03/05) ya trata cualquier estado distinto de `conectada` como "no publicable", así que no hace falta tocar esa lógica — alcanza con que `/cuentas` muestre esta Cuenta de forma distinta a una desconectada a mano, con un link directo para reconectarla (mismo flujo de OAuth del ticket 02, que hace upsert por `igUserId`).
