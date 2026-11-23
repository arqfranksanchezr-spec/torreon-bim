// Módulo Control de Obra del menú del proyecto: resumen, revisiones y no conformidades.
// Las revisiones se registran desde el panel del visor 3D (visor.html).
import { trimble } from "../trimble.js";
import { obra } from "../backend.js";
import { COLORES, claveColor } from "../obra/modelo.js";
import * as seguimiento from "../obra/seguimiento.js";
import * as anexos from "../obra/anexos.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fecha = (iso) => iso ? new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const unicos = (arr) => [...new Set(arr.filter(Boolean))];

let raiz, datos = { actuales: [], revisiones: [] };
const filtros = { texto: "", estado: "", conformidad: "", nivel: "" };

export async function mostrar(el) {
  raiz = el;
  raiz.innerHTML = `
    <header class="encabezado">
      <h1>Control de Obra</h1>
      <input id="o-buscar" class="buscar" placeholder="Buscar elemento, nota o REV">
      <button id="o-csv" class="btn">Exportar a Excel (CSV)</button>
    </header>
    <p class="tenue o-ayuda">Las revisiones se registran desde el visor 3D: abre el modelo, selecciona los elementos y usa el panel Control de Obra.</p>
    <section id="o-tarjetas" class="tarjetas"></section>
    <div id="f-avisos"></div>
    <h3>Seguimiento</h3>
    <section id="o-seguimiento"></section>
    <h3>Avance por nivel</h3>
    <table class="tabla" id="o-niveles"></table>
    <h3>Revisiones</h3>
    <section class="filtros">
      <select id="o-estado"><option value="">Todos los estados</option>
        ${Object.entries(COLORES.estado).map(([k, c]) => `<option value="${k}">${c.texto}</option>`).join("")}</select>
      <select id="o-conf"><option value="">Toda conformidad</option>
        <option value="no_conforme">No conformes abiertas</option>
        <option value="corregido">No conformidades cerradas</option>
        <option value="conforme">Conformes</option>
        <option value="sin_chequeo">Sin lista de chequeo</option></select>
      <select id="o-nivel"><option value="">Todos los niveles</option></select>
    </section>
    <table class="tabla">
      <thead><tr><th>Revisión</th><th>Elementos</th><th>Estado</th><th>Conformidad</th><th>Fotos / anexos</th><th>Por</th></tr></thead>
      <tbody id="o-filas"><tr><td colspan="6" class="tenue">Cargando…</td></tr></tbody>
    </table>
    <aside id="o-panel" class="panel oculto"></aside>`;

  raiz.querySelector("#o-buscar").oninput = (e) => { filtros.texto = e.target.value.toLowerCase(); pintarTabla(); };
  raiz.querySelector("#o-estado").onchange = (e) => { filtros.estado = e.target.value; pintarTabla(); };
  raiz.querySelector("#o-conf").onchange = (e) => { filtros.conformidad = e.target.value; pintarTabla(); };
  raiz.querySelector("#o-nivel").onchange = (e) => { filtros.nivel = e.target.value; pintarTabla(); };
  raiz.querySelector("#o-csv").onclick = exportarCsv;
  await recargar();
  seguimiento.montar(raiz.querySelector("#o-seguimiento"), datos.revisiones);
}

export function salir() { seguimiento.desmontar(); }

const soloFecha = (d) => d ? new Date(d + "T00:00:00Z").toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "";

async function recargar() {
  try { datos = await obra("resumen"); }
  catch (e) { aviso(e.message, "error"); return; }
  const niveles = unicos(datos.revisiones.flatMap((r) => r.obra_revision_elementos.map((e) => e.nivel))).sort();
  raiz.querySelector("#o-nivel").innerHTML = `<option value="">Todos los niveles</option>` +
    niveles.map((n) => `<option ${filtros.nivel === n ? "selected" : ""}>${esc(n)}</option>`).join("");
  pintarTarjetas();
  pintarNiveles();
  pintarTabla();
}

function aviso(texto, tipo = "info") {
  const d = document.createElement("div");
  d.className = `aviso ${tipo}`;
  d.textContent = texto;
  raiz.querySelector("#f-avisos").prepend(d);
  setTimeout(() => d.remove(), 8000);
}

