// Función "la" de Supabase (Deno): estado comercial y de entrega de cada apartamento.
// Igual que las demás, valida cada petición contra Trimble con el token del usuario.

import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const HOST_VALIDO = /^https:\/\/app\d*\.connect\.trimble\.com\/tc\/api\/2\.0$/;
const CARPETA_FOTOS = Deno.env.get("CARPETA_FOTOS_LA") ?? "L.A. - Fotos";
const MAX_FOTOS = 8;

// Orden obligatorio de los estados
const ESTADOS = ["separada", "vendida", "escriturada", "liberada", "entregada"] as const;
const NOMBRES: Record<string, string> = {
  separada: "Separada", vendida: "Vendida", escriturada: "Escriturada",
  liberada: "Liberado por Calidad", entregada: "Entregado",
};

type Usuario = { email: string; nombre: string };
type Ctx = { token: string; host: string; projectId: string; yo: Usuario };
type Estado = { si: boolean | null; fecha: string | null };
type Estados = Record<string, Estado>;

class ErrorCliente extends Error {
  constructor(msg: string, public status = 400) { super(msg); }
}
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function tc(c: Pick<Ctx, "token" | "host">, ruta: string, init: RequestInit = {}) {
  const r = await fetch(`${c.host}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${c.token}`, ...(init.headers ?? {}) },
  });
  if (r.status === 401) throw new ErrorCliente("La sesión de Trimble venció. Recarga la extensión.", 401);
  if (!r.ok) throw new ErrorCliente(`Trimble respondió ${r.status} en ${ruta}`, 502);
  const texto = await r.text();
  return texto ? JSON.parse(texto) : {};
}

// ---------------------------------------------------------------- fotos en Trimble Connect (igual que en obra)

