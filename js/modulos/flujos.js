// Módulo Flujos documentales: revisión y aprobación de archivos por pasos.
import { CONFIG } from "../config.js";
import { ctx, trimble, nombreUsuario } from "../trimble.js";
import { backend } from "../backend.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const igual = (a, b) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
const fecha = (iso) => iso ? new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
const soloFecha = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const hora = (iso) => new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
const ESTADOS = { pendiente: "En revisión", rechazado: "Rechazado", aprobado: "Aprobado" };

let raiz, datos = { yo: null, flujos: [] }, temporizador = null;
const filtros = { texto: "", meToca: false, estado: "activos" };
let abierto = null; // id del flujo abierto en el panel

const meToca = (f, a) => a.estado === "pendiente" && f.activo && igual(f.pasos[a.paso_actual]?.responsable_email, datos.yo?.email);

// ------------------------------------------------------------------ vista principal

export async function mostrar(el) {
  raiz = el;
  raiz.innerHTML = `
    <header class="encabezado">
      <h1>Flujos documentales</h1>
      <input id="f-buscar" class="buscar" placeholder="Buscar flujo">
      <button id="f-nuevo" class="btn primario">Nuevo flujo</button>
    </header>
    <section id="f-tarjetas" class="tarjetas"></section>
    <div class="linea-estado"><span id="f-revision">Revisando versiones…</span>
      <button id="f-revisar" class="btn enlace">Revisar ahora</button></div>
    <div id="f-avisos"></div>
    <section class="filtros">
      <label><input type="checkbox" id="f-metoca"> Solo lo que me toca revisar</label>
      <select id="f-estado">
        <option value="activos">Activos</option>
        <option value="desactivados">Desactivados</option>
        <option value="todos">Todos</option>
      </select>
      <button id="f-limpiar" class="btn enlace">Quitar filtros</button>
    </section>
    <table class="tabla">
      <thead><tr><th>Nombre</th><th>Archivos</th><th>Por revisar</th><th>Vence</th><th>Responsables</th><th>Estado</th></tr></thead>
      <tbody id="f-filas"><tr><td colspan="6" class="tenue">Cargando…</td></tr></tbody>
    </table>
    <aside id="f-panel" class="panel oculto"></aside>
    <div id="f-modal" class="modal oculto"></div>`;

  raiz.querySelector("#f-buscar").oninput = (e) => { filtros.texto = e.target.value; pintarTabla(); };
  raiz.querySelector("#f-metoca").onchange = (e) => { filtros.meToca = e.target.checked; pintarTabla(); };
  raiz.querySelector("#f-estado").onchange = (e) => { filtros.estado = e.target.value; pintarTabla(); };
  raiz.querySelector("#f-limpiar").onclick = () => {
    Object.assign(filtros, { texto: "", meToca: false, estado: "activos" });
    raiz.querySelector("#f-buscar").value = ""; raiz.querySelector("#f-metoca").checked = false; raiz.querySelector("#f-estado").value = "activos";
    pintarTabla();
  };
  raiz.querySelector("#f-nuevo").onclick = abrirNuevo;
  raiz.querySelector("#f-revisar").onclick = revisarVersiones;

  await recargar();
  revisarVersiones();
  temporizador = setInterval(revisarVersiones, CONFIG.MINUTOS_REVISION_VERSIONES * 60 * 1000);
}

export function salir() { clearInterval(temporizador); }

async function recargar() {
  try {
    datos = await backend("resumen");
  } catch (e) {
    aviso(e.message, "error");
    return;
  }
  pintarTarjetas();
  pintarTabla();
  if (abierto) abrirDetalle(abierto);
}

function aviso(texto, tipo = "info") {
  const caja = raiz.querySelector("#f-avisos");
  const div = document.createElement("div");
  div.className = `aviso ${tipo}`;
  div.textContent = texto;
  caja.prepend(div);
  setTimeout(() => div.remove(), 9000);
}

async function revisarVersiones() {
  const etiqueta = raiz.querySelector("#f-revision");
  try {
    const r = await backend("revisar_versiones");
    etiqueta.textContent = r.cambios.length
      ? `Archivos revisados a las ${hora(r.hora)}: ${r.cambios.length} con versión nueva (${r.cambios.join(", ")}). Se avisó a los revisores.`
      : `Archivos revisados a las ${hora(r.hora)}: no hay versiones nuevas.`;
    if (r.cambios.length) recargar();
  } catch (e) {
    etiqueta.textContent = `No se pudieron revisar las versiones: ${e.message}`;
  }
}

