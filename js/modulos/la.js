// Módulo L.A.: estado comercial y de entrega de cada apartamento, sobre el modelo.
import { backend } from "../backend.js";
import { trimble, ctx } from "../trimble.js";
import { ESTADOS, DISPONIBLE, etapa, hexARgba, piso, normal } from "../la/reglas.js";
import { abrirVisor, buscarApartamentos } from "../la/visor.js";

const la = (accion, datos) => backend(accion, datos, "la");
const XLSX_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fechaCorta = (d) => d ? new Date(d + "T00:00:00Z").toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "";
const hoyLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

let raiz, unidades = [], torre = "", modelo = null, visor = null, abierta = null;

export async function mostrar(el) {
  raiz = el;
  visor = null;
  raiz.innerHTML = `
    <header class="encabezado">
      <h1>L.A.</h1>
      <button class="btn" id="la-buscar">Vincular apartamentos del modelo</button>
      <button class="btn" id="la-importar">Importar Excel</button>
      <button class="btn" id="la-plantilla">Plantilla Excel</button>
      <button class="btn" id="la-csv">Exportar CSV</button>
    </header>
    <p class="tenue o-ayuda">Estado de cada apartamento por torre: Separada → Vendida → Escriturada → Liberado por Calidad → Entregado. Cada estado lleva SÍ/NO y fecha, y deben ir en ese orden.</p>
    <section id="la-tarjetas" class="tarjetas seis"></section>
    <div id="f-avisos"></div>
    <section class="seg">
      <div class="seg-mini">
        <div class="seg-barra">
          <select id="la-modelo"></select>
          <button class="btn" id="la-elegir">Otro modelo…</button>
        </div>
        <div class="seg-lienzo" id="la-lienzo"><p class="tenue">Elige el modelo donde están las habitaciones o áreas de los apartamentos.</p></div>
        <div class="leyenda">${[DISPONIBLE, ...ESTADOS].map((e) => `<span><i style="background:${e.color}"></i>${esc(e.nombre)}</span>`).join("")}</div>
      </div>
      <div class="seg-tiempo">
        <div class="seg-cab"><b>Tablero por torre</b><div class="segmentos chico" id="la-torres"></div></div>
        <div id="la-tablero" class="la-tablero"></div>
        <p class="tenue"><small>Toca un apartamento para ver o cambiar sus estados. También puedes seleccionarlo en el modelo.</small></p>
      </div>
    </section>
    <aside id="la-panel" class="panel oculto"></aside>
    <div id="la-modal" class="modal oculto"></div>`;

  raiz.querySelector("#la-buscar").onclick = vincularDesdeModelo;
  raiz.querySelector("#la-importar").onclick = importarExcel;
  raiz.querySelector("#la-plantilla").onclick = descargarPlantilla;
  raiz.querySelector("#la-csv").onclick = exportarCsv;
  raiz.querySelector("#la-elegir").onclick = elegirModelo;
  raiz.querySelector("#la-modelo").onchange = (e) => { modelo = modelos().find((m) => m.id === e.target.value) || null; abrirModelo(); };

  await recargar();
  modelo = modelos()[0] || null;
  pintarSelectorModelo();
  if (modelo) abrirModelo();
}

function modelos() {
  const vistos = new Map();
  unidades.forEach((u) => { if (u.modelo_id && !vistos.has(u.modelo_id)) vistos.set(u.modelo_id, u.modelo_nombre || u.modelo_id); });
  if (modelo && !vistos.has(modelo.id)) vistos.set(modelo.id, modelo.nombre);
  return [...vistos].map(([id, nombre]) => ({ id, nombre }));
}

function pintarSelectorModelo() {
  const lista = modelos();
  raiz.querySelector("#la-modelo").innerHTML = lista.length
    ? lista.map((m) => `<option value="${esc(m.id)}" ${modelo && modelo.id === m.id ? "selected" : ""}>${esc(m.nombre)}</option>`).join("")
    : `<option value="">Sin modelo vinculado</option>`;
}

