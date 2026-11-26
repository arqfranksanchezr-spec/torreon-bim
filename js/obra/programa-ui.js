// Sección "Programación de obra" del tablero de Control de Obra: carga del XML de Project,
// conteo de elementos del modelo y editor de vínculos actividad → nivel y categoría.
import { obra } from "../backend.js";
import { describir } from "./modelo.js";
import { leerXmlProject, rutas, sugerirRegla, cantidadTarea, estadoActividades } from "./programa.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fCorta = (d) => d ? new Date(d + "T00:00:00Z").toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }) : "—";
const fHora = (iso) => iso ? new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

// ctx: { el, prog: {programa, inventarios}, modelo: () => {id, nombre}, visor: () => {api, modeloVisor} | null,
//        cmp: () => comparación actual | null, fecha: () => ms, recargar: async () => void, aviso }
let c;

export function pintar(contexto) {
  c = contexto;
  const { programa } = c.prog;
  const m = c.modelo();
  const inv = inventarioActual();
  const tareas = programa ? programa.tareas.filter((t) => !t.resumen) : [];
  const vinculadas = programa ? tareas.filter((t) => programa.reglas?.[t.uid]).length : 0;
  const sinBase = tareas.filter((t) => !t.base_fin).length;

  c.el.innerHTML = `
    <div class="prog-cab">
      ${programa
        ? `<div><b>${esc(programa.nombre || programa.archivo || "Programación")}</b>
            <small class="tenue">${esc(programa.archivo || "")} · ${tareas.length} actividades · cargada por ${esc(programa.importado_por || "")} ${fHora(programa.importado_en)}</small></div>`
        : `<p class="tenue">Carga la programación de obra exportada de MS Project para comparar la línea base con la ejecución real que se registra en el visor. En Project: Archivo › Guardar como › tipo "Formato XML".</p>`}
      <div class="prog-botones">
        <label class="btn">${programa ? "Cargar XML nuevo" : "Cargar XML de Project"}<input type="file" id="p-xml" accept=".xml" hidden></label>
        ${programa ? `<button class="btn" id="p-leer" ${c.visor() ? "" : "disabled title=\"Espera a que cargue el modelo de arriba\""}>${inv ? "Volver a leer elementos" : "Leer elementos del modelo"}</button>
          <button class="btn primario" id="p-vincular" ${inv ? "" : "disabled title=\"Primero lee los elementos del modelo\""}>Vincular actividades</button>` : ""}
      </div>
    </div>
    ${programa ? `<ol class="prog-pasos">
      <li class="${programa ? "hecho" : ""}">Programación cargada.</li>
      <li class="${inv ? "hecho" : ""}">${inv
        ? `Elementos de ${esc(m?.nombre || "este modelo")}: ${inv.filas.reduce((a, f) => a + f.cantidad, 0)} en ${new Set(inv.filas.map((f) => f.nivel)).size} niveles (leído ${fHora(inv.leido_en)}).`
        : `Leer los elementos de ${esc(m?.nombre || "el modelo de arriba")} para saber cuántos hay por nivel y categoría.`}</li>
      <li class="${vinculadas ? "hecho" : ""}">${vinculadas} de ${tareas.length} actividades vinculadas a elementos del modelo.</li>
    </ol>` : ""}
    ${sinBase && programa ? `<p class="aviso">${sinBase} actividades no tienen línea base guardada en Project; para ellas se usan las fechas actuales del programa.</p>` : ""}
    <div id="p-atrasos"></div>
    <div id="p-modal" class="modal oculto"></div>`;

  c.el.querySelector("#p-xml").onchange = (e) => cargarXml(e.target.files[0]);
  const leer = c.el.querySelector("#p-leer");
  if (leer) leer.onclick = () => leerInventario(leer);
  const vinc = c.el.querySelector("#p-vincular");
  if (vinc) vinc.onclick = abrirEditor;
  pintarAtrasos();
}

function inventarioActual() {
  const m = c.modelo();
  return m ? c.prog.inventarios.find((i) => i.modelo_id === m.id) || null : null;
}

