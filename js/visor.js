// Panel de Control de Obra dentro del visor 3D de Trimble Connect.
import { conectar, escuchar, ctx } from "./trimble.js";
import { obra } from "./backend.js";
import { LISTAS, sugerirLista } from "./obra/listas.js";
import { leerSeleccion, colorear, comprimirFoto, COLORES, claveColor } from "./obra/modelo.js";

const MAX_FOTOS = 8;
const raiz = document.getElementById("contenido");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fecha = (iso) => new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const st = {
  elementos: [], sinId: 0, recortados: 0, leyendo: false,
  estado: null, lista: null, listaManual: false, resultados: {}, observaciones: "", fotos: [],
  modoColor: null, guardando: false, historial: null,
};

// ------------------------------------------------------------------ arranque

async function iniciar() {
  try {
    await conectar();
  } catch (e) {
    raiz.innerHTML = `<div class="aviso">${e.message === "FUERA_DE_TRIMBLE"
      ? "Este panel funciona dentro del visor 3D de Trimble Connect."
      : "No fue posible conectar con Trimble Connect: " + esc(e.message)}</div>`;
    return;
  }
  let espera;
  escuchar("viewer.onSelectionChanged", (sel) => {
    clearTimeout(espera);
    espera = setTimeout(() => cargarSeleccion(sel), 250);
  });
  pintar();
  cargarSeleccion(await ctx.api.viewer.getSelection().catch(() => []));
}

async function cargarSeleccion(sel) {
  st.leyendo = true; st.historial = null; pintar();
  try {
    const r = await leerSeleccion(sel);
    Object.assign(st, { elementos: r.elementos, sinId: r.sinId, recortados: r.recortados });
    if (!st.listaManual) cambiarLista(sugerirLista(r.elementos.map((e) => `${e.categoria} ${e.clase}`)));
    if (r.elementos.length === 1) cargarHistorial(r.elementos[0]);
  } catch (e) {
    aviso(`No se pudo leer la selección: ${e.message}`, "error");
    st.elementos = [];
  }
  st.leyendo = false;
  pintar();
}

async function cargarHistorial(el) {
  try {
    const r = await obra("historial_elemento", { modeloId: el.modelo_id, objectId: el.object_id });
    if (st.elementos.length === 1 && st.elementos[0].object_id === el.object_id) { st.historial = r.revisiones; pintar(); }
  } catch (_) { // el historial es informativo
  }
}

function cambiarLista(lista) {
  if (st.lista && lista && st.lista.nombre === lista.nombre) return;
  st.lista = lista;
  st.resultados = {};
}

// ------------------------------------------------------------------ pintar

function pintar() {
  const n = st.elementos.length;
  const agrupado = {};
  st.elementos.forEach((e) => {
    const k = `${e.categoria || "Sin categoría"}|${e.nivel || "Sin nivel"}`;
    agrupado[k] = (agrupado[k] || 0) + 1;
  });

  raiz.innerHTML = `
    <header class="v-cab"><h1>Control de Obra</h1></header>

    <section class="v-bloque">
      <div class="v-etiqueta">Colorear el modelo</div>
      <div class="segmentos">
        <button data-color="estado" class="${st.modoColor === "estado" ? "activo" : ""}">Avance</button>
        <button data-color="conformidad" class="${st.modoColor === "conformidad" ? "activo" : ""}">Conformidad</button>
        <button data-color="" class="${!st.modoColor ? "activo" : ""}">Sin color</button>
      </div>
      ${st.modoColor ? `<div class="leyenda">${Object.values(COLORES[st.modoColor]).map((c) =>
        `<span><i style="background:${c.color}"></i>${c.texto}</span>`).join("")}</div>` : ""}
    </section>

    <section class="v-bloque">
      <div class="v-etiqueta">Elementos seleccionados</div>
      ${st.leyendo ? `<p class="tenue">Leyendo la selección…</p>`
        : n === 0 ? `<p class="tenue">Selecciona uno o varios elementos en el modelo. Con Ctrl o arrastrando puedes tomar varios a la vez, por ejemplo todas las columnas de un piso.</p>`
        : `<p class="v-total">${n} ${n === 1 ? "elemento" : "elementos"}</p>
           ${n === 1 ? `<p><b>${esc(st.elementos[0].nombre)}</b></p>` : ""}
           <ul class="v-grupos">${Object.entries(agrupado).map(([k, c]) => {
             const [cat, niv] = k.split("|");
             return `<li><span>${esc(cat)} · ${esc(niv)}</span><b>${c}</b></li>`;
           }).join("")}</ul>`}
      ${st.sinId ? `<p class="aviso">${st.sinId} elementos no tienen identificador permanente en el modelo y no se incluirán.</p>` : ""}
      ${st.recortados ? `<p class="aviso">La selección pasa de 2000 elementos; se tomaron los primeros 2000.</p>` : ""}
    </section>

    ${n === 1 && st.historial ? pintarHistorial() : ""}

    ${n > 0 && !st.leyendo ? pintarFormulario() : ""}
  `;
  enlazar();
}

