// Listas de chequeo de control de obra. Edítalas a gusto: cada lista tiene
// palabras para reconocer la categoría del elemento que viene de Revit y los ítems a revisar.
// La lista se sugiere sola al seleccionar; el residente puede cambiarla.

export const LISTAS = [
  {
    nombre: "Columnas en concreto",
    reconoce: ["columna", "column", "ifccolumn", "pilar"],
    items: [
      "Ubicación y ejes según modelo",
      "Sección (ancho x largo) según modelo",
      "Plomo dentro de tolerancia",
      "Recubrimiento del refuerzo",
      "Superficie sin hormigueros ni segregación",
    ],
  },
  {
    nombre: "Vigas en concreto",
    reconoce: ["viga", "beam", "structural framing", "armazón estructural", "ifcbeam"],
    items: [
      "Ubicación y apoyos según modelo",
      "Sección según modelo",
      "Nivel de fondo y de cara superior",
      "Recubrimiento del refuerzo",
      "Superficie sin hormigueros ni segregación",
    ],
  },
  {
    nombre: "Placas y losas",
    reconoce: ["placa", "losa", "floor", "suelo", "slab", "ifcslab", "entrepiso"],
    items: [
      "Espesor según modelo",
      "Nivel de piso terminado / cara superior",
      "Pases y reservas según coordinación",
      "Bordes y voladizos según modelo",
      "Superficie sin fisuras ni hormigueros",
    ],
  },
  {
    nombre: "Muros",
    reconoce: ["muro", "wall", "ifcwall", "mampostería", "pantalla"],
    items: [
      "Ubicación y ejes según modelo",
      "Espesor según modelo",
      "Plomo y alineación",
      "Vanos (puertas y ventanas) en posición y medida",
      "Pases de instalaciones según coordinación",
    ],
  },
  {
    nombre: "Escaleras",
    reconoce: ["escalera", "stair", "ifcstair", "railing", "barandilla", "baranda"],
    items: [
      "Huella y contrahuella según modelo",
      "Ancho libre",
      "Descansos en nivel y medida",
      "Baranda y pasamanos",
    ],
  },
  {
    nombre: "Puertas y ventanas",
    reconoce: ["puerta", "door", "ventana", "window", "ifcdoor", "ifcwindow"],
    items: [
      "Ubicación según modelo",
      "Dimensiones del vano",
      "Sentido de apertura",
      "Instalación, plomo y nivel",
    ],
  },
  {
    nombre: "Redes y equipos",
    reconoce: ["tubería", "tuberia", "pipe", "duct", "conducto", "cable tray", "bandeja", "conduit", "accesorio", "fitting", "aparato", "plumbing", "sanitario", "mechanical", "electrical", "equipo"],
    items: [
      "Trazado según modelo coordinado",
      "Diámetro o sección según modelo",
      "Pendiente (cuando aplica)",
      "Soportes y anclajes",
      "Prueba realizada (presión, estanqueidad o continuidad)",
    ],
  },
  {
    nombre: "General",
    reconoce: [],
    items: [
      "Ubicación según modelo",
      "Dimensiones según modelo",
      "Calidad del acabado",
    ],
  },
];

export function sugerirLista(categorias) {
  const texto = categorias.join(" ").toLowerCase();
  let mejor = LISTAS[LISTAS.length - 1];
  let puntos = 0;
  for (const l of LISTAS) {
    const p = l.reconoce.filter((k) => texto.includes(k)).length;
    if (p > puntos) { mejor = l; puntos = p; }
  }
  return mejor;
}
