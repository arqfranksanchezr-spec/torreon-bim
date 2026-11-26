// Seguimiento de Control de Obra en el tablero del proyecto:
// miniatura del modelo con los colores del seguimiento y línea de tiempo de la ejecución.
import { ctx, conectarEmbebido } from "../trimble.js";
import { obra } from "../backend.js";
import { COLORES, claveColor, hoyLocal } from "./modelo.js";
import { prepararComparacion } from "./programa.js";
import * as programaUI from "./programa-ui.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DIA = 86400000;
const aFecha = (s) => new Date(s + "T00:00:00Z").getTime();
const aTexto = (t) => new Date(t).toISOString().slice(0, 10);
const corta = (t) => new Date(t).toLocaleDateString("es-CO", { day: "2-digit", month: "short", timeZone: "UTC" });
const GRIS_SIN_REVISAR = "#E4E7EB";
const MORADO_PROGRAMA = "#7C3AED";

let raiz, datos, modelos = [], st = null, prog = { programa: null, inventarios: [] }, aviso = () => {};

// estado del elemento en una fecha según sus fechas de inicio y fin
function estadoEn(e, t) {
  if (e.fin && aFecha(e.fin) <= t) return "ejecutado";
  if (e.inicio && aFecha(e.inicio) <= t) return "en_ejecucion";
  return "no_iniciado";
}

export async function montar(el, revisiones, fnAviso) {
  raiz = el;
  if (fnAviso) aviso = fnAviso;
  if (st && st.temporizador) clearInterval(st.temporizador);
  const vistos = new Map();
  revisiones.forEach((r) => { if (!vistos.has(r.modelo_id)) vistos.set(r.modelo_id, r.modelo_nombre || r.modelo_id); });
  modelos = [...vistos].map(([id, nombre]) => ({ id, nombre }));

  raiz.innerHTML = `<p class="tenue">Cargando seguimiento…</p>`;
  try {
    [datos, prog] = await Promise.all([
      obra("linea_tiempo"),
      obra("programa").catch(() => ({ programa: null, inventarios: [] })),
    ]);
  } catch (e) { raiz.innerHTML = `<div class="aviso error">No se pudo cargar el seguimiento: ${esc(e.message)}</div>`; return; }

  const conFecha = datos.elementos.filter((e) => e.inicio || e.fin);
  const hoy = aFecha(hoyLocal());
  const desde = conFecha.length ? Math.min(...conFecha.map((e) => aFecha(e.inicio || e.fin))) : hoy - 30 * DIA;
  st = {
    modelo: modelos[0]?.id || null,
    modo: "avance",
    desde: Math.min(desde, hoy - 7 * DIA),
    hasta: hoy,
    fecha: hoy,
    temporizador: null,
    visor: null,          // { api, iframe, listo, rt: Map(object_id -> runtime) }
    actuales: null,       // estado actual por elemento (para el modo conformidad)
    desdeReal: Math.min(desde, hoy - 7 * DIA),
    cmp: null,            // comparación con la programación de obra del modelo elegido
    vista: null,          // "programa" (programado vs real) o "avance" (avance revisado)
  };
  calcularProgramacion();

  raiz.innerHTML = `
    <div class="seg">
      <div class="seg-mini">
        <div class="seg-barra">
          <select id="s-modelo">${modelos.map((m) => `<option value="${esc(m.id)}">${esc(m.nombre)}</option>`).join("") || "<option value=''>Sin modelos revisados</option>"}</select>
          <div class="segmentos chico">
            <button data-modo="avance" class="activo">Avance a la fecha</button>
            <button data-modo="conformidad">Conformidad</button>
          </div>
        </div>
        <div class="seg-lienzo" id="s-lienzo"><p class="tenue">Selecciona un modelo.</p></div>
        <div class="leyenda" id="s-leyenda"></div>
      </div>
      <div class="seg-tiempo">
        <div class="seg-cab">
          <b>Línea de tiempo de la ejecución</b>
          <div class="segmentos chico" id="s-vistas"></div>
          <span class="tenue" id="s-resumen"></span>
        </div>
        <svg id="s-curva" viewBox="0 0 800 230" preserveAspectRatio="none"></svg>
        <div class="leyenda leyenda-curva" id="s-leyenda-curva"></div>
        <p class="tenue nota-curva"><small id="s-nota-curva"></small></p>
        <div class="seg-control">
          <button class="btn" id="s-play">Reproducir</button>
          <input type="range" id="s-rango" min="0" max="${Math.round((st.hasta - st.desde) / DIA)}" value="${Math.round((st.hasta - st.desde) / DIA)}">
          <b id="s-fecha"></b>
        </div>
      </div>
    </div>
    <h3>Ejecución por nivel en el tiempo</h3>
    <div id="s-gantt" class="seg-gantt"></div>
    <h3>Programación de obra</h3>
    <section id="s-prog" class="prog"></section>`;

  raiz.querySelector("#s-modelo").onchange = (e) => { st.modelo = e.target.value; calcularProgramacion(); pintarProgramacion(); abrirModelo(); };
  raiz.querySelectorAll("[data-modo]").forEach((b) => (b.onclick = () => {
    st.modo = b.dataset.modo;
    raiz.querySelectorAll("[data-modo]").forEach((x) => x.classList.toggle("activo", x === b));
    pintarTodo();
  }));
  const rango = raiz.querySelector("#s-rango");
  let espera;
  rango.oninput = () => {
    detener();
    st.fecha = st.desde + Number(rango.value) * DIA;
    pintarTiempo();
    clearTimeout(espera);
    espera = setTimeout(pintarModelo, 200);
  };
  raiz.querySelector("#s-play").onclick = () => (st.temporizador ? detener() : reproducir());

  pintarTiempo();
  pintarProgramacion();
  abrirModelo();
}

