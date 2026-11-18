// Los valores vienen de /config.js (archivo aparte para poder cambiarlos sin recompilar).
const externo = (typeof window !== "undefined" && window.TORREON_CONFIG) || {};
export const CONFIG = {
  SUPABASE_FUNCIONES: externo.SUPABASE_FUNCIONES || "https://TU-PROYECTO.supabase.co/functions/v1",
  BASE_URL: externo.BASE_URL || "https://arqfranksanchezr-spec.github.io/torreon-bim",
  PASOS_POR_DEFECTO: externo.PASOS_POR_DEFECTO || ["Realiza", "Revisa", "Aprueba"],
  MINUTOS_REVISION_VERSIONES: externo.MINUTOS_REVISION_VERSIONES || 5,
};
