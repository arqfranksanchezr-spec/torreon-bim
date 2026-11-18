// Visor 3D de Trimble embebido dentro de una pestaña del proyecto.
import { ctx, conectarEmbebido } from "../trimble.js";

export async function abrirVisor(contenedor, modeloId, alSeleccionar) {
  const iframe = document.createElement("iframe");
  iframe.className = "seg-iframe";
  const cargado = new Promise((ok) => (iframe.onload = ok));
  iframe.src = TrimbleConnectWorkspace.getConnectEmbedUrl();
  contenedor.innerHTML = "";
  contenedor.appendChild(iframe);
  await cargado;
  const api = await conectarEmbebido(iframe, (evento, args) => {
    if (evento === "viewer.onSelectionChanged" && alSeleccionar) alSeleccionar(args && args.data);
  });
  await api.embed.setTokens({ accessToken: ctx.token });
  await api.embed.init3DViewer({ projectId: ctx.proyecto.id, modelId: modeloId });
  const limite = Date.now() + 90000;
  let cargados = [];
  while (Date.now() < limite) {
    cargados = await api.viewer.getModels("loaded").catch(() => []);
    if (cargados.length) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!cargados.length) throw new Error("el modelo no terminó de cargar");
  for (const [name, state] of [["SidePanel", "collapsed"], ["MainToolbar", "hidden"], ["DetailsPanel", "hidden"]]) {
    try { await api.ui.setUI({ name, state }); } catch (_) { // si la versión de Trimble no lo permite, se deja como está
    }
  }
  return { api, modelo: cargados[0] };
}

// Busca en el modelo las habitaciones/áreas (una por apartamento) y lee número, nivel y torre.
const CLASES = ["IfcSpace", "Rooms", "Room", "Habitaciones", "Areas", "IfcZone"];
const CAMPOS = {
  apto: ["number", "numero", "número", "room number", "numero de habitacion", "número de habitación", "apto", "apartamento", "unidad", "name", "nombre"],
  nivel: ["level", "nivel", "building storey", "storey", "reference level", "nivel de referencia"],
  torre: ["torre", "tower", "bloque", "edificio", "block"],
};
const sinTildes = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function leer(obj, lista) {
  const buscados = lista.map(sinTildes);
  for (const set of obj.properties || []) {
    for (const p of set.properties || []) {
      if (buscados.includes(sinTildes(p.name)) && p.value !== "" && p.value != null) return String(p.value).trim();
    }
  }
  return "";
}

export async function buscarApartamentos(api, modelo) {
  const v = api.viewer;
  let ids = [];
  let clase = "";
  for (const c of CLASES) {
    const r = await v.getObjects({ parameter: { class: c } }).catch(() => []);
    const propios = r.filter((g) => g.modelId === modelo.id).flatMap((g) => g.objects.map((o) => o.id));
    if (propios.length) { ids = propios; clase = c; break; }
  }
  if (!ids.length) return { clase: "", encontrados: [] };
  const torreModelo = (String(modelo.name || "").match(/(?:^|[^A-Z0-9])T(?:ORRE)?[\s_-]*(\d+)/i) || [])[1];
  const encontrados = [];
  for (let i = 0; i < ids.length; i += 200) {
    const parte = ids.slice(i, i + 200);
    const [props, externos] = await Promise.all([v.getObjectProperties(modelo.id, parte), v.convertToObjectIds(modelo.id, parte)]);
    parte.forEach((rt, j) => {
      const o = props.find((p) => p.id === rt) || { properties: [] };
      const apto = leer(o, CAMPOS.apto) || (o.product && o.product.name) || "";
      if (!apto || !externos[j]) return;
      encontrados.push({
        apto,
        nivel: leer(o, CAMPOS.nivel),
        torre: leer(o, CAMPOS.torre) || (torreModelo ? `T${torreModelo}` : ""),
        modelo_id: modelo.id,
        object_id: externos[j],
        runtime_id: rt,
      });
    });
  }
  return { clase, encontrados };
}