function pintarTarjetas() {
  const a = datos.actuales;
  const cuenta = (k) => a.filter((e) => e.estado === k).length;
  const ncAbiertas = datos.revisiones.filter((r) => r.conformidad === "no_conforme" && !r.nc_cerrada).length;
  raiz.querySelector("#o-tarjetas").innerHTML = `
    <div class="tarjeta"><span>Elementos revisados</span><b>${a.length}</b><small>${datos.revisiones.length} revisiones registradas</small></div>
    <div class="tarjeta verde"><span>Ejecutados</span><b>${cuenta("ejecutado")}</b><small>${pct(cuenta("ejecutado"), a.length)} % de lo revisado</small></div>
    <div class="tarjeta"><span>En ejecución</span><b>${cuenta("en_ejecucion")}</b><small>elementos</small></div>
    <div class="tarjeta"><span>No iniciados</span><b>${cuenta("no_iniciado")}</b><small>elementos</small></div>
    <div class="tarjeta rojo ${ncAbiertas ? "resalta" : ""}" data-nc><span>No conformidades abiertas</span><b>${ncAbiertas}</b><small>revisiones por cerrar</small></div>`;
  raiz.querySelector("[data-nc]").onclick = () => {
    filtros.conformidad = "no_conforme"; raiz.querySelector("#o-conf").value = "no_conforme"; pintarTabla();
  };
}

function pintarNiveles() {
  const porNivel = {};
  for (const e of datos.actuales) {
    const n = e.nivel || "Sin nivel";
    const f = (porNivel[n] ||= { total: 0, ejecutado: 0, en_ejecucion: 0, no_iniciado: 0, nc: 0 });
    f.total++; f[e.estado]++;
    if (e.conformidad === "no_conforme" && !e.nc_cerrada) f.nc++;
  }
  const filas = Object.entries(porNivel).sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }));
  raiz.querySelector("#o-niveles").innerHTML = `
    <thead><tr><th>Nivel</th><th>Revisados</th><th>Ejecutados</th><th>En ejecución</th><th>No iniciados</th><th>Con NC abierta</th><th>Avance</th></tr></thead>
    <tbody>${filas.length ? filas.map(([n, f]) => `<tr>
      <td><b>${esc(n)}</b></td><td>${f.total}</td><td>${f.ejecutado}</td><td>${f.en_ejecucion}</td><td>${f.no_iniciado}</td>
      <td class="${f.nc ? "vencido" : ""}">${f.nc}</td>
      <td><div class="barra"><i style="width:${pct(f.ejecutado, f.total)}%"></i></div><small>${pct(f.ejecutado, f.total)} %</small></td></tr>`).join("")
      : `<tr><td colspan="7" class="tenue">Todavía no hay revisiones.</td></tr>`}</tbody>`;
}

function resumenElementos(r) {
  const els = r.obra_revision_elementos;
  const cats = unicos(els.map((e) => e.categoria));
  const nivs = unicos(els.map((e) => e.nivel));
  if (els.length === 1) return `${esc(els[0].nombre)}<br><small class="tenue">${esc(els[0].categoria)} · ${esc(els[0].nivel)}</small>`;
  return `${els.length} elementos<br><small class="tenue">${esc(cats.slice(0, 3).join(", "))}${cats.length > 3 ? "…" : ""} · ${esc(nivs.slice(0, 3).join(", "))}${nivs.length > 3 ? "…" : ""}</small>`;
}

function filtradas() {
  return datos.revisiones.filter((r) => {
    if (filtros.estado && r.estado !== filtros.estado) return false;
    if (filtros.conformidad && claveColor("conformidad", r) !== filtros.conformidad) return false;
    if (filtros.nivel && !r.obra_revision_elementos.some((e) => e.nivel === filtros.nivel)) return false;
    if (filtros.texto) {
      const t = `rev-${r.numero} ${r.observaciones || ""} ${r.autor_nombre} ${r.modelo_nombre || ""} ${r.obra_revision_elementos.map((e) => `${e.nombre} ${e.categoria}`).join(" ")}`.toLowerCase();
      if (!t.includes(filtros.texto)) return false;
    }
    return true;
  });
}

