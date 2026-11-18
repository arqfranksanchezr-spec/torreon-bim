// Estados de L.A., en el orden obligatorio, con sus colores para el modelo y el tablero.
export const ESTADOS = [
  { k: "separada", nombre: "Separada", color: "#E2B93B" },
  { k: "vendida", nombre: "Vendida", color: "#E8833A" },
  { k: "escriturada", nombre: "Escriturada", color: "#2F80ED" },
  { k: "liberada", nombre: "Liberado por Calidad", color: "#8E5CD9" },
  { k: "entregada", nombre: "Entregado", color: "#2E9E5B" },
];
export const DISPONIBLE = { k: "disponible", nombre: "Disponible", color: "#C9CED6" };

// Última etapa en SÍ (respetando el orden); si ninguna, Disponible.
export function etapa(u) {
  let actual = DISPONIBLE;
  for (const e of ESTADOS) {
    if (u.estados?.[e.k]?.si === true) actual = e; else break;
  }
  return actual;
}

export function hexARgba(hex, a = 255) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
}

// Piso a partir del apto (504 -> 5, 1203 -> 12) o del nombre del nivel.
export function piso(u) {
  const m = String(u.apto).match(/^(\d{1,3})(\d{2})$/);
  if (m) return Number(m[1]);
  const n = String(u.nivel || "").match(/(\d+)/);
  return n ? Number(n[1]) : 0;
}

export const normal = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