async function recargar() {
  try { unidades = (await la("resumen")).unidades; }
  catch (e) { aviso(e.message, "error"); return; }
  const torres = [...new Set(unidades.map((u) => u.torre))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  if (!torres.includes(torre)) torre = torres[0] || "";
  pintarTarjetas();
  pintarTorres(torres);
  pintarTablero();
  pintarModelo();
  if (abierta) abrirUnidad(abierta);
}

function aviso(texto, tipo = "info") {
  const d = document.createElement("div");
  d.className = `aviso ${tipo}`;
  d.textContent = texto;
  const caja = raiz.querySelector("#f-avisos");
  caja.prepend(d);
  while (caja.children.length > 2) caja.lastChild.remove();
  setTimeout(() => d.remove(), 6000);
}

function pintarTarjetas() {
  const total = unidades.length;
  const cuenta = (k) => unidades.filter((u) => u.estados?.[k]?.si === true).length;
  raiz.querySelector("#la-tarjetas").innerHTML =
    `<div class="tarjeta"><span>Apartamentos</span><b>${total}</b><small>${[...new Set(unidades.map((u) => u.torre))].length} torres</small></div>` +
    ESTADOS.map((e) => `<div class="tarjeta" style="box-shadow: inset 3px 0 0 ${e.color}"><span>${esc(e.nombre)}</span><b>${cuenta(e.k)}</b><small>${pct(cuenta(e.k), total)} % del total</small></div>`).join("");
}

function pintarTorres(torres) {
  const cont = raiz.querySelector("#la-torres");
  cont.innerHTML = torres.map((t) => `<button data-torre="${esc(t)}" class="${t === torre ? "activo" : ""}">${esc(t)}</button>`).join("");
  cont.querySelectorAll("[data-torre]").forEach((b) => (b.onclick = () => { torre = b.dataset.torre; pintarTorres(torres); pintarTablero(); }));
}

function pintarTablero() {
  const cont = raiz.querySelector("#la-tablero");
  const propias = unidades.filter((u) => u.torre === torre);
  if (!propias.length) {
    cont.innerHTML = `<p class="tenue">Todavía no hay apartamentos. Vincúlalos desde el modelo o importa el Excel comercial.</p>`;
    return;
  }
  const porPiso = {};
  propias.forEach((u) => (porPiso[piso(u)] ||= []).push(u));
  cont.innerHTML = Object.keys(porPiso).map(Number).sort((a, b) => b - a).map((p) => `
    <div class="la-fila"><span class="la-piso">${p ? "Piso " + p : "Sin piso"}</span>
      <div class="la-celdas">${porPiso[p].sort((a, b) => a.apto.localeCompare(b.apto, "es", { numeric: true })).map((u) => {
        const e = etapa(u);
        return `<button class="la-celda ${u.object_id ? "" : "sin-modelo"}" data-id="${u.id}" style="--c:${e.color}"
          title="${esc(u.torre)} ${esc(u.apto)}: ${esc(e.nombre)}${u.object_id ? "" : " (sin vincular al modelo)"}">${esc(u.apto)}</button>`;
      }).join("")}</div></div>`).join("");
  cont.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => abrirUnidad(b.dataset.id, true)));
}

// ------------------------------------------------------------------ panel de la unidad

async function abrirUnidad(id, enfocar = false) {
  const u = unidades.find((x) => x.id === id);
  if (!u) return;
  abierta = id;
  const panel = raiz.querySelector("#la-panel");
  panel.classList.remove("oculto");
  const e = etapa(u);
  panel.innerHTML = `
    <div class="panel-cab">
      <div><small class="tenue">${esc(u.torre)} · ${esc(u.nivel || (piso(u) ? "Piso " + piso(u) : ""))}</small><h2>Apto ${esc(u.apto)}</h2>
        <span class="chip" style="background:${e.color}33;color:#333">${esc(e.nombre)}</span></div>
      <button class="btn enlace" id="p-cerrar">Cerrar</button>
    </div>
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
    <p class="tenue"><small>Al marcar SÍ sin fecha se toma la de hoy. Para cambiar solo la fecha, edítala y vuelve a tocar SÍ.</small></p>
    ${u.object_id ? "" : `<p class="aviso">Este apartamento no está vinculado a una habitación del modelo; no se pinta en el 3D.</p>`}
    <h3>Historial</h3><ol class="historial" id="p-hist"><li class="tenue">Cargando…</li></ol>`;

  panel.querySelector("#p-cerrar").onclick = () => { abierta = null; panel.classList.add("oculto"); };
  panel.querySelectorAll(".la-estado").forEach((fila) => {
    fila.querySelectorAll("[data-si]").forEach((b) => (b.onclick = async () => {
      const si = b.dataset.si === "true";
      const input = fila.querySelector("input");
      const fecha = input.value || (si ? hoyLocal() : null);
      b.disabled = true;
      try {
        await la("guardar_estado", { unidadId: u.id, estado: fila.dataset.k, si, fecha });
        aviso(`Apto ${u.apto}: guardado.`);
        await recargar();
      } catch (err) { aviso(err.message, "error"); b.disabled = false; }
    }));
  });
  if (enfocar) enfocarEnModelo(u);
  try {
    const { eventos } = await la("historial", { unidadId: u.id });
    const ol = panel.querySelector("#p-hist");
    if (ol) ol.innerHTML = eventos.map((ev) => `<li><small class="tenue">${new Date(ev.creado_en).toLocaleString("es-CO")} · ${esc(ev.actor_nombre || "")} · ${ev.origen}</small><br>${esc(ev.detalle || "")}</li>`).join("") || `<li class="tenue">Sin movimientos.</li>`;
  } catch (_) { // el historial es informativo
  }
}