// ------------------------------------------------------------------ programación de obra

function calcularProgramacion() {
  const inv = prog.inventarios.find((i) => i.modelo_id === st.modelo);
  const habia = !!st.cmp;
  st.cmp = inv ? prepararComparacion(prog.programa, inv.filas, elementosDelModelo()) : null;
  // Cuando aparece la comparación se muestra de una vez; si desaparece, se vuelve al avance revisado.
  if (!st.cmp) st.vista = "avance";
  else if (!habia || !st.vista) st.vista = "programa";
  // El eje de tiempo cubre lo ejecutado y toda la línea base del programa.
  const hoy = aFecha(hoyLocal());
  st.desde = st.cmp ? Math.min(st.desdeReal, st.cmp.desde) : st.desdeReal;
  st.hasta = st.cmp ? Math.max(hoy, st.cmp.hasta) : hoy;
  st.fecha = Math.min(Math.max(st.fecha, st.desde), st.hasta);
  const rango = raiz?.querySelector("#s-rango");
  if (rango) {
    rango.max = Math.round((st.hasta - st.desde) / DIA);
    rango.value = Math.round((st.fecha - st.desde) / DIA);
  }
}

function pintarProgramacion() {
  const caja = raiz.querySelector("#s-prog");
  if (!caja) return;
  programaUI.pintar({
    el: caja, prog,
    modelo: () => modelos.find((m) => m.id === st.modelo) || null,
    visor: () => st.visor,
    cmp: () => st.cmp,
    fecha: () => st.fecha,
    aviso,
    recargar: async () => {
      prog = await obra("programa");
      calcularProgramacion();
      pintarTiempo();
      pintarProgramacion();
    },
  });
}

export function desmontar() {
  if (st && st.temporizador) clearInterval(st.temporizador);
}

function elementosDelModelo() {
  return datos.elementos.filter((e) => !st.modelo || e.modelo_id === st.modelo);
}

// ------------------------------------------------------------------ línea de tiempo