async function carpetaFotos(c: Ctx): Promise<string> {
  const { rootId } = await tc(c, `/projects/${c.projectId}`);
  const items: { id: string; name: string; type: string }[] = await tc(c, `/folders/${rootId}/items`);
  const existente = items.find((i) => i.type === "FOLDER" && i.name === CARPETA_FOTOS);
  if (existente) return existente.id;
  const nueva = await tc(c, `/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: CARPETA_FOTOS, parentId: rootId }),
  });
  return nueva.id;
}

async function subirArchivo(c: Ctx, carpetaId: string, nombre: string, bytes: Uint8Array, tipo: string) {
  try {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: tipo }), nombre);
    const r = await tc(c, `/files?parentId=${encodeURIComponent(carpetaId)}`, { method: "POST", body: form });
    const archivo = Array.isArray(r) ? r[0] : r;
    if (archivo?.id) return archivo.id as string;
  } catch (e) {
    if (e instanceof ErrorCliente && e.status === 401) throw e;
  }
  const inicio = await tc(c, `/files/fs/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nombre, parentId: carpetaId, parentType: "FOLDER" }),
  });
  const put = await fetch(inicio.uploadURL ?? inicio.uploadUrl, { method: "PUT", body: bytes });
  if (!put.ok) throw new Error(`La carga de ${nombre} falló (${put.status})`);
  const fin = await tc(c, `/files/fs/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId: inicio.uploadId }),
  });
  return fin.id as string;
}

function base64ABytes(b64: string) {
  const bin = atob(b64.replace(/^data:[^;]+;base64,/, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const hoy = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const limpio = (s: unknown) => String(s ?? "").trim();

// Devuelve el primer problema de orden que encuentre, o null si los estados son coherentes.
function problemaDeOrden(e: Estados): string | null {
  let fechaAnterior: string | null = null;
  for (let i = 0; i < ESTADOS.length; i++) {
    const k = ESTADOS[i];
    const v = e[k];
    if (!v || v.si !== true) continue;
    for (let j = 0; j < i; j++) {
      if (e[ESTADOS[j]]?.si !== true) return `No se puede marcar ${NOMBRES[k]} sin tener ${NOMBRES[ESTADOS[j]]} en SÍ`;
    }
    if (!v.fecha) return `${NOMBRES[k]} en SÍ necesita fecha`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.fecha)) return `La fecha de ${NOMBRES[k]} no es válida`;
    if (v.fecha > hoy()) return `La fecha de ${NOMBRES[k]} no puede ser posterior a hoy`;
    if (fechaAnterior && v.fecha < fechaAnterior) return `La fecha de ${NOMBRES[k]} es anterior a la del estado previo`;
    fechaAnterior = v.fecha;
  }
  return null;
}

async function evento(unidadId: string, c: Ctx, datos: { estado?: string; si?: boolean | null; fecha?: string | null; origen: string; detalle?: string }) {
  await db.from("la_eventos").insert({
    unidad_id: unidadId, estado: datos.estado ?? null, si: datos.si ?? null, fecha: datos.fecha ?? null,
    origen: datos.origen, detalle: datos.detalle ?? null, actor_email: c.yo.email, actor_nombre: c.yo.nombre,
  });
}

// ---------------------------------------------------------------- acciones

async function resumen(c: Ctx) {
  const unidades: unknown[] = [];
  for (let d = 0; ; d += 1000) {
    const { data, error } = await db.from("la_unidades").select("*").eq("project_id", c.projectId)
      .order("torre").order("apto").range(d, d + 999);
    if (error) throw error;
    unidades.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { yo: c.yo, unidades };
}

async function historial(c: Ctx, b: { unidadId: string }) {
  const { data: u } = await db.from("la_unidades").select("id").eq("id", b.unidadId).eq("project_id", c.projectId).single();
  if (!u) throw new ErrorCliente("Unidad no encontrada", 404);
  const { data } = await db.from("la_eventos").select("*").eq("unidad_id", u.id).order("creado_en", { ascending: false }).limit(100);
  return { eventos: data ?? [] };
}

async function guardarEstado(c: Ctx, b: { unidadId: string; estado: string; si: boolean | null; fecha?: string | null }) {
  if (!ESTADOS.includes(b.estado as typeof ESTADOS[number])) throw new ErrorCliente("Estado desconocido");
  const { data: u } = await db.from("la_unidades").select("*").eq("id", b.unidadId).eq("project_id", c.projectId).single();
  if (!u) throw new ErrorCliente("Unidad no encontrada", 404);
  const estados: Estados = { ...(u.estados ?? {}) };
  estados[b.estado] = { si: b.si === true ? true : b.si === false ? false : null, fecha: b.fecha || null };
  // Pasar a NO un estado que tiene posteriores en SÍ rompería el orden
  const idx = ESTADOS.indexOf(b.estado as typeof ESTADOS[number]);
  if (b.si !== true) {
    const posterior = ESTADOS.slice(idx + 1).find((k) => estados[k]?.si === true);
    if (posterior) throw new ErrorCliente(`Primero quita ${NOMBRES[posterior]}; está en SÍ y va después de ${NOMBRES[b.estado]}`);
  }
  const p = problemaDeOrden(estados);
  if (p) throw new ErrorCliente(p);
  await db.from("la_unidades").update({ estados, actualizado_en: new Date().toISOString(), actualizado_por: c.yo.nombre }).eq("id", u.id);
  await evento(u.id, c, {
    estado: b.estado, si: estados[b.estado].si, fecha: estados[b.estado].fecha, origen: "manual",
    detalle: `${NOMBRES[b.estado]}: ${estados[b.estado].si === true ? "SÍ" : estados[b.estado].si === false ? "NO" : "sin dato"}${estados[b.estado].fecha ? " (" + estados[b.estado].fecha + ")" : ""}`,
  });
  return { unidad: { ...u, estados } };
}

// Crea o actualiza unidades a partir de las habitaciones/áreas encontradas en el modelo.
async function vincularModelo(c: Ctx, b: { modelo_nombre?: string; unidades: { torre: string; apto: string; nivel?: string; modelo_id: string; object_id: string }[] }) {
  if (!Array.isArray(b.unidades) || !b.unidades.length) throw new ErrorCliente("No llegaron apartamentos para vincular");
  if (b.unidades.length > 3000) throw new ErrorCliente("Máximo 3000 apartamentos por vez");
  const filas = b.unidades.map((x) => ({
    project_id: c.projectId, torre: limpio(x.torre), apto: limpio(x.apto), nivel: limpio(x.nivel) || null,
    modelo_id: x.modelo_id, modelo_nombre: b.modelo_nombre ?? null, object_id: x.object_id,
  })).filter((x) => x.torre && x.apto && x.modelo_id && x.object_id);
  const vistos = new Set<string>();
  const unicas = filas.filter((x) => { const k = `${x.torre}|${x.apto}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
  for (let i = 0; i < unicas.length; i += 500) {
    const { error } = await db.from("la_unidades").upsert(unicas.slice(i, i + 500), { onConflict: "project_id,torre,apto" });
    if (error) throw error;
  }
  return { vinculadas: unicas.length, repetidas: filas.length - unicas.length };
}

