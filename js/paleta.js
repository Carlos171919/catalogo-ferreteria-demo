/* Pone la paleta de colores antes de pintar la página (así no parpadea).
   Orden: ?paleta= en la dirección, la que eligió esta persona en el selector
   de presentación, y si no, la de config.js. */
(() => {
  const CFG = window.CATALOGO || {};
  const VALIDAS = ['naranja', 'amarillo', 'azul', 'claro', 'rojo', 'plano', 'bosque', 'marino', 'cobre'];
  const raiz = document.documentElement;
  let p = '';
  try {
    const u = new URLSearchParams(location.search);
    p = u.get('paleta') || '';
    if (p && CFG.presentacion && VALIDAS.indexOf(p) >= 0) localStorage.setItem('catalogo-ferreteria:paleta', p);
    if (!p && CFG.presentacion) p = localStorage.getItem('catalogo-ferreteria:paleta') || '';
    // ?captura=1 deja todo quieto y visible (para sacar imágenes del diseño).
    if (u.has('captura')) raiz.classList.add('captura');
  } catch (e) { /* sin almacenamiento: se usa la de config.js */ }
  if (VALIDAS.indexOf(p) < 0) p = VALIDAS.indexOf(CFG.paleta) >= 0 ? CFG.paleta : 'naranja';
  raiz.dataset.paleta = p;
  raiz.classList.add('js');
  if (CFG.presentacion) raiz.classList.add('con-paletas');
})();
