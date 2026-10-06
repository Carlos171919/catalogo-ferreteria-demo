/* ============================================================================
   CONFIGURACIÓN DEL CATÁLOGO
   Todo lo que cambia de una ferretería a otra está aquí. El resto del código
   no hay que tocarlo para actualizar datos, número, colores o textos.
   ========================================================================== */
window.CATALOGO = {
  // Nombre completo (pie de página, títulos de la pestaña).
  nombre: 'Ferretería [Nombre]',
  // Palabra gigante de la portada. Corta se ve mejor (una o dos palabras).
  palabraPortada: 'Ferretería',

  // Número de WhatsApp con indicativo y sin "+" ni espacios: '573001234567'.
  // Vacío: WhatsApp abre el mensaje listo y deja elegir a quién enviarlo
  // (sirve para probar, pero en producción tiene que ir el número).
  whatsapp: '',

  // De dónde salen los productos. Puede ser el CSV que viene con el sitio o
  // la URL de una Hoja de Google publicada como CSV (ver LEEME.md).
  datos: 'data/productos.csv',

  // Productos que se muestran antes de pedir "Cargar más".
  porPagina: 24,

  // Colores: 'naranja', 'amarillo', 'azul' o 'claro'.
  paleta: 'naranja',
  // true muestra el selector de colores abajo a la izquierda (para enseñarle
  // las opciones al cliente). Cuando el cliente elija, poner false.
  presentacion: true,

  // Orden de las categorías. Las que no estén aquí van al final, en el orden
  // en que aparecen en los datos.
  ordenCategorias: [
    'Herramientas eléctricas', 'Herramientas manuales', 'Discos de corte',
    'Tornillería y fijación', 'Electricidad', 'Plomería', 'Pinturas',
    'Seguridad industrial'
  ],

  // Nombres cortos para los botones de categoría en el celular.
  nombresCortos: {
    'Herramientas eléctricas': 'Eléctricas',
    'Herramientas manuales': 'Manuales',
    'Tornillería y fijación': 'Tornillería',
    'Seguridad industrial': 'Seguridad'
  },

  // Texto de cada categoría en la lista numerada de la portada.
  descripciones: {
    'Herramientas eléctricas': 'Pulidoras, taladros y sierras para cortar, perforar y desbastar en la obra o en el taller.',
    'Herramientas manuales': 'Martillos, destornilladores, alicates, llaves y herramientas de medición para el trabajo diario.',
    'Discos de corte': 'Discos para metal, acero inoxidable, concreto y cerámica, en las medidas de cada pulidora.',
    'Tornillería y fijación': 'Tornillos, chazos, puntillas y tuercas por unidad, caja o bolsa.',
    'Electricidad': 'Cable, bombillos, tomas, interruptores y cintas para las instalaciones de la casa.',
    'Plomería': 'Tubería, accesorios, llaves de paso y pegantes para agua a presión.',
    'Pinturas': 'Vinilos, esmaltes, brochas, rodillos y lijas para dejar todo como nuevo.',
    'Seguridad industrial': 'Guantes, gafas y cascos para trabajar protegido.'
  },

  // Rangos del filtro de precio (en pesos). "hasta" vacío = sin tope.
  rangosPrecio: [
    { id: 'a', texto: 'Hasta $10.000', desde: 0, hasta: 10000 },
    { id: 'b', texto: '$10.000 a $50.000', desde: 10000, hasta: 50000 },
    { id: 'c', texto: '$50.000 a $200.000', desde: 50000, hasta: 200000 },
    { id: 'd', texto: 'Más de $200.000', desde: 200000, hasta: null }
  ],

  // Portada. Las referencias (REF) tienen que existir en los datos; si una no
  // existe, se salta. Si una lista queda vacía se usan los productos
  // marcados como destacados.
  portada: {
    heroe: '0101',
    cintas: ['0111', '0124', '0601', '0721', '0201', '0241', '0411', '0521', '0101', '0311', '0622',
      '0121', '0141', '0231', '0701', '0431', '0611', '0221', '0501', '0711', '0242'],
    nosotros: 'Herramientas, discos de corte, tornillería, plomería, electricidad y pintura, todo con precio a la vista. Busca lo que necesitas, arma tu pedido y envíalo por WhatsApp. Te respondemos con la disponibilidad y el total.',
    // Palabras de la franja que corre debajo de la portada. Vacío = los nombres de las categorías.
    franjas: [],
    esquinas: ['img/ilustraciones/casco.svg', 'img/ilustraciones/tornillos.svg', 'img/ilustraciones/galon.svg', 'img/ilustraciones/llave.svg'],
    destacados: [
      { categoria: 'Discos de corte', texto: 'Metal, inox, concreto y cerámica', refs: ['0124', '0141', '0151'] },
      { categoria: 'Herramientas eléctricas', texto: 'Pulidoras, taladros y sierras', refs: ['0111', '0101', '0121'] },
      { categoria: 'Pinturas', texto: 'Vinilos, esmaltes, brochas y rodillos', refs: ['0601', '0622', '0611'] }
    ]
  },

  // Imagen que se usa cuando un producto no tiene foto o la foto no carga.
  ilustracionPorCategoria: {
    'Herramientas eléctricas': 'img/ilustraciones/pulidora.svg',
    'Herramientas manuales': 'img/ilustraciones/martillo.svg',
    'Discos de corte': 'img/ilustraciones/disco.svg',
    'Tornillería y fijación': 'img/ilustraciones/tornillos.svg',
    'Electricidad': 'img/ilustraciones/bombillo.svg',
    'Plomería': 'img/ilustraciones/llavepaso.svg',
    'Pinturas': 'img/ilustraciones/galon.svg',
    'Seguridad industrial': 'img/ilustraciones/casco.svg'
  },
  sinFoto: 'img/ilustraciones/sin-foto.svg'
};
