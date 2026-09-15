# Despliegue en la raíz del repositorio

## Lista exacta de archivos

```
Elecciones/                    ← raíz de la rama publicada
├── index.html                 obligatorio    15 KB
├── estilos.css                obligatorio    20 KB
├── tablero.js                 obligatorio    71 KB
├── data.js                    obligatorio   192 KB
├── registro_full.json         recomendado   648 KB
└── .nojekyll                  recomendado     0 KB
```

Los cinco primeros al **mismo nivel**, sin subcarpetas. El resto del repositorio
—los CSV, los XLSX y los scripts de Python— no interviene en el sitio.

Si quedó una carpeta `assets/` de una entrega anterior, bórrala. Tener dos copias
del mismo archivo garantiza que en algún momento se edite la que no está
publicada.

## Qué hace cada archivo

**`data.js`** es la fuente de datos normal. Define `window.DATA` con cinco
secciones, que son objetos indexados, no listas:

```js
window.DATA = {
  meta:       { casa, corte, n, me, olas[], municipios[], conteo{}, cierre, derechos },
  partido:    { municipio: { partido: { ola: porcentaje } } },
  precand:    { municipio: { partido: { precandidato: { ola: porcentaje } } } },
  reeleccion: { municipio: { "SÍ" | "NO": { ola: porcentaje } } },
  estatus:    { "municipio|tipo|contexto|actor|ola": "LITERAL" | "PONDERADO" | "AUSENTE" }
};
```

Es el mismo archivo que ya venía en el repositorio base, sin una sola
modificación. No hubo desalineación de formato: el tablero siempre leyó esta
estructura.

**`registro_full.json`** es el registro atómico del que `data.js` se deriva:
2 255 observaciones con municipio, ola, tipo de pregunta, actor, valor, página y
estatus. Solo se usa como respaldo. Si lo omites, el tablero funciona igual
mientras `data.js` esté presente.

**`.nojekyll`**, archivo vacío, desactiva el procesamiento de Jekyll en GitHub
Pages. Si tu editor no permite crear archivos que empiezan con punto, créalo
desde la interfaz web: **Add file → Create new file**, escribe `.nojekyll` como
nombre, déjalo vacío y confirma.

## Orden de respaldos

El tablero ya no depende de que ningún archivo esté presente para dar una
respuesta útil. Cada pieza tiene una alternativa y, cuando se agotan, un mensaje
que nombra el archivo que falta.

| Pieza | Orden que intenta | Si todo falla |
|---|---|---|
| Datos | `data.js` → reconstrucción desde `registro_full.json` | Pantalla: «No se cargaron los datos» |
| Chart.js | cdn.jsdelivr.net → unpkg.com → `./chart.umd.js` local | Pantalla: «No se cargó la biblioteca de gráficas» |
| Estilos | `estilos.css` → alturas críticas en línea dentro de `index.html` | Franja roja arriba que lo nombra; las gráficas se dibujan igual, sin formato |
| Gráfica suelta | se dibuja de forma aislada | Aviso dentro de la tarjeta, nunca una caja en blanco |

La reconstrucción desde `registro_full.json` se verificó contra `data.js` celda
por celda en las cinco secciones: **cero diferencias**, incluidos el conteo por
origen (395 literales, 1 768 ponderadas, 92 ausentes) y el control de cierre
(93 / 93).

## Sobre el orden de las etiquetas

```html
<link rel="stylesheet" href="./estilos.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.js" defer></script>
<script src="./data.js" defer></script>
<script src="./tablero.js" defer></script>
```

Los tres scripts llevan `defer`, incluido `data.js`. El atributo garantiza que se
ejecuten en el orden en que aparecen en el documento y después de que el HTML
esté completo, que es justo lo que hace falta: `tablero.js` encuentra
`window.DATA` ya definido. Cargar `data.js` de forma bloqueante también
funcionaría, pero detiene el pintado de la página durante 192 KB sin ninguna
ganancia.

## Publicación

1. Sube los archivos a la raíz de la rama que Pages publica. Verifica en
   **Settings → Pages** cuál es la rama y la carpeta de origen; si el origen dice
   `/docs`, los archivos van ahí y no en la raíz.
2. Espera a que termine el despliegue (pestaña **Actions**).
3. Abre `https://arjona87.github.io/Elecciones/` con **Ctrl+Shift+R** para saltar
   la caché.

## Comprobar en cinco segundos qué versión está publicada

Cada entrega lleva un sello de compilación. Abre el sitio y mira el pie de
página: dice **Compilación 2026-09-15.05**. Si dice otra cosa, o no dice nada,
el servidor no está sirviendo estos archivos y cualquier auditoría sobre esa
página describe código distinto del entregado.

`tablero.js` compara su propio sello con el de `index.html`. Si no coinciden
—porque solo se subió parte del paquete, o porque el navegador o el CDN de Pages
guardan una copia vieja— aparece una franja naranja arriba con las dos versiones.

Las rutas propias llevan `?v=2026-09-15.05`. Ese sufijo obliga al navegador y al
CDN a pedir copias nuevas en lugar de reutilizar las guardadas, que es la causa
habitual de que una corrección subida no se vea.

**Si el pie no muestra la compilación esperada**, revisa en este orden:

1. **Settings → Pages**: la rama y la carpeta de origen. Si publicas desde
   `gh-pages` y estás subiendo a `main`, nada cambia nunca.
2. **Actions**: que el despliegue haya terminado en verde, no en rojo ni en cola.
3. Que `index.html` de la raíz sea el nuevo. Ábrelo en GitHub y busca
   `tablero-version`: debe aparecer en las primeras líneas.
4. Recarga con **Ctrl+Shift+R**.

## Verificación

**A simple vista.** Tipografía Inter, tarjetas con borde redondeado, marca de
cuatro barras azul y naranja arriba a la izquierda, selector con siete
municipios y catorce olas, once gráficas dibujadas.

**En la consola.** F12 → pestaña **Red** → recargar. Deben responder 200:

```
index.html   estilos.css?v=…   tablero.js?v=…   data.js?v=…
chart.umd.min.js (desde cdn.jsdelivr.net)
```

`registro_full.json` no debe aparecer: solo se pide cuando `data.js` falla.
Si lo ves en la lista, `data.js` no está llegando.

**Si alguna tarjeta sale en blanco.** No debería poder ocurrir: cada tarjeta que
no se puede dibujar escribe un aviso dentro de su propio recuadro, con el motivo.
Si aun así encontraras una caja vacía, es un caso no previsto: manda el texto de
la consola (F12 → **Consola**), que registra el nombre interno de la vista y la
excepción.

## Copia local de Chart.js, opcional

Si la red donde se consulta el tablero filtra los CDN públicos:

```bash
npm pack chart.js@4.4.3
tar xzf chart.js-4.4.3.tgz
cp package/dist/chart.umd.js ./chart.umd.js
```

El cargador la toma automáticamente como último recurso, sin tocar el código.

## Prueba en local

```bash
python3 -m http.server 8080
```

y abre `http://localhost:8080/`. Si funciona ahí, funciona en Pages: todas las
rutas son relativas y no dependen del subdirectorio en que viva el sitio.