function pintarHistorial() {
  if (!st.historial.length) return `<section class="v-bloque"><div class="v-etiqueta">Historial del elemento</div><p class="tenue">Sin revisiones anteriores.</p></section>`;
  return `<section class="v-bloque"><div class="v-etiqueta">Historial del elemento</div>
    <ol class="historial">${st.historial.slice(0, 6).map((r) => {
      const k = claveColor("conformidad", r);
      return `<li><small class="tenue">${fecha(r.creado_en)} · ${esc(r.autor_nombre)} · REV-${r.numero}</small><br>
        ${esc(COLORES.estado[r.estado].texto)} · <span style="color:${COLORES.conformidad[k].color}">${esc(COLORES.conformidad[k].texto)}</span>
        ${r.observaciones ? `<br><small>${esc(r.observaciones)}</small>` : ""}</li>`;
    }).join("")}</ol></section>`;
}

function pintarFormulario() {
  const estados = Object.entries(COLORES.estado);
  return `
    <section class="v-bloque">
      <div class="v-etiqueta">Estado de ejecución</div>
      <div class="segmentos grande">${estados.map(([k, c]) =>
        `<button data-estado="${k}" class="${st.estado === k ? "activo" : ""}" style="--c:${c.color}">${c.texto}</button>`).join("")}
      </div>
    </section>

    <section class="v-bloque">
      <div class="v-etiqueta">Lista de chequeo</div>
      <select id="v-lista">${LISTAS.map((l) => `<option ${st.lista && st.lista.nombre === l.nombre ? "selected" : ""}>${esc(l.nombre)}</option>`).join("")}
        <option value="" ${!st.lista ? "selected" : ""}>Sin lista (solo avance)</option>
      </select>
      ${st.lista ? `<div class="chequeo">${st.lista.items.map((it, i) => `
        <div class="item-chequeo">
          <span>${esc(it)}</span>
          <div class="trio" data-item="${i}">
            ${["C", "NC", "NA"].map((r) => `<button data-r="${r}" class="${st.resultados[i] === r ? "activo r-" + r : ""}">${r === "NA" ? "N/A" : r}</button>`).join("")}
          </div>
        </div>`).join("")}
        <button class="btn enlace" id="v-todo-c">Marcar todo conforme</button>
      </div>` : ""}
    </section>

    <section class="v-bloque">
      <div class="v-etiqueta">Observaciones</div>
      <textarea id="v-obs" rows="3" placeholder="Qué se encontró en obra. Obligatorio si hay no conformidades.">${esc(st.observaciones)}</textarea>
    </section>

    <section class="v-bloque">
      <div class="v-etiqueta">Fotos <small class="tenue">${st.fotos.length}/${MAX_FOTOS}</small></div>
      <div class="fotos">
        ${st.fotos.map((f, i) => `<div class="foto"><img src="${f.base64}" alt=""><button data-quitar-foto="${i}" title="Quitar">×</button></div>`).join("")}
        ${st.fotos.length < MAX_FOTOS ? `<label class="foto agregar">+<input type="file" accept="image/*" capture="environment" multiple id="v-fotos" hidden></label>` : ""}
      </div>
    </section>

    <button class="btn primario v-guardar" id="v-guardar" ${st.guardando ? "disabled" : ""}>
      ${st.guardando ? "Guardando…" : `Guardar revisión de ${st.elementos.length} ${st.elementos.length === 1 ? "elemento" : "elementos"}`}
    </button>`;
}

// ------------------------------------------------------------------ eventos

