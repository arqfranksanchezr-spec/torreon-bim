// Listas de chequeo de Control de Obra, tomadas de "Parametrizacion listas de chequeo.xlsx" (hoja CONSOLIDADO)
// que envió Construcción. Cada ítem trae sus opciones de respuesta (C/NC, C/NC/N/A o SÍ/NO) y, en los de
// resistencia del concreto, los datos del ensayo. "reconoce" son palabras para sugerir la lista según la
// categoría o el nombre del elemento que viene de Revit; el residente siempre puede cambiarla.
// Cambiar el texto de un ítem no afecta las revisiones ya guardadas, que conservan el texto con que se hicieron.

const CNC = ["C", "NC"];
const CNCNA = ["C", "NC", "NA"];
const SINO = ["SI", "NO"];
// Datos de la muestra que se piden en las preguntas de resistencia del concreto.
const ENSAYO = [
  { texto: "Fecha del ensayo", tipo: "fecha" },
  { texto: "N.° de remisión de la concretera", tipo: "texto" },
  { texto: "N.° de consecutivo en obra", tipo: "texto" },
  { texto: "Resultado del ensayo a 28 días (psi)", tipo: "numero" },
];

export const LISTAS = [
  {
    nombre: "Estructura",
    reconoce: ["concreto", "columna", "column", "pantalla", "viga", "beam", "structural framing", "armazón estructural", "cimentación", "cimentacion", "foundation", "footing", "zapata", "dado", "pilote", "pile", "placa", "losa", "slab", "floor", "entrepiso", "contención", "contencion", "ifccolumn", "ifcbeam", "ifcslab", "ifcfooting", "ifcpile"],
    items: [
      { texto: "El elemento cumple con las especificaciones de diseño", opciones: CNC },
      { texto: "Después de fundido el elemento cumple con los parámetros de calidad", opciones: CNC },
      { texto: "El curado del elemento es continuo de acuerdo con las especificaciones técnicas", opciones: CNC },
      { texto: "Cumple con la resistencia de acuerdo con el diseño y norma NSR-10 (muestra y el resultado)", opciones: CNC, datos: ENSAYO },
      { texto: "Se tomaron ensayos adicionales", opciones: SINO },
    ],
  },
  {
    nombre: "Mampostería",
    reconoce: ["mampost", "masonry", "bloque", "ladrillo", "dovela"],
    items: [
      { texto: "Cumple con las especificaciones de diseño.", opciones: CNC },
      { texto: "Cumple con los parámetros de calidad.", opciones: CNC },
      { texto: "Se realiza el sondeo de las dovelas, con el fin de verificar el llenado total de la celda del muro.", opciones: SINO },
      { texto: "Cumple con las especificaciones de acuerdo con la norma.", opciones: CNC },
      { texto: "Los ejes están marcados de acuerdo con los planos arquitectónicos.", opciones: CNC },
      { texto: "Al verificar las ventanas de inspección se evidencia que las dovelas se llenaron correctamente.", opciones: CNC },
      { texto: "De acuerdo a la tabla D.4.2-2 de la NSR-10, el muro de mamposteria cumple con las tolerancias estructurales.", opciones: CNC },
      { texto: "Se realiza lavado de la mampostería de acuerdo con las especificaciones del producto.", opciones: CNCNA },
      { texto: "Se impermeabiliza la mampostería de acuerdo con las especificaciones del producto.", opciones: CNCNA },
    ],
  },
  {
    nombre: "Escaleras",
    reconoce: ["escalera", "stair", "ifcstair", "rampa", "ramp"],
    items: [
      { texto: "El elemento cumple con las especificaciones de diseño", opciones: CNC },
      { texto: "Se realizan los anclajes de acuerdo con las especificaciones del producto", opciones: CNC },
      { texto: "Después de fundido el elemento cumple con los parámetros de calidad", opciones: CNC },
      { texto: "El curado del elemento es continuo de acuerdo con las especificaciones técnicas", opciones: CNC },
      { texto: "Cumple con la resistencia de acuerdo con el diseño y norma NSR-10 (muestra y el resultado)", opciones: CNC, datos: ENSAYO },
      { texto: "Se tomaron ensayos adicionales", opciones: SINO },
    ],
  },
  {
    nombre: "Tanque",
    reconoce: ["tanque", "tank", "cuarto de bombas"],
    items: [
      { texto: "Se instala la cinta PVC correctamente de acuerdo con el diseño", opciones: CNC },
      { texto: "La cantidad de pases del cuarto de bombas se encuentran de acuerdo al diseño", opciones: CNC },
      { texto: "La perforación de las corbatas, cuentan con sello antigoteo", opciones: CNC },
      { texto: "Después de fundido el elemento cumple con los parámetros de calidad", opciones: CNC },
      { texto: "El curado del elemento es continuo de acuerdo con las especificaciones técnicas", opciones: CNC },
      { texto: "El elemento cumple con las especificaciones de diseño", opciones: CNC },
      { texto: "Cumple con la resistencia de acuerdo con el diseño y norma NSR-10 (muestra y el resultado)", opciones: CNC, datos: ENSAYO },
      { texto: "Se tomaron ensayos adicionales", opciones: SINO },
      { texto: "Se impermeabiliza al interior de acuerdo lo especificado", opciones: CNC },
    ],
  },
  {
    nombre: "Placa cubierta",
    reconoce: ["cubierta", "roof", "ifcroof", "mediacaña"],
    items: [
      { texto: "Los desagües están de acuerdo con el diseño", opciones: CNC },
      { texto: "Después de fundido el elemento cumple con los parámetros de calidad", opciones: CNC },
      { texto: "El elemento cumple con las especificaciones de diseño", opciones: CNC },
      { texto: "El curado del elemento es continuo de acuerdo con las especificaciones técnicas", opciones: CNC },
      { texto: "Cumple con la resistencia de acuerdo con el diseño y norma NSR-10 (muestra y el resultado)", opciones: CNC, datos: ENSAYO },
      { texto: "Se tomaron ensayos adicionales", opciones: SINO },
      { texto: "Las fisuras o micro fisuras se resanan para evitar filtraciones con los productos avalados por dirección de obra y se realiza la aplicación de productos asfálticos para la instalación de manto.", opciones: SINO },
      { texto: "Se realiza impermeabilización de acuerdo a las especificaciones tecnicas (está bien fijado a la superficie, no se observan abultamientos ni fisuras)", opciones: CNC },
      { texto: "Se realiza prueba de estanqueidad y se verifica que no queden filtraciones.", opciones: CNC },
      { texto: "La media caña sobre cubierta se realiza según disposiciones de las especificaciones técnicas.", opciones: CNC },
    ],
  },
  {
    nombre: "Piscina",
    reconoce: ["piscina", "pool"],
    items: [
      { texto: "La piscina cumple con la profundidad de acuerdo con el diseño", opciones: CNC },
      { texto: "Se impermeabiliza el interior de la piscina", opciones: CNC },
      { texto: "El elemento cumple con las especificaciones de diseño", opciones: CNC },
      { texto: "Después de fundido el elemento cumple con las especificaciones de diseño", opciones: CNC },
      { texto: "El curado del elemento es continuo de acuerdo con las especificaciones técnicas", opciones: CNC },
      { texto: "Cumple con la resistencia de acuerdo con el diseño y norma NSR-10 (muestra y el resultado)", opciones: CNC, datos: ENSAYO },
      { texto: "Se tomaron ensayos adicionales", opciones: SINO },
    ],
  },
  {
    nombre: "Pañete interior",
    reconoce: ["pañete", "panete", "plaster"],
    items: [
      { texto: "La superficie es plana, sin ondulaciones, sin protuberancias y a escuadra.", opciones: CNC },
      { texto: "Los espesores de los pañetes en muros son mínimo 0,5 cm y máximo de 1,5 cm y en placa son mínimo 0,5 cm y máximo de 2 cm.", opciones: CNC },
      { texto: "Las dilataciones están definidas, limpias y uniformes, con una profundidad y ancho de mínimo 0,5 cm y máximo 1,5 cm.", opciones: CNC },
      { texto: "Filos rematados a 90°, bordeados y rectos.", opciones: CNC },
      { texto: "Las carteras de vanos en puertas y ventanas cuentan con el espesor y terminación de los muros y dimensiones de acuerdo con las especificaciones de diseño.", opciones: CNC },
    ],
  },
  {
    nombre: "Enchape",
    reconoce: ["enchape", "cerámica", "ceramica", "porcelanato", "tile", "guardaescoba"],
    items: [
      { texto: "Las fisuras o micro fisuras se tratan para evitar afectaciones en el enchape con los productos avalados por dirección de obra", opciones: CNC },
      { texto: "Se hace alistado de acuerdo con el diseño", opciones: CNC },
      { texto: "Se instala el enchape de acuerdo con el diseño", opciones: CNC },
      { texto: "El enchape presenta uniformidad en su acabado (tono y color) de acuerdo con las especificaciones de diseño", opciones: CNC },
      { texto: "El emboquillado está de acuerdo con el diseño", opciones: CNC },
      { texto: "El guarda escobas cumple con las dimensiones de acuerdo con las especificaciones de diseño.", opciones: CNC },
    ],
  },
  {
    nombre: "Estuco y pintura",
    reconoce: ["estuco", "pintura", "paint"],
    items: [
      { texto: "Después de aplicado el estuco el elemento presenta una superficie uniforme", opciones: CNC },
      { texto: "Cumple con espesor y acabado de acuerdo con los detalles de diseño", opciones: CNC },
      { texto: "El acabado de pintura está de acuerdo con las especificaciones técnicas y detalles de diseño", opciones: CNC },
      { texto: "El elemento presenta uniformidad en su acabado (color)", opciones: CNC },
    ],
  },
  {
    nombre: "Carpintería metálica",
    reconoce: ["baranda", "railing", "barandilla", "ifcrailing", "metálica", "metalica", "reja"],
    items: [
      { texto: "Las especificaciones y detalles de las puertas están de acuerdo a diseños arquitectónicos y estructurales.", opciones: CNC },
      { texto: "Para las puertas se cuenta con la distancia admisible entre la hoja y el suelo para un arrastre adecuado.", opciones: CNC },
      { texto: "La puerta cierra correctamente, debe de tener un cierre uniforme y no se evidencia resortada.", opciones: CNC },
      { texto: "Las chapas no deben tener juegos (movimientos) y debe estar libre de golpes y rayaduras.", opciones: CNC },
      { texto: "Las especificaciones de las barandas están acorde a los detalles arquitectónicos", opciones: CNC },
      { texto: "La baranda está anclada y/o soldada a los hierros de refuerzo de los muros laterales, a nivel, a plomo y no presenta movimiento ni desplazamiento.", opciones: CNC },
      { texto: "Los resanes hechos a los puntos de anclaje de la baranda han sido bien implementados, no se observa desprendimiento de material, la superficie es lisa y libre de rebabas.", opciones: CNC },
      { texto: "Las barandas cumplen con la resistencia de carga.", opciones: CNC },
      { texto: "La soldadura no presenta irregularidades en cuanto a la aplicación de cordones y puntos.", opciones: CNC },
      { texto: "La pintura cumple según especificaciones y presenta uniformidad en su acabado (textura, tono y color).", opciones: CNC },
    ],
  },
  {
    nombre: "Carpintería en aluminio",
    reconoce: ["ventana", "window", "ifcwindow", "aluminio", "vidrio", "espejo", "curtain"],
    items: [
      { texto: "La carpintería en aluminio cumple con las especificaciones y detalles arquitectónicos.", opciones: CNC },
      { texto: "La carpintería en aluminio se encuentran debidamente asegurada.", opciones: CNC },
      { texto: "La carpintería está completamente sellada perimetralmente e impide el acceso de agua o humedad, cierra herméticamente.", opciones: CNC },
      { texto: "La carpintería cierra correctamente, se encuentran alineadas, a nivel y en buen estado.", opciones: CNC },
      { texto: "La alfajía se apoya uniformemente sobre el vano y tiene la pendiente adecuada hacia el exterior, además, debe sobrepasar de 1 a 2 cm el ancho de la ventana.(La alfajía solamente se utiliza para ventanas que están en exteriores).", opciones: CNC },
      { texto: "La carpintería en aluminio está libre de manchas y rayaduras en su acabado", opciones: CNC },
      { texto: "El empaque de caucho está instalado en todo el perímetro del perfil (Naves), es homogéneo y continuo en todo su recorrido y su empalme esta en el lugar que menos se ve.", opciones: CNC },
      { texto: "Los vidrios son de superficie tersa y espesor uniforme, libres de ondulaciones y manchas.", opciones: CNC },
      { texto: "Los espejos se encuentran bien instalados y fijos.", opciones: CNC },
    ],
  },
  {
    nombre: "Carpintería en madera",
    reconoce: ["puerta", "door", "ifcdoor", "mueble", "casework", "madera", "closet", "cocina integral", "furniture"],
    items: [
      { texto: "Las especificaciones están de acuerdo a los detalles arquitectónicos.", opciones: CNC },
      { texto: "Los elementos de la carpintería en madera están fijos al vano, y las uniones están perfectamente ajustados.", opciones: CNC },
      { texto: "El acabado de las superficies y orillas expuestas, son completamente lisas, libre de nudos, golpes, abolladuras, rayones u otras irregularidades.", opciones: CNC },
      { texto: "Se han instalado tapa tornillos del color de la madera.", opciones: CNC },
      { texto: "Los muebles y puertas corresponde a los diseños y detalles arquitectónicos.", opciones: CNC },
      { texto: "Los elementos que articulan los muebles y las puertas funcionan correctamente (manijas, bisagras, rieles, las bases)", opciones: CNC },
      { texto: "Se deja vano para la conexión eléctrica en mueble inferior y superior para los hornos y el chispero de la estufa (si aplica).", opciones: CNC },
      { texto: "Las puertas y los cajones guardan la horizontalidad, verticalidad y tienen un desplazamiento suave y uniforme.", opciones: CNC },
    ],
  },
  {
    nombre: "Ascensores",
    reconoce: ["ascensor", "elevator", "foso"],
    items: [
      { texto: "El foso negativo debe estar libre de humedad e impermeabilizado y garantiza la altura según diseño o según especificaciones del proveedor.", opciones: CNC },
      { texto: "El foso cuenta con los plomos requeridos (entre placas y los muros perimetrales), iluminación, tomacorrientes y pintura.", opciones: CNC },
      { texto: "El cuarto de máquinas cumple con las especificaciones técnicas del proveedor de acuerdo con los diseños estructurales y detalles arquitectónicos.", opciones: CNCNA },
      { texto: "El cuarto de máquinas cuenta con las Instalaciones eléctricas y tableros eléctricos requeridas por el proveedor.", opciones: CNCNA },
      { texto: "El modelo de ascensor corresponde al contratado junto a sus especificaciones. (Velocidad del recorrido y acabados de la cabina).", opciones: CNC },
      { texto: "La parada del ascensor en cada piso está a nivel con el acabado de piso (ni más arriba, ni más abajo).", opciones: CNC },
      { texto: "Las paradas corresponden al nivel de piso en el cual fue llamado.", opciones: CNC },
      { texto: "La superficie interna de la cabina del ascensor se encuentra libre de rayaduras y manchas; y su acabado esta según las especificaciones contratadas.", opciones: CNC },
      { texto: "El tablero digital interior y exterior en cada piso funciona correctamente (los números se ven claramente).", opciones: CNC },
    ],
  },
  {
    nombre: "Instalaciones eléctricas: cableado",
    reconoce: ["cable", "conductor", "acometida", "wire"],
    items: [
      { texto: "Todas las acometidas parciales tienen dispositivo de corte individual.", opciones: CNC },
      { texto: "Los conductores son de los calibres descritos en planos eléctricos", opciones: CNC },
      { texto: "Los tableros y cajas metálicas están aterrizadas.", opciones: CNC },
      { texto: "Existen y funcionan correctamente las tomas GFCI en baño, en el área de ropas y en la cocina.", opciones: CNC },
    ],
  },
  {
    nombre: "Instalaciones eléctricas: muros",
    reconoce: ["electrical fixture", "toma", "interruptor", "aparato eléctrico", "tablero"],
    items: [
      { texto: "Las instalaciones eléctricas cumplen con las especificaciones del diseño eléctrico", opciones: CNC },
      { texto: "Los aparatos eléctricos están con las medidas estipuladas de acuerdo con las especificaciones de diseño", opciones: CNC },
      { texto: "El tablero eléctrico cumple con las medidas establecidas con las especificaciones de diseño", opciones: CNC },
    ],
  },
  {
    nombre: "Instalaciones eléctricas: placa",
    reconoce: ["conduit", "lighting", "luminaria", "iluminación", "electrical"],
    items: [
      { texto: "El sistema de tuberías es totalmente independiente y se encuentran instaladas en forma oculta (Embebidas, enterradas) o visible según especificaciones de los planos eléctricos y especificaciones de diseño", opciones: CNC },
      { texto: "El trazado de la tubería no afecta los elementos estructurales de la edificación tales como vigas y columnas de acuerdo con las especificaciones de diseño", opciones: CNC },
      { texto: "El diámetro de la tubería eléctrica y de señales corresponde de acuerdo con las especificaciones de diseño", opciones: CNC },
      { texto: "Las salidas de iluminación se encuentran ubicadas según especificaciones de diseño", opciones: CNC },
    ],
  },
  {
    nombre: "Redes eléctricas exteriores",
    reconoce: ["cámara", "camara", "subestación", "media tensión"],
    items: [
      { texto: "Las bocas de los tubos en las cámaras subterráneas están selladas.", opciones: CNC },
      { texto: "Las cajas, armarios y celdas están aterrizados a un electrodo de puesta a tierra.", opciones: CNC },
      { texto: "Los alimentadores, acometidas, redes de alumbrado público, barrajes preformados están identificados en todas las cámaras subterráneas (Placas de colores).", opciones: CNC },
    ],
  },
  {
    nombre: "RITEL: muros",
    reconoce: ["ritel", "telecomunicaciones", "data", "communication", "telefon", "pau"],
    items: [
      { texto: "Las cajas tomas de usuario asociadas a salidas de TDT están a una altura mínima de 1,40 metros a centro de caja, de piso terminado y a máximo 50 cm de una toma eléctrica.", opciones: CNC },
      { texto: "La caja PAU está ubicado a 0,30 metros del piso terminado y a máximo 50 cm de una toma eléctrica.", opciones: CNC },
      { texto: "Todas las cajas de toma de usuario son de 4 x 4 para salidas de telecomunicaciones según planos y diseño arquitectónico.", opciones: CNC },
      { texto: "La ductería tiene instalados todos los accesorios tales como adaptadores, terminales de caja, soldadura PVC en pegues, sondeada y con guía en la ductería sin taponamiento.", opciones: CNC },
    ],
  },
  {
    nombre: "RITEL: red TDT",
    reconoce: ["tdt", "antena", "derivador"],
    items: [
      { texto: "Las salidas TDT tienen un nivel de señal entre mínimo 47dBuV y máximo 70 dBuV, se entrega pruebas con equipo certificado para TDT.", opciones: CNC },
      { texto: "Los derivadores ubicados en los gabinetes de piso cumplen con las especificaciones de diseño y planos arquitectónicos.", opciones: CNC },
      { texto: "Se realizó y entrego estudio de campo (site survey) de cobertura y niveles de señal TDT, con equipos de prueba certificados, en el sitio de la obra", opciones: CNC },
      { texto: "Los aparatos instalados cumplen con las especificaciones de diseño Red TDT y Ritel", opciones: CNC },
    ],
  },
  {
    nombre: "RITEL: placa",
    reconoce: ["gabinete de piso"],
    items: [
      { texto: "El sistema de tuberías es totalmente independiente a las demás instalaciones.", opciones: CNC },
      { texto: "El diámetro de las tuberías corresponde a los especificados en los planos.", opciones: CNC },
      { texto: "Se verifica que la caja de toma de usuario cumple con la dimensión y la ubicación establecida en los planos arquitectónicos", opciones: CNC },
      { texto: "El gabinete de piso cuenta con toma eléctrica en su interior, conectado a circuito independiente desde el tablero de zonas comunes.", opciones: CNC },
    ],
  },
  {
    nombre: "RITEL: redes internas",
    reconoce: ["sets", "seti", "cuarto de telecomunicaciones"],
    items: [
      { texto: "Todos los ductos al interior de las cajas PAU, los gabinetes de piso, cuartos de telecomunicaciones- superior e inferior deben estar identificados con marquilla de alta duración.", opciones: CNC },
      { texto: "Los cuartos de telecomunicaciones SETS y SETI cumplen con las dimensiones y especificaciones de diseño y planos arquitectónicos.", opciones: CNC },
      { texto: "Los cuartos de telecomunicaciones cuentan con un acceso seguro.", opciones: CNC },
    ],
  },
  {
    nombre: "Instalaciones eléctricas: urbanismo",
    reconoce: ["urbanismo", "alumbrado"],
    items: [
      { texto: "La profundidad de la tubería para media tensión es mayor o igual a 70 cm, y la tubería para baja tensión y alumbrado exterior es mayor o igual a 50 cm.", opciones: CNC },
      { texto: "Los diámetros y características las tuberías son los especificados en planos.", opciones: CNC },
      { texto: "Los alimentadores, acometidas, redes de alumbrado público, barrajes preformados están identificados en todas las cámaras subterráneas (Placas de colores).", opciones: CNC },
      { texto: "Las tapas de las cajas de inspección tienen la marquilla donde se especifica el nivel de tensión, nombre del proyecto y fecha.", opciones: CNC },
      { texto: "La subestación y equipos complementarios cumplen con las características especificadas en planos y memorias, además cuentan con su respectiva señalización.", opciones: CNC },
    ],
  },
  {
    nombre: "RITEL: urbanismo",
    reconoce: ["caja de inspección", "enlace"],
    items: [
      { texto: "Las cajas de inspección corresponden a las especificadas en los planos.", opciones: CNC },
      { texto: "Los ductos de telecomunicaciones entrecamaras de enlace son DLP corrugado, según las dimensiones, cantidades y especificaciones de diseño y planos arquitectónicos.", opciones: CNC },
      { texto: "La tubería tiene instalada la guía en alambre galvanizada mínimo N.° 14", opciones: CNC },
      { texto: "Las tapas de las cámaras de enlace cuentan con su marquilla de identificación según especificaciones de diseño.", opciones: CNC },
    ],
  },
  {
    nombre: "Instalaciones de gas",
    reconoce: ["gas"],
    items: [
      { texto: "El sistema de tuberías es totalmente independiente y se encuentran instaladas en forma oculta (Embebidas, enterradas) o visible según especificaciones de los planos y especificaciones de diseño", opciones: CNC },
      { texto: "La tubería está protegida contra daños mecánicos y corrosión (Pintura anticorrosiva - Material plástico aislante).", opciones: CNC },
      { texto: "Las tuberías a través de sótanos tienen válvula de corte de fácil acceso.", opciones: CNC },
      { texto: "Las tuberías a la vista se apoyan sobre elementos estables, rígidos y seguros de la edificación.", opciones: CNC },
      { texto: "Los dispositivos de anclaje de las tuberías están dispuestos de abrazaderas y elementos necesarios según planos y especificaciones de diseño", opciones: CNC },
      { texto: "Los centros de medición están localizados según planos y especificaciones de diseño", opciones: CNC },
      { texto: "Se realizan pruebas de hermeticidad y cumplen con las especificaciones definidas en el plan de inspección y ensayo.", opciones: CNC },
    ],
  },
  {
    nombre: "Hidráulicas: prolongaciones",
    reconoce: ["prolongación", "prolongacion"],
    items: [
      { texto: "Para realizar pruebas de presión contar con: manómetro de glicerina, registro de paso directo y bomba de buena calidad.", opciones: CNC },
      { texto: "Las salidas hidráulicas cumplen con las especificaciones de localización de acuerdo con los planos de detalles arquitectónicos.", opciones: CNC },
      { texto: "Las salidas sanitarias cumplen con las especificaciones de localización de acuerdo con los planos de detalles arquitectónicos.", opciones: CNC },
      { texto: "Las tuberías de desagües y de suministro fueron probadas, luego de las prolongaciones.", opciones: CNC },
    ],
  },
  {
    nombre: "Hidráulicas: acabados",
    reconoce: ["plumbing fixture", "sanitario", "lavamanos", "ducha", "lavaplatos", "grifería", "griferia"],
    items: [
      { texto: "Los aparatos de redes del baño auxiliar como sanitario, lavamanos, duchas, cuentan con sus debidas griferías, acoples y desagües de acuerdo con las especificaciones de diseño", opciones: CNC },
      { texto: "Los aparatos de redes del baño Principal como sanitario, lavamanos, duchas, cuentan con sus debidas griferías, acoples y desagües de acuerdo con las especificaciones de diseño", opciones: CNC },
      { texto: "Los aparatos de redes de cocina y cuarto de ropas como lavaplatos, lavadora, lavadero y calentador; cuentan con sus debidas griferías, acoples y desagües de acuerdo con las especificaciones de diseño", opciones: CNC },
    ],
  },
  {
    nombre: "Hidráulicas: placas",
    reconoce: ["pipe", "tubería", "tuberia", "plumbing", "hidrosanitari", "desagüe", "desague", "ifcpipe", "ifcflowsegment"],
    items: [
      { texto: "Para realizar pruebas de presión contar con: manómetro de glicerina, cheque de cortina, registro de paso directo y tapón, una bomba de buena calidad, avalados por la supervisión técnica.", opciones: CNC },
      { texto: "Las tuberías para desagües (sanitaria, Re-ventilaciones y lluvias) cumplen especificaciones de diseño tanto en diámetros como en tipo de materiales.", opciones: CNC },
      { texto: "Aparece la totalidad de salidas sanitarias correspondientes a planos de diseño.", opciones: CNC },
      { texto: "Los recorridos de las tuberías de suministro de agua potable están coordinados de tal manera que cumplan con los recorridos de planos de diseño y especificaciones técnicas.", opciones: CNC },
      { texto: "Aparece la totalidad de puntos hidráulicos correspondientes a planos de diseño.", opciones: CNC },
    ],
  },
  {
    nombre: "Red contra incendios",
    reconoce: ["incendio", "rci", "sprinkler", "rociador", "siamesa", "hidrante"],
    items: [
      { texto: "El equipo fue instalado de acuerdo con las especificaciones de diseño y fichas técnicas.", opciones: CNC },
      { texto: "El equipo cuenta con esquema isométrico de operación, mantenimiento y nomenclaturas de válvulas.", opciones: CNC },
      { texto: "La capacidad del tanque de reserva es de acuerdo con el diseño.", opciones: CNC },
      { texto: "El material utilizado para el RCI cumple con las especificaciones del diseño.", opciones: CNC },
      { texto: "La instalación de los gabinetes contra incendios y toma de bomberos está de acuerdo con el diseño (Tipo).", opciones: CNC },
      { texto: "Las válvulas de sectorización de redes se encuentran instaladas de acuerdo con el diseño.", opciones: CNC },
      { texto: "La instalación de la siamesa es acorde al diseño incluyendo cheque hidrante.", opciones: CNC },
      { texto: "Se realizó prueba de presión con manómetro de glicerina y registro de paso; la prueba de presión esta en los rangos de 150 a 200 PSI por mínimo 4 horas con una tolerancia del 2% al bajar su presión.", opciones: CNC },
    ],
  },
  {
    nombre: "Sistema de detección",
    reconoce: ["detector", "detección", "deteccion", "fire alarm", "sirena"],
    items: [
      { texto: "El sistema de tuberías es totalmente independiente a las demás instalaciones.", opciones: CNC },
      { texto: "El diámetro de las tuberías corresponde a los especificados en los planos.", opciones: CNC },
      { texto: "Se verifica que la caja de toma de usuario cumple con la dimensión y la ubicación establecida en los planos arquitectónicos", opciones: CNC },
      { texto: "Los equipos están ubicados a una altura entre 1.20 y 2.20 m según especificación de diseño", opciones: CNC },
      { texto: "Los detectores de humo, estaciones manuales, sirenas y demás dispositivos del sistema se encuentran correctamente instalados y funcionan adecuadamente.", opciones: CNC },
      { texto: "El cableado y las conexiones presentan continuidad e instalación adecuada.", opciones: CNC },
      { texto: "La instalación cumple con las especificaciones técnicas y detalles establecidos en los planos aprobados.", opciones: CNC },
    ],
  },
  {
    nombre: "Sistema de extinción",
    reconoce: ["extinción", "extincion", "extintor"],
    items: [
      { texto: "Las tuberías y accesorios se encuentran debidamente soportados y alineadas", opciones: CNC },
      { texto: "Las válvulas y dispositivos de control se encuentran accesibles, identificados y en correcto funcionamiento.", opciones: CNC },
      { texto: "El sistema presenta condiciones adecuadas de presión y funcionamiento, de acuerdo con las especificaciones del diseño.", opciones: CNC },
      { texto: "El sistema cumple con las especificaciones técnicas y detalles establecidos en los planos aprobados.", opciones: CNC },
      { texto: "Los gabinetes contra incendios, extintores, válvulas, conexiones y demás equipos se encuentran correctamente instalados y en buen estado.", opciones: CNC },
    ],
  },
  {
    nombre: "Fachadas",
    reconoce: ["fachada", "graniplast", "pasta acrílica", "pasta acrilica", "facade"],
    items: [
      { texto: "La pasta acrílica presenta uniformidad en textura y acabado, adecuada adherencia y cubrimiento, sin fisuras ni desprendimientos.", opciones: CNC },
      { texto: "El acabado del graniplast presenta uniformidad en textura, granulometría y color en toda la superficie aplicada.", opciones: CNC },
      { texto: "La superficie presenta adecuada adherencia y continuidad del graniplast, sin fisuras, manchas ni desprendimientos.", opciones: CNC },
      { texto: "El acabado de graniplast cumple con las especificaciones técnicas y los detalles establecidos en los planos arquitectónicos.", opciones: CNC },
    ],
  },
];

// Sugiere la lista con más palabras coincidentes; si ninguna coincide, no sugiere ninguna.
export function sugerirLista(textos) {
  const texto = textos.join(" ").toLowerCase();
  let mejor = null;
  let puntos = 0;
  for (const l of LISTAS) {
    const p = l.reconoce.filter((k) => texto.includes(k)).length;
    if (p > puntos) { mejor = l; puntos = p; }
  }
  return mejor;
}

// Ítems "aplanados": cada pregunta y cada dato del ensayo es una fila con su índice.
export function filasDe(lista) {
  const filas = [];
  (lista?.items || []).forEach((it) => {
    filas.push({ texto: it.texto, opciones: it.opciones });
    (it.datos || []).forEach((d) => filas.push({ texto: d.texto, dato: d.tipo, padre: it.texto }));
  });
  return filas;
}
