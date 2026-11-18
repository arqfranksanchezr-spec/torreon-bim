// Llamadas a las funciones de Supabase. Cada petición viaja con el token de Trimble
// del usuario; la función lo valida contra Trimble antes de tocar la base de datos.
import { CONFIG } from "./config.js";
import { ctx } from "./trimble.js";

export async function backend(accion, datos = {}, funcion = "flujos") {
  const r = await fetch(`${CONFIG.SUPABASE_FUNCIONES}/${funcion}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.token}`,
    },
    body: JSON.stringify({
      accion,
      projectId: ctx.proyecto.id,
      host: ctx.host,
      ...datos,
    }),
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(cuerpo.error || `Error ${r.status} en el servidor`);
  return cuerpo;
}

export const obra = (accion, datos) => backend(accion, datos, "obra");
