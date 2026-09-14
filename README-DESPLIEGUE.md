# Despliegue en la raíz del repositorio

## Archivos que deben estar en la rama publicada

```
Elecciones/                    ← raíz del repositorio
├── index.html                 ← reemplazar
├── estilos.css                ← nuevo (antes estaba en assets/)
├── tablero.js                 ← nuevo (antes estaba en assets/)
├── data.js                    ← ya existe, no se toca
└── .nojekyll                  ← nuevo, archivo vacío
```

Los cuatro primeros deben quedar en el **mismo nivel**. Si `estilos.css` o
`tablero.js` terminan dentro de una subcarpeta, el sitio se sirve sin formato y
el tablero no arranca.

Borra del repositorio la carpeta `assets/` si quedó de la entrega anterior: ya no
se usa y tener dos copias del mismo archivo garantiza que tarde o temprano se
edite la que no está publicada.

El resto del repositorio —los CSV, los XLSX y los scripts de Python— no
interviene en el sitio y puede quedarse donde está.

## Por qué `.nojekyll`

GitHub Pages pasa cada sitio por Jekyll, que ignora los archivos y carpetas cuyo
nombre empieza con guion bajo y a veces reescribe rutas. Un archivo vacío llamado
`.nojekyll` en la raíz desactiva ese paso y publica los archivos tal cual. Si tu
editor no deja crear archivos que empiezan con punto, créalo desde la interfaz
web de GitHub: **Add file → Create new file**, escribe `.nojekyll` como nombre,
déjalo vacío y confirma.

## Publicación

1. Sube los cuatro archivos a la raíz de la rama que Pages publica, normalmente
   `main`. Verifica en **Settings → Pages** cuál es la rama y la carpeta de
   origen; si el origen dice `/docs`, los archivos van ahí y no en la raíz.
2. Espera a que termine el flujo de trabajo de despliegue (pestaña **Actions**).
3. Abre `https://arjona87.github.io/Elecciones/` con **Ctrl+Shift+R** para saltar
   la caché del navegador.

## Verificación en dos pasos

**Paso 1, a simple vista.** La página debe aparecer con la tipografía Inter, las
tarjetas con borde redondeado y la marca de cuatro barras azul y naranja arriba a
la izquierda. Si sale en Times New Roman, aparecerá una franja roja que nombra el
archivo que falta.

**Paso 2, en la consola.** Abre las herramientas del navegador con F12, ve a la
pestaña **Red** y recarga. Ningún archivo debe responder 404. Los que tienen que
aparecer en 200 son:

```
index.html      estilos.css      tablero.js      data.js
chart.umd.js (desde cdn.jsdelivr.net)
```

## Qué hace el tablero si algo falta

Ya no existe el estado mudo en el que la página se quedaba en «Cargando el
tablero…» sin explicar nada. Cada pieza ausente produce un mensaje que la nombra:

| Falta | Qué verás |
|---|---|
| `estilos.css` | Franja roja arriba: «No se cargó estilos.css…». El tablero sigue funcionando, sin formato. |
| `data.js` | Pantalla de falla: «No se cargaron los datos». |
| Chart.js | Se intenta un espejo en unpkg y luego una copia local. Si los tres fallan: «No se cargó la biblioteca de gráficas». |

## Copia local de Chart.js, opcional

Si la red donde se consulta el tablero filtra los CDN públicos, descarga la
biblioteca y colócala junto a `index.html` con el nombre `chart.umd.js`. El
cargador la toma automáticamente como último recurso, sin tocar el código:

```bash
npm pack chart.js@4.4.3
tar xzf chart.js-4.4.3.tgz
cp package/dist/chart.umd.js ./chart.umd.js
```

## Prueba en local antes de subir

Los navegadores bloquean `file://` para cargar scripts vecinos, así que hay que
servir la carpeta por HTTP:

```bash
python3 -m http.server 8080
```

y abrir `http://localhost:8080/`. Si funciona ahí, funciona en Pages: las rutas
son relativas y no dependen de en qué subdirectorio viva el sitio.