// Tabla de actividades más atrasadas a la fecha que se está viendo en la línea de tiempo.
export function pintarAtrasos() {
  const caja = c?.el.querySelector("#p-atrasos");
  if (!caja) return;
  const cmp = c.cmp();
  if (!cmp) { caja.innerHTML = ""; return; }
  const estado = estadoActividades(cmp, c.fecha());
  const atrasadas = estado.filter((a) => a.desfase <= -5);
  const fechaTxt = new Date(c.fecha()).toLocaleDateString("es-CO", { day: "2-digit", month: "long", timeZone: "UTC" });
  caja.innerHTML = `
    <h4>${atrasadas.length ? `${atrasadas.length} actividades atrasadas al ${fechaTxt}` : `Ninguna actividad atrasada al ${fechaTxt}`}</h4>
    ${atrasadas.length ? `<table class="tabla prog-tabla">
      <thead><tr><th>Actividad</th><th>Fin línea base</th><th>Elementos</th><th>Programado</th><th>Real</th><th>Desfase</th></tr></thead>
      <tbody>${atrasadas.slice(0, 15).map((a) => `<tr>
        <td>${esc(a.nombre)}<br><small class="tenue">${esc(a.ruta || "")}</small></td>
        <td>${fCorta(a.finBase)}</td>
        <td>${a.cantidad}</td>
        <td>${a.prog} %</td>
        <td>${a.realPct} %</td>
        <td><b class="atraso">${a.desfase} pts</b></td></tr>`).join("")}</tbody></table>
      ${atrasadas.length > 15 ? `<p class="tenue"><small>Se muestran las 15 más atrasadas.</small></p>` : ""}` : ""}`;
}

// ------------------------------------------------------------------ carga del XML

async function cargarXml(archivo) {
  if (!archivo) return;
  try {
    const { nombre, tareas } = leerXmlProject(await archivo.text());
    const r = await obra("guardar_programa", { nombre, archivo: archivo.name, tareas });
    c.aviso(`Programación cargada: ${r.tareas} actividades${r.reglasConservadas ? `; se conservaron ${r.reglasConservadas} vínculos anteriores` : ""}.`);
    await c.recargar();
  } catch (e) {
    c.aviso(e.message, "error");
  }
}

// ------------------------------------------------------------------ conteo de elementos del modelo

async function leerInventario(boton) {
  const visor = c.visor();
  const m = c.modelo();
  if (!visor || !m) return c.aviso("Espera a que cargue el modelo en el seguimiento.", "error");
  boton.disabled = true;
  try {
    const v = visor.api.viewer;
    const grupos = await v.getObjects();
    const grupo = grupos.find((g) => g.modelId === visor.modeloVisor) || grupos[0];
    const ids = (grupo?.objects || []).map((o) => o.id);
    if (!ids.length) throw new Error("el visor no devolvió elementos");
    const cuenta = new Map();
    for (let i = 0; i < ids.length; i += 400) {
      boton.textContent = `Leyendo ${Math.min(i + 400, ids.length)} de ${ids.length}…`;
      const props = await v.getObjectProperties(grupo.modelId, ids.slice(i, i + 400));
      for (const p of props) {
        const d = describir(p);
        const k = `${d.nivel}|~|${d.categoria}`;
        cuenta.set(k, (cuenta.get(k) || 0) + 1);
      }
    }
    const filas = [...cuenta].map(([k, cantidad]) => { const [nivel, categoria] = k.split("|~|"); return { nivel, categoria, cantidad }; });
    const r = await obra("guardar_inventario", { modelo: { id: m.id, nombre: m.nombre }, filas });
    c.aviso(`${r.elementos} elementos leídos de ${m.nombre}.`);
    await c.recargar();
  } catch (e) {
    c.aviso(`No se pudieron leer los elementos: ${e.message}`, "error");
    boton.disabled = false;
  }
}

// ------------------------------------------------------------------ editor de vínculos

