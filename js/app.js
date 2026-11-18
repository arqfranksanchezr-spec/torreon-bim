import { CONFIG } from "./config.js";
import { conectar, alRecibirComando, ctx } from "./trimble.js";
import * as flujos from "./modulos/flujos.js";
import * as enConstruccion from "./modulos/en-construccion.js";
import * as controlObra from "./modulos/control-obra.js";

// Cada submenú es un módulo. Para agregar uno nuevo: crea su archivo en js/modulos/,
// impórtalo arriba y súmalo aquí con su command.
const MODULOS = [
  { command: "flujo_aprobacion_open", titulo: "Flujos documentales", icono: "flujos.svg", modulo: flujos },
  { command: "propiedades_open", titulo: "Propiedades", icono: "propiedades.svg", modulo: enConstruccion },
  { command: "loin_open", titulo: "Requisitos BIM (LOIN)", icono: "loin.svg", modulo: enConstruccion },
  { command: "control_obra_open", titulo: "Control de Obra", icono: "obra-menu.svg", modulo: controlObra },
  { command: "presupuesto_open", titulo: "Presupuesto", icono: "presupuesto.svg", modulo: enConstruccion },
  { command: "manuales_open", titulo: "Manuales", icono: "manuales.svg", modulo: enConstruccion },
];

const contenedor = document.getElementById("contenido");
let actual = null;

async function abrir(command, marcar = true) {
  const m = MODULOS.find((x) => x.command === command) || MODULOS[0];
  if (actual === m) return; // Trimble puede mandar el mismo comando dos veces al cargar
  if (actual && actual.modulo.salir) actual.modulo.salir();
  actual = m;
  // Cada apertura usa un contenedor nuevo; si una carga anterior termina tarde, escribe en uno ya retirado.
  const zona = document.createElement("div");
  contenedor.replaceChildren(zona);
  if (marcar) ctx.api.ui.setActiveMenuItem(m.command).catch(() => {});
  try {
    await m.modulo.mostrar(zona, m);
  } catch (e) {
    if (actual === m) zona.innerHTML = `<div class="aviso error">No se pudo abrir ${m.titulo}: ${e.message}</div>`;
  }
}

async function iniciar() {
  try {
    await conectar();
  } catch (e) {
    const textos = {
      FUERA_DE_TRIMBLE: "Esta página funciona dentro de Trimble Connect. Agrégala como extensión desde Configuraciones > Extensiones del proyecto.",
      PERMISO_DENEGADO: "La extensión necesita permiso para leer el proyecto. Vuelve a abrirla y acepta la solicitud de acceso.",
    };
    contenedor.innerHTML = `<div class="aviso">${textos[e.message] || "No fue posible conectar con Trimble Connect: " + e.message}</div>`;
    return;
  }

  await ctx.api.ui.setMenu({
    title: "Torreón BIM",
    icon: `${CONFIG.BASE_URL}/icons/torreon.svg`,
    command: MODULOS[0].command,
    subMenus: MODULOS.map((m) => ({
      title: m.titulo,
      icon: `${CONFIG.BASE_URL}/icons/${m.icono}`,
      command: m.command,
    })),
  });

  alRecibirComando((c) => abrir(c));
  // Al cargar se abre el módulo de la dirección (si Trimble la deja ver) sin mover el menú,
  // para no sacar al usuario de la pantalla en la que está.
  const desdeUrl = (document.referrer.match(/\/extension\/[^/]+\/([a-z_]+)/) || [])[1];
  abrir(MODULOS.some((m) => m.command === desdeUrl) ? desdeUrl : MODULOS[0].command, false);
}

iniciar();
