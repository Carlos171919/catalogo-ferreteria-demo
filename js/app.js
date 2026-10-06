/* ============================================================================
   CATÁLOGO · lógica
   Dos páginas: la portada (index.html) y el catálogo (catalogo.html). Las dos
   leen los productos del mismo CSV y comparten el pedido, que se guarda en el
   navegador y se envía por WhatsApp. No hay servidor ni base de datos.
   ========================================================================== */
(() => {
  'use strict';

  const CFG = window.CATALOGO || {};
  const PAGINA = document.body.dataset.pagina || 'catalogo';
  const POR_PAGINA = Math.max(4, Number(CFG.porPagina) || 24);
  const CLAVE_PEDIDO = 'catalogo-ferreteria:pedido:v1';
  const CLAVE_PALETA = 'catalogo-ferreteria:paleta';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const quieto = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Utilidades ---------- */

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  // Sin tildes, en minúscula y sin comillas ni guiones: así "4-1/2"" y
  // "4 1/2" se encuentran igual, y "flexometro" encuentra "Flexómetro".
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/["'–-]/g, ' ');
  const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const pesos = (n) => '$' + miles(n);
  const precioTxt = (p) => (p.precio == null ? 'Precio por confirmar' : pesos(p.precio));
  const plural = (n, uno, varios) => (n === 1 ? '1 ' + uno : miles(n) + ' ' + varios);

  // Solo rutas del propio sitio o direcciones http(s). Una celda del CSV nunca
  // debe poder colar un "javascript:" en un enlace o una imagen.
  function srcSegura(u) {
    const s = String(u || '').trim();
    if (!s) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:/i.test(s)) return '';
    return s;
  }

  const numeroWa = String(CFG.whatsapp || '').replace(/\D/g, '');
  const linkWa = (texto) => 'https://wa.me/' + numeroWa + '?text=' + encodeURIComponent(texto);
  const linkCat = (cat) => 'catalogo.html' + (cat ? '?cat=' + encodeURIComponent(cat) : '');

  // Gancho opcional para estadísticas (ver LEEME.md). Si falla, el catálogo sigue.
  function medir(evento, datos) {
    if (typeof CFG.medir !== 'function') return;
    try { CFG.medir(evento, datos || {}); } catch (e) { /* las estadísticas nunca rompen el catálogo */ }
  }

  function guardarPedido() {
    try { localStorage.setItem(CLAVE_PEDIDO, JSON.stringify(Array.from(E.pedido.entries()))); } catch (e) {
      // Modo privado o almacenamiento lleno: el pedido vive solo en esta visita.
    }
  }
  function leerPedido() {
    try { return JSON.parse(localStorage.getItem(CLAVE_PEDIDO) || '[]'); } catch (e) { return []; }
  }

  /* ---------- Lectura del CSV ----------
     Acepta coma, punto y coma (lo que guarda Excel en español) o tabulador,
     campos entre comillas y la marca BOM que pone "CSV UTF-8". */

  function leerCSV(texto) {
    texto = String(texto).replace(/^﻿/, '');
    const salto = texto.search(/\r?\n/);
    const cab = salto < 0 ? texto : texto.slice(0, salto);
    const cuenta = (c) => cab.split(c).length - 1;
    const sep = cuenta(';') > cuenta(',') ? ';' : (cuenta('\t') > cuenta(',') ? '\t' : ',');
    const filas = [];
    let fila = [];
    let campo = '';
    let comillas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (comillas) {
        if (c === '"') {
          if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false;
        } else campo += c;
      // Una comilla solo abre un campo entre comillas si va al principio del
      // campo. En medio es texto: Brocha 3" no debe tragarse el resto del archivo.
      } else if (c === '"' && campo === '') comillas = true;
      else if (c === sep) { fila.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        fila.push(campo); filas.push(fila); fila = []; campo = '';
      } else campo += c;
    }
    if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
    return filas.filter((f) => f.some((x) => String(x).trim() !== ''));
  }

  // Nombres de columna que se aceptan para cada dato (sin tildes ni mayúsculas).
  const ALIAS = {
    ref: ['referencia', 'ref', 'codigo', 'cod', 'sku', 'id'],
    nombre: ['nombre', 'producto', 'articulo', 'nombre del producto'],
    precio: ['precio', 'valor', 'precio de venta', 'precio venta', 'pvp'],
    cat: ['categoria', 'linea', 'familia'],
    sub: ['subcategoria', 'sub categoria', 'sublinea', 'grupo'],
    desc: ['descripcion', 'detalle', 'descripcion larga'],
    img: ['imagen', 'foto', 'url imagen', 'url de la imagen'],
    medida: ['medida', 'tamano', 'calibre', 'dimension', 'dimensiones'],
    pres: ['presentacion', 'unidad', 'unidad de venta', 'empaque'],
    dest: ['destacado', 'destacar'],
    oculto: ['oculto', 'ocultar', 'inactivo']
  };
  const claveCol = (s) => norm(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const esSi = (v) => /^(si|sí|x|1|true|verdadero)$/i.test(String(v).trim());

  function leerPrecio(v) {
    let s = String(v || '').replace(/\s|\$|cop/gi, '');
    if (!s) return null;
    // Centavos al final ("245000,00", "3500.5"): se descartan. Un punto seguido
    // de tres cifras ("3.500") es separador de miles y se conserva.
    if (/[.,]\d{1,2}$/.test(s)) s = s.replace(/[.,]\d{1,2}$/, '');
    const n = Number(s.replace(/\D/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function aProductos(filas) {
    if (filas.length < 2) return [];
    const cab = filas[0].map(claveCol);
    const idx = {};
    Object.keys(ALIAS).forEach((k) => { idx[k] = cab.findIndex((c) => ALIAS[k].indexOf(c) >= 0); });
    // Muchos inventarios llaman "Descripción" al nombre del producto.
    if (idx.nombre < 0 && idx.desc >= 0) { idx.nombre = idx.desc; idx.desc = -1; }
    if (idx.nombre < 0) throw new Error('El archivo de productos no tiene una columna "nombre".');
    const val = (f, k) => (idx[k] >= 0 && f[idx[k]] != null ? String(f[idx[k]]).trim() : '');
    const vistos = new Set();
    const lista = [];
    filas.slice(1).forEach((f, n) => {
      const nombre = val(f, 'nombre');
      if (!nombre || esSi(val(f, 'oculto'))) return;
      let ref = val(f, 'ref') || String(n + 1);
      while (vistos.has(ref)) ref += '-' + (n + 1);
      vistos.add(ref);
      const p = {
        ref, nombre,
        precio: leerPrecio(val(f, 'precio')),
        cat: val(f, 'cat') || 'Otros',
        sub: val(f, 'sub'),
        desc: val(f, 'desc'),
        img: srcSegura(val(f, 'img')),
        medida: val(f, 'medida'),
        pres: val(f, 'pres'),
        dest: esSi(val(f, 'dest')),
        i: lista.length
      };
      p.nn = norm(p.nombre);
      p.hay = norm([p.nombre, 'ref ' + p.ref, p.cat, p.sub, p.medida, p.pres, p.desc].join(' '));
      lista.push(p);
    });
    return lista;
  }

  function armarCategorias(productos) {
    const mapa = new Map();
    productos.forEach((p) => {
      if (!mapa.has(p.cat)) mapa.set(p.cat, { nombre: p.cat, subs: [], n: 0, i: mapa.size });
      const c = mapa.get(p.cat);
      c.n++;
      if (p.sub && c.subs.indexOf(p.sub) < 0) c.subs.push(p.sub);
    });
    const orden = CFG.ordenCategorias || [];
    const pos = (n) => { const i = orden.indexOf(n); return i < 0 ? 1e6 : i; };
    return Array.from(mapa.values()).sort((a, b) => pos(a.nombre) - pos(b.nombre) || a.i - b.i);
  }
  const corto = (cat) => (CFG.nombresCortos && CFG.nombresCortos[cat]) || cat;

  /* ---------- Estado ---------- */

  const RANGOS = (Array.isArray(CFG.rangosPrecio) && CFG.rangosPrecio.length ? CFG.rangosPrecio : [
    { id: 'a', texto: 'Hasta $10.000', desde: 0, hasta: 10000 },
    { id: 'b', texto: '$10.000 a $50.000', desde: 10000, hasta: 50000 },
    { id: 'c', texto: '$50.000 a $200.000', desde: 50000, hasta: 200000 },
    { id: 'd', texto: 'Más de $200.000', desde: 200000, hasta: null }
  ]).filter((r) => r && r.id);

  const E = {
    productos: [],
    porRef: new Map(),
    cats: [],
    lista: [],
    q: '', cat: '', sub: '', pr: '', orden: 'rel', vista: 'grilla', limite: POR_PAGINA,
    pedido: new Map(),   // ref -> cantidad, en el orden en que se agregó
    det: null, dq: 1
  };

  const enRango = (p, id) => {
    const r = RANGOS.find((x) => x.id === id);
    if (!r || p.precio == null) return false;
    return p.precio >= (Number(r.desde) || 0) && (r.hasta == null || r.hasta === '' || p.precio < Number(r.hasta));
  };

  // Filtra con lo que se le pase (por defecto, el estado actual). Los conteos
  // de cada filtro se sacan quitando ese mismo filtro.
  function filtrar(f = E) {
    const toks = norm(f.q).split(/\s+/).filter(Boolean);
    const lista = E.productos.filter((p) => (!f.cat || p.cat === f.cat) && (!f.sub || p.sub === f.sub)
      && (!f.pr || enRango(p, f.pr)) && toks.every((t) => p.hay.indexOf(t) >= 0));
    if (f.orden === 'asc') {
      lista.sort((a, b) => (a.precio == null ? Infinity : a.precio) - (b.precio == null ? Infinity : b.precio));
    } else if (f.orden === 'desc') {
      lista.sort((a, b) => (b.precio || 0) - (a.precio || 0));
    } else {
      // Relevancia: primero lo que coincide en el nombre, luego los destacados.
      const puntos = (p) => toks.reduce((k, t) => k + (p.nn.indexOf(t) >= 0 ? 10 : 0), 0) + (p.dest ? 1 : 0);
      lista.sort((a, b) => puntos(b) - puntos(a) || a.i - b.i);
    }
    return lista;
  }
  const sin = (cambios) => filtrar(Object.assign({}, E, cambios, { orden: 'rel' }));

  /* ---------- Mensajes de WhatsApp ---------- */

  function msgUno(p, n) {
    const valor = p.precio == null ? 'precio por confirmar' : pesos(p.precio * n);
    return 'Hola, me interesa este producto: ' + (n > 1 ? n + ' × ' : '') + p.nombre + ' (REF ' + p.ref + ') - ' + valor + '. ¿Lo tienen disponible?';
  }

  function totales() {
    let cuenta = 0;
    let total = 0;
    let sinPrecio = false;
    E.pedido.forEach((n, ref) => {
      const p = E.porRef.get(ref);
      if (!p) return;
      cuenta += n;
      if (p.precio == null) sinPrecio = true; else total += p.precio * n;
    });
    return { cuenta, total, sinPrecio };
  }

  function msgPedido() {
    const lineas = [];
    E.pedido.forEach((n, ref) => {
      const p = E.porRef.get(ref);
      if (!p) return;
      lineas.push('• ' + n + ' × ' + p.nombre + ' (REF ' + p.ref + ') - ' + (p.precio == null ? 'precio por confirmar' : pesos(p.precio * n)));
    });
    const t = totales();
    return 'Hola, quiero hacer este pedido:\n\n' + lineas.join('\n') + '\n\nTotal estimado: ' + pesos(t.total)
      + (t.sinPrecio ? ' (sin los productos con precio por confirmar)' : '');
  }

  /* ---------- Íconos ---------- */

  const I_WA = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path class="ic" d="M3.6 20.4l1.2-3.9A8.6 8.6 0 1 1 7.7 19.3z"/><path class="icf" d="M9.1 7.9c-.2-.5-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.1.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2-1.3-.8-.7-1.3-1.5-1.4-1.8-.1-.3 0-.4.1-.5l.4-.4.3-.5c.1-.2 0-.3 0-.5z"/></svg>';
  const I_MAS = '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const I_MENOS = '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14"/></svg>';
  const I_X = '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const I_BASURA = '<svg class="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg>';

  const respaldo = (p) => srcSegura((CFG.ilustracionPorCategoria || {})[p.cat]) || srcSegura(CFG.sinFoto);
  const fotoDe = (p) => p.img || respaldo(p);

  /* ---------- Ventanas comunes (detalle, pedido, aviso, colores) ---------- */

  // Diseños propuestos: [id, nombre, fondo, acento]. Los colores, letras y formas están en estilos.css.
  const PALETAS = [
    ['naranja', 'Naranja y negro', '#0B0B0B', '#FF6A13'],
    ['amarillo', 'Amarillo obra', '#0A0A0A', '#FFC400'],
    ['azul', 'Azul eléctrico', '#07090F', '#3466FF'],
    ['claro', 'Claro con naranja', '#F1EFEA', '#E8590C'],
    ['rojo', 'Rojo industrial', '#0C0C0C', '#E3141B'],
    ['plano', 'Plano técnico', '#0F1419', '#C6F432'],
    ['bosque', 'Verde bosque', '#0C1611', '#2FBF71'],
    ['marino', 'Marino y amarillo', '#F3F5F9', '#FFB703'],
    ['cobre', 'Cobre premium', '#0E0C0B', '#C9773C']
  ];
  const I_ATRAS = '<svg class="ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const I_ADELANTE = '<svg class="ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  const I_TODOS = '<svg class="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>';

  function montarComunes() {
    const d = document.createElement('div');
    d.innerHTML = ''
      + '<div class="toast" id="toast" role="status" aria-live="polite" hidden><span id="toastTxt"></span></div>'
      + (PAGINA === 'portada' ? '<button class="luz flota-pedido" type="button" id="flotaPedido" data-abrir-pedido hidden>Mi pedido · <span data-cuenta>0</span></button>' : '')
      + (CFG.presentacion ? '<nav class="disenos-barra" aria-label="Diseños propuestos">'
        + '<button type="button" data-diseno-paso="-1" aria-label="Diseño anterior">' + I_ATRAS + '</button>'
        + '<span class="db-nombre" aria-live="polite"><i id="dbMuestra"></i><span id="dbNombre"></span><small id="dbNum"></small></span>'
        + '<button type="button" data-diseno-paso="1" aria-label="Diseño siguiente">' + I_ADELANTE + '</button>'
        + '<a class="db-todos" href="disenos.html" aria-label="Ver todos los diseños">' + I_TODOS + '<span>Todos</span></a>'
        + '</nav>' : '')
      + '<div class="capa" id="capaDetalle" hidden>'
      + '<button class="velo" type="button" data-cerrar tabindex="-1" aria-label="Cerrar detalle"></button>'
      + '<div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="detNombre">'
      + '<div class="det-img"><img id="detImg" alt=""></div>'
      + '<div class="det-info"><div class="det-top"><span class="det-ruta" id="detRuta"></span>'
      + '<button class="redondo" type="button" data-cerrar aria-label="Cerrar">' + I_X + '</button></div>'
      + '<h2 id="detNombre"></h2><p class="det-precio" id="detPrecio"></p><p class="det-desc" id="detDesc"></p><ul class="det-datos" id="detDatos"></ul>'
      + '<div class="det-acc"><div class="paso"><button type="button" data-dq="-1" aria-label="Quitar uno">' + I_MENOS + '</button><span id="detCant">1</span>'
      + '<button type="button" data-dq="1" aria-label="Agregar uno">' + I_MAS + '</button></div>'
      + '<button class="luz" type="button" id="detAgregar">Agregar · <b id="detTotal"></b></button></div>'
      + '<div class="det-sec"><a class="fantasma" id="detWa" href="#" target="_blank" rel="noopener"><span class="wa-ic">' + I_WA + '</span>Pedir solo este</a>'
      + '<button class="fantasma" type="button" id="detCompartir">Compartir</button></div>'
      + '</div></div></div>'
      + '<div class="capa capa-lado" id="capaPedido" hidden>'
      + '<button class="velo" type="button" data-cerrar tabindex="-1" aria-label="Cerrar pedido"></button>'
      + '<aside class="cajon" role="dialog" aria-modal="true" aria-labelledby="pedTitulo">'
      + '<div class="caj-top"><div><h2 id="pedTitulo">Mi pedido</h2><span id="pedCuenta"></span></div>'
      + '<button class="redondo" type="button" data-cerrar aria-label="Cerrar">' + I_X + '</button></div>'
      + '<div class="caj-vacio" id="pedVacio"><strong>Tu pedido está vacío</strong><span>Agrega productos y vuelve aquí para enviarlos por WhatsApp.</span>'
      + (PAGINA === 'catalogo' ? '<button class="luz" type="button" data-cerrar>Ver productos</button>' : '<a class="luz" href="catalogo.html">Ver el catálogo</a>') + '</div>'
      + '<div class="caj-lista" id="pedLista"></div>'
      + '<div class="caj-pie" id="pedPie"><span class="caj-vista">Así llega tu mensaje</span><div class="caj-msg" id="pedMsg"></div>'
      + '<div class="caj-total"><span>Total estimado</span><strong data-total>$0</strong></div>'
      + '<a class="luz" id="pedEnviar" href="#" target="_blank" rel="noopener">Enviar pedido por WhatsApp</a>'
      + '<div class="caj-notas"><span>El precio final se confirma en el chat.</span><button type="button" id="pedVaciar">Vaciar pedido</button></div></div>'
      + '</aside></div>';
    while (d.firstChild) document.body.insertBefore(d.firstChild, $('noscript'));
    marcarPaleta();
  }

  function marcarPaleta() {
    const actual = document.documentElement.dataset.paleta;
    const i = Math.max(0, PALETAS.findIndex((p) => p[0] === actual));
    const p = PALETAS[i];
    if ($('#dbNombre')) {
      $('#dbNombre').textContent = p[1];
      $('#dbNum').textContent = (i + 1) + ' de ' + PALETAS.length;
      $('#dbMuestra').style.background = 'linear-gradient(135deg,' + p[2] + ' 50%,' + p[3] + ' 50%)';
    }
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', p[2]);
  }
  function pasarDiseno(paso) {
    const actual = document.documentElement.dataset.paleta;
    const i = Math.max(0, PALETAS.findIndex((p) => p[0] === actual));
    cambiarPaleta(PALETAS[(i + paso + PALETAS.length) % PALETAS.length][0]);
  }

  function cambiarPaleta(p) {
    document.documentElement.dataset.paleta = p;
    try { localStorage.setItem(CLAVE_PALETA, p); } catch (e) { /* sin almacenamiento */ }
    cambiarURL((u) => u.set('paleta', p));
    marcarPaleta();
    // Cada diseño trae su letra: cuando cargue, se vuelven a medir los títulos y sus líneas.
    requestAnimationFrame(() => {
      const listo = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      listo.then(() => {
        BQ.lista.forEach(partirLineas);
        if (PAGINA === 'portada') encajarTitulo();
      });
    });
  }

  /* ---------- Pedido ---------- */

  function accionesHTML(p) {
    const n = E.pedido.get(p.ref) || 0;
    const izq = n
      ? '<div class="paso-claro"><button type="button" data-acc="menos" aria-label="Quitar uno de ' + esc(p.nombre) + '">' + I_MENOS + '</button>'
        + '<span>' + n + '<span class="sr"> en el pedido</span></span>'
        + '<button type="button" data-acc="mas" aria-label="Agregar otro ' + esc(p.nombre) + '">' + I_MAS + '</button></div>'
      : '<button class="btn-agregar" type="button" data-acc="agregar" aria-label="Agregar ' + esc(p.nombre) + ' al pedido">Agregar</button>';
    return izq + '<a class="wa-mini" data-acc="wa" href="' + esc(linkWa(msgUno(p, 1))) + '" target="_blank" rel="noopener" aria-label="Pedir ' + esc(p.nombre) + ' por WhatsApp">' + I_WA + '</a>';
  }

  // Cambia solo los botones de una tarjeta. Si el foco estaba ahí, lo deja en
  // el botón equivalente para no perder a quien navega con teclado.
  function refrescarTarjeta(ref) {
    const p = E.porRef.get(ref);
    const zona = $('#grilla [data-ref="' + CSS.escape(ref) + '"] .prod-acc');
    if (!p || !zona) return;
    const activo = document.activeElement;
    const acc = zona.contains(activo) ? activo.dataset.acc : '';
    zona.innerHTML = accionesHTML(p);
    if (acc) {
      const n = E.pedido.get(ref) || 0;
      const destino = !n ? 'agregar' : (acc === 'agregar' ? 'mas' : acc);
      const b = zona.querySelector('[data-acc="' + destino + '"]') || zona.querySelector('button');
      if (b) b.focus();
    }
  }

  function cambiar(ref, n) {
    if (!E.porRef.has(ref)) return;
    if (n > 0) E.pedido.set(ref, n); else E.pedido.delete(ref);
    guardarPedido();
    refrescarTarjeta(ref);
    pintarPedido();
  }

  function agregar(ref, n) {
    const p = E.porRef.get(ref);
    if (!p) return;
    cambiar(ref, (E.pedido.get(ref) || 0) + n);
    aviso('Agregado: ' + (n > 1 ? n + ' × ' : '') + p.nombre);
    $$('[data-abrir-pedido]').forEach((b) => { b.classList.remove('rebote'); void b.offsetWidth; b.classList.add('rebote'); });
    medir('agregar', { ref, cantidad: n });
  }

  function pintarPedido() {
    const t = totales();
    $$('[data-cuenta]').forEach((el) => { el.textContent = t.cuenta; });
    $$('[data-total]').forEach((el) => { el.textContent = pesos(t.total); });
    const flota = $('#flotaPedido');
    if (flota) flota.hidden = t.cuenta === 0;
    if (!$('#capaPedido').hidden) pintarCajon();
  }

  function pintarCajon() {
    const t = totales();
    const vacio = t.cuenta === 0;
    const lista = $('#pedLista');
    $('#pedVacio').hidden = !vacio;
    lista.hidden = vacio;
    $('#pedPie').hidden = vacio;
    $('#pedCuenta').textContent = plural(t.cuenta, 'producto', 'productos');
    const activo = document.activeElement;
    const foco = lista.contains(activo) ? { acc: activo.dataset.acc, ref: (activo.closest('[data-ref]') || {}).dataset } : null;
    lista.innerHTML = Array.from(E.pedido.entries()).map(([ref, n]) => {
      const p = E.porRef.get(ref);
      if (!p) return '';
      return '<div class="item" data-ref="' + esc(ref) + '">'
        + '<div class="item-foto"><img src="' + esc(fotoDe(p)) + '" alt="" loading="lazy"></div>'
        + '<div class="item-c"><span class="item-n">' + esc(p.nombre) + '</span>'
        + '<div class="item-f"><div class="paso">'
        + '<button type="button" data-acc="menos" aria-label="Quitar uno de ' + esc(p.nombre) + '">' + I_MENOS + '</button>'
        + '<span>' + n + '</span>'
        + '<button type="button" data-acc="mas" aria-label="Agregar otro ' + esc(p.nombre) + '">' + I_MAS + '</button></div>'
        + '<strong>' + esc(p.precio == null ? 'Por confirmar' : pesos(p.precio * n)) + '</strong></div></div>'
        + '<button class="item-x" type="button" data-acc="quitar" aria-label="Quitar ' + esc(p.nombre) + ' del pedido">' + I_BASURA + '</button></div>';
    }).join('');
    const msg = msgPedido();
    $('#pedMsg').textContent = msg;
    $('#pedEnviar').href = linkWa(msg);
    if (foco && foco.ref && foco.ref.ref) {
      const fila = lista.querySelector('[data-ref="' + CSS.escape(foco.ref.ref) + '"]');
      const b = fila ? fila.querySelector('[data-acc="' + foco.acc + '"]') : null;
      (b || $('#capaPedido .caj-top [data-cerrar]')).focus();
    }
  }

  /* ---------- Aviso breve ---------- */

  let tAviso = 0;
  function aviso(texto) {
    const t = $('#toast');
    $('#toastTxt').textContent = texto;
    t.hidden = false;
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
    clearTimeout(tAviso);
    tAviso = setTimeout(() => { t.hidden = true; }, 2400);
  }

  /* ---------- Ventanas: abrir, cerrar y no dejar escapar el foco ---------- */

  let capaAbierta = null;
  let abiertoPor = null;

  function abrirCapa(capa, desde) {
    if (capaAbierta && capaAbierta !== capa) cerrarCapa(capaAbierta, false);
    abiertoPor = desde || document.activeElement;
    capa.hidden = false;
    capaAbierta = capa;
    document.documentElement.classList.add('bloqueo');
    const cerrar = capa.querySelector('[data-cerrar]:not(.velo)');
    if (cerrar) cerrar.focus();
  }

  function cerrarCapa(capa, devolverFoco = true) {
    if (!capa || capa.hidden) return;
    capa.hidden = true;
    if (capaAbierta === capa) capaAbierta = null;
    document.documentElement.classList.remove('bloqueo');
    if (capa.id === 'capaDetalle') { E.det = null; urlProducto(''); }
    if (devolverFoco && abiertoPor && document.contains(abiertoPor)) abiertoPor.focus();
  }

  function atrapar(capa, e) {
    const f = $$('a[href],button:not([disabled]),input,select,[tabindex]:not([tabindex="-1"])', capa)
      .filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const primero = f[0];
    const ultimo = f[f.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }

  function abrirDetalle(ref, desde) {
    const p = E.porRef.get(ref);
    if (!p) return;
    E.det = p;
    E.dq = 1;
    const img = $('#detImg');
    delete img.dataset.respaldo;
    img.src = fotoDe(p);
    img.alt = p.nombre;
    $('#detRuta').textContent = [p.cat, p.sub].filter(Boolean).join(' / ');
    $('#detNombre').textContent = p.nombre;
    $('#detPrecio').textContent = precioTxt(p);
    $('#detDesc').textContent = p.desc;
    $('#detDesc').hidden = !p.desc;
    $('#detDatos').innerHTML = [['Medida', p.medida], ['Presentación', p.pres], ['REF', p.ref]]
      .filter((d) => d[1]).map((d) => '<li><span>' + esc(d[0]) + ' </span>' + esc(d[1]) + '</li>').join('');
    pintarCantidad();
    abrirCapa($('#capaDetalle'), desde);
    urlProducto(p.ref);
  }

  function pintarCantidad() {
    const p = E.det;
    if (!p) return;
    $('#detCant').textContent = E.dq;
    $('#detTotal').textContent = p.precio == null ? 'por confirmar' : pesos(p.precio * E.dq);
    $('#detWa').href = linkWa(msgUno(p, E.dq));
  }

  async function compartir() {
    const p = E.det;
    if (!p) return;
    const url = location.origin + location.pathname + '?p=' + encodeURIComponent(p.ref);
    try {
      if (navigator.share) {
        await navigator.share({ title: p.nombre, text: p.nombre + ' - ' + precioTxt(p), url });
      } else {
        await navigator.clipboard.writeText(url);
        aviso('Enlace del producto copiado');
      }
    } catch (e) { /* se canceló el menú de compartir */ }
  }

  /* ---------- Dirección (URL) ----------
     Búsqueda, filtros y producto quedan en la dirección: se puede compartir
     "catalogo.html?cat=Discos de corte" o "?p=0124". */

  function cambiarURL(fn) {
    const u = new URLSearchParams(location.search);
    fn(u);
    const s = u.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
  }
  function escribirURL() {
    cambiarURL((u) => {
      [['q', E.q.trim()], ['cat', E.cat], ['sub', E.sub], ['precio', E.pr], ['vista', E.vista === 'lista' ? 'lista' : '']]
        .forEach(([k, v]) => { if (v) u.set(k, v); else u.delete(k); });
    });
  }
  function urlProducto(ref) {
    cambiarURL((u) => { if (ref) u.set('p', ref); else u.delete('p'); });
  }

  /* ================= PORTADA ================= */

  // Busca las referencias de config.js; si ninguna existe, usa los destacados.
  function porRefs(refs, respaldoLista) {
    const lista = (refs || []).map((r) => E.porRef.get(String(r))).filter(Boolean);
    return lista.length ? lista : respaldoLista;
  }

  function tileHTML(p, copia, i) {
    return '<button class="mtile" type="button" style="--i:' + i + '" data-abrir-ref="' + esc(p.ref) + '"'
      + (copia ? ' aria-hidden="true" tabindex="-1"' : ' aria-label="Ver ' + esc(p.nombre) + ', ' + esc(precioTxt(p)) + '"') + '>'
      + '<img src="' + esc(fotoDe(p)) + '" alt="" loading="lazy" decoding="async">'
      + '<span class="mpie"><span class="c1">' + esc(p.nombre) + '</span><b>' + esc(precioTxt(p)) + '</b></span></button>';
  }

  function fotoHTML(p, cls, conNombre) {
    if (!p) return '';
    return '<button class="foto ' + cls + '" type="button" data-abrir-ref="' + esc(p.ref) + '" aria-label="Ver ' + esc(p.nombre) + '">'
      + '<img src="' + esc(fotoDe(p)) + '" alt="" loading="lazy" decoding="async">'
      + '<span class="fprecio c1">' + (conNombre ? esc(p.nombre) + ' · ' : '') + esc(precioTxt(p)) + '</span></button>';
  }

  function pintarPortada() {
    const P = CFG.portada || {};
    const destacados = E.productos.filter((p) => p.dest);
    const base = destacados.length ? destacados : E.productos.slice(0, 12);

    // Producto grande de la portada.
    const heroe = E.porRef.get(String(P.heroe || '')) || base[0];
    if (heroe) {
      $('#heroeImg').src = fotoDe(heroe);
      $('#heroeBtn').dataset.abrirRef = heroe.ref;
      $('#heroeBtn').setAttribute('aria-label', 'Ver ' + heroe.nombre + ', ' + precioTxt(heroe));
    }

    // Cintas: la lista se reparte en dos filas; cada fila lleva dos copias para que corra sin corte.
    const cintas = porRefs(P.cintas, base);
    const mitad = Math.ceil(cintas.length / 2);
    [[$('#cintaA'), cintas.slice(0, mitad)], [$('#cintaB'), cintas.slice(mitad).length ? cintas.slice(mitad) : cintas]].forEach(([el, l]) => {
      el.style.setProperty('--n', l.length);
      el.innerHTML = l.map((p, i) => tileHTML(p, false, i)).join('') + l.map((p, i) => tileHTML(p, true, i + l.length)).join('');
    });

    // Franja fija con los nombres de las categorías (o los de config.js). Cada nombre lleva al
    // catálogo: filtrado si es una categoría, o buscando la palabra si no.
    const palabrasFranja = (Array.isArray(P.franjas) && P.franjas.length ? P.franjas : E.cats.map((c) => c.nombre));
    const enlace = (w) => E.cats.some((c) => c.nombre === w) ? linkCat(w) : 'catalogo.html?q=' + encodeURIComponent(w);
    const tira = palabrasFranja.map((w) => '<a href="' + esc(enlace(w)) + '"><i aria-hidden="true">+</i>' + esc(w) + '</a>').join('');
    $$('[data-franja]').forEach((el) => { el.innerHTML = tira; });

    // Nosotros: si config.js trae otro texto, se cambia y se vuelve a partir en líneas.
    const txt = $('#nosotrosTxt');
    const texto = String(P.nosotros || txt.dataset.bqTexto || txt.textContent).trim();
    if (texto !== txt.dataset.bqTexto) { txt.textContent = texto; prepararBloque(txt); }
    (P.esquinas || []).forEach((src, i) => { const img = $('[data-esquina="' + i + '"]'); if (img && srcSegura(src)) img.src = srcSegura(src); });

    // Lista numerada de categorías.
    const desc = CFG.descripciones || {};
    $('#servis').innerHTML = E.cats.map((c, i) => '<a class="servi aparece" href="' + esc(linkCat(c.nombre)) + '">'
      + '<span class="snum" aria-hidden="true">' + (i < 9 ? '0' : '') + (i + 1) + '</span>'
      + '<span class="servi-t"><span class="servi-n">' + esc(c.nombre) + '</span>'
      + (desc[c.nombre] ? '<span class="servi-d">' + esc(desc[c.nombre]) + '</span>' : '') + '</span>'
      + '<span class="servi-c">' + plural(c.n, 'producto', 'productos') + '</span></a>').join('');

    // Destacados: tarjetas que se apilan. Si la categoría no existe, se salta.
    const grupos = (P.destacados || []).map((g) => {
      const enCat = E.productos.filter((p) => p.cat === g.categoria);
      if (!enCat.length) return null;
      const fotos = porRefs(g.refs, []).concat(enCat.filter((p) => p.dest), enCat)
        .filter((p, i, a) => a.indexOf(p) === i).slice(0, 3);
      return { g, fotos };
    }).filter(Boolean);
    const total = grupos.length;
    $('#pilas').innerHTML = grupos.map(({ g, fotos }, i) => '<div class="pila"><article class="tarj" style="--i:' + i + ';--esc:' + (1 - (total - 1 - i) * 0.03).toFixed(2) + '">'
      + '<div class="tarj-cab"><span class="snum" aria-hidden="true">0' + (i + 1) + '</span>'
      + '<div class="tarj-t"><span>' + esc(g.texto || '') + '</span><strong>' + esc(g.categoria) + '</strong></div>'
      + '<a class="fantasma" href="' + esc(linkCat(g.categoria)) + '">Ver en el catálogo</a></div>'
      + '<div class="fotos"><div class="fotos-col">' + fotoHTML(fotos[0], 'f1') + fotoHTML(fotos[1], 'f2') + '</div>' + fotoHTML(fotos[2], 'f3', true) + '</div>'
      + '</article></div>').join('');
    $('.destacados').hidden = !grupos.length;
  }

  /* ---------- Revelado con bloque ----------
     El mismo efecto del TextBlockAnimation del prompt, sin React ni GSAP: el
     texto se parte en líneas; sobre cada una pasa un bloque del color de acento
     (crece hacia la derecha, deja ver el texto y se va por la derecha), una
     línea tras otra. Se dispara al entrar en pantalla (85 % de la altura) y se
     repite si se vuelve a subir. El lector de pantalla lee el texto completo.
     Opciones en el HTML: data-bloque-retraso, data-bloque-duracion (por línea)
     y data-bloque-escalon (tiempo entre líneas). */
  const BQ = { io: null, ya: false, lista: [] };
  const bqNum = (el, k, def) => { const n = parseFloat(el.dataset[k]); return Number.isFinite(n) ? n : def; };

  function iniciarBloques() {
    BQ.ya = new URLSearchParams(location.search).has('captura') || !('IntersectionObserver' in window);
    if (!BQ.ya) {
      BQ.io = new IntersectionObserver((es) => es.forEach((e) => {
        const el = e.target;
        if (e.isIntersecting) { if (!el.classList.contains('visto')) dispararBloque(el); }
        else if (e.boundingClientRect.top > 0) { clearTimeout(el._bqT); el.classList.remove('visto', 'hecho'); }
      }), { rootMargin: '0px 0px -15% 0px' });
    }
    $$('[data-bloque]').forEach(prepararBloque);
    let t = 0;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => BQ.lista.forEach(partirLineas), 200); });
  }

  function prepararBloque(el) {
    el.dataset.bqTexto = el.textContent.trim().replace(/\s+/g, ' ');
    if (!el.dataset.bqTexto) return;
    el.classList.add('bq');
    partirLineas(el);
    if (BQ.lista.indexOf(el) < 0) BQ.lista.push(el);
    if (BQ.ya || quieto()) { el.classList.add('quieto', 'visto', 'hecho'); return; }
    if (el.closest('.heroe')) dispararBloque(el); else BQ.io.observe(el);
  }

  // Mide en qué renglón cae cada palabra y arma una línea por renglón.
  function partirLineas(el) {
    const texto = el.dataset.bqTexto;
    el.innerHTML = texto.split(' ').map((w) => '<span class="bq-p">' + esc(w) + '</span>').join(' ');
    const lineas = [];
    let arriba = null;
    $$('.bq-p', el).forEach((s) => {
      const y = s.offsetTop;
      if (arriba === null || Math.abs(y - arriba) > 3) { lineas.push([]); arriba = y; }
      lineas[lineas.length - 1].push(s.textContent);
    });
    const d = bqNum(el, 'bloqueDuracion', 0.7);
    const paso = bqNum(el, 'bloqueEscalon', 0.1);
    const ret = bqNum(el, 'bloqueRetraso', 0);
    el.innerHTML = '<span class="sr">' + esc(texto) + '</span>' + lineas.map((l, i) => '<span class="bq-linea" aria-hidden="true" style="--d:' + d + 's;--dl:' + (ret + i * paso).toFixed(2) + 's">'
      + '<span class="bq-txt">' + esc(l.join(' ')) + '</span><span class="bq-bloque"></span></span>').join('');
    el._bqFin = (ret + (lineas.length - 1) * paso + 2 * d) * 1000 + 120;
  }

  function dispararBloque(el) {
    clearTimeout(el._bqT);
    el.classList.remove('hecho');
    void el.offsetWidth;
    el.classList.add('visto');
    el._bqT = setTimeout(() => el.classList.add('hecho'), el._bqFin || 2000);
  }

  // La palabra gigante ocupa el ancho sin salirse, aunque sea larga (el nombre de la ferretería, por ejemplo).
  function encajarTitulo() {
    const h1 = $('.heroe-titulo h1');
    const s = h1 && ($('.bq-txt', h1) || $('[data-palabra]', h1));
    if (!s) return;
    h1.style.fontSize = '';
    const max = h1.clientWidth * (window.innerWidth <= 760 ? 0.9 : 0.96);
    const w = s.getBoundingClientRect().width;
    if (w > max) h1.style.fontSize = (parseFloat(getComputedStyle(h1).fontSize) * max / w).toFixed(1) + 'px';
  }

  // Efecto imán: el producto grande se acerca al mouse cuando está cerca.
  function iman() {
    const heroe = $('#heroe');
    const el = $('.iman');
    if (!heroe || !el || !window.matchMedia('(pointer: fine)').matches) return;
    let raf = 0;
    const mover = (x, y) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (quieto()) return;
        const r = el.getBoundingClientRect();
        const pad = 150;
        const cerca = x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
        el.style.transition = cerca ? 'transform .3s ease-out' : 'transform .6s ease-in-out';
        el.style.transform = cerca ? 'translate3d(' + ((x - (r.left + r.width / 2)) / 3).toFixed(1) + 'px,' + ((y - (r.top + r.height / 2)) / 3).toFixed(1) + 'px,0)' : 'translate3d(0,0,0)';
      });
    };
    heroe.addEventListener('mousemove', (e) => mover(e.clientX, e.clientY));
    heroe.addEventListener('mouseleave', () => mover(-1e4, -1e4));
  }

  /* ================= CATÁLOGO ================= */

  function tarjetaHTML(p) {
    const extra = [p.pres, 'REF ' + p.ref].filter(Boolean).join(' · ');
    return '<article class="prod" data-ref="' + esc(p.ref) + '">'
      + '<button class="prod-abrir" type="button" data-acc="abrir" aria-label="Ver detalle de ' + esc(p.nombre) + '">'
      + '<span class="prod-foto"><img src="' + esc(fotoDe(p)) + '" alt="" loading="lazy" decoding="async" width="200" height="200"></span>'
      + '<span class="prod-txt"><span class="prod-n c2">' + esc(p.nombre) + '</span>'
      + '<span class="prod-p c1">' + esc(extra) + '</span></span></button>'
      + '<span class="prod-precio">' + esc(precioTxt(p)) + '</span>'
      + '<div class="prod-acc">' + accionesHTML(p) + '</div></article>';
  }

  const opc = (attr, valor, activo, texto, n, extra) => '<button class="fopc' + (extra ? ' ' + extra : '') + '" type="button" ' + attr + '="' + esc(valor) + '" aria-pressed="' + activo + '">'
    + '<span class="c1">' + esc(texto) + '</span>' + (n == null ? '' : '<span class="fnum">' + miles(n) + '</span>') + '</button>';

  function hayFiltros() { return !!(E.q.trim() || E.cat || E.sub || E.pr); }

  // Panel de filtros (al lado en computador y en la hoja del celular). Cada
  // conteo dice cuántos productos quedarían al elegir esa opción.
  function pintarFiltros() {
    const sinCat = sin({ cat: '', sub: '' });
    const sinSub = E.cat ? sin({ sub: '' }) : [];
    const sinPr = sin({ pr: '' });
    let h = '<div class="panel-f"><div class="fgrupo"><span class="ftit">Categoría</span>'
      + opc('data-f-cat', '', !E.cat, 'Todas', sinCat.length);
    E.cats.forEach((c) => {
      const n = sinCat.filter((p) => p.cat === c.nombre).length;
      h += opc('data-f-cat', c.nombre, E.cat === c.nombre, c.nombre, n, n ? '' : 'cero');
      if (E.cat === c.nombre && c.subs.length > 1) {
        h += '<div class="fsubs">' + c.subs.map((s) => {
          const k = sinSub.filter((p) => p.sub === s).length;
          return opc('data-f-sub', s, E.sub === s, s, k, k ? '' : 'cero');
        }).join('') + '</div>';
      }
    });
    h += '</div><div class="fgrupo"><span class="ftit">Precio</span>' + opc('data-f-pr', '', !E.pr, 'Cualquier precio', null);
    RANGOS.forEach((r) => {
      const n = sinPr.filter((p) => enRango(p, r.id)).length;
      h += opc('data-f-pr', r.id, E.pr === r.id, r.texto, n, n ? '' : 'cero');
    });
    h += '</div>';
    const panel = $('#filtrosPanel');
    conservarFoco(panel, () => { panel.innerHTML = h + (hayFiltros() ? '<button class="fantasma" type="button" data-f-limpiar>Limpiar filtros</button>' : '') + '</div>'; });
    const hoja = $('#filtrosHoja');
    conservarFoco(hoja, () => { hoja.innerHTML = h + '</div>'; });

    // Fila de categorías del celular.
    const chips = $('#chipsCel');
    conservarFoco(chips, () => {
      chips.innerHTML = '<button class="chip" type="button" data-f-cat="" aria-pressed="' + !E.cat + '">Todo</button>'
        + E.cats.map((c) => '<button class="chip" type="button" data-f-cat="' + esc(c.nombre) + '" aria-pressed="' + (E.cat === c.nombre) + '">' + esc(corto(c.nombre)) + '</button>').join('');
    });

    // Filtros activos, cada uno con su X.
    const act = [];
    if (E.q.trim()) act.push(['q', '“' + E.q.trim() + '”']);
    if (E.cat) act.push(['cat', E.cat]);
    if (E.sub) act.push(['sub', E.sub]);
    if (E.pr) act.push(['pr', (RANGOS.find((r) => r.id === E.pr) || {}).texto || '']);
    const activos = $('#activos');
    activos.hidden = !act.length;
    conservarFoco(activos, () => {
      activos.innerHTML = act.map((a) => '<button class="chipq" type="button" data-quitar="' + a[0] + '" aria-label="Quitar filtro ' + esc(a[1]) + '">' + esc(a[1]) + I_X + '</button>').join('')
        + '<button class="limpiar-todo" type="button" data-f-limpiar>Limpiar todo</button>';
    });
    const nf = (E.cat ? 1 : 0) + (E.sub ? 1 : 0) + (E.pr ? 1 : 0);
    $('#nFiltros').textContent = nf ? ' · ' + nf : '';
  }

  // Al volver a pintar un grupo de botones, el foco queda en el equivalente.
  function conservarFoco(caja, pintar) {
    const a = document.activeElement;
    let sel = '';
    if (a && caja.contains(a)) {
      ['fCat', 'fSub', 'fPr', 'quitar'].some((k) => {
        if (a.dataset[k] == null) return false;
        const attr = 'data-' + k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
        sel = '[' + attr + '="' + CSS.escape(a.dataset[k]) + '"]';
        return true;
      });
      if (!sel && a.hasAttribute('data-f-limpiar')) sel = '[data-f-limpiar]';
    }
    pintar();
    if (sel) { const b = caja.querySelector(sel) || caja.querySelector('button'); if (b) b.focus(); }
  }

  function pintarResultados(reiniciar) {
    const grilla = $('#grilla');
    if (reiniciar) {
      E.limite = POR_PAGINA;
      E.lista = filtrar();
    }
    const total = E.lista.length;
    const q = E.q.trim();
    $('#miga').textContent = E.cat ? E.cat + (E.sub ? ' / ' + E.sub : '') : (q ? 'Resultados de búsqueda' : 'Todo el catálogo');
    $('#conteo').textContent = plural(total, 'producto', 'productos');
    $('#verResultados').textContent = total ? 'Ver ' + plural(total, 'producto', 'productos') : 'Sin resultados';
    $('#vacio').hidden = total > 0;
    if (!total) {
      $('#vacioTitulo').textContent = q ? 'No encontramos “' + q + '”' : 'No hay productos con estos filtros';
      $('#vacioWa').href = linkWa(q ? 'Hola, ¿tienen ' + q + '?' : 'Hola, estoy buscando un producto.');
      if (q) medir('busqueda_sin_resultados', { q });
    }
    grilla.classList.toggle('lista', E.vista === 'lista');
    $$('[data-vista]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vista === E.vista)));
    const desde = reiniciar ? 0 : grilla.querySelectorAll('.prod').length;
    const hasta = Math.min(E.limite, total);
    const html = E.lista.slice(desde, hasta).map(tarjetaHTML).join('');
    if (reiniciar) grilla.innerHTML = html; else grilla.insertAdjacentHTML('beforeend', html);
    grilla.removeAttribute('aria-busy');
    $('#mostrando').textContent = total ? 'Mostrando ' + miles(hasta) + ' de ' + miles(total) : '';
    $('#mas').hidden = hasta >= total;
  }

  // Después de filtrar con la lista muy abajo, se vuelve al encabezado de resultados.
  function verResultados() {
    const cab = $('.res-cab');
    const barra = $('.barra-sup');
    if (!cab) return;
    const alto = barra ? barra.offsetHeight : 0;
    const top = cab.getBoundingClientRect().top;
    if (top < alto) window.scrollTo({ top: window.scrollY + top - alto - 12, behavior: quieto() ? 'auto' : 'smooth' });
  }

  function aplicar(cambios) {
    Object.assign(E, cambios);
    const cat = E.cats.find((c) => c.nombre === E.cat);
    if (!cat) { E.cat = ''; E.sub = ''; } else if (E.sub && cat.subs.indexOf(E.sub) < 0) E.sub = '';
    escribirURL();
    pintarFiltros();
    pintarResultados(true);
  }

  function eventosCatalogo() {
    let tBusca = 0;
    const q = $('#q');
    q.addEventListener('input', () => {
      $('#limpiar').hidden = !q.value;
      clearTimeout(tBusca);
      tBusca = setTimeout(() => aplicar({ q: q.value }), 120);
    });
    $('#buscador').addEventListener('submit', (e) => { e.preventDefault(); q.blur(); verResultados(); });
    $('#limpiar').addEventListener('click', () => { q.value = ''; $('#limpiar').hidden = true; aplicar({ q: '' }); q.focus(); });
    $('#orden').addEventListener('change', (e) => { E.orden = e.target.value; pintarResultados(true); });
    $$('[data-vista]').forEach((b) => b.addEventListener('click', () => { E.vista = b.dataset.vista; escribirURL(); pintarResultados(true); }));

    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-f-cat],[data-f-sub],[data-f-pr],[data-quitar],[data-f-limpiar]');
      if (!b) return;
      const enHoja = !!b.closest('#capaFiltros');
      if (b.dataset.fCat != null) aplicar({ cat: b.dataset.fCat === E.cat ? '' : b.dataset.fCat, sub: '' });
      else if (b.dataset.fSub != null) aplicar({ sub: b.dataset.fSub === E.sub ? '' : b.dataset.fSub });
      else if (b.dataset.fPr != null) aplicar({ pr: b.dataset.fPr === E.pr ? '' : b.dataset.fPr });
      else if (b.dataset.quitar) {
        const k = b.dataset.quitar;
        if (k === 'q') { q.value = ''; $('#limpiar').hidden = true; }
        aplicar(k === 'cat' ? { cat: '', sub: '' } : { [k]: '' });
      } else {
        q.value = ''; $('#limpiar').hidden = true;
        aplicar({ q: '', cat: '', sub: '', pr: '' });
      }
      if (!enHoja) verResultados();
      const activo = $('#chipsCel [aria-pressed="true"]');
      if (activo && b.closest('#chipsCel')) activo.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    $('#abrirFiltros').addEventListener('click', (e) => abrirCapa($('#capaFiltros'), e.currentTarget));
    $('#limpiarHoja').addEventListener('click', () => aplicar({ cat: '', sub: '', pr: '' }));
    $('#verResultados').addEventListener('click', () => setTimeout(verResultados, 0));

    $('#grilla').addEventListener('click', (e) => {
      const b = e.target.closest('[data-acc]');
      const art = e.target.closest('[data-ref]');
      if (!b || !art) return;
      const ref = art.dataset.ref;
      const n = E.pedido.get(ref) || 0;
      if (b.dataset.acc === 'abrir') abrirDetalle(ref, b);
      else if (b.dataset.acc === 'agregar') agregar(ref, 1);
      else if (b.dataset.acc === 'mas') cambiar(ref, n + 1);
      else if (b.dataset.acc === 'menos') cambiar(ref, n - 1);
      else if (b.dataset.acc === 'wa') medir('whatsapp_producto', { ref });
    });
    $('#btnMas').addEventListener('click', () => { E.limite += POR_PAGINA; pintarResultados(false); });
  }

  /* ---------- Eventos comunes ---------- */

  function eventosComunes() {
    $$('[data-abrir-pedido]').forEach((b) => b.addEventListener('click', () => { pintarCajon(); abrirCapa($('#capaPedido'), b); }));
    $('#pedLista').addEventListener('click', (e) => {
      const b = e.target.closest('[data-acc]');
      const fila = e.target.closest('[data-ref]');
      if (!b || !fila) return;
      const ref = fila.dataset.ref;
      const n = E.pedido.get(ref) || 0;
      if (b.dataset.acc === 'mas') cambiar(ref, n + 1);
      else if (b.dataset.acc === 'menos') cambiar(ref, n - 1);
      else if (b.dataset.acc === 'quitar') cambiar(ref, 0);
    });
    $('#pedVaciar').addEventListener('click', () => {
      if (!window.confirm('¿Vaciar el pedido?')) return;
      Array.from(E.pedido.keys()).forEach((ref) => { E.pedido.delete(ref); refrescarTarjeta(ref); });
      guardarPedido(); pintarPedido();
    });
    $('#pedEnviar').addEventListener('click', () => medir('enviar_pedido', totales()));

    // Productos de la portada (cintas, destacados y el grande) abren su detalle.
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-abrir-ref]');
      if (b) abrirDetalle(b.dataset.abrirRef, b);
      const paso = e.target.closest('[data-diseno-paso]');
      if (paso) pasarDiseno(Number(paso.dataset.disenoPaso));
    });

    $$('.capa').forEach((capa) => capa.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) cerrarCapa(capa); }));
    document.addEventListener('keydown', (e) => {
      if (!capaAbierta) return;
      if (e.key === 'Escape') { e.preventDefault(); cerrarCapa(capaAbierta); }
      else if (e.key === 'Tab') atrapar(capaAbierta, e);
    });
    $$('[data-dq]').forEach((b) => b.addEventListener('click', () => { E.dq = Math.max(1, E.dq + Number(b.dataset.dq)); pintarCantidad(); }));
    $('#detAgregar').addEventListener('click', () => {
      if (!E.det) return;
      const ref = E.det.ref;
      const n = E.dq;
      cerrarCapa($('#capaDetalle'));
      agregar(ref, n);
    });
    $('#detWa').addEventListener('click', () => { if (E.det) medir('whatsapp_producto', { ref: E.det.ref }); });
    $('#detCompartir').addEventListener('click', compartir);

    // El pedido hecho en otra pestaña (o en la otra página) se refleja aquí.
    window.addEventListener('storage', (e) => {
      if (e.key !== CLAVE_PEDIDO) return;
      E.pedido = new Map();
      cargarPedido();
      E.productos.forEach((p) => refrescarTarjeta(p.ref));
      pintarPedido();
    });

    // Si una foto no carga, se muestra la ilustración de su categoría.
    document.addEventListener('error', (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || img.dataset.respaldo) return;
      const caja = img.closest('[data-ref],[data-abrir-ref]');
      const ref = caja ? (caja.dataset.ref || caja.dataset.abrirRef) : '';
      const p = ref ? E.porRef.get(ref) : (img.id === 'detImg' ? E.det : null);
      const otra = p ? respaldo(p) : srcSegura(CFG.sinFoto);
      img.dataset.respaldo = '1';
      if (otra && img.getAttribute('src') !== otra) img.src = otra;
    }, true);
  }

  function cargarPedido() {
    leerPedido().forEach((par) => {
      if (Array.isArray(par) && E.porRef.has(par[0]) && Number(par[1]) > 0) E.pedido.set(par[0], Math.floor(Number(par[1])));
    });
  }

  /* ---------- Arranque ---------- */

  async function cargar() {
    const texto = await fetch(CFG.datos || 'data/productos.csv', { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' al pedir ' + r.url);
      return r.text();
    });
    const productos = aProductos(leerCSV(texto));
    if (!productos.length) throw new Error('El archivo de productos no tiene filas válidas.');
    return productos;
  }

  async function iniciar() {
    const nombre = CFG.nombre || 'Ferretería';
    $$('[data-nombre]').forEach((el) => { el.textContent = nombre; });
    $$('[data-palabra]').forEach((el) => { el.textContent = CFG.palabraPortada || el.textContent; });
    document.title = document.title.replace('Ferretería [Nombre]', nombre);
    iniciarBloques();
    montarComunes();
    $$('[data-wa-saludo]').forEach((a) => { a.href = linkWa('Hola, tengo una pregunta sobre un producto.'); });
    $$('.wa-ic:empty').forEach((s) => { s.innerHTML = I_WA; });
    eventosComunes();

    const u = new URLSearchParams(location.search);
    if (PAGINA === 'catalogo') {
      E.q = u.get('q') || '';
      E.cat = u.get('cat') || '';
      E.sub = u.get('sub') || '';
      E.pr = RANGOS.some((r) => r.id === u.get('precio')) ? u.get('precio') : '';
      E.vista = u.get('vista') === 'lista' ? 'lista' : 'grilla';
      $('#q').value = E.q;
      $('#limpiar').hidden = !E.q;
      if (window.innerWidth <= 760) $('#q').placeholder = 'Nombre, medida o REF';
      eventosCatalogo();
    } else {
      iman();
      encajarTitulo();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(encajarTitulo);
      let raf = 0;
      window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(encajarTitulo); });
    }

    try {
      E.productos = await cargar();
    } catch (err) {
      console.error('[catálogo] No se pudieron cargar los productos.', err);
      if (PAGINA === 'catalogo') {
        $('#grilla').innerHTML = '';
        $('#grilla').removeAttribute('aria-busy');
        $('#conteo').textContent = 'Catálogo no disponible';
        $('#error').hidden = false;
      }
      return;
    }

    E.productos.forEach((p) => E.porRef.set(p.ref, p));
    E.cats = armarCategorias(E.productos);
    cargarPedido();
    $$('[data-total-productos]').forEach((el) => { el.textContent = miles(E.productos.length); });

    if (PAGINA === 'catalogo') {
      const cat = E.cats.find((c) => c.nombre === E.cat);
      if (!cat) { E.cat = ''; E.sub = ''; } else if (cat.subs.indexOf(E.sub) < 0) E.sub = '';
      pintarFiltros();
      pintarResultados(true);
      escribirURL();
    } else {
      pintarPortada();
    }
    pintarPedido();

    const pInicial = u.get('p');
    if (pInicial && E.porRef.has(pInicial)) abrirDetalle(pInicial, document.body);

    // Solo para las imágenes de la entrega: ?captura=1&verpedido=1 abre un pedido de
    // ejemplo (sin guardarlo) y ?captura=1&filtros=1 abre la hoja de filtros.
    if (u.has('captura')) {
      if (u.has('verpedido')) {
        E.pedido = new Map([['0124', 4], ['0311', 2], ['0601', 1], ['0721', 1]].filter((x) => E.porRef.has(x[0])));
        pintarPedido(); pintarCajon(); abrirCapa($('#capaPedido'));
      } else if (u.has('filtros') && PAGINA === 'catalogo') abrirCapa($('#capaFiltros'));
      if (document.activeElement) document.activeElement.blur();
    }
  }

  iniciar();
})();