function pintarTiempo() {
  const els = elementosDelModelo();
  const total = els.length;
  const W = 800, H = 230, L = 42, R = 12, T = 12, B = 28;
  const x = (t) => L + ((t - st.desde) / Math.max(DIA, st.hasta - st.desde)) * (W - L - R);
  const y = (n) => H - B - (total ? n / total : 0) * (H - T - B);

  const dias = Math.round((st.hasta - st.desde) / DIA);
  const paso = Math.max(1, Math.ceil(dias / 120));
  const puntosE = [], puntosI = [];
  for (let d = 0; d <= dias; d += paso) {
    const t = st.desde + d * DIA;
    puntosE.push([x(t), y(els.filter((e) => e.fin && aFecha(e.fin) <= t).length)]);
    puntosI.push([x(t), y(els.filter((e) => (e.inicio || e.fin) && aFecha(e.inicio || e.fin) <= t).length)]);
  }
  const linea = (p) => p.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)},${b.toFixed(1)}`).join("");
  const area = (p) => `${linea(p)}L${p[p.length - 1][0].toFixed(1)},${H - B}L${p[0][0].toFixed(1)},${H - B}Z`;

  const marcas = [];
  const nMarcas = Math.min(6, dias + 1);
  for (let i = 0; i < nMarcas; i++) {
    const t = st.desde + Math.round((dias * i) / Math.max(1, nMarcas - 1)) * DIA;
    const ancla = i === 0 ? "start" : i === nMarcas - 1 ? "end" : "middle";
    marcas.push(`<text x="${x(t)}" y="${H - 8}" text-anchor="${ancla}" class="eje">${corta(t)}</text>`);
  }
  const yMarcas = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${y(total * f)}" y2="${y(total * f)}" class="guia"/>
    <text x="${L - 6}" y="${y(total * f) + 4}" text-anchor="end" class="eje">${Math.round(total * f)}</text>`).join("");

  const eHoy = els.filter((e) => e.fin && aFecha(e.fin) <= st.fecha).length;
  const iHoy = els.filter((e) => estadoEn(e, st.fecha) === "en_ejecucion").length;

  pintarVistas();
  raiz.querySelector("#s-fecha").textContent = new Date(st.fecha).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
  if (st.vista === "programa" && st.cmp) {
    pintarProgramadoVsReal(x, dias, paso, marcas, W, H, L, R, T, B);
    pintarGantt(els, x);
    pintarLeyenda();
    programaUI.pintarAtrasos();
    return;
  }
  raiz.querySelector("#s-leyenda-curva").innerHTML = `
    <span><i class="l-linea" style="background:${COLORES.estado.ejecutado.color}"></i>Ejecutados (acumulado)</span>
    <span><i class="l-linea" style="background:${COLORES.estado.en_ejecucion.color}"></i>Iniciados (en ejecución + ejecutados)</span>
    <span><i class="l-corte"></i>Fecha que se está viendo</span>`;
  raiz.querySelector("#s-nota-curva").textContent = "Si solo se ve la línea verde, es porque todo lo que se inició ya está ejecutado y las dos líneas van juntas. La distancia entre ellas es lo que está en ejecución.";

  raiz.querySelector("#s-curva").innerHTML = total ? `
    ${yMarcas}
    <path d="${area(puntosI)}" fill="${COLORES.estado.en_ejecucion.color}" opacity=".25"/>
    <path d="${linea(puntosI)}" fill="none" stroke="${COLORES.estado.en_ejecucion.color}" stroke-width="2"><title>Iniciados: en ejecución + ejecutados</title></path>
    <path d="${area(puntosE)}" fill="${COLORES.estado.ejecutado.color}" opacity=".25"/>
    <path d="${linea(puntosE)}" fill="none" stroke="${COLORES.estado.ejecutado.color}" stroke-width="2.5"><title>Ejecutados (acumulado)</title></path>
    <line x1="${x(st.fecha)}" x2="${x(st.fecha)}" y1="${T}" y2="${H - B}" class="cursor"><title>Fecha que se está viendo</title></line>
    ${marcas.join("")}` :
    `<text x="400" y="115" text-anchor="middle" class="eje">Todavía no hay revisiones con fecha de ejecución en este modelo.</text>`;

  raiz.querySelector("#s-fecha").textContent = new Date(st.fecha).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
  raiz.querySelector("#s-resumen").textContent = total
    ? `Al ${corta(st.fecha)}: ${eHoy} ejecutados y ${iHoy} en ejecución de ${total} elementos revisados (${Math.round((eHoy / total) * 100)} %)`
    : "";
  pintarGantt(els, x);
  pintarLeyenda();
  programaUI.pintarAtrasos();
}