function pintarTabla() {
  const filas = filtradas();
  const tbody = raiz.querySelector("#o-filas");
  if (!filas.length) { tbody.innerHTML = `<tr><td colspan="6" class="tenue">No hay revisiones con estos filtros.</td></tr>`; return; }
  tbody.innerHTML = filas.map((r) => {
    const k = claveColor("conformidad", r);
    return `<tr data-id="${r.id}">
      <td><b>REV-${r.numero}</b><br><small class="tenue">Ejecución ${soloFecha(r.fecha_ejecucion)}</small></td>
      <td>${resumenElementos(r)}</td>
      <td><span class="punto" style="background:${COLORES.estado[r.estado].color}"></span>${COLORES.estado[r.estado].texto}</td>
      <td><span class="chip" style="background:${COLORES.conformidad[k].color}22;color:${COLORES.conformidad[k].color}">${COLORES.conformidad[k].texto}</span></td>
      <td>${r.fotos.length ? `${r.fotos.length} fotos` : ""}${r.fotos.length && (r.anexos || []).length ? "<br>" : ""}${(r.anexos || []).length ? `<b>${r.anexos.length} ${r.anexos.length === 1 ? "anexo" : "anexos"}</b>` : ""}</td>
      <td><small>${esc(r.autor_nombre)}</small></td></tr>`;
  }).join("");
  tbody.querySelectorAll("tr[data-id]").forEach((tr) => (tr.onclick = () => abrirDetalle(tr.dataset.id)));
}

function abrirDetalle(id) {
  const r = datos.revisiones.find((x) => x.id === id);
  const panel = raiz.querySelector("#o-panel");
  const k = claveColor("conformidad", r);
  const els = r.obra_revision_elementos;
  panel.classList.remove("oculto");
  panel.innerHTML = `
    <div class="panel-cab">
      <div><small class="tenue">${fecha(r.creado_en)} · ${esc(r.autor_nombre)}</small><h2>REV-${r.numero}</h2></div>
      <button class="btn enlace" id="p-cerrar">Cerrar</button>
    </div>
    <dl class="meta">
      <dt>Modelo</dt><dd>${esc(r.modelo_nombre || r.modelo_id)}</dd>
      <dt>Ejecución</dt><dd>${soloFecha(r.fecha_ejecucion)}</dd>
      <dt>Estado</dt><dd>${COLORES.estado[r.estado].texto}</dd>
      <dt>Conformidad</dt><dd style="color:${COLORES.conformidad[k].color}">${COLORES.conformidad[k].texto}</dd>
      <dt>Lista</dt><dd>${esc(r.lista || "Sin lista")}</dd>
    </dl>
    ${r.resultados.length ? `<h3>Chequeo</h3><ul class="resultados">${r.resultados.map((x) =>
      `<li><span>${esc(x.item)}</span><b class="r-${x.resultado}">${x.resultado === "NA" ? "N/A" : x.resultado}</b></li>`).join("")}</ul>` : ""}
    ${r.observaciones ? `<h3>Observaciones</h3><p>${esc(r.observaciones)}</p>` : ""}
    ${r.fotos.length ? `<h3>Fotos</h3><div class="lista-fotos">${r.fotos.map((f) =>
      `<button class="btn" data-foto="${esc(f.file_id)}">${esc(f.nombre)}</button>`).join("")}</div>
      <p class="tenue"><small>Están en la carpeta de fotos de control de obra del proyecto.</small></p>` : ""}
    <h3>Anexos <small class="tenue">${(r.anexos || []).length}</small></h3>
    ${(r.anexos || []).length ? `<ul class="lista-anexos">${r.anexos.map((a) => `<li>
        <button class="btn enlace" data-anexo="${esc(a.file_id)}">${esc(a.nombre)}</button>
        <small class="tenue">${esc(a.categoria)} · ${anexos.tamano(a.bytes || 0)} · ${esc(a.subido_por || "")} · ${fecha(a.subido_en)}</small></li>`).join("")}</ul>
      <p class="tenue"><small>Están en la carpeta "Control de Obra - Anexos" del proyecto.</small></p>`
      : `<p class="tenue">Sin anexos.</p>`}
    ${(r.anexos || []).length < anexos.MAX_ANEXOS ? `<div class="anexo-nuevo">
      <select id="p-anexo-tipo">${anexos.TIPOS_ANEXO.map((t) => `<option>${t}</option>`).join("")}</select>
      <label class="btn">Anexar archivo<input type="file" id="p-anexo" accept="${anexos.ACEPTA}" multiple hidden></label>
    </div>
    <p class="tenue"><small>Por ejemplo el resultado de los cilindros a 7 o 28 días. Hasta ${anexos.MAX_MB} MB por archivo.</small></p>` : ""}
    ${r.conformidad === "no_conforme" ? (r.nc_cerrada
      ? `<h3>Cierre de la no conformidad</h3><p>${esc(r.nc_nota_cierre)}<br><small class="tenue">${esc(r.nc_cerrada_por)} · ${fecha(r.nc_cerrada_en)}</small></p>`
      : `<h3>Cerrar no conformidad</h3>
         <textarea id="p-nota" rows="3" style="width:100%" placeholder="Cómo se corrigió y quién lo verificó"></textarea>
         <button class="btn primario" id="p-cerrar-nc">Cerrar no conformidad</button>
         <p class="tenue"><small>Lo ideal es registrar además una revisión nueva en el visor con el elemento corregido.</small></p>`) : ""}
    <h3>Elementos <small class="tenue">${els.length}</small></h3>
    <ul class="elementos">${els.slice(0, 100).map((e) =>
      `<li>${esc(e.nombre)}<br><small class="tenue">${esc(e.categoria)} · ${esc(e.nivel)}</small></li>`).join("")}
      ${els.length > 100 ? `<li class="tenue">y ${els.length - 100} más (salen completos en el CSV)</li>` : ""}</ul>`;

  panel.querySelector("#p-cerrar").onclick = () => panel.classList.add("oculto");
  panel.querySelectorAll("[data-foto]").forEach((b) => (b.onclick = async () => {
    const ventana = window.open("", "_blank");
    try { ventana.location = await trimble.urlDescarga(b.dataset.foto); }
    catch (e) { ventana && ventana.close(); aviso(e.message, "error"); }
  }));
  panel.querySelectorAll("[data-anexo]").forEach((b) => (b.onclick = async () => {
    const ventana = window.open("", "_blank");
    try { ventana.location = await trimble.urlDescarga(b.dataset.anexo); }
    catch (e) { ventana && ventana.close(); aviso(e.message, "error"); }
  }));
  const nuevo = panel.querySelector("#p-anexo");
  if (nuevo) nuevo.onchange = async () => {
    const { ok, grandes } = anexos.filtrar([...nuevo.files], (r.anexos || []).length);
    if (grandes.length) aviso(`No se anexan por pasar de ${anexos.MAX_MB} MB: ${grandes.join(", ")}`, "error");
    if (!ok.length) return;
    const tipo = panel.querySelector("#p-anexo-tipo").value;
    ok.forEach((a) => (a.tipo = tipo));
    nuevo.disabled = true;
    const fallidos = await anexos.subir(r.id, ok, (i, n, nombre) => aviso(`Subiendo ${i} de ${n}: ${nombre}`));
    aviso(fallidos.length ? `No subieron: ${fallidos.join("; ")}` : `REV-${r.numero}: ${ok.length} ${ok.length === 1 ? "anexo agregado" : "anexos agregados"}.`, fallidos.length ? "error" : "info");
    await recargar();
    abrirDetalle(r.id);
  };
  const cerrarNc = panel.querySelector("#p-cerrar-nc");
  if (cerrarNc) cerrarNc.onclick = async () => {
    const nota = panel.querySelector("#p-nota").value.trim();
    if (!nota) return aviso("Escribe cómo se corrigió.", "error");
    cerrarNc.disabled = true;
    try {
      await obra("cerrar_nc", { revisionId: r.id, nota });
      aviso("No conformidad cerrada.");
      await recargar();
      abrirDetalle(r.id);
    } catch (e) { aviso(e.message, "error"); cerrarNc.disabled = false; }
  };
}

