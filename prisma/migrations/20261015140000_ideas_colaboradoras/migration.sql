-- CreateTable: Cuentas colaboradoras de una Idea (relación implícita muchos-a-muchos de Prisma).
CREATE TABLE "_IdeaColaboradoras" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_IdeaColaboradoras_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_IdeaColaboradoras_B_index" ON "_IdeaColaboradoras"("B");

-- AddForeignKey
ALTER TABLE "_IdeaColaboradoras" ADD CONSTRAINT "_IdeaColaboradoras_A_fkey" FOREIGN KEY ("A") REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IdeaColaboradoras" ADD CONSTRAINT "_IdeaColaboradoras_B_fkey" FOREIGN KEY ("B") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