// ------------------------------------------------------------------ modelo

async function abrirModelo() {
  const lienzo = raiz.querySelector("#la-lienzo");
  if (!modelo) return;
  lienzo.innerHTML = `<p class="tenue">Cargando el modelo…</p>`;
  visor = null;
  try {
    const v = await abrirVisor(lienzo, modelo.id, alSeleccionarEnModelo);
    visor = { ...v, rt: new Map() };
    await pintarModelo();
  } catch (e) {
    lienzo.innerHTML = `<p class="tenue">No se pudo abrir el modelo aquí (${esc(e.message)}). El tablero funciona igual.</p>`;
  }
}

async function runtimeDe(lista) {
  const faltan = lista.filter((u) => u.object_id && !visor.rt.has(u.object_id));
  for (let i = 0; i < faltan.length; i += 5000) {
    const parte = faltan.slice(i, i + 5000);
    const rts = await visor.api.viewer.convertToObjectRuntimeIds(visor.modelo.id, parte.map((u) => u.object_id));
    parte.forEach((u, k) => visor.rt.set(u.object_id, rts[k]));
  }
}

async function pintarModelo() {
  if (!visor) return;
  const v = visor.api.viewer;
  const propias = unidades.filter((u) => u.modelo_id === modelo.id && u.object_id);
  try {
    await runtimeDe(propias);
    // El edificio queda tenue para que se vean los volúmenes de los apartamentos.
    await v.setObjectState(undefined, { color: { r: 210, g: 214, b: 220, a: 50 } });
    const grupos = {};
    for (const u of propias) {
      const rt = visor.rt.get(u.object_id);
      if (rt == null) continue;
      (grupos[etapa(u).k] ||= []).push(rt);
    }
    for (const est of [DISPONIBLE, ...ESTADOS]) {
      const ids = grupos[est.k];
      if (!ids) continue;
      await v.setObjectState({ modelObjectIds: [{ modelId: visor.modelo.id, objectRuntimeIds: ids }] }, { visible: true, color: hexARgba(est.color, 210) });
    }
  } catch (e) {
    aviso(`No se pudo pintar el modelo: ${e.message}`, "error");
  }
}

async function alSeleccionarEnModelo(sel) {
  if (!visor || !sel || !sel.length) return;
  const grupo = sel.find((g) => (g.objectRuntimeIds || []).length);
  if (!grupo) return;
  try {
    const [oid] = await visor.api.viewer.convertToObjectIds(grupo.modelId, [grupo.objectRuntimeIds[0]]);
    const u = unidades.find((x) => x.object_id === oid);
    if (u) { torre = u.torre; recargarTorre(); abrirUnidad(u.id); }
  } catch (_) { // selección de algo que no es un apartamento
  }
}