// Importación del Excel comercial. Celda vacía = se deja como está.
async function importar(c: Ctx, b: { filas: { fila: number; torre: string; apto: string; estados: Record<string, { si?: boolean | null; fecha?: string | null }> }[]; crearFaltantes?: boolean }) {
  if (!Array.isArray(b.filas) || !b.filas.length) throw new ErrorCliente("El archivo no trae filas");
  const actuales = (await resumen(c)).unidades as { id: string; torre: string; apto: string; estados: Estados }[];
  const porClave = new Map(actuales.map((u) => [`${u.torre}|${u.apto}`.toLowerCase(), u]));
  const errores: { fila: number; motivo: string }[] = [];
  let actualizadas = 0, creadas = 0, sinCambios = 0;

  for (const f of b.filas) {
    const torre = limpio(f.torre), apto = limpio(f.apto);
    if (!torre || !apto) { errores.push({ fila: f.fila, motivo: "Falta torre o apartamento" }); continue; }
    let u = porClave.get(`${torre}|${apto}`.toLowerCase());
    const nuevos: Estados = { ...(u?.estados ?? {}) };
    let cambio = false;
    for (const k of ESTADOS) {
      const v = f.estados?.[k];
      if (!v || (v.si === undefined && !v.fecha)) continue;
      const antes = JSON.stringify(nuevos[k] ?? null);
      nuevos[k] = { si: v.si === undefined ? (nuevos[k]?.si ?? null) : v.si, fecha: v.fecha ?? nuevos[k]?.fecha ?? null };
      if (JSON.stringify(nuevos[k]) !== antes) cambio = true;
    }
    const p = problemaDeOrden(nuevos);
    if (p) { errores.push({ fila: f.fila, motivo: `${torre} ${apto}: ${p}` }); continue; }
    if (!cambio) { sinCambios++; continue; }
    if (!u) {
      if (!b.crearFaltantes) { errores.push({ fila: f.fila, motivo: `${torre} ${apto} no existe en L.A. (vincúlalo desde el modelo o marca crear faltantes)` }); continue; }
      const { data, error } = await db.from("la_unidades").insert({
        project_id: c.projectId, torre, apto, estados: nuevos, actualizado_por: c.yo.nombre,
      }).select().single();
      if (error) { errores.push({ fila: f.fila, motivo: error.message }); continue; }
      u = data; porClave.set(`${torre}|${apto}`.toLowerCase(), data); creadas++;
    } else {
      await db.from("la_unidades").update({ estados: nuevos, actualizado_en: new Date().toISOString(), actualizado_por: c.yo.nombre }).eq("id", u.id);
      actualizadas++;
    }
    await evento(u!.id, c, { origen: "importacion", detalle: `Importado del archivo (fila ${f.fila})` });
  }
  return { actualizadas, creadas, sinCambios, errores };
}

// Vincula un apartamento con un elemento del modelo elegido a mano en el visor.
async function vincularObjeto(c: Ctx, b: { unidadId: string; modelo_id: string; modelo_nombre?: string; object_id: string; nivel?: string | null }) {
  if (!b.modelo_id || !b.object_id) throw new ErrorCliente("Falta el elemento del modelo");
  const { data: u } = await db.from("la_unidades").select("*").eq("id", b.unidadId).eq("project_id", c.projectId).single();
  if (!u) throw new ErrorCliente("Unidad no encontrada", 404);
  const { data: otro } = await db.from("la_unidades").select("torre, apto").eq("project_id", c.projectId)
    .eq("modelo_id", b.modelo_id).eq("object_id", b.object_id).neq("id", u.id).maybeSingle();
  if (otro) throw new ErrorCliente(`Ese elemento ya está vinculado al apto ${otro.apto} de ${otro.torre}`);
  const cambios = {
    modelo_id: b.modelo_id, modelo_nombre: b.modelo_nombre ?? null, object_id: b.object_id,
    nivel: u.nivel || limpio(b.nivel) || null, actualizado_en: new Date().toISOString(), actualizado_por: c.yo.nombre,
  };
  await db.from("la_unidades").update(cambios).eq("id", u.id);
  await evento(u.id, c, { origen: "manual", detalle: `Vinculado al modelo ${b.modelo_nombre ?? ""}`.trim() });
  return { unidad: { ...u, ...cambios } };
}