function pintarTarjetas() {
  const fl = datos.flujos;
  const activos = fl.filter((f) => f.activo);
  const archivos = activos.flatMap((f) => f.flujo_archivos.map((a) => ({ f, a })));
  const mios = archivos.filter(({ f, a }) => meToca(f, a)).length;
  const pend = archivos.filter(({ a }) => a.estado === "pendiente").length;
  const rech = archivos.filter(({ a }) => a.estado === "rechazado").length;
  const aprob = archivos.filter(({ a }) => a.estado === "aprobado").length;
  raiz.querySelector("#f-tarjetas").innerHTML = `
    <div class="tarjeta"><span>Flujos</span><b>${fl.length}</b><small>${activos.length} activos · ${fl.length - activos.length} desactivados</small></div>
    <div class="tarjeta ${mios ? "resalta" : ""}" data-filtro="metoca"><span>Me toca</span><b>${mios}</b><small>${mios === 1 ? "archivo espera" : "archivos esperan"} tu revisión</small></div>
    <div class="tarjeta"><span>En revisión</span><b>${pend}</b><small>archivos avanzando por pasos</small></div>
    <div class="tarjeta rojo"><span>Rechazados</span><b>${rech}</b><small>esperan corrección</small></div>
    <div class="tarjeta verde"><span>Aprobados</span><b>${aprob}</b><small>terminaron el flujo</small></div>`;
  raiz.querySelector('[data-filtro="metoca"]').onclick = () => {
    filtros.meToca = true; raiz.querySelector("#f-metoca").checked = true; pintarTabla();
  };
}

