// Pestaña L.A. dentro del panel del visor 3D: estado comercial y de entrega de cada
// apartamento, con listas de chequeo como las de Control de Obra.
import { ctx, escuchar } from "../trimble.js";
import { backend } from "../backend.js";
import { ESTADOS, DISPONIBLE, etapa, piso } from "./reglas.js";
import { LISTAS_LA } from "./listas.js";
import { leerSeleccion, comprimirFoto, hoyLocal } from "../obra/modelo.js";

const MAX_FOTOS = 8;
const la = (accion, datos) => backend(accion, datos, "la");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fecha = (iso) => new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const porNumero = (a, b) => String(a).localeCompare(String(b), "es", { numeric: true });

const st = {
  activo: false, cargado: false, unidades: [], torre: "", id: null,
  sel: null, // único elemento seleccionado en el modelo, para vincular
  lista: null, listaManual: false, resultados: {}, observaciones: "", fotos: [], marcar: false,
  historial: null, color: false, guardando: false,
};
let raiz, aviso;

export function montar(el, fnAviso) {
  raiz = el;
  aviso = fnAviso;
  let espera;
  escuchar("viewer.onSelectionChanged", (sel) => {
    if (!st.activo) return;
    clearTimeout(espera);
    espera = setTimeout(() => alSeleccionar(sel), 250);
  });
}

export async function activar() {
  st.activo = true;
  if (!st.cargado) {
    raiz.innerHTML = `<p class="tenue">Cargando apartamentos…</p>`;
    await recargar();
  }
  pintar();
  alSeleccionar(await ctx.api.viewer.getSelection().catch(() => []));
}

export function desactivar() { st.activo = false; }

const unidad = () => st.unidades.find((u) => u.id === st.id) || null;
const torres = () => [...new Set(st.unidades.map((u) => u.torre))].sort(porNumero);

async function recargar() {
  try {
    st.unidades = (await la("resumen")).unidades;
    st.cargado = true;
  } catch (e) {
    aviso(e.message, "error");
  }
  if (!torres().includes(st.torre)) st.torre = torres()[0] || "";
}

// La lista sugerida es la del estado que sigue (si va en Escriturada, la de Liberación por Calidad).
function listaSugerida(u) {
  const i = ESTADOS.indexOf(etapa(u)) + 1;
  const k = ESTADOS[Math.min(i, ESTADOS.length - 1)].k;
  return LISTAS_LA.find((l) => l.estado === k) || null;
}

function elegir(id) {
  if (st.id === id) return;
  st.id = id;
  const u = unidad();
  if (u) st.torre = u.torre;
  Object.assign(st, { resultados: {}, observaciones: "", fotos: [], marcar: false, historial: null, listaManual: false });
  st.lista = u ? listaSugerida(u) : null;
  if (u) cargarHistorial(u.id);
}

async function cargarHistorial(id) {
  try {
    const { eventos } = await la("historial", { unidadId: id });
    if (st.id === id) { st.historial = eventos; pintar(); }
  } catch (_) { // el historial es informativo
  }
}

async function alSeleccionar(sel) {
  if (!st.activo) return;
  try {
    const r = await leerSeleccion(sel, 1);
    st.sel = r.elementos[0] || null;
  } catch (_) { st.sel = null; }
  if (st.sel) {
    const u = st.unidades.find((x) => x.object_id === st.sel.object_id && x.modelo_id === st.sel.modelo_id);
    if (u) elegir(u.id);
  }
  pintar();
}

// ------------------------------------------------------------------ pintar

