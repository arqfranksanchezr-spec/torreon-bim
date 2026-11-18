// Lectura de elementos del modelo cargado en el visor 3D y coloreado por estado.
import { ctx } from "../trimble.js";

const CANDIDATOS = {
  categoria: ["category", "categoría", "categoria", "revit category"],
  nivel: ["level", "nivel", "reference level", "nivel de referencia", "base constraint", "restricción de base",
    "restriccion de base", "schedule level", "nivel de planificación", "building storey", "buildingstorey", "storey"],
  nombre: ["family and type", "familia y tipo", "type name", "nombre de tipo", "type", "tipo", "name", "nombre"],
  marca: ["mark", "marca"],
};

function buscar(obj, lista) {
  for (const set of obj.properties || []) {
    for (const p of set.properties || []) {
      if (lista.includes(String(p.name).trim().toLowerCase()) && p.value !== "" && p.value != null) return String(p.value);
    }
  }
  return "";
}

export function describir(obj) {
  const categoria = buscar(obj, CANDIDATOS.categoria) || (obj.class || "").replace(/^Ifc/, "");
  const marca = buscar(obj, CANDIDATOS.marca);
  const nombre = (obj.product && obj.product.name) || buscar(obj, CANDIDATOS.nombre) || categoria || `Elemento ${obj.id}`;
  return {
    categoria,
    nivel: buscar(obj, CANDIDATOS.nivel),
    nombre: marca ? `${nombre} (${marca})` : nombre,
    clase: obj.class || "",
  };
}

const trozos = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// Convierte la selección del visor en una lista de elementos con id externo, nombre, categoría y nivel.
export async function leerSeleccion(seleccion, limite = 2000) {
  const v = ctx.api.viewer;
  const modelos = await v.getModels("loaded").catch(() => []);
  const elementos = [];
  let sinId = 0;
  for (const grupo of seleccion || []) {
    const ids = (grupo.objectRuntimeIds || []).slice(0, Math.max(0, limite - elementos.length));
    if (!ids.length) continue;
    const spec = modelos.find((m) => m.id === grupo.modelId || m.versionId === grupo.modelId);
    for (const parte of trozos(ids, 200)) {
      const [props, externos] = await Promise.all([
        v.getObjectProperties(grupo.modelId, parte),
        convertirSeguro(grupo.modelId, parte),
      ]);
      parte.forEach((rt, i) => {
        if (!externos[i]) { sinId++; return; }
        const obj = props.find((p) => p.id === rt) || { id: rt };
        elementos.push({
          modelo_id: spec ? spec.id : grupo.modelId,
          modelo_version: spec ? spec.versionId : "",
          modelo_nombre: spec ? spec.name : "",
          visor_modelo_id: grupo.modelId,
          runtime_id: rt,
          object_id: externos[i],
          ...describir(obj),
        });
      });
    }
  }
  const total = (seleccion || []).reduce((s, g) => s + (g.objectRuntimeIds || []).length, 0);
  return { elementos, sinId, recortados: Math.max(0, total - limite) };
}

async function convertirSeguro(modelId, runtimeIds) {
  try {
    return await ctx.api.viewer.convertToObjectIds(modelId, runtimeIds);
  } catch (_) {
    // Si un elemento no tiene id externo la llamada completa falla; se reintenta uno por uno.
    const salida = [];
    for (const id of runtimeIds) {
      try { salida.push((await ctx.api.viewer.convertToObjectIds(modelId, [id]))[0]); }
      catch (__) { salida.push(null); }
    }
    return salida;
  }
}

export const COLORES = {
  estado: {
    no_iniciado: { color: "#9AA0A6", texto: "No iniciado" },
    en_ejecucion: { color: "#F2A93B", texto: "En ejecución" },
    ejecutado: { color: "#2E9E5B", texto: "Ejecutado" },
  },
  conformidad: {
    conforme: { color: "#2E9E5B", texto: "Conforme" },
    no_conforme: { color: "#D93025", texto: "No conforme abierta" },
    corregido: { color: "#1E88E5", texto: "No conformidad cerrada" },
    sin_chequeo: { color: "#9AA0A6", texto: "Sin lista de chequeo" },
  },
};

export function claveColor(modo, e) {
  if (modo === "estado") return e.estado;
  if (e.conformidad === "no_conforme") return e.nc_cerrada ? "corregido" : "no_conforme";
  return e.conformidad;
}

// Pinta los modelos cargados según la última revisión de cada elemento.
// pedirEstados recibe la lista de ids de modelo y devuelve [{modelo_id, object_id, estado, conformidad, nc_cerrada}]
export async function colorear(modo, pedirEstados) {
  const v = ctx.api.viewer;
  await v.setObjectState(undefined, { color: "reset" });
  if (!modo) return { pintados: 0 };
  const modelos = await v.getModels("loaded");
  if (!modelos.length) return { pintados: 0 };
  const estados = await pedirEstados(modelos.map((m) => m.id));
  let pintados = 0;
  for (const m of modelos) {
    const propios = estados.filter((e) => e.modelo_id === m.id);
    if (!propios.length) continue;
    const porColor = {};
    for (const parte of trozos(propios, 5000)) {
      const rts = await v.convertToObjectRuntimeIds(m.id, parte.map((e) => e.object_id));
      parte.forEach((e, i) => {
        if (rts[i] == null) return;
        const k = claveColor(modo, e);
        (porColor[k] ||= []).push(rts[i]);
      });
    }
    for (const [k, ids] of Object.entries(porColor)) {
      await v.setObjectState({ modelObjectIds: [{ modelId: m.id, objectRuntimeIds: ids }] }, { color: COLORES[modo][k].color });
      pintados += ids.length;
    }
  }
  return { pintados };
}

// Reduce una foto a 1600 px de lado mayor en JPEG para que suba rápido desde la obra.
export async function comprimirFoto(file, lado = 1600, calidad = 0.75) {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", calidad);
}
