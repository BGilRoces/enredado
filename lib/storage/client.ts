import { createClient } from "@supabase/supabase-js";
import type { StorageClient } from "@/lib/publicador/types";
import { requireEnv } from "@/lib/env";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "enredado-temp";

/**
 * Cliente real de Supabase Storage, usado como exposición pública temporal
 * para que Meta pueda descargar el archivo (ver ADR: bucket de shared-infra).
 * Usa el service role key porque es un bucket privado del servidor, nunca
 * expuesto al cliente.
 */
function supabaseClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  );
}

export const storageClient: StorageClient = {
  async subir(nombre, data, contentType) {
    const supabase = supabaseClient();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(nombre, data, { contentType, upsert: true });
    if (error) throw new Error(`Supabase Storage: ${error.message}`);

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(nombre);
    return { url: publicUrlData.publicUrl };
  },

  async borrar(nombre) {
    const { error } = await supabaseClient().storage.from(BUCKET).remove([nombre]);
    if (error) throw new Error(`Supabase Storage: ${error.message}`);
  },
};
