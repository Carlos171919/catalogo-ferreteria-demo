# Catálogo de la ferretería

Sitio estático: HTML, CSS y JavaScript sin frameworks ni servidor. Tiene dos páginas: la portada (`index.html`) y el catálogo completo con buscador y filtros (`catalogo.html`). Los productos salen de un archivo CSV, así que actualizar el catálogo es cambiar ese archivo.

## Carpetas

```
sitio/
  index.html            portada
  catalogo.html         catálogo con buscador y filtros
  css/estilos.css       todo el diseño (las 4 paletas de color están al principio)
  js/config.js          nombre, WhatsApp, colores, textos de la portada, filtros de precio
  js/paleta.js          pone la paleta de colores antes de pintar (no hace falta tocarlo)
  js/app.js             la lógica de las dos páginas (no hace falta tocarla)
  data/productos.csv    los productos
  img/marca.svg         el ícono de la pestaña
  img/ilustraciones/    imágenes de respaldo para productos sin foto
  img/productos/        aquí van las fotos de los productos
```

## Verlo en el computador

Desde la carpeta `catalogo-ferreteria`:

```bash
node herramientas/servidor-local.js
```

Y se abre http://localhost:4410. Con doble clic sobre `index.html` no funciona: el navegador bloquea la lectura del CSV en archivos locales.

## Lo primero: nombre y número

En `js/config.js`:

- `nombre`: el nombre del negocio (pie de página y título de la pestaña).
- `palabraPortada`: la palabra gigante de la portada. Si es larga, se achica sola para caber.
- `whatsapp`: el número con indicativo y sin espacios, por ejemplo `'573001234567'`. Mientras esté vacío, WhatsApp abre el mensaje listo pero deja elegir a quién enviarlo.

En `index.html` y `catalogo.html` el nombre también aparece en `<title>` y en las etiquetas `og:` (lo que se ve al compartir el enlace). Esas hay que editarlas a mano, porque WhatsApp y Google las leen sin ejecutar JavaScript.

## Diseños (colores, letra y formas)

Hay 9 diseños. Cada uno cambia colores, letra de los títulos y forma de botones y tarjetas:

| id | Nombre | Letra de títulos |
|---|---|---|
| naranja | Naranja y negro | Outfit |
| amarillo | Amarillo obra | Outfit |
| azul | Azul eléctrico | Outfit |
| claro | Claro con naranja | Outfit |
| rojo | Rojo industrial | Archivo condensada, mayúscula, esquinas rectas |
| plano | Plano técnico | Manrope, fondo de cuadrícula |
| bosque | Verde bosque | Bricolage Grotesque, formas redondeadas |
| marino | Marino y amarillo | Plus Jakarta Sans, fondo claro con puntos |
| cobre | Cobre premium | Urbanist fina en mayúscula, esquinas rectas |

- `paleta` en `config.js`: el id del diseño que se usa.
- `presentacion: true` muestra abajo una barra para pasar de un diseño a otro (anterior / siguiente / ver todos). Cuando el cliente elija, poner `false` y dejar su diseño en `paleta`.
- `?paleta=rojo` en la dirección abre el sitio con ese diseño.
- `disenos.html` es la galería para el cliente: los 9 diseños en celular; cada uno abre la portada con ese diseño. Se arma con `node herramientas/hacer-galeria.js` y sus imágenes con `node herramientas/galeria.js` (con el servidor local corriendo).
- Todo lo de cada diseño está en `css/estilos.css` (bloques `[data-paleta="..."]`).
- Al publicar el diseño elegido, en el enlace de Google Fonts de los HTML basta dejar la familia de ese diseño (y Outfit para el texto). Se pueden borrar `disenos.html` e `img/disenos/`.

## Tipografía y animación de los textos

- Letra: **Outfit** (Google Fonts, gratis), la más cercana a Gevora: geométrica, con la "a" de un solo piso y la "e" redonda. Los títulos van en color crema, en minúscula y peso 600.
- Los textos con `data-bloque` se revelan como en el TextBlockAnimation del prompt: un bloque del color de acento pasa sobre cada línea, deja ver el texto y se va. Se dispara al aparecer en pantalla y se repite si se vuelve a subir. Opciones en el HTML: `data-bloque-retraso`, `data-bloque-duracion` y `data-bloque-escalon` (segundos). No usa React ni GSAP: es CSS y JavaScript propio.
- Resplandores cálidos de fondo (`.resplandor`), notas en tres columnas bajo la palabra grande y etiquetas con "+" sobre los títulos, como en la presentación de Gevora.
- Para usar **Gevora** de verdad (Envato Elements): descargarla con la suscripción, copiar `Gevora.woff` a `sitio/fonts/` y quitar los comentarios del bloque "Usar Gevora" al final de `css/estilos.css`.

## Los productos

Una fila por producto. Los nombres de columna no distinguen mayúsculas ni tildes, y se aceptan varios sinónimos:

| Columna | Obligatoria | Sinónimos aceptados | Ejemplo |
|---|---|---|---|
| referencia | no (si falta se numera) | ref, código, sku | 0124 |
| nombre | sí | producto, artículo (o "descripción" si no hay columna nombre) | Disco de corte para metal 4-1/2" x 1 mm |
| precio | no | valor, precio de venta | 3500, 3.500 o $3.500 |
| categoria | no (si falta va a "Otros") | línea, familia | Discos de corte |
| subcategoria | no | sublínea, grupo | Metal |
| medida | no | tamaño, calibre | 4-1/2" (115 mm) |
| presentacion | no | unidad, empaque | Caja x 100 |
| descripcion | no | detalle | Corte fino en hierro y lámina. |
| imagen | no | foto | img/productos/0124.jpg |
| destacado | no | | si |
| oculto | no | inactivo | si |