function pintarVistas() {
  const cont = raiz.querySelector("#s-vistas");
  if (!st.cmp) { cont.innerHTML = ""; return; }
  cont.innerHTML = [["programa", "Programado vs real"], ["avance", "Avance revisado"]]
    .map(([k, t]) => `<button data-vista="${k}" class="${st.vista === k ? "activo" : ""}">${t}</button>`).join("");
  cont.querySelectorAll("[data-vista]").forEach((b) => (b.onclick = () => { st.vista = b.dataset.vista; pintarTiempo(); }));
}

// Curva de la línea base del programa contra lo ejecutado en las actividades vinculadas.
function pintarProgramadoVsReal(x, dias, paso, marcas, W, H, L, R, T, B) {
  const cmp = st.cmp;
  const total = cmp.total;
  const y = (n) => H - B - (n / total) * (H - T - B);
  const hoy = aFecha(hoyLocal());
  const pp = [], pr = [];
  for (let d = 0; d <= dias; d += paso) {
    const t = st.desde + d * DIA;
    pp.push([x(t), y(cmp.programado(t))]);
    if (t <= hoy) pr.push([x(t), y(cmp.real(t))]);
  }
  const linea = (p) => p.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)},${b.toFixed(1)}`).join("");
  const area = (p) => p.length ? `${linea(p)}L${p[p.length - 1][0].toFixed(1)},${H - B}L${p[0][0].toFixed(1)},${H - B}Z` : "";
  const yMarcas = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${y(total * f)}" y2="${y(total * f)}" class="guia"/>
    <text x="${L - 6}" y="${y(total * f) + 4}" text-anchor="end" class="eje">${Math.round(total * f)}</text>`).join("");
  raiz.querySelector("#s-curva").innerHTML = `
    ${yMarcas}
    <path d="${area(pp)}" fill="${MORADO_PROGRAMA}" opacity=".08"/>
    <path d="${linea(pp)}" fill="none" stroke="${MORADO_PROGRAMA}" stroke-width="2" stroke-dasharray="6 4"><title>Programado según la línea base</title></path>
    <path d="${area(pr)}" fill="${COLORES.estado.ejecutado.color}" opacity=".22"/>
    <path d="${linea(pr)}" fill="none" stroke="${COLORES.estado.ejecutado.color}" stroke-width="2.5"><title>Ejecutado real</title></path>
    <line x1="${x(hoy)}" x2="${x(hoy)}" y1="${T}" y2="${H - B}" class="hoy"><title>Hoy</title></line>
    <line x1="${x(st.fecha)}" x2="${x(st.fecha)}" y1="${T}" y2="${H - B}" class="cursor"><title>Fecha que se está viendo</title></line>
    ${marcas.join("")}`;
  const p = Math.round(cmp.programado(st.fecha)), r = Math.round(cmp.real(Math.min(st.fecha, hoy)));
  const dif = r - p;
  raiz.querySelector("#s-resumen").textContent =
    `Al ${corta(st.fecha)}: programado ${p}, ejecutado ${r} de ${total} elementos (${Math.round((p / total) * 100)} % contra ${Math.round((r / total) * 100)} %). ` +
    (dif === 0 ? "Al día." : `${dif < 0 ? "Atraso" : "Adelanto"} de ${Math.abs(dif)} ${Math.abs(dif) === 1 ? "elemento" : "elementos"}.`);
  raiz.querySelector("#s-leyenda-curva").innerHTML = `
    <span><i class="l-linea l-trazos" style="border-color:${MORADO_PROGRAMA}"></i>Programado (línea base de Project)</span>
    <span><i class="l-linea" style="background:${COLORES.estado.ejecutado.color}"></i>Ejecutado real</span>
    <span><i class="l-corte l-hoy"></i>Hoy</span>
    <span><i class="l-corte"></i>Fecha que se está viendo</span>`;
  raiz.querySelector("#s-nota-curva").textContent =
    `Cuenta solo los elementos de las ${cmp.actividades.length} actividades vinculadas. Si la línea verde va por debajo de la morada, la obra va atrasada frente a la línea base.`;
}

