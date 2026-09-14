/** Lee una env var requerida, o tira un error con el mismo mensaje en todo el proyecto. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no está configurado (ver .env.example)`);
  return value;
}
