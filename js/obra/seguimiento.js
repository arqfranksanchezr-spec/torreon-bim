// Seguimiento de Control de Obra en el tablero del proyecto:
// miniatura del modelo con los colores del seguimiento y línea de tiempo de la ejecución.
import { ctx } from "../trimble.js";
import { obra } from "../backend.js";
import { COLORES, claveColor, hoyLocal } from "./modelo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DIA = 86400000;
const aFecha = (s) => new Date(s + "T00:00:00Z").getTime();
const aTexto = (t) => new Date(t).toISOString().slice(0, 10);
const corta = (t) => new Date(t).toLocaleDateString("es-CO", { day: "2-digit", month: "short", timeZone: "UTC" });
const GRIS_SIN_REVISAR = "#E4E7EB";

let raiz, datos, modelos = [], st = null;

// estado del elemento en una fecha según sus fechas de inicio y fin
function estadoEn(e, t) {
  if (e.fin && aFecha(e.fin) <= t) return "ejecutado";
  if (e.inicio && aFecha(e.inicio) <= t) return "en_ejecucion";
  return "no_iniciado";
}

export async function montar(el, revisiones) {
  raiz = el;
  if (st && st.temporizador) clearInterval(st.temporizador);
  const vistos = new Map();
  revisiones.forEach((r) => { if (!vistos.has(r.modelo_id)) vistos.set(r.modelo_id, r.modelo_nombre || r.modelo_id); });
  modelos = [...vistos].map(([id, nombre]) => ({ id, nombre }));

  raiz.innerHTML = `<p class="tenue">Cargando seguimiento…</p>`;
  try { datos = await obra("linea_tiempo"); }
  catch (e) { raiz.innerHTML = `<div class="aviso error">No se pudo cargar el seguimiento: ${esc(e.message)}</div>`; return; }

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
  };

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
          <span class="tenue" id="s-resumen"></span>
        </div>
        <svg id="s-curva" viewBox="0 0 800 230" preserveAspectRatio="none"></svg>
        <div class="seg-control">
          <button class="btn" id="s-play">Reproducir</button>
          <input type="range" id="s-rango" min="0" max="${Math.round((st.hasta - st.desde) / DIA)}" value="${Math.round((st.hasta - st.desde) / DIA)}">
          <b id="s-fecha"></b>
        </div>
      </div>
    </div>
    <h3>Ejecución por nivel en el tiempo</h3>
    <div id="s-gantt" class="seg-gantt"></div>`;

  raiz.querySelector("#s-modelo").onchange = (e) => { st.modelo = e.target.value; abrirModelo(); };
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
  abrirModelo();
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

  raiz.querySelector("#s-curva").innerHTML = total ? `
    ${yMarcas}
    <path d="${area(puntosI)}" fill="${COLORES.estado.en_ejecucion.color}" opacity=".25"/>
    <path d="${linea(puntosI)}" fill="none" stroke="${COLORES.estado.en_ejecucion.color}" stroke-width="2"/>
    <path d="${area(puntosE)}" fill="${COLORES.estado.ejecutado.color}" opacity=".25"/>
    <path d="${linea(puntosE)}" fill="none" stroke="${COLORES.estado.ejecutado.color}" stroke-width="2.5"/>
    <line x1="${x(st.fecha)}" x2="${x(st.fecha)}" y1="${T}" y2="${H - B}" class="cursor"/>
    ${marcas.join("")}` :
    `<text x="400" y="115" text-anchor="middle" class="eje">Todavía no hay revisiones con fecha de ejecución en este modelo.</text>`;

  raiz.querySelector("#s-fecha").textContent = new Date(st.fecha).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
  raiz.querySelector("#s-resumen").textContent = total
    ? `Al ${corta(st.fecha)}: ${eHoy} ejecutados y ${iHoy} en ejecución de ${total} elementos revisados (${Math.round((eHoy / total) * 100)} %)`
    : "";
  pintarGantt(els, x);
  pintarLeyenda();
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
    const api = await TrimbleConnectWorkspace.connect(iframe, () => {}, 30000);
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
    st.visor = { api, modeloVisor: cargados[0].id, rt: new Map() };
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
