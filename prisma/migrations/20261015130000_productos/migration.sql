-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Producto_cuentaId_nombre_key" ON "Producto"("cuentaId", "nombre");

-- AlterTable
ALTER TABLE "Idea" ADD COLUMN     "productoId" TEXT;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Carga inicial de productos (catálogo del segundo cerebro). Se asocia por
-- @usuario de IG; la Cuenta de Biashop duplicada y desconectada se ignora.
INSERT INTO "Producto" ("id", "cuentaId", "nombre")
SELECT 'prod_' || substr(md5(random()::text || c."id" || v.nombre), 1, 20), c."id", v.nombre
FROM "Cuenta" c
CROSS JOIN (VALUES
    ('Cerri – Broche cierra bolsas hermético (set x8)'),
    ('Cerri – Caja organizadora multiuso para zapatos 7,5 L'),
    ('Cerri – Caja organizadora + organizador 15 divisiones'),
    ('Cerri – Caja organizadora 12 L apilable'),
    ('Cerri – Caja organizadora 24 L apilable'),
    ('Cerri – Caja organizadora premium 26x18x16 cm'),
    ('Cerri – Caja organizadora premium 35x26x16 cm'),
    ('Cerri – Huevera deslizante con separador de yema'),
    ('Cerri – Jarra medidora 1 L'),
    ('Cerri – Set x2 cajas premium 35x26x16 cm'),
    ('Cerri – Set x3 cajas transparentes 12 L'),
    ('Cerri – Set x3 cajas transparentes con tapa'),
    ('Cerri – Set x3 cajas premium 26x18x16 cm'),
    ('Cerri – Set x4 cajas para zapatos 7,5 L'),
    ('Cerri – Set x6 cajas transparentes 24 L'),
    ('LukParty – Caja organizadora símil rattan XL con tapa'),
    ('LukParty – Caja organizadora 24 L apilable premium'),
    ('LukParty – Caja organizadora 72 L con ruedas'),
    ('LukParty – Caja organizadora símil rattan premium mediana'),
    ('LukParty – Frasco hermético transparente apilable'),
    ('LukParty – Jarra de plástico para agua/jugo 1,8 L'),
    ('LukParty – Provoletera de hierro fundido'),
    ('LukParty – Set x2 cajas 72 L con ruedas'),
    ('LukParty – Set x2 frascos herméticos 0,9 L + 1,4 L'),
    ('LukParty – Set x4 canastos rattan XL')
) AS v(nombre)
WHERE c."igUsername" = 'biashop.ar' AND "estado" = 'conectada'
ON CONFLICT ("cuentaId", "nombre") DO NOTHING;

INSERT INTO "Producto" ("id", "cuentaId", "nombre")
SELECT 'prod_' || substr(md5(random()::text || c."id" || v.nombre), 1, 20), c."id", v.nombre
FROM "Cuenta" c
CROSS JOIN (VALUES
    ('Funda cubre asiento de auto'),
    ('Arnés de asistencia'),
    ('Bebedero portátil 3 en 1')
) AS v(nombre)
WHERE c."igUsername" = 'mimada_ar'
ON CONFLICT ("cuentaId", "nombre") DO NOTHING;

INSERT INTO "Producto" ("id", "cuentaId", "nombre")
SELECT 'prod_' || substr(md5(random()::text || c."id" || v.nombre), 1, 20), c."id", v.nombre
FROM "Cuenta" c
CROSS JOIN (VALUES
    ('Desodorizador de guantes'),
    ('Enrollador de vendas'),
    ('Punching bag pro'),
    ('Vendas elásticas con cubre nudillo')
) AS v(nombre)
WHERE c."igUsername" = 'saume.ok'
ON CONFLICT ("cuentaId", "nombre") DO NOTHING;