function pintarGantt(els) {
  const porNivel = {};
  els.forEach((e) => (porNivel[e.nivel || "Sin nivel"] ||= []).push(e));
  const filas = Object.entries(porNivel).sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }));
  const span = Math.max(DIA, st.hasta - st.desde);
  const pos = (t) => ((t - st.desde) / span) * 100;
  const cont = raiz.querySelector("#s-gantt");
  if (!filas.length) { cont.innerHTML = `<p class="tenue">Sin datos todavía.</p>`; return; }
  cont.innerHTML = filas.map(([nivel, lista]) => {
    const inicios = lista.map((e) => e.inicio || e.fin).filter(Boolean).map(aFecha);
    const fines = lista.map((e) => e.fin).filter(Boolean).map(aFecha);
    const ejecutados = lista.filter((e) => e.fin && aFecha(e.fin) <= st.fecha).length;
    const pct = Math.round((ejecutados / lista.length) * 100);
    let barra = "";
    if (inicios.length) {
      const a = Math.min(...inicios);
      const terminado = fines.length === lista.length;
      const b = terminado ? Math.max(...fines) : st.hasta;
      const izq = pos(a), ancho = Math.max(0.8, pos(b + DIA) - izq);
      barra = `<div class="g-barra ${terminado ? "fin" : ""}" style="left:${izq}%;width:${ancho}%"
        title="${esc(nivel)}: del ${corta(a)} ${terminado ? "al " + corta(b) : "a hoy (sin terminar)"}">
        <i style="width:${pct}%"></i></div>`;
    }
    return `<div class="g-fila">
      <span class="g-nivel">${esc(nivel)}</span>
      <div class="g-pista">${barra}<div class="g-cursor" style="left:${pos(st.fecha)}%"></div></div>
      <span class="g-pct">${ejecutados}/${lista.length} · ${pct} %</span>
    </div>`;
  }).join("");
}

function pintarLeyenda() {
  const colores = st.modo === "avance" ? COLORES.estado : COLORES.conformidad;
  raiz.querySelector("#s-leyenda").innerHTML = Object.values(colores)
    .map((c) => `<span><i style="background:${c.color}"></i>${c.texto}</span>`).join("") +
    `<span><i style="background:${GRIS_SIN_REVISAR}"></i>Sin revisión</span>`;
}

function reproducir() {
  const rango = raiz.querySelector("#s-rango");
  const max = Number(rango.max);
  let i = Number(rango.value) >= max ? 0 : Number(rango.value);
  const paso = Math.max(1, Math.ceil(max / 40));
  raiz.querySelector("#s-play").textContent = "Pausar";
  st.temporizador = setInterval(async () => {
    i = Math.min(max, i + paso);
    rango.value = i;
    st.fecha = st.desde + i * DIA;
    pintarTiempo();
    await pintarModelo();
    if (i >= max) detener();
  }, 700);
}

function detener() {
  if (st.temporizador) clearInterval(st.temporizador);
  st.temporizador = null;
  const b = raiz && raiz.querySelector("#s-play");
  if (b) b.textContent = "Reproducir";
}

function pintarTodo() {
  pintarTiempo();
  pintarModelo();
}

// ------------------------------------------------------------------ miniatura (visor embebido)

