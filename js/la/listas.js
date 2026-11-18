// Listas de chequeo de L.A., una por estado. Edítalas a gusto: cambiar el texto
// de un ítem no afecta los chequeos ya guardados, que conservan el texto con que se hicieron.

export const LISTAS_LA = [
  {
    estado: "separada",
    nombre: "Separación",
    items: [
      "Formato de separación firmado",
      "Recibo del pago de separación",
      "Copia del documento del comprador",
      "Unidad bloqueada en el inventario comercial",
    ],
  },
  {
    estado: "vendida",
    nombre: "Venta",
    items: [
      "Promesa de compraventa firmada",
      "Plan de pagos acordado con el comprador",
      "Cuota inicial al día",
      "Datos del comprador actualizados en SINCO",
    ],
  },
  {
    estado: "escriturada",
    nombre: "Escrituración",
    items: [
      "Paz y salvo de cartera",
      "Crédito o subsidio desembolsado (si aplica)",
      "Minuta revisada",
      "Escritura firmada en notaría",
      "Registro en Instrumentos Públicos",
    ],
  },
  {
    estado: "liberada",
    nombre: "Liberación por Calidad",
    items: [
      "Pisos y enchapes sin fisuras ni piezas sueltas",
      "Muros y cielos con pintura pareja",
      "Puertas, cerraduras y bisagras",
      "Ventanería: sello, cierre y vidrios",
      "Aparatos sanitarios y griferías sin fugas",
      "Desagües y sifones evacuan bien",
      "Tomas, interruptores y tablero probados",
      "Citófono o timbre",
      "Mesón y muebles de cocina",
      "Medidores instalados y marcados",
      "Aseo final",
    ],
  },
  {
    estado: "entregada",
    nombre: "Entrega al propietario",
    items: [
      "Recorrido del apartamento con el propietario",
      "Observaciones del propietario registradas",
      "Llaves entregadas",
      "Manual del propietario entregado",
      "Lectura de medidores anotada",
      "Acta de entrega firmada",
    ],
  },
];