function abrirEditor() {
  const { programa } = c.prog;
  const inv = inventarioActual();
  const modal = c.el.querySelector("#p-modal");
  const ruta = rutas(programa.tareas);
  const reglas = JSON.parse(JSON.stringify(programa.reglas || {}));
  const niveles = [...new Set(inv.filas.map((f) => f.nivel))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const categorias = [...new Set(inv.filas.map((f) => f.categoria))].sort((a, b) => a.localeCompare(b, "es"));
  const tareas = programa.tareas.filter((t) => !t.resumen);
  const filtro = { texto: "", sinVincular: false };
  let abierto = null; // "uid|niveles" del selector desplegado

  const resumenSel = (arr, todos) => !arr?.length ? "Todos" : arr.length <= 2 ? arr.join(", ") : `${arr.length} de ${todos}`;

  const pintarTabla = () => {
    const visibles = tareas.filter((t) => {
      if (filtro.sinVincular && reglas[t.uid]) return false;
      if (filtro.texto && !`${t.nombre} ${ruta.get(t.uid)} ${t.wbs}`.toLowerCase().includes(filtro.texto)) return false;
      return true;
    });
    const vinculadas = tareas.filter((t) => reglas[t.uid]).length;
    modal.querySelector("#e-cuenta").textContent = `${vinculadas} de ${tareas.length} vinculadas`;
    modal.querySelector("#e-filas").innerHTML = visibles.slice(0, 400).map((t) => {
      const r = reglas[t.uid];
      const n = r ? cantidadTarea(r, inv.filas) : 0;
      const sel = (campo, lista) => {
        const clave = `${t.uid}|${campo}`;
        const actual = r?.[campo] || [];
        return `<div class="e-sel">
          <button class="btn e-boton ${r ? "" : "vacio"}" data-abrir="${esc(clave)}">${r ? esc(resumenSel(actual, lista.length)) : "—"}</button>
          ${abierto === clave ? `<div class="e-pop">${lista.map((x) => `<label><input type="checkbox" data-uid="${esc(t.uid)}" data-campo="${campo}" value="${esc(x)}" ${actual.includes(x) ? "checked" : ""}> ${esc(x || "(sin nivel)")}</label>`).join("")}
            <button class="btn enlace" data-cerrar>Listo</button></div>` : ""}
        </div>`;
      };
      return `<tr class="${r ? "" : "sin-vinculo"}">
        <td><small class="tenue">${esc(t.wbs)} ${esc(ruta.get(t.uid) || "")}</small><br>${esc(t.nombre)}</td>
        <td><small>${fCorta(t.base_inicio || t.inicio)} – ${fCorta(t.base_fin || t.fin)}</small></td>
        <td>${sel("niveles", niveles)}</td>
        <td>${sel("categorias", categorias)}</td>
        <td>${r ? `<b>${n}</b>` : ""}${r ? ` <button class="btn enlace" data-quitar="${esc(t.uid)}" title="Quitar vínculo">×</button>` : ""}</td></tr>`;
    }).join("") + (visibles.length > 400 ? `<tr><td colspan="5" class="tenue">Se muestran 400; usa el buscador para encontrar las demás.</td></tr>` : "");

    modal.querySelectorAll("[data-abrir]").forEach((b) => (b.onclick = () => { abierto = abierto === b.dataset.abrir ? null : b.dataset.abrir; pintarTabla(); }));
    modal.querySelectorAll("[data-cerrar]").forEach((b) => (b.onclick = () => { abierto = null; pintarTabla(); }));
    modal.querySelectorAll("[data-quitar]").forEach((b) => (b.onclick = () => { delete reglas[b.dataset.quitar]; pintarTabla(); }));
    modal.querySelectorAll(".e-pop input").forEach((inp) => (inp.onchange = () => {
      const r = (reglas[inp.dataset.uid] ||= { niveles: [], categorias: [] });
      const lista = new Set(r[inp.dataset.campo] || []);
      inp.checked ? lista.add(inp.value) : lista.delete(inp.value);
      r[inp.dataset.campo] = [...lista];
      if (!r.niveles.length && !r.categorias.length) delete reglas[inp.dataset.uid];
      pintarTabla();
    }));
  };

  modal.classList.remove("oculto");
  modal.innerHTML = `<div class="caja ancha">
    <h2>Vincular actividades con elementos del modelo</h2>
    <p class="tenue">Cada actividad cuenta los elementos del nivel y la categoría que elijas. "Todos" en nivel sirve para actividades que no son de un piso, por ejemplo la cimentación. Las actividades sin vínculo no entran en la comparación.</p>
    <div class="e-barra">
      <button class="btn" id="e-sugerir">Sugerir vínculos</button>
      <input id="e-buscar" class="buscar" placeholder="Buscar actividad">
      <label><input type="checkbox" id="e-sin"> Solo sin vincular</label>
      <span class="tenue" id="e-cuenta"></span>
    </div>
    <div class="e-tabla"><table class="tabla">
      <thead><tr><th>Actividad</th><th>Línea base</th><th>Nivel</th><th>Categoría</th><th>Elem.</th></tr></thead>
      <tbody id="e-filas"></tbody></table></div>
    <div class="acciones"><button class="btn" id="e-cancelar">Cancelar</button><button class="btn primario" id="e-guardar">Guardar vínculos</button></div>
  </div>`;
  modal.querySelector("#e-cancelar").onclick = () => modal.classList.add("oculto");
  modal.querySelector("#e-buscar").oninput = (e) => { filtro.texto = e.target.value.toLowerCase(); pintarTabla(); };
  modal.querySelector("#e-sin").onchange = (e) => { filtro.sinVincular = e.target.checked; pintarTabla(); };
  modal.querySelector("#e-sugerir").onclick = () => {
    let n = 0;
    for (const t of tareas) {
      if (reglas[t.uid]) continue;
      const r = sugerirRegla(t, ruta.get(t.uid) || "", inv.filas);
      if (r && cantidadTarea(r, inv.filas)) { reglas[t.uid] = r; n++; }
    }
    c.aviso(n ? `Se sugirieron ${n} vínculos. Revísalos antes de guardar.` : "No encontré actividades para sugerir. Vincúlalas a mano.");
    pintarTabla();
  };
  modal.querySelector("#e-guardar").onclick = async (ev) => {
    ev.target.disabled = true;
    try {
      const r = await obra("guardar_reglas", { reglas });
      modal.classList.add("oculto");
      c.aviso(`${r.reglas} actividades vinculadas.`);
      await c.recargar();
    } catch (e) { c.aviso(e.message, "error"); ev.target.disabled = false; }
  };
  pintarTabla();
}