function recargarTorre() {
  const torres = [...new Set(unidades.map((u) => u.torre))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  pintarTorres(torres);
  pintarTablero();
}

async function enfocarEnModelo(u) {
  if (!visor || !u.object_id || u.modelo_id !== modelo.id) return;
  try {
    await runtimeDe([u]);
    const rt = visor.rt.get(u.object_id);
    if (rt == null) return;
    const sel = { modelObjectIds: [{ modelId: visor.modelo.id, objectRuntimeIds: [rt] }] };
    await visor.api.viewer.setSelection(sel, "set");
    await visor.api.viewer.setCamera(sel, { animationTime: 400 });
  } catch (_) { // enfocar es una ayuda; si falla, el panel sigue
  }
}

// Escoger el archivo del modelo navegando las carpetas del proyecto.
async function elegirModelo() {
  const modal = raiz.querySelector("#la-modal");
  modal.classList.remove("oculto");
  const ruta = [{ id: await trimble.carpetaRaiz(), nombre: ctx.proyecto.name || "Proyecto" }];
  modal.innerHTML = `<div class="caja"><h2>Elegir modelo</h2>
    <p class="tenue">Busca el .rvt o .ifc donde están las habitaciones o áreas de los apartamentos.</p>
    <div class="explorador"><div id="m-ruta" class="ruta"></div><div id="m-items" class="items"></div></div>
    <div class="acciones"><button class="btn" id="m-cancelar">Cancelar</button></div></div>`;
  modal.querySelector("#m-cancelar").onclick = () => modal.classList.add("oculto");
  const abrir = async () => {
    modal.querySelector("#m-ruta").innerHTML = ruta.map((c, i) => `<a data-i="${i}">${esc(c.nombre)}</a>`).join(" / ");
    modal.querySelectorAll("#m-ruta a").forEach((a) => (a.onclick = () => { ruta.splice(+a.dataset.i + 1); abrir(); }));
    const items = modal.querySelector("#m-items");
    items.innerHTML = `<p class="tenue">Cargando…</p>`;
    const lista = (await trimble.contenido(ruta[ruta.length - 1].id))
      .filter((it) => it.type === "FOLDER" || /\.(rvt|ifc|trb|ifczip)$/i.test(it.name))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "FOLDER" ? -1 : 1));
    items.innerHTML = lista.map((it) => it.type === "FOLDER"
      ? `<div class="item carpeta" data-id="${it.id}" data-nombre="${esc(it.name)}"><span class="ico-carpeta"></span>${esc(it.name)}</div>`
      : `<div class="item archivo-modelo" data-id="${it.id}" data-nombre="${esc(it.name)}">${esc(it.name)}</div>`).join("") || `<p class="tenue">Sin modelos en esta carpeta.</p>`;
    items.querySelectorAll(".carpeta").forEach((d) => (d.onclick = () => { ruta.push({ id: d.dataset.id, nombre: d.dataset.nombre }); abrir(); }));
    items.querySelectorAll(".archivo-modelo").forEach((d) => (d.onclick = () => {
      modelo = { id: d.dataset.id, nombre: d.dataset.nombre };
      modal.classList.add("oculto");
      pintarSelectorModelo();
      abrirModelo();
    }));
  };
  abrir();
}

