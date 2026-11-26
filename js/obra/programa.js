// Programación de obra: lectura del XML de MS Project, reglas actividad → elementos del modelo
// (por nivel y categoría) y curvas de avance programado (línea base) contra ejecución real.
// Todo lo de este archivo es cálculo; la interfaz está en programa-ui.js.

const DIA = 86400000;
const aFecha = (d) => Date.parse(d + "T00:00:00Z");

// ------------------------------------------------------------------ XML de Project (MSPDI)

const hijo = (nodo, nombre) => {
  for (const n of nodo.children) if (n.localName === nombre) return n;
  return null;
};
const texto = (nodo, nombre) => (hijo(nodo, nombre)?.textContent || "").trim();
const soloFecha = (v) => (/^\d{4}-\d{2}-\d{2}/.test(v || "") ? v.slice(0, 10) : null);

export function leerXmlProject(contenido) {
  const doc = new DOMParser().parseFromString(contenido, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("El archivo no es un XML válido");
  const raiz = doc.documentElement;
  if (!raiz || raiz.localName !== "Project") throw new Error("No parece un XML exportado de MS Project (Archivo > Guardar como > XML)");
  const nodosTareas = hijo(raiz, "Tasks");
  if (!nodosTareas) throw new Error("El XML no trae actividades");
  const tareas = [];
  for (const t of nodosTareas.children) {
    if (t.localName !== "Task") continue;
    const uid = texto(t, "UID");
    const nombre = texto(t, "Name");
    if (!uid || uid === "0" || !nombre) continue; // la tarea 0 es el resumen del proyecto
    let base = null;
    for (const b of t.children) {
      if (b.localName === "Baseline" && texto(b, "Number") === "0") { base = b; break; }
    }
    tareas.push({
      uid, id: texto(t, "ID"), wbs: texto(t, "WBS") || texto(t, "OutlineNumber"),
      nombre, nivel_esquema: Number(texto(t, "OutlineLevel")) || 1, resumen: texto(t, "Summary") === "1",
      inicio: soloFecha(texto(t, "Start")), fin: soloFecha(texto(t, "Finish")),
      base_inicio: base ? soloFecha(texto(base, "Start")) : null, base_fin: base ? soloFecha(texto(base, "Finish")) : null,
      pct: Number(texto(t, "PercentComplete")) || 0,
    });
  }
  if (!tareas.length) throw new Error("El XML no trae actividades");
  return { nombre: texto(raiz, "Title") || texto(raiz, "Name"), tareas };
}

// Ruta de resúmenes de cada actividad ("TORRE 1 › PISO 3"), según el nivel de esquema.
export function rutas(tareas) {
  const pila = [];
  const salida = new Map();
  for (const t of tareas) {
    pila.length = Math.max(0, t.nivel_esquema - 1);
    salida.set(t.uid, pila.filter(Boolean).join(" › "));
    pila[t.nivel_esquema - 1] = t.nombre;
  }
  return salida;
}

// ------------------------------------------------------------------ sugerencia de reglas

const normal = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Palabras de la actividad → fragmentos que se buscan en la categoría del elemento (Revit o IFC).
const CATEGORIAS = [
  [/placa|losa|entrepiso|contrapiso/, ["floor", "suelo", "losa", "placa", "slab"]],
  [/column/, ["column", "columna"]],
  [/viga/, ["beam", "viga", "framing", "armazon"]],
  [/pantalla|muro de contencion|muros de contencion|muro en concreto/, ["wall", "muro"]],
  [/mamposter|muro|bloque|ladrillo/, ["wall", "muro", "mamposter"]],
  [/escalera|rampa/, ["stair", "escalera", "ramp"]],
  [/ciment|zapata|dado|pilote|cabezal/, ["foundation", "cimentacion", "footing", "zapata", "pile"]],
  [/cubierta|techo/, ["roof", "cubierta"]],
  [/ventan|aluminio|vidrio/, ["window", "ventana"]],
  [/puerta/, ["door", "puerta"]],
  [/baranda/, ["railing", "baranda"]],
  [/mueble|cocina integral|closet/, ["casework", "mueble", "furniture"]],
  [/enchape|piso ceramic|porcelanato/, ["floor", "suelo"]],
];

// Número de piso que menciona un texto: "piso 3", "nivel 3", "p3", "3er piso".
function numeroPiso(t) {
  const m = t.match(/\b(?:piso|nivel|niv|planta|p|n)\s*\.?\s*(\d{1,2})\b/) || t.match(/\b(\d{1,2})\s*(?:er|do|ro|to|vo|no|mo)?\s*(?:piso|nivel)\b/);
  return m ? Number(m[1]) : null;
}

function nivelesQueCoinciden(textoTarea, niveles) {
  const t = normal(textoTarea);
  const n = numeroPiso(t);
  const especiales = [["sotano", /sotano|semisotano/], ["cubierta", /cubierta|terraza|azotea/], ["ciment", /ciment|fundaci/]];
  return niveles.filter((nv) => {
    const x = normal(nv);
    if (n != null) {
      const m = numeroPiso(x) ?? Number((x.match(/(\d{1,2})(?!.*\d)/) || [])[1]);
      if (m === n) return true;
    }
    return especiales.some(([clave, re]) => re.test(t) && x.includes(clave));
  });
}

export function sugerirRegla(tarea, ruta, inventario) {
  const textoTarea = `${ruta} ${tarea.nombre}`;
  const nombre = normal(tarea.nombre);
  const niveles = [...new Set(inventario.map((f) => f.nivel).filter(Boolean))];
  const categorias = [...new Set(inventario.map((f) => f.categoria).filter(Boolean))];
  const fragmentos = CATEGORIAS.filter(([re]) => re.test(nombre)).flatMap(([, f]) => f);
  if (!fragmentos.length) return null;
  const cats = categorias.filter((c) => fragmentos.some((f) => normal(c).includes(f)));
  if (!cats.length) return null;
  const nivs = nivelesQueCoinciden(textoTarea, niveles);
  // Sin piso en el nombre se toma todo el modelo solo si la actividad no habla de un piso concreto
  if (!nivs.length && numeroPiso(normal(textoTarea)) != null) return null;
  return { niveles: nivs, categorias: cats };
}

// ------------------------------------------------------------------ curvas

const coincide = (regla, e) =>
  (!regla.niveles?.length || regla.niveles.includes(e.nivel || "")) &&
  (!regla.categorias?.length || regla.categorias.includes(e.categoria || ""));

export function cantidadTarea(regla, inventario) {
  return inventario.filter((f) => coincide(regla, f)).reduce((a, f) => a + f.cantidad, 0);
}

// Fracción programada de una actividad en la fecha t (lineal entre inicio y fin de la línea base).
function fraccion(ini, fin, t) {
  if (!ini || !fin) return 0;
  const a = aFecha(ini), b = aFecha(fin) + DIA;
  if (t >= b) return 1;
  if (t <= a) return 0;
  return (t - a) / (b - a);
}

// Prepara lo necesario para calcular, en cualquier fecha, cuánto debía ir y cuánto va cada actividad.
export function prepararComparacion(programa, inventario, elementosReales) {
  if (!programa || !inventario?.length) return null;
  const reglas = programa.reglas || {};
  const ruta = rutas(programa.tareas);
  const actividades = [];
  let sinLineaBase = 0;
  for (const t of programa.tareas) {
    const regla = reglas[t.uid];
    if (t.resumen || !regla) continue;
    const cantidad = cantidadTarea(regla, inventario);
    if (!cantidad) continue;
    const ini = t.base_inicio || t.inicio, fin = t.base_fin || t.fin;
    if (!t.base_fin) sinLineaBase++;
    const ejecutados = elementosReales.filter((e) => e.fin && coincide(regla, e)).map((e) => aFecha(e.fin)).sort((a, b) => a - b);
    actividades.push({ ...t, ruta: ruta.get(t.uid), regla, cantidad, ini, finBase: fin, ejecutados });
  }
  if (!actividades.length) return null;
  const total = actividades.reduce((a, x) => a + x.cantidad, 0);
  const fechas = actividades.flatMap((a) => [a.ini, a.finBase]).filter(Boolean).map(aFecha);
  return {
    actividades, total, sinLineaBase,
    desde: Math.min(...fechas), hasta: Math.max(...fechas),
    programado: (t) => actividades.reduce((s, a) => s + a.cantidad * fraccion(a.ini, a.finBase, t), 0),
    real: (t) => actividades.reduce((s, a) => s + Math.min(a.cantidad, contarHasta(a.ejecutados, t)), 0),
  };
}

function contarHasta(ordenadas, t) {
  let n = 0;
  while (n < ordenadas.length && ordenadas[n] <= t) n++;
  return n;
}

// Estado de cada actividad en la fecha t, ordenado por las más atrasadas.
export function estadoActividades(cmp, t) {
  return cmp.actividades.map((a) => {
    const prog = Math.round(fraccion(a.ini, a.finBase, t) * 100);
    const real = Math.round((Math.min(a.cantidad, contarHasta(a.ejecutados, t)) / a.cantidad) * 100);
    return { ...a, prog, realPct: real, desfase: real - prog };
  }).sort((x, y) => x.desfase - y.desfase);
}