function pintar() {
  if (!st.activo) return;
  const u = unidad();
  const propias = st.unidades.filter((x) => x.torre === st.torre).sort((a, b) => piso(a) - piso(b) || porNumero(a.apto, b.apto));
  raiz.innerHTML = `
    <section class="v-bloque">
      <div class="v-etiqueta">Colorear el modelo</div>
      <div class="segmentos">
        <button data-lacolor="1" class="${st.color ? "activo" : ""}">Por estado</button>
        <button data-lacolor="" class="${!st.color ? "activo" : ""}">Sin color</button>
      </div>
      ${st.color ? `<div class="leyenda">${[DISPONIBLE, ...ESTADOS].map((e) => `<span><i style="background:${e.color}"></i>${esc(e.nombre)}</span>`).join("")}</div>` : ""}
    </section>

    <section class="v-bloque">
      <div class="v-etiqueta">Apartamento</div>
      ${!st.unidades.length
        ? `<p class="tenue">Todavía no hay apartamentos en L.A. Cárgalos con el Excel desde la pestaña L.A. del proyecto, o vincúlalos desde el modelo.</p>`
        : `<div class="la-v-fila">
            <select id="la-torre">${torres().map((t) => `<option ${t === st.torre ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
            <select id="la-apto"><option value="">Elige el apartamento…</option>${propias.map((x) =>
              `<option value="${x.id}" ${x.id === st.id ? "selected" : ""}>${esc(x.apto)} · ${esc(etapa(x).nombre)}${x.object_id ? "" : " (sin modelo)"}</option>`).join("")}</select>
          </div>
          <p class="tenue"><small>También puedes tocar en el modelo la habitación o el elemento vinculado al apartamento.</small></p>`}
    </section>

    ${u ? pintarUnidad(u) : ""}`;
  enlazar();
}

function pintarUnidad(u) {
  const e = etapa(u);
  const selLibre = st.sel && st.sel.object_id !== u.object_id;
  const respondidos = st.lista ? st.lista.items.filter((_, i) => st.resultados[i]).length : 0;
  const yaSi = st.lista && u.estados?.[st.lista.estado]?.si === true;
  const nombreEstado = st.lista ? ESTADOS.find((x) => x.k === st.lista.estado).nombre : "";
  return `
    <section class="v-bloque">
      <div class="la-v-cab">
        <div><small class="tenue">${esc(u.torre)} · ${esc(u.nivel || (piso(u) ? "Piso " + piso(u) : ""))}</small>
          <div class="v-total">Apto ${esc(u.apto)}</div></div>
        <span class="chip" style="background:${e.color}33;color:#333">${esc(e.nombre)}</span>
      </div>
      ${u.object_id
        ? `<button class="btn" id="la-ver">Ver en el modelo</button>`
        : `<p class="tenue"><small>No está vinculado al modelo, así que no se pinta en el 3D.</small></p>`}
      ${selLibre
        ? `<button class="btn" id="la-vincular">${u.object_id ? "Cambiar el vínculo a" : "Vincular con"} ${esc(st.sel.nombre || "el elemento seleccionado")}</button>`
        : !u.object_id ? `<p class="tenue"><small>Para vincularlo, selecciona en el modelo la habitación o el elemento que lo representa.</small></p>` : ""}
    </section>

    <section class="v-bloque">
      <div class="v-etiqueta">Estados</div>
      <div class="la-estados">${ESTADOS.map((est, i) => {
        const v = u.estados?.[est.k] || {};
        return `<div class="la-estado" data-k="${est.k}">
          <span class="la-nombre"><i style="background:${est.color}"></i>${i + 1}. ${esc(est.nombre)}</span>
          <div class="trio">
            <button data-si="true" class="${v.si === true ? "activo r-C" : ""}">SÍ</button>
            <button data-si="false" class="${v.si === false ? "activo r-NC" : ""}">NO</button>
          </div>
          <input type="date" value="${esc(v.fecha || "")}" max="${hoyLocal()}">
        </div>`;
      }).join("")}</div>
      <p class="tenue"><small>Van en orden. Al marcar SÍ sin fecha se toma la de hoy.</small></p>
    </section>

    <section class="v-bloque">
      <div class="v-etiqueta">Lista de chequeo</div>
      <select id="la-lista">${LISTAS_LA.map((l) => `<option ${st.lista && st.lista.nombre === l.nombre ? "selected" : ""}>${esc(l.nombre)}</option>`).join("")}
        <option value="" ${!st.lista ? "selected" : ""}>Sin lista</option>
      </select>
      ${st.lista ? `<div class="chequeo">${st.lista.items.map((it, i) => `
        <div class="item-chequeo">
          <span>${esc(it)}</span>
          <div class="trio" data-item="${i}">
            ${["C", "NC", "NA"].map((r) => `<button data-r="${r}" class="${st.resultados[i] === r ? "activo r-" + r : ""}">${r === "NA" ? "N/A" : r}</button>`).join("")}
          </div>
        </div>`).join("")}
        <button class="btn enlace" id="la-todo-c">Marcar todo conforme</button>
        <p class="tenue"><small>${respondidos} de ${st.lista.items.length} ítems respondidos.</small></p>
      </div>` : ""}
    </section>

    ${st.lista ? `
    <section class="v-bloque">
      <div class="v-etiqueta">Observaciones</div>
      <textarea id="la-obs" rows="3" placeholder="Qué se encontró. Obligatorio si hay no conformidades.">${esc(st.observaciones)}</textarea>
    </section>

    <section class="v-bloque">
      <div class="v-etiqueta">Fotos <small class="tenue">${st.fotos.length}/${MAX_FOTOS}</small></div>
      <div class="fotos">
        ${st.fotos.map((f, i) => `<div class="foto"><img src="${f.base64}" alt=""><button data-quitar-foto="${i}" title="Quitar">×</button></div>`).join("")}
        ${st.fotos.length < MAX_FOTOS ? `<label class="foto agregar">+<input type="file" accept="image/*" capture="environment" multiple id="la-fotos" hidden></label>` : ""}
      </div>
    </section>

    ${yaSi ? "" : `<label class="la-v-marcar"><input type="checkbox" id="la-marcar" ${st.marcar ? "checked" : ""}>
      Al guardar, marcar ${esc(nombreEstado)} en SÍ con fecha de hoy (solo si todo queda conforme)</label>`}

    <button class="btn primario v-guardar" id="la-guardar" ${st.guardando ? "disabled" : ""}>${st.guardando ? "Guardando…" : `Guardar chequeo del apto ${esc(u.apto)}`}</button>` : ""}

    <section class="v-bloque">
      <div class="v-etiqueta">Historial</div>
      ${!st.historial ? `<p class="tenue">Cargando…</p>` : !st.historial.length ? `<p class="tenue">Sin movimientos.</p>`
        : `<ol class="historial">${st.historial.slice(0, 8).map((ev) =>
            `<li><small class="tenue">${fecha(ev.creado_en)} · ${esc(ev.actor_nombre || "")}</small><br>${esc(ev.detalle || "")}</li>`).join("")}</ol>`}
    </section>`;
}

// ------------------------------------------------------------------ eventos

function enlazar() {
  raiz.querySelectorAll("[data-lacolor]").forEach((b) => (b.onclick = () => colorear(!!b.dataset.lacolor)));
  const t = raiz.querySelector("#la-torre");
  if (t) t.onchange = () => { st.torre = t.value; st.id = null; pintar(); };
  const a = raiz.querySelector("#la-apto");
  if (a) a.onchange = () => { elegir(a.value || null); pintar(); if (a.value) verEnModelo(false); };
  const ver = raiz.querySelector("#la-ver");
  if (ver) ver.onclick = () => verEnModelo(true);
  const vin = raiz.querySelector("#la-vincular");
  if (vin) vin.onclick = vincular;

  raiz.querySelectorAll(".la-estado").forEach((fila) => fila.querySelectorAll("[data-si]").forEach((b) => (b.onclick = async () => {
    const si = b.dataset.si === "true";
    const valor = fila.querySelector("input").value;
    b.disabled = true;
    try {
      await la("guardar_estado", { unidadId: st.id, estado: fila.dataset.k, si, fecha: valor || (si ? hoyLocal() : null) });
      aviso(`Apto ${unidad().apto}: guardado.`);
      await despuesDeGuardar();
    } catch (e) { aviso(e.message, "error"); b.disabled = false; }
  })));

  const sl = raiz.querySelector("#la-lista");
  if (sl) sl.onchange = () => {
    st.listaManual = true;
    st.lista = LISTAS_LA.find((l) => l.nombre === sl.value) || null;
    st.resultados = {}; st.marcar = false;
    pintar();
  };
  raiz.querySelectorAll(".chequeo .trio").forEach((tr) => tr.querySelectorAll("button").forEach((b) => (b.onclick = () => {
    const i = tr.dataset.item;
    st.resultados[i] = st.resultados[i] === b.dataset.r ? undefined : b.dataset.r;
    pintar();
  })));
  const todo = raiz.querySelector("#la-todo-c");
  if (todo) todo.onclick = () => { st.lista.items.forEach((_, i) => (st.resultados[i] = "C")); pintar(); };
  const obs = raiz.querySelector("#la-obs");
  if (obs) obs.oninput = () => (st.observaciones = obs.value);
  const fotos = raiz.querySelector("#la-fotos");
  if (fotos) fotos.onchange = () => agregarFotos([...fotos.files]);
  raiz.querySelectorAll("[data-quitar-foto]").forEach((b) => (b.onclick = () => { st.fotos.splice(+b.dataset.quitarFoto, 1); pintar(); }));
  const m = raiz.querySelector("#la-marcar");
  if (m) m.onchange = () => (st.marcar = m.checked);
  const g = raiz.querySelector("#la-guardar");
  if (g) g.onclick = guardarChequeo;
}

async function agregarFotos(archivos) {
  for (const f of archivos.slice(0, MAX_FOTOS - st.fotos.length)) {
    try { st.fotos.push({ nombre: f.name, tipo: "image/jpeg", base64: await comprimirFoto(f) }); }
    catch (_) { aviso(`No se pudo leer la imagen ${f.name}`, "error"); }
  }
  pintar();
}

async function despuesDeGuardar() {
  const id = st.id;
  await recargar();
  st.id = id;
  pintar();
  cargarHistorial(id);
  if (st.color) colorear(true, false);
}

async function guardarChequeo() {
  const u = unidad();
  const resultados = st.lista.items.map((item, i) => ({ item, resultado: st.resultados[i] })).filter((r) => r.resultado);
  if (!resultados.length) return aviso("Responde al menos un ítem de la lista.", "error");
  const hayNC = resultados.some((r) => r.resultado === "NC");
  if (hayNC && !st.observaciones.trim()) return aviso("Hay no conformidades: describe en observaciones qué se encontró.", "error");
  const marcar = st.marcar && raiz.querySelector("#la-marcar");
  if (marcar && (hayNC || resultados.length < st.lista.items.length)) {
    return aviso("Para marcar el estado en SÍ, todos los ítems deben estar respondidos y sin NC.", "error");
  }
  st.guardando = true; pintar();
  try {
    const r = await la("guardar_chequeo", {
      unidadId: u.id, lista: st.lista.nombre, estado: st.lista.estado, resultados,
      observaciones: st.observaciones, marcar: !!marcar, fecha: hoyLocal(),
      fotos: st.fotos.map(({ nombre, tipo, base64 }) => ({ nombre, tipo, base64 })),
    });
    const partes = ["Chequeo guardado."];
    if (r.fotos_fallidas.length) partes.push(`No subieron ${r.fotos_fallidas.length} fotos; revisa permisos de la carpeta en Trimble.`);
    if (r.error_estado) partes.push(`El estado no se marcó: ${r.error_estado}`);
    aviso(partes.join(" "), r.fotos_fallidas.length || r.error_estado ? "error" : "info");
    Object.assign(st, { resultados: {}, observaciones: "", fotos: [], marcar: false });
    st.guardando = false;
    await despuesDeGuardar();
    if (!st.listaManual) { st.lista = listaSugerida(unidad()); pintar(); }
  } catch (e) {
    aviso(e.message, "error");
    st.guardando = false;
    pintar();
  }
}

// ------------------------------------------------------------------ modelo

async function runtimeIds(modeloId, objectIds) {
  const salida = [];
  for (let i = 0; i < objectIds.length; i += 5000) {
    salida.push(...await ctx.api.viewer.convertToObjectRuntimeIds(modeloId, objectIds.slice(i, i + 5000)));
  }
  return salida;
}

async function colorear(encendido, avisar = true) {
  st.color = encendido;
  pintar();
  const v = ctx.api.viewer;
  try {
    await v.setObjectState(undefined, { color: "reset" });
    if (!encendido) return;
    const modelos = await v.getModels("loaded");
    let pintados = 0;
    let faltantes = 0;
    for (const m of modelos) {
      const propias = st.unidades.filter((u) => u.modelo_id === m.id && u.object_id);
      if (!propias.length) continue;
      const rts = await runtimeIds(m.id, propias.map((u) => u.object_id));
      const grupos = {};
      propias.forEach((u, i) => {
        if (rts[i] == null) { faltantes++; return; }
        (grupos[etapa(u).color] ||= []).push(rts[i]);
      });
      for (const [color, ids] of Object.entries(grupos)) {
        await v.setObjectState({ modelObjectIds: [{ modelId: m.id, objectRuntimeIds: ids }] }, { color });
        pintados += ids.length;
      }
    }
    if (avisar) aviso(pintados ? `${pintados} apartamentos coloreados.` : "Ningún apartamento está vinculado a los modelos cargados.");
    if (avisar && faltantes) aviso(`${faltantes} apartamento(s) vinculado(s) ya no están en esta versión del modelo. Vuelve a vincularlos.`, "error");
  } catch (e) {
    aviso(`No se pudo colorear: ${e.message}`, "error");
  }
}

async function verEnModelo(avisar) {
  const u = unidad();
  if (!u || !u.object_id) return;
  const v = ctx.api.viewer;
  try {
    const modelos = await v.getModels("loaded");
    if (!modelos.some((m) => m.id === u.modelo_id)) {
      if (avisar) aviso(`Carga en el visor el modelo ${u.modelo_nombre || ""} para ver este apartamento.`, "error");
      return;
    }
    const [rt] = await runtimeIds(u.modelo_id, [u.object_id]);
    if (rt == null) { if (avisar) aviso("El elemento vinculado ya no está en esta versión del modelo.", "error"); return; }
    const sel = { modelObjectIds: [{ modelId: u.modelo_id, objectRuntimeIds: [rt] }] };
    await v.setSelection(sel, "set");
    await v.setCamera(sel, { animationTime: 400 });
  } catch (_) { // enfocar es una ayuda; si falla, el panel sigue
  }
}

async function vincular() {
  const u = unidad();
  if (!u || !st.sel) return;
  try {
    await la("vincular_objeto", {
      unidadId: u.id, modelo_id: st.sel.modelo_id, modelo_nombre: st.sel.modelo_nombre,
      object_id: st.sel.object_id, nivel: st.sel.nivel || null,
    });
    aviso(`Apto ${u.apto} vinculado al modelo.`);
    await despuesDeGuardar();
  } catch (e) { aviso(e.message, "error"); }
}