// Lee las habitaciones/áreas del modelo abierto y propone la lista de apartamentos.
async function vincularDesdeModelo() {
  if (!visor) return aviso("Primero abre el modelo donde están los apartamentos (botón Otro modelo…).", "error");
  const modal = raiz.querySelector("#la-modal");
  modal.classList.remove("oculto");
  modal.innerHTML = `<div class="caja"><p class="tenue">Buscando habitaciones y áreas en el modelo…</p></div>`;
  let r;
  try { r = await buscarApartamentos(visor.api, visor.modelo); }
  catch (e) { modal.innerHTML = `<div class="caja"><div class="aviso error">${esc(e.message)}</div><div class="acciones"><button class="btn" id="m-cerrar">Cerrar</button></div></div>`; modal.querySelector("#m-cerrar").onclick = () => modal.classList.add("oculto"); return; }
  if (!r.encontrados.length) {
    modal.innerHTML = `<div class="caja"><h2>Sin apartamentos</h2>
      <p>No encontré habitaciones ni áreas en este modelo. Revisa que el .rvt tenga las habitaciones (Rooms) colocadas y que se exporten al subirlo a Trimble.</p>
      <div class="acciones"><button class="btn" id="m-cerrar">Cerrar</button></div></div>`;
    modal.querySelector("#m-cerrar").onclick = () => modal.classList.add("oculto");
    return;
  }
  const sinTorre = r.encontrados.some((x) => !x.torre);
  modal.innerHTML = `<div class="caja"><h2>${r.encontrados.length} apartamentos encontrados</h2>
    <p class="tenue">Clase en el modelo: ${esc(r.clase)}. Revisa la torre y el número antes de vincular. Los estados que ya tengan se conservan.</p>
    <label>Torre para los que no la traen <input id="m-torre" value="${esc(r.encontrados.find((x) => x.torre)?.torre || "")}" placeholder="Ej.: T2"></label>
    <div class="items la-lista">${r.encontrados.slice(0, 400).map((x, i) => `<div class="item"><input data-i="${i}" data-c="torre" value="${esc(x.torre)}" ${sinTorre ? "" : ""} style="width:70px"> <input data-i="${i}" data-c="apto" value="${esc(x.apto)}" style="width:90px"> <span class="tenue">${esc(x.nivel)}</span></div>`).join("")}</div>
    ${r.encontrados.length > 400 ? `<p class="tenue">Se muestran 400; se vinculan todos.</p>` : ""}
    <div class="acciones"><button class="btn" id="m-cancelar">Cancelar</button><button class="btn primario" id="m-vincular">Vincular</button></div></div>`;
  modal.querySelector("#m-cancelar").onclick = () => modal.classList.add("oculto");
  modal.querySelectorAll("input[data-i]").forEach((inp) => (inp.oninput = () => { r.encontrados[+inp.dataset.i][inp.dataset.c] = inp.value.trim(); }));
  modal.querySelector("#m-vincular").onclick = async (ev) => {
    const porDefecto = modal.querySelector("#m-torre").value.trim();
    const lista = r.encontrados.map((x) => ({ ...x, torre: x.torre || porDefecto }));
    if (lista.some((x) => !x.torre)) return aviso("Hay apartamentos sin torre. Escribe la torre por defecto.", "error");
    ev.target.disabled = true;
    try {
      const res = await la("vincular_modelo", { modelo_nombre: visor.modelo.name, unidades: lista.map(({ torre, apto, nivel, modelo_id, object_id }) => ({ torre, apto, nivel, modelo_id, object_id })) });
      modal.classList.add("oculto");
      aviso(`${res.vinculadas} apartamentos vinculados${res.repetidas ? ` (${res.repetidas} repetidos omitidos)` : ""}.`);
      modelo = { id: visor.modelo.id, nombre: visor.modelo.name };
      await recargar();
      pintarSelectorModelo();
    } catch (e) { aviso(e.message, "error"); ev.target.disabled = false; }
  };
}

// ------------------------------------------------------------------ Excel

const COLUMNAS = [["Torre", "torre"], ["Apto", "apto"], ...ESTADOS.flatMap((e) => [[e.nombre, e.k], [`Fecha ${e.nombre}`, `f_${e.k}`]])];

async function descargarPlantilla() {
  const XLSX = await import(XLSX_URL);
  const filas = (unidades.length ? unidades : [{ torre: "T1", apto: "101", estados: {} }]).map((u) => {
    const o = { Torre: u.torre, Apto: u.apto };
    ESTADOS.forEach((e) => {
      const v = u.estados?.[e.k] || {};
      o[e.nombre] = v.si === true ? "SI" : v.si === false ? "NO" : "";
      o[`Fecha ${e.nombre}`] = v.fecha ? new Date(v.fecha + "T12:00:00") : "";
    });
    return o;
  });
  const hoja = XLSX.utils.json_to_sheet(filas, { header: COLUMNAS.map((c) => c[0]), cellDates: true, dateNF: "dd/mm/yyyy" });
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "L.A.");
  XLSX.writeFile(libro, `LA-${ctx.proyecto.name || "proyecto"}-${hoyLocal()}.xlsx`);
}

function valorSi(v) {
  const t = normal(v);
  if (!t) return undefined;
  if (["si", "s", "x", "1", "true", "yes"].includes(t)) return true;
  if (["no", "n", "0", "false"].includes(t)) return false;
  return undefined;
}

