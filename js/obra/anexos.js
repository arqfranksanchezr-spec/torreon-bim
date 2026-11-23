// Anexos de las revisiones de Control de Obra: certificados de laboratorio, ensayos, actas.
// Se suben uno por uno a la carpeta "Control de Obra - Anexos" del proyecto en Trimble.
import { obra } from "../backend.js";

export const TIPOS_ANEXO = ["Certificado de laboratorio", "Ensayo", "Acta", "Plano o detalle", "Otro"];
export const MAX_MB = 15;
export const MAX_ANEXOS = 10;
export const ACEPTA = ".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.docx,.doc,.dwg";

export const tamano = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

// Separa los archivos que sirven de los que pasan del límite de tamaño.
export function filtrar(archivos, yaHay = 0) {
  const ok = [], grandes = [];
  for (const f of archivos) {
    if (f.size > MAX_MB * 1048576) grandes.push(f.name);
    else if (ok.length + yaHay < MAX_ANEXOS) ok.push({ archivo: f, nombre: f.name, tipo: adivinarTipo(f.name) });
  }
  return { ok, grandes };
}

function adivinarTipo(nombre) {
  const n = nombre.toLowerCase();
  if (/laborat|cilindr|resistenc|compres|concreto|f'?c|mpa|psi/.test(n)) return TIPOS_ANEXO[0];
  if (/ensayo|prueba|test/.test(n)) return TIPOS_ANEXO[1];
  if (/acta/.test(n)) return TIPOS_ANEXO[2];
  if (/\.dwg$|plano|detalle/.test(n)) return TIPOS_ANEXO[3];
  return TIPOS_ANEXO[0];
}

function base64(archivo) {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => mal(new Error(`No se pudo leer ${archivo.name}`));
    r.readAsDataURL(archivo);
  });
}

// Sube los anexos a una revisión ya guardada. Devuelve los nombres que no subieron.
export async function subir(revisionId, lista, alAvanzar) {
  const fallidos = [];
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (alAvanzar) alAvanzar(i + 1, lista.length, a.nombre);
    try {
      await obra("adjuntar_anexo", {
        revisionId, nombre: a.nombre, categoria: a.tipo,
        tipo: a.archivo.type || "application/octet-stream", base64: await base64(a.archivo),
      });
    } catch (e) {
      fallidos.push(`${a.nombre} (${e.message})`);
    }
  }
  return fallidos;
}