async function guardarChequeo(c: Ctx, b: {
  unidadId: string; estado: string; lista: string;
  resultados: { item: string; resultado: string }[];
  observaciones?: string; marcar?: boolean; fecha?: string;
  fotos?: { nombre?: string; tipo?: string; base64: string }[];
}) {
  if (!ESTADOS.includes(b.estado as typeof ESTADOS[number])) throw new ErrorCliente("Estado desconocido");
  if (!limpio(b.lista)) throw new ErrorCliente("Falta la lista de chequeo");
  const resultados = (b.resultados ?? []).filter((r) => ["C", "NC", "NA"].includes(r.resultado) && limpio(r.item))
    .map((r) => ({ item: limpio(r.item), resultado: r.resultado }));
  if (!resultados.length) throw new ErrorCliente("La lista no tiene ítems respondidos");
  const hayNC = resultados.some((r) => r.resultado === "NC");
  if (hayNC && !limpio(b.observaciones)) throw new ErrorCliente("Hay no conformidades: describe en observaciones qué se encontró");
  if ((b.fotos ?? []).length > MAX_FOTOS) throw new ErrorCliente(`Máximo ${MAX_FOTOS} fotos por chequeo`);
  const { data: u } = await db.from("la_unidades").select("*").eq("id", b.unidadId).eq("project_id", c.projectId).single();
  if (!u) throw new ErrorCliente("Unidad no encontrada", 404);

  const { data: ch, error } = await db.from("la_chequeos").insert({
    project_id: c.projectId, unidad_id: u.id, estado: b.estado, lista: limpio(b.lista), resultados,
    conformidad: hayNC ? "no_conforme" : "conforme", observaciones: limpio(b.observaciones) || null,
    autor_email: c.yo.email, autor_nombre: c.yo.nombre,
  }).select().single();
  if (error) throw error;

  // Fotos: si alguna falla, el chequeo queda guardado y se informa cuál no subió.
  const fotos: { file_id: string; nombre: string }[] = [];
  const fallidas: string[] = [];
  if (b.fotos?.length) {
    let carpeta: string | null = null;
    try { carpeta = await carpetaFotos(c); } catch (e) {
      console.error(e);
      fallidas.push(...b.fotos.map((f, i) => f.nombre || `foto ${i + 1}`));
    }
    if (carpeta) {
      const base = `LA-${u.torre}-${u.apto}-${ch.numero}`.replace(/[^\w.-]+/g, "_");
      for (let i = 0; i < b.fotos.length; i++) {
        const f = b.fotos[i];
        const nombre = `${base}-${i + 1}.jpg`;
        try {
          fotos.push({ file_id: await subirArchivo(c, carpeta, nombre, base64ABytes(f.base64), f.tipo || "image/jpeg"), nombre });
        } catch (e) {
          console.error(e);
          fallidas.push(f.nombre || nombre);
        }
      }
      if (fotos.length) await db.from("la_chequeos").update({ fotos }).eq("id", ch.id);
    }
  }

  const nc = resultados.filter((r) => r.resultado === "NC").length;
  await evento(u.id, c, {
    estado: b.estado, origen: "chequeo",
    detalle: `Chequeo ${limpio(b.lista)}: ${hayNC ? `${nc} no conforme${nc > 1 ? "s" : ""}` : "conforme"} (${resultados.length} ítems${fotos.length ? `, ${fotos.length} fotos` : ""})${limpio(b.observaciones) ? ". " + limpio(b.observaciones) : ""}`,
  });

  // Marcar el estado en SÍ solo si la lista quedó completa y conforme; si el orden no lo permite, se informa.
  let error_estado: string | null = null;
  if (b.marcar) {
    if (hayNC) error_estado = "la lista tiene no conformidades";
    else {
      try { await guardarEstado(c, { unidadId: u.id, estado: b.estado, si: true, fecha: b.fecha || hoy() }); }
      catch (e) { error_estado = e instanceof ErrorCliente ? e.message : "error al guardar el estado"; }
    }
  }
  return { chequeo: { ...ch, fotos }, fotos_fallidas: fallidas, error_estado };
}