function exportarCsv() {
  const cab = ["Revisión", "Fecha de ejecución", "Fecha de registro", "Responsable", "Modelo", "Nivel", "Categoría", "Elemento", "Id elemento",
    "Estado", "Conformidad", "Chequeo", "Observaciones", "Fotos", "Anexos", "Cierre NC"];
  const celda = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const lineas = [cab.map(celda).join(";")];
  for (const r of filtradas()) {
    const k = claveColor("conformidad", r);
    const chequeo = r.resultados.map((x) => `${x.item}: ${x.resultado}`).join(" | ");
    for (const e of r.obra_revision_elementos) {
      lineas.push([`REV-${r.numero}`, soloFecha(r.fecha_ejecucion), fecha(r.creado_en), r.autor_nombre, r.modelo_nombre, e.nivel, e.categoria, e.nombre, e.object_id,
        COLORES.estado[r.estado].texto, COLORES.conformidad[k].texto, chequeo, r.observaciones, r.fotos.map((f) => f.nombre).join(", "),
        (r.anexos || []).map((a) => `${a.categoria}: ${a.nombre}`).join(", "),
        r.nc_cerrada ? `${r.nc_nota_cierre} (${r.nc_cerrada_por}, ${fecha(r.nc_cerrada_en)})` : ""].map(celda).join(";"));
    }
  }
  const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `control-obra-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
