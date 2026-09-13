/**
 * El proyecto de Supabase Auth (`shared-infra`) es compartido con otras apps
 * del VPS (tropero, sistemas, bertha). Un login válido ahí no implica que el
 * usuario pertenezca a este panel — `app_metadata.app` lo setea a mano quien
 * crea el usuario en Supabase Studio, y se compara contra este slug.
 */
export const APP_SLUG = "enredado";