- Un producto sin precio se muestra como "Precio por confirmar" y en el mensaje de WhatsApp va igual.
- `destacado` en "si" lo sube al principio del catálogo y lo usa la portada cuando no hay referencias elegidas.
- `oculto` en "si" lo saca del catálogo sin borrarlo del archivo.

### Desde Excel

Archivo > Guardar como > **CSV UTF-8**. Reemplaza `data/productos.csv` con ese archivo. Si Excel lo guarda con punto y coma, también sirve: el catálogo detecta el separador.

Ojo: el formato "CSV" a secas (sin UTF-8) daña las tildes y las eñes.

### Desde una Hoja de Google (para que el dueño lo actualice sin tocar archivos)

1. Archivo > Compartir > Publicar en la Web > la hoja de productos > formato CSV.
2. Copia la dirección que te da y pégala en `datos` dentro de `js/config.js`.

Desde ahí, cada cambio en la hoja aparece en el sitio al recargar (Google tarda unos minutos en actualizar lo publicado).

## Las fotos

- Guárdalas en `img/productos/` con la referencia como nombre (`0124.jpg`) y pon esa ruta en la columna `imagen`. También sirve una dirección completa (`https://…`).
- Recomendado: cuadradas, con fondo transparente o liso, unos 800 x 800 px y menos de 150 KB cada una (WebP, PNG o JPG). Con fondo transparente se ven mejor sobre el fondo oscuro.
- Si una foto falta o no carga, se muestra la ilustración de su categoría (`ilustracionPorCategoria` en `config.js`).

## La portada

Todo en `portada` dentro de `config.js`:

- `heroe`: la referencia del producto grande de arriba (sigue al mouse en computador).
- `franjas`: las palabras de la franja que corre debajo de la portada. Vacío = los nombres de las categorías.
- `cintas`: las referencias de las dos filas que se mueven. Se reparten mitad y mitad.
- `nosotros`: el texto de la sección "Nosotros" (se revela línea por línea con el bloque).
- `esquinas`: las cuatro imágenes que flotan en las esquinas de "Nosotros".
- `destacados`: las tarjetas que se apilan al bajar. Cada una con su `categoria`, un `texto` corto y tres `refs`.
- La lista numerada de categorías sale sola de los datos; su texto está en `descripciones`.

Si una referencia no existe en los datos, se salta. Si una lista queda vacía, se usan los productos marcados como destacados.

## El catálogo

- Busca por nombre, medida, referencia, categoría y descripción, sin importar tildes.
- Filtros: categoría, subcategoría y rango de precio. Cada opción muestra cuántos productos quedarían. Los rangos se cambian en `rangosPrecio` de `config.js`.
- Los filtros activos aparecen como etiquetas que se quitan con una X, y "Limpiar todo" los borra.
- Vista en cuadrícula o en lista (en computador). En el celular los filtros se abren en una hoja desde abajo.
- `porPagina`: cuántos productos se muestran antes de "Cargar más".

## El pedido

Se guarda en el navegador de cada cliente, así que lo que agrega en la portada sigue ahí en el catálogo. El cajón del pedido muestra cómo llega el mensaje antes de enviarlo por WhatsApp.

## Publicarlo

**Demo para el cliente (ya publicada):** https://carlos171919.github.io/catalogo-ferreteria-demo/disenos.html. Vive en el repositorio público Carlos171919/catalogo-ferreteria-demo (GitHub Pages), que se arma desde la carpeta `publicar-demo/` (copia de `sitio/`). Para subir cambios: `.\herramientas\actualizar-demo.ps1` desde PowerShell en la carpeta `catalogo-ferreteria`.

**Sitio final (cuando el cliente elija):**

1. Entra a https://app.netlify.com/drop y arrastra la carpeta `sitio`. Netlify da una dirección al instante. Si se le conecta un dominio propio, mejor.
2. Con la dirección final, cambia `https://TU-DOMINIO/img/og-imagen.jpg` en los dos HTML y crea esa imagen de 1200 x 630 px. Es la vista previa que sale al pegar el enlace en WhatsApp.

## Enlaces que se pueden compartir

- `catalogo.html?cat=Discos de corte` abre el catálogo en esa categoría (también `&sub=Metal`, `&precio=a`, `&q=chazo`, `&vista=lista`).
- `?p=0124` abre directamente el producto con esa referencia (en cualquiera de las dos páginas).
- `?paleta=amarillo` cambia los colores (útil para enseñar opciones).

En el detalle de cada producto, el botón "Compartir" arma el enlace del producto.

## Imágenes para presentar el diseño

Con el servidor local corriendo:

```bash
node herramientas/capturas.js
```

Saca la portada y el catálogo de cada paleta, en computador y celular, a `entrega/capturas/`. Usa `?captura=1`, que deja todo quieto y esconde el selector de colores.

## Estadísticas (opcional)

Si se agrega en `config.js` una función `medir: function (evento, datos) { … }`, el catálogo la llama en estos eventos: `agregar`, `enviar_pedido`, `whatsapp_producto` y `busqueda_sin_resultados`. Sirve para conectar Google Analytics o Plausible y saber qué se busca y qué no se encuentra.

## Accesibilidad y movimiento

- Con "reducir movimiento" activado en el sistema, no hay animaciones.
- El revelado con bloque funciona en todos los navegadores modernos. Las tarjetas que se apilan dependen del scroll y funcionan en Chrome, Edge y Safari; en los demás se ven completas y quietas.
- Ventanas y hojas se cierran con Escape, y el foco no se escapa mientras están abiertas.
