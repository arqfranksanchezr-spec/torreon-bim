// Conexión con Trimble Connect (Workspace API) y llamadas a la API REST Core v2.0.

const HOSTS_POR_REGION = {
  northamerica: "https://app.connect.trimble.com/tc/api/2.0",
  europe: "https://app21.connect.trimble.com/tc/api/2.0",
  asia: "https://app31.connect.trimble.com/tc/api/2.0",
  australia: "https://app32.connect.trimble.com/tc/api/2.0",
};

export const ctx = {
  api: null,       // objeto de la Workspace API
  proyecto: null,  // { id, name, location }
  usuario: null,   // { id, email, firstName, lastName }
  token: null,     // access token del usuario en Trimble
  host: HOSTS_POR_REGION.northamerica,
};

const oyentes = {}; // nombre de evento -> [funciones]
export function escuchar(evento, fn) { (oyentes[evento] ||= []).push(fn); }
export function alRecibirComando(fn) { escuchar("extension.command", fn); }

let resolverToken;
const tokenListo = new Promise((r) => (resolverToken = r));

function alEvento(evento, args) {
  if (evento === "extension.accessToken") {
    ctx.token = args.data;
    resolverToken(args.data);
  }
  (oyentes[evento] || []).forEach((fn) => fn(args?.data));
}

// La librería de Trimble deja un solo oyente de eventos activo: el de la última conexión.
// Por eso los visores embebidos se conectan con esta función, que reenvía todo al oyente
// principal; si no, al abrir un modelo embebido la extensión deja de recibir los clics del menú.
export function conectarEmbebido(iframe, alEventoVisor) {
  return TrimbleConnectWorkspace.connect(iframe, (evento, args) => {
    alEvento(evento, args);
    if (alEventoVisor) alEventoVisor(evento, args);
  }, 30000);
}

export async function conectar() {
  if (window.self === window.top) {
    throw new Error("FUERA_DE_TRIMBLE");
  }
  ctx.api = await TrimbleConnectWorkspace.connect(window.parent, alEvento, 30000);

  // La primera vez Trimble pide autorización al usuario y responde "pending";
  // el token llega después por el evento extension.accessToken.
  const respuesta = await ctx.api.extension.requestPermission("accesstoken");
  if (respuesta === "denied") throw new Error("PERMISO_DENEGADO");
  // Solo se toma como token si tiene forma de JWT; otro texto es el estado de la solicitud de permiso.
  if (typeof respuesta === "string" && respuesta.split(".").length === 3) {
    ctx.token = respuesta;
    resolverToken(respuesta);
  }
  await tokenListo;

  ctx.proyecto = await ctx.api.project.getProject();
  ctx.usuario = await ctx.api.user.getUser();
  ctx.host = await resolverHost(ctx.proyecto.location);
  return ctx;
}

async function resolverHost(location) {
  const clave = String(location || "").toLowerCase().replace(/[\s_-]/g, "");
  try {
    const r = await fetch(`${HOSTS_POR_REGION.northamerica}/regions`);
    if (r.ok) {
      const regiones = await r.json();
      const reg = regiones.find((x) => String(x.location || "").toLowerCase().replace(/[\s_-]/g, "") === clave);
      const url = reg && (reg["tc-api"] || reg.tcApi);
      if (url) return url.replace(/\/$/, "");
    }
  } catch (_) { // se usa la tabla fija
  }
  return HOSTS_POR_REGION[clave] || HOSTS_POR_REGION.northamerica;
}

export async function tc(ruta) {
  const r = await fetch(`${ctx.host}${ruta}`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
  });
  if (!r.ok) throw new Error(`Trimble respondió ${r.status} en ${ruta}`);
  return r.json();
}

export const trimble = {
  carpetaRaiz: async () => (await tc(`/projects/${ctx.proyecto.id}`)).rootId,
  contenido: (carpetaId) => tc(`/folders/${carpetaId}/items`),
  usuarios: () => tc(`/projects/${ctx.proyecto.id}/users`),
  // URL temporal de descarga de un archivo (se prueban las dos rutas que ha usado Trimble)
  async urlDescarga(fileId) {
    for (const ruta of [`/files/fs/${fileId}/downloadurl`, `/files/${fileId}/downloadurl`]) {
      try {
        const r = await tc(ruta);
        const url = r.url || r.downloadUrl || r.downloadURL;
        if (url) return url;
      } catch (_) { // se intenta la siguiente
      }
    }
    throw new Error("Trimble no entregó el enlace de descarga de la foto");
  },
};

export function nombreUsuario(u) {
  if (!u) return "";
  const n = `${u.firstName || ""} ${u.lastName || ""}`.trim();
  return n || u.email;
}