function pintarTabla() {
  const t = filtros.texto.trim().toLowerCase();
  const filas = datos.flujos.filter((f) => {
    if (filtros.estado === "activos" && !f.activo) return false;
    if (filtros.estado === "desactivados" && f.activo) return false;
    if (filtros.meToca && !f.flujo_archivos.some((a) => meToca(f, a))) return false;
    if (t && !(`${f.nombre} flujo-${f.numero}`.toLowerCase().includes(t))) return false;
    return true;
  });
  const tbody = raiz.querySelector("#f-filas");
  if (filas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="tenue">${filtros.meToca
      ? "No tienes archivos esperando tu revisión: aquí salen los flujos donde eres responsable del paso que espera."
      : "No hay flujos con estos filtros."}</td></tr>`;
    return;
  }
  const hoy = new Date().toISOString().slice(0, 10);
  tbody.innerHTML = filas.map((f) => {
    const arch = f.flujo_archivos;
    const porRevisar = arch.filter((a) => a.estado === "pendiente").length;
    const terminado = arch.length > 0 && arch.every((a) => a.estado === "aprobado");
    const vencido = f.vence && f.vence < hoy && !terminado;
    const estado = !f.activo ? "Desactivado" : terminado ? "Aprobado" : arch.some((a) => a.estado === "rechazado") ? "Con rechazos" : "En curso";
    const clase = !f.activo ? "gris" : terminado ? "verde" : estado === "Con rechazos" ? "rojo" : "azul";
    const mio = arch.some((a) => meToca(f, a));
    return `<tr data-id="${f.id}" class="${mio ? "mia" : ""}">
      <td><b>${esc(f.nombre)}</b><br><small class="tenue">FLUJO-${f.numero}</small></td>
      <td>${arch.length}</td>
      <td>${porRevisar}${mio ? ' <span class="chip azul">te toca</span>' : ""}</td>
      <td class="${vencido ? "vencido" : ""}">${soloFecha(f.vence)}</td>
      <td><small>${f.pasos.slice(1).map((p) => esc(`${p.nombre}: ${p.responsable_nombre || p.responsable_email}`)).join("<br>")}</small></td>
      <td><span class="chip ${clase}">${estado}</span></td></tr>`;
  }).join("");
  tbody.querySelectorAll("tr[data-id]").forEach((tr) => (tr.onclick = () => abrirDetalle(tr.dataset.id)));
}

// ------------------------------------------------------------------ panel de detalle

async function abrirDetalle(id) {
  abierto = id;
  const panel = raiz.querySelector("#f-panel");
  panel.classList.remove("oculto");
  panel.innerHTML = `<div class="tenue">Cargando…</div>`;
  let d;
  try { d = await backend("detalle", { flujoId: id }); }
  catch (e) { panel.innerHTML = `<div class="aviso error">${esc(e.message)}</div>`; return; }

  const { flujo: f, archivos, eventos } = d;
  datos.yo = d.yo;
  const soyCreador = igual(f.creado_por_email, datos.yo.email);
  const misArchivos = archivos.filter((a) => meToca(f, a));
  let pestaña = misArchivos.length ? "mios" : "todos";

  panel.innerHTML = `
    <div class="panel-cab">
      <div><small class="tenue">FLUJO-${f.numero}</small><h2>${esc(f.nombre)}</h2></div>
      <button class="btn enlace" id="p-cerrar">Cerrar</button>
    </div>
    ${f.descripcion ? `<p>${esc(f.descripcion)}</p>` : ""}
    <div class="pasos">${f.pasos.map((p, i) => `<div class="paso"><b>${i + 1}. ${esc(p.nombre)}</b><small>${esc(p.responsable_nombre || p.responsable_email)}</small></div>`).join('<span class="flecha">→</span>')}</div>
    <dl class="meta">
      <dt>Creado</dt><dd>${fecha(f.creado_en)} por ${esc(f.creado_por_nombre || f.creado_por_email)}</dd>
      <dt>Modificado</dt><dd>${fecha(f.modificado_en)} por ${esc(f.modificado_por_nombre || f.modificado_por_email || "")}</dd>
      <dt>Vence</dt><dd>${soloFecha(f.vence)}</dd>
      <dt>Estado</dt><dd>${f.activo ? "Activo" : "Desactivado"} ${soyCreador ? `<button class="btn enlace" id="p-activo">${f.activo ? "Desactivar" : "Activar"}</button>` : ""}</dd>
    </dl>
    <h3>Archivos <small class="tenue">${archivos.length}</small></h3>
    <div class="pestañas">
      <button data-p="mios">Me toca (${misArchivos.length})</button>
      <button data-p="todos">Todos (${archivos.length})</button>
    </div>
    <div id="p-archivos"></div>
    <h3>Historial</h3>
    <ol class="historial">${eventos.map((e) => `
      <li><small class="tenue">${fecha(e.creado_en)} · ${esc(e.actor_nombre || e.actor_email || "")}</small> · <b>${esc(e.tipo)}</b><br>${esc(e.detalle)}</li>`).join("") || '<li class="tenue">Sin movimientos.</li>'}
    </ol>`;

  panel.querySelector("#p-cerrar").onclick = () => { abierto = null; panel.classList.add("oculto"); };
  const btnActivo = panel.querySelector("#p-activo");
  if (btnActivo) btnActivo.onclick = async () => {
    try { await backend("cambiar_estado", { flujoId: f.id, activo: !f.activo }); recargar(); }
    catch (e) { aviso(e.message, "error"); }
  };

  const pintarArchivos = () => {
    panel.querySelectorAll(".pestañas button").forEach((b) => b.classList.toggle("activa", b.dataset.p === pestaña));
    const lista = pestaña === "mios" ? misArchivos : archivos;
    const caja = panel.querySelector("#p-archivos");
    if (lista.length === 0) {
      caja.innerHTML = `<p class="tenue">No tienes archivos esperando tu revisión en este flujo.</p>`;
      return;
    }
    caja.innerHTML = lista.map((a) => {
      const paso = f.pasos[a.paso_actual];
      const donde = a.estado === "aprobado" ? "Terminó el flujo"
        : a.estado === "rechazado" ? `Corrige ${esc(paso.responsable_nombre || paso.responsable_email)}`
        : `Espera «${esc(paso.nombre)}»: ${esc(paso.responsable_nombre || paso.responsable_email)}`;
      const clase = { pendiente: "azul", rechazado: "rojo", aprobado: "verde" }[a.estado];
      return `<div class="archivo" data-id="${a.id}">
        <div><b>${esc(a.nombre)}</b> <small class="tenue">v${a.numero_version}</small><br>
          <small class="tenue">${esc(a.ruta || "")}</small><br>
          <span class="chip ${clase}">${ESTADOS[a.estado]}</span> <small>${donde}</small></div>
        ${meToca(f, a) ? `<div class="decision">
          <textarea placeholder="Comentario (obligatorio si rechazas)"></textarea>
          <div><button class="btn primario" data-d="aprobar">Aprobar</button>
          <button class="btn peligro" data-d="rechazar">Rechazar</button></div></div>` : ""}
      </div>`;
    }).join("");
    caja.querySelectorAll(".archivo").forEach((div) => {
      div.querySelectorAll("[data-d]").forEach((btn) => (btn.onclick = async () => {
        const comentario = div.querySelector("textarea").value;
        if (btn.dataset.d === "rechazar" && !comentario.trim()) { aviso("Escribe qué hay que corregir antes de rechazar.", "error"); return; }
        btn.disabled = true;
        try {
          await backend("decidir", { archivoId: div.dataset.id, decision: btn.dataset.d, comentario });
          aviso(btn.dataset.d === "aprobar" ? "Archivo aprobado." : "Archivo rechazado. Se avisó a quien debe corregir.");
          recargar();
        } catch (e) { aviso(e.message, "error"); btn.disabled = false; }
      }));
    });
  };
  panel.querySelectorAll(".pestañas button").forEach((b) => (b.onclick = () => { pestaña = b.dataset.p; pintarArchivos(); }));
  pintarArchivos();
}

// ------------------------------------------------------------------ nuevo flujo

async function abrirNuevo() {
  const modal = raiz.querySelector("#f-modal");
  modal.classList.remove("oculto");
  modal.innerHTML = `<div class="caja"><p class="tenue">Cargando usuarios y carpetas del proyecto…</p></div>`;

  let usuarios, rootId;
  try {
    [usuarios, rootId] = await Promise.all([trimble.usuarios(), trimble.carpetaRaiz()]);
  } catch (e) {
    modal.innerHTML = `<div class="caja"><div class="aviso error">${esc(e.message)}</div><button class="btn" id="m-cerrar">Cerrar</button></div>`;
    modal.querySelector("#m-cerrar").onclick = () => modal.classList.add("oculto");
    return;
  }
  usuarios = usuarios.filter((u) => u.email && u.status !== "REMOVED")
    .sort((a, b) => nombreUsuario(a).localeCompare(nombreUsuario(b)));

  const pasos = CONFIG.PASOS_POR_DEFECTO.map((nombre, i) => ({
    nombre, responsable_email: i === 0 ? ctx.usuario.email : "",
  }));
  const seleccion = new Map(); // file_id -> archivo
  const ruta = [{ id: rootId, nombre: ctx.proyecto.name || "Proyecto" }];

  modal.innerHTML = `
    <div class="caja">
      <h2>Nuevo flujo</h2>
      <label>Nombre <input id="n-nombre" placeholder="Ej.: Revisión arquitectónica Torre 1"></label>
      <label>Descripción <textarea id="n-desc" rows="2"></textarea></label>
      <label>Fecha límite <input type="date" id="n-vence"></label>
      <h3>Pasos</h3>
      <p class="tenue">El primer paso es quien elabora el archivo; recibe los rechazos para corregir. Los siguientes revisan en orden.</p>
      <div id="n-pasos"></div>
      <button class="btn enlace" id="n-agregar">Agregar paso</button>
      <h3>Archivos</h3>
      <div class="explorador">
        <div id="n-ruta" class="ruta"></div>
        <div id="n-items" class="items"></div>
      </div>
      <div id="n-sel" class="seleccion"></div>
      <div class="acciones">
        <button class="btn" id="n-cancelar">Cancelar</button>
        <button class="btn primario" id="n-crear">Crear flujo</button>
      </div>
    </div>`;

  const opcionesUsuarios = (sel) => `<option value="">Responsable…</option>` + usuarios.map((u) =>
    `<option value="${esc(u.email)}" ${igual(u.email, sel) ? "selected" : ""}>${esc(nombreUsuario(u))} (${esc(u.email)})</option>`).join("");

  const pintarPasos = () => {
    const caja = modal.querySelector("#n-pasos");
    caja.innerHTML = pasos.map((p, i) => `
      <div class="fila-paso" data-i="${i}">
        <span class="num">${i + 1}</span>
        <input value="${esc(p.nombre)}" data-campo="nombre">
        <select data-campo="responsable_email">${opcionesUsuarios(p.responsable_email)}</select>
        ${i > 1 ? `<button class="btn enlace" data-quitar>Quitar</button>` : "<span></span>"}
      </div>`).join("");
    caja.querySelectorAll(".fila-paso").forEach((fila) => {
      const i = +fila.dataset.i;
      fila.querySelector('[data-campo="nombre"]').oninput = (e) => (pasos[i].nombre = e.target.value);
      fila.querySelector('[data-campo="responsable_email"]').onchange = (e) => (pasos[i].responsable_email = e.target.value);
      const q = fila.querySelector("[data-quitar]");
      if (q) q.onclick = () => { pasos.splice(i, 1); pintarPasos(); };
    });
  };

  const pintarSeleccion = () => {
    const caja = modal.querySelector("#n-sel");
    caja.innerHTML = seleccion.size
      ? `<b>${seleccion.size} seleccionados:</b> ` + [...seleccion.values()].map((a) => `<span class="chip">${esc(a.nombre)}</span>`).join(" ")
      : `<span class="tenue">Marca los archivos que entran al flujo.</span>`;
  };

  const abrirCarpeta = async () => {
    const actual = ruta[ruta.length - 1];
    modal.querySelector("#n-ruta").innerHTML = ruta.map((c, i) => `<a data-i="${i}">${esc(c.nombre)}</a>`).join(" / ");
    modal.querySelectorAll("#n-ruta a").forEach((a) => (a.onclick = () => { ruta.splice(+a.dataset.i + 1); abrirCarpeta(); }));
    const items = modal.querySelector("#n-items");
    items.innerHTML = `<p class="tenue">Cargando…</p>`;
    let lista;
    try { lista = await trimble.contenido(actual.id); }
    catch (e) { items.innerHTML = `<div class="aviso error">${esc(e.message)}</div>`; return; }
    lista.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "FOLDER" ? -1 : 1));
    const textoRuta = ruta.slice(1).map((c) => c.nombre).join(" / ");
    items.innerHTML = lista.map((it) => it.type === "FOLDER"
      ? `<div class="item carpeta" data-id="${it.id}" data-nombre="${esc(it.name)}"><span class="ico-carpeta"></span>${esc(it.name)}</div>`
      : `<label class="item"><input type="checkbox" data-id="${it.id}" ${seleccion.has(it.id) ? "checked" : ""}> ${esc(it.name)}</label>`
    ).join("") || `<p class="tenue">Carpeta vacía.</p>`;
    items.querySelectorAll(".carpeta").forEach((d) => (d.onclick = () => { ruta.push({ id: d.dataset.id, nombre: d.dataset.nombre }); abrirCarpeta(); }));
    items.querySelectorAll("input[type=checkbox]").forEach((chk) => (chk.onchange = () => {
      const it = lista.find((x) => x.id === chk.dataset.id);
      if (chk.checked) seleccion.set(it.id, { file_id: it.id, nombre: it.name, ruta: textoRuta, version_id: it.versionId });
      else seleccion.delete(it.id);
      pintarSeleccion();
    }));
  };

  modal.querySelector("#n-agregar").onclick = () => { pasos.push({ nombre: "", responsable_email: "" }); pintarPasos(); };
  modal.querySelector("#n-cancelar").onclick = () => modal.classList.add("oculto");
  modal.querySelector("#n-crear").onclick = async (ev) => {
    const btn = ev.target;
    const nombre = modal.querySelector("#n-nombre").value.trim();
    const faltaPaso = pasos.find((p) => !p.nombre.trim() || !p.responsable_email);
    if (!nombre) return aviso("Ponle nombre al flujo.", "error");
    if (faltaPaso) return aviso("Cada paso necesita nombre y responsable.", "error");
    if (!seleccion.size) return aviso("Selecciona al menos un archivo.", "error");
    btn.disabled = true;
    try {
      await backend("crear", {
        nombre,
        descripcion: modal.querySelector("#n-desc").value.trim(),
        vence: modal.querySelector("#n-vence").value || null,
        pasos: pasos.map((p) => {
          const u = usuarios.find((x) => igual(x.email, p.responsable_email));
          return { nombre: p.nombre.trim(), responsable_email: p.responsable_email, responsable_nombre: nombreUsuario(u) };
        }),
        archivos: [...seleccion.values()],
      });
      modal.classList.add("oculto");
      aviso("Flujo creado. Se avisó al responsable del primer paso de revisión.");
      recargar();
    } catch (e) { aviso(e.message, "error"); btn.disabled = false; }
  };

  pintarPasos();
  pintarSeleccion();
  abrirCarpeta();
}