function valorFecha(v) {
  if (v === null || v === undefined || v === "") return undefined;
  if (v instanceof Date && !isNaN(v)) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) { const a = m[3].length === 2 ? "20" + m[3] : m[3]; return `${a}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  return null; // texto que no es fecha
}

// Reconoce las columnas aunque vengan con otro nombre: busca palabras de cada estado.
function columnaDe(encabezado) {
  const h = normal(encabezado);
  if (h === "torre" || h.startsWith("torre") || h === "bloque") return "torre";
  if (["apto", "apartamento", "unidad", "inmueble", "apto."].includes(h) || h.startsWith("apart")) return "apto";
  const claves = { separada: ["separ"], vendida: ["vend", "venta"], escriturada: ["escritur"], liberada: ["liber", "calidad"], entregada: ["entreg"] };
  for (const [k, pal] of Object.entries(claves)) {
    if (pal.some((p) => h.includes(p))) return h.includes("fecha") ? `f_${k}` : k;
  }
  return null;
}

async function importarExcel() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,.xls,.csv";
  input.onchange = async () => {
    const archivo = input.files[0];
    if (!archivo) return;
    const XLSX = await import(XLSX_URL);
    const libro = XLSX.read(await archivo.arrayBuffer(), { cellDates: true });
    const filasCrudas = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { defval: "", raw: true });
    if (!filasCrudas.length) return aviso("El archivo no tiene filas.", "error");
    const mapa = {};
    Object.keys(filasCrudas[0]).forEach((h) => { const c = columnaDe(h); if (c && !mapa[c]) mapa[c] = h; });
    if (!mapa.torre || !mapa.apto) return aviso("No encontré las columnas Torre y Apto. Usa la plantilla.", "error");
    const avisosFecha = [];
    const filas = filasCrudas.map((f, i) => {
      const estados = {};
      ESTADOS.forEach((e) => {
        const si = mapa[e.k] ? valorSi(f[mapa[e.k]]) : undefined;
        const fecha = mapa[`f_${e.k}`] ? valorFecha(f[mapa[`f_${e.k}`]]) : undefined;
        if (fecha === null) avisosFecha.push(`fila ${i + 2}: fecha de ${e.nombre} no reconocida`);
        if (si !== undefined || fecha) estados[e.k] = { ...(si !== undefined ? { si } : {}), ...(fecha ? { fecha } : {}) };
      });
      return { fila: i + 2, torre: String(f[mapa.torre]).trim(), apto: String(f[mapa.apto]).trim(), estados };
    }).filter((f) => f.torre || f.apto);

    const modal = raiz.querySelector("#la-modal");
    modal.classList.remove("oculto");
    modal.innerHTML = `<div class="caja"><h2>Importar ${filas.length} filas</h2>
      <p class="tenue">Columnas reconocidas: ${Object.entries(mapa).map(([k, h]) => esc(h)).join(", ")}. Las celdas vacías no cambian lo que ya está guardado.</p>
      ${avisosFecha.length ? `<div class="aviso error">${avisosFecha.slice(0, 8).map(esc).join("<br>")}${avisosFecha.length > 8 ? "<br>…" : ""}</div>` : ""}
      <label class="item"><input type="checkbox" id="m-crear"> Crear los apartamentos que no existan en L.A. (quedan sin vincular al modelo)</label>
      <div class="acciones"><button class="btn" id="m-cancelar">Cancelar</button><button class="btn primario" id="m-ok">Importar</button></div>
      <div id="m-res"></div></div>`;
    modal.querySelector("#m-cancelar").onclick = () => modal.classList.add("oculto");
    modal.querySelector("#m-ok").onclick = async (ev) => {
      ev.target.disabled = true;
      try {
        const r = await la("importar", { filas, crearFaltantes: modal.querySelector("#m-crear").checked });
        modal.querySelector("#m-res").innerHTML = `<p><b>${r.actualizadas}</b> actualizados, <b>${r.creadas}</b> creados, ${r.sinCambios} sin cambios, <b>${r.errores.length}</b> con problemas.</p>
          ${r.errores.length ? `<div class="aviso error">${r.errores.slice(0, 30).map((x) => `Fila ${x.fila}: ${esc(x.motivo)}`).join("<br>")}${r.errores.length > 30 ? "<br>…" : ""}</div>` : ""}`;
        modal.querySelector("#m-cancelar").textContent = "Cerrar";
        await recargar();
      } catch (e) { aviso(e.message, "error"); ev.target.disabled = false; }
    };
  };
  input.click();
}

function exportarCsv() {
  const celda = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lineas = [["Torre", "Apto", "Nivel", "Etapa actual", ...ESTADOS.flatMap((e) => [e.nombre, `Fecha ${e.nombre}`]), "Vinculado al modelo"].map(celda).join(";")];
  for (const u of unidades) {
    lineas.push([u.torre, u.apto, u.nivel, etapa(u).nombre,
      ...ESTADOS.flatMap((e) => { const v = u.estados?.[e.k] || {}; return [v.si === true ? "SI" : v.si === false ? "NO" : "", fechaCorta(v.fecha)]; }),
      u.object_id ? "SI" : "NO"].map(celda).join(";"));
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  a.download = `LA-${hoyLocal()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