async function chequeos(c: Ctx, b: { unidadId: string }) {
  const { data } = await db.from("la_chequeos").select("*").eq("project_id", c.projectId).eq("unidad_id", b.unidadId)
    .order("creado_en", { ascending: false }).limit(50);
  return { chequeos: data ?? [] };
}

// ---------------------------------------------------------------- entrada

const ACCIONES: Record<string, (c: Ctx, b: any) => Promise<unknown>> = {
  resumen, historial, guardar_estado: guardarEstado, vincular_modelo: vincularModelo, importar,
  vincular_objeto: vincularObjeto, guardar_chequeo: guardarChequeo, chequeos,
};

// ---------------------------------------------------------------- permisos desde Trimble Connect
// Pueden modificar L.A.: los administradores del proyecto y los miembros del grupo de Trimble Connect
// llamado GRUPO_EDITORES (se crea en la página Team del proyecto). Si el grupo no existe en un proyecto,
// cualquier miembro puede modificar, como antes. El nombre se puede cambiar con el secreto GRUPO_LA.
const GRUPO_EDITORES = Deno.env.get("GRUPO_LA") ?? "L.A. Editores";
const ACCIONES_ESCRITURA = new Set(["guardar_estado", "vincular_modelo", "importar", "vincular_objeto", "guardar_chequeo"]);
const normalizar = (t: unknown) =>
  String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const lista = (r: any): any[] => (Array.isArray(r) ? r : r?.items ?? r?.data ?? []);

type InfoPermisos = { puedeEditar: boolean; admin: boolean; grupo: string; grupoExiste: boolean; enGrupo: boolean };

async function permisos(base: Pick<Ctx, "token" | "host">, projectId: string, me: { id?: string; email?: string }): Promise<InfoPermisos> {
  const info: InfoPermisos = { puedeEditar: false, admin: false, grupo: GRUPO_EDITORES, grupoExiste: false, enGrupo: false };
  if (me.id) {
    try {
      const u = await tc(base, `/projects/${projectId}/users/${me.id}`);
      info.admin = /admin/i.test(String(u.role ?? u.projectRole ?? ""));
    } catch (_) { /* si no se puede leer el rol, decide el grupo */ }
  }
  if (info.admin) { info.puedeEditar = true; return info; }
  const grupo = lista(await tc(base, `/groups?projectId=${encodeURIComponent(projectId)}`))
    .find((g) => normalizar(g.name) === normalizar(GRUPO_EDITORES));
  if (grupo) {
    info.grupoExiste = true;
    const email = normalizar(me.email);
    info.enGrupo = lista(await tc(base, `/groups/${grupo.id}/users`)).some((m) =>
      (me.id && (m.id === me.id || m.userId === me.id || m.tiduuid === me.id)) || (email && normalizar(m.email) === email));
  }
  info.puedeEditar = info.admin || !info.grupoExiste || info.enGrupo;
  return info;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const cuerpo = await req.json();
    const { accion, projectId, host } = cuerpo ?? {};
    if (!token) throw new ErrorCliente("Falta el token de Trimble", 401);
    if (!projectId || typeof projectId !== "string") throw new ErrorCliente("Falta el proyecto");
    if (!HOST_VALIDO.test(host ?? "")) throw new ErrorCliente("Región de Trimble no válida");
    const fn = ACCIONES[accion];
    if (!fn && accion !== "permisos") throw new ErrorCliente(`Acción desconocida: ${accion}`);

    const base = { token, host };
    const [me] = await Promise.all([tc(base, "/users/me"), tc(base, `/projects/${projectId}`)]);
    const yo: Usuario = { email: me.email, nombre: `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || me.email };
    if (accion === "permisos") return json(await permisos(base, projectId, me));
    if (ACCIONES_ESCRITURA.has(accion)) {
      const p = await permisos(base, projectId, me);
      if (!p.puedeEditar) {
        throw new ErrorCliente(`No tienes permiso para modificar L.A. Pide que te agreguen al grupo "${p.grupo}" en Trimble Connect.`, 403);
      }
    }

    return json(await fn({ token, host, projectId, yo }, cuerpo));
  } catch (e) {
    if (e instanceof ErrorCliente) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});