async function abrirModelo() {
  const lienzo = raiz.querySelector("#s-lienzo");
  pintarTiempo();
  if (!st.modelo) return;
  lienzo.innerHTML = `<p class="tenue">Cargando el modelo…</p>`;
  st.visor = null;
  st.actuales = null;
  try {
    const iframe = document.createElement("iframe");
    iframe.className = "seg-iframe";
    const cargado = new Promise((ok) => (iframe.onload = ok));
    iframe.src = TrimbleConnectWorkspace.getConnectEmbedUrl();
    lienzo.innerHTML = "";
    lienzo.appendChild(iframe);
    await cargado;
    const api = await conectarEmbebido(iframe);
    await api.embed.setTokens({ accessToken: ctx.token });
    await api.embed.init3DViewer({ projectId: ctx.proyecto.id, modelId: st.modelo });
    const limite = Date.now() + 90000;
    let cargados = [];
    while (Date.now() < limite) {
      cargados = await api.viewer.getModels("loaded").catch(() => []);
      if (cargados.length) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (!cargados.length) throw new Error("el modelo no terminó de cargar");
    // La miniatura muestra solo el modelo: se esconden barras y paneles del visor.
    for (const [name, state] of [["SidePanel", "collapsed"], ["MainToolbar", "hidden"], ["DetailsPanel", "hidden"]]) {
      try { await api.ui.setUI({ name, state }); } catch (_) { // si la versión de Trimble no lo permite, se deja como está
      }
    }
    try { await api.viewer.setCamera("reset"); } catch (_) { // encuadre por defecto
    }
    st.visor = { api, modeloVisor: cargados[0].id, rt: new Map() };
    pintarProgramacion();
    await pintarModelo();
  } catch (e) {
    mostrarCaptura(`No se pudo abrir el visor aquí (${e.message}).`);
  }
}

function mostrarCaptura(motivo) {
  const lienzo = raiz.querySelector("#s-lienzo");
  const m = (datos.miniaturas || []).find((x) => x.modelo_id === st.modelo);
  lienzo.innerHTML = m
    ? `<img class="seg-img" src="${m.imagen}" alt="">
       <small class="tenue seg-pie">Última captura del visor: ${esc(m.autor_nombre || "")}, ${new Date(m.actualizado_en).toLocaleString("es-CO")}. ${esc(motivo)}</small>`
    : `<p class="tenue">${esc(motivo)} Cuando alguien coloree este modelo por avance en el panel del visor, aquí aparece la captura.</p>`;
}

async function pintarModelo() {
  if (!st.visor) return;
  const v = st.visor.api.viewer;
  const mid = st.visor.modeloVisor;
  const els = elementosDelModelo();
  try {
    const faltan = els.map((e) => e.object_id).filter((id) => !st.visor.rt.has(id));
    for (let i = 0; i < faltan.length; i += 5000) {
      const parte = faltan.slice(i, i + 5000);
      const rts = await v.convertToObjectRuntimeIds(mid, parte);
      parte.forEach((id, k) => st.visor.rt.set(id, rts[k]));
    }
    let clave;
    if (st.modo === "avance") {
      clave = (e) => estadoEn(e, st.fecha);
    } else {
      if (!st.actuales) {
        const r = await obra("estado_modelos", { modeloIds: [st.modelo] });
        st.actuales = new Map(r.elementos.map((x) => [x.object_id, x]));
      }
      clave = (e) => (st.actuales.has(e.object_id) ? claveColor("conformidad", st.actuales.get(e.object_id)) : null);
    }
    const colores = st.modo === "avance" ? COLORES.estado : COLORES.conformidad;
    const grupos = {};
    for (const e of els) {
      const rt = st.visor.rt.get(e.object_id);
      const k = clave(e);
      if (rt == null || !k) continue;
      (grupos[k] ||= []).push(rt);
    }
    await v.setObjectState(undefined, { color: GRIS_SIN_REVISAR });
    for (const [k, ids] of Object.entries(grupos)) {
      await v.setObjectState({ modelObjectIds: [{ modelId: mid, objectRuntimeIds: ids }] }, { color: colores[k].color });
    }
  } catch (e) {
    mostrarCaptura(`El visor dejó de responder (${e.message}).`);
    st.visor = null;
  }
}