function enlazar() {
  raiz.querySelectorAll("[data-color]").forEach((b) => (b.onclick = () => aplicarColor(b.dataset.color || null)));
  raiz.querySelectorAll("[data-estado]").forEach((b) => (b.onclick = () => { st.estado = b.dataset.estado; pintar(); }));
  const sel = raiz.querySelector("#v-lista");
  if (sel) sel.onchange = () => {
    st.listaManual = true;
    cambiarLista(LISTAS.find((l) => l.nombre === sel.value) || null);
    pintar();
  };
  raiz.querySelectorAll(".trio").forEach((t) => t.querySelectorAll("button").forEach((b) => (b.onclick = () => {
    const i = t.dataset.item;
    st.resultados[i] = st.resultados[i] === b.dataset.r ? undefined : b.dataset.r;
    pintar();
  })));
  const todo = raiz.querySelector("#v-todo-c");
  if (todo) todo.onclick = () => { st.lista.items.forEach((_, i) => (st.resultados[i] = "C")); pintar(); };
  const obs = raiz.querySelector("#v-obs");
  if (obs) obs.oninput = () => (st.observaciones = obs.value);
  const fotos = raiz.querySelector("#v-fotos");
  if (fotos) fotos.onchange = () => agregarFotos([...fotos.files]);
  raiz.querySelectorAll("[data-quitar-foto]").forEach((b) => (b.onclick = () => { st.fotos.splice(+b.dataset.quitarFoto, 1); pintar(); }));
  const g = raiz.querySelector("#v-guardar");
  if (g) g.onclick = guardar;
}

async function agregarFotos(archivos) {
  for (const f of archivos.slice(0, MAX_FOTOS - st.fotos.length)) {
    try { st.fotos.push({ nombre: f.name, tipo: "image/jpeg", base64: await comprimirFoto(f) }); }
    catch (_) { aviso(`No se pudo leer la imagen ${f.name}`, "error"); }
  }
  pintar();
}

async function aplicarColor(modo) {
  st.modoColor = modo;
  pintar();
  try {
    const r = await colorear(modo, async (modeloIds) => (await obra("estado_modelos", { modeloIds })).elementos);
    if (modo) aviso(r.pintados ? `${r.pintados} elementos coloreados.` : "Todavía no hay revisiones en los modelos cargados.");
  } catch (e) {
    aviso(`No se pudo colorear: ${e.message}`, "error");
  }
}

async function guardar() {
  if (!st.estado) return aviso("Indica el estado de ejecución.", "error");
  const resultados = st.lista ? st.lista.items.map((item, i) => ({ item, resultado: st.resultados[i] })).filter((r) => r.resultado) : [];
  if (resultados.some((r) => r.resultado === "NC") && !st.observaciones.trim()) {
    return aviso("Hay no conformidades: describe en observaciones qué se encontró.", "error");
  }
  // Una revisión por modelo (la selección puede tomar elementos de varios modelos cargados)
  const porModelo = {};
  st.elementos.forEach((e) => (porModelo[e.modelo_id] ||= []).push(e));

  st.guardando = true; pintar();
  try {
    let fotosPendientes = st.fotos;
    const fallidas = [];
    for (const lista of Object.values(porModelo)) {
      const m = lista[0];
      const r = await obra("guardar_revision", {
        modelo: { id: m.modelo_id, version: m.modelo_version, nombre: m.modelo_nombre },
        elementos: lista.map((e) => ({ object_id: e.object_id, nombre: e.nombre, categoria: e.categoria, nivel: e.nivel })),
        estado: st.estado,
        lista: st.lista ? st.lista.nombre : null,
        resultados,
        observaciones: st.observaciones,
        fotos: fotosPendientes.map(({ nombre, tipo, base64 }) => ({ nombre, tipo, base64 })),
      });
      fallidas.push(...r.fotos_fallidas);
      fotosPendientes = []; // las fotos se suben con la primera revisión
    }
    aviso(fallidas.length
      ? `Revisión guardada, pero no subieron ${fallidas.length} fotos (${fallidas.join(", ")}). Revisa permisos de la carpeta en Trimble.`
      : "Revisión guardada.", fallidas.length ? "error" : "info");
    Object.assign(st, { estado: null, resultados: {}, observaciones: "", fotos: [] });
    if (st.modoColor) aplicarColor(st.modoColor);
    if (st.elementos.length === 1) cargarHistorial(st.elementos[0]);
  } catch (e) {
    aviso(e.message, "error");
  }
  st.guardando = false;
  pintar();
}

function aviso(texto, tipo = "info") {
  const caja = document.getElementById("v-avisos");
  if (!caja) return;
  const d = document.createElement("div");
  d.className = `aviso ${tipo}`;
  d.textContent = texto;
  caja.prepend(d);
  while (caja.children.length > 2) caja.lastChild.remove();
  setTimeout(() => d.remove(), 7000);
}

iniciar();
