/* ===================================================================
   Tablero de preferencia electoral municipal — Jalisco, alcaldías 2027
   Lógica de aplicación.

   Organización del archivo
     1. Arranque y guardas
     2. Utilidades
     3. Tokens de color en caché
     4. Capa de datos (validada)
     5. Estadística
     6. Cimientos de Chart.js
     7. Vistas
     8. Programador de render
     9. Interfaz
   =================================================================== */
(function () {
"use strict";

/* -------------------------------------------------------------------
   1. ARRANQUE Y GUARDAS

   Un archivo que no llega es el modo de falla más probable de este
   tablero, y hasta ahora era silencioso: la página se quedaba con el
   texto «Cargando el tablero…» sin decir qué faltaba. Aquí cada pieza
   ausente —la hoja de estilos, Chart.js o data.js— produce un mensaje
   que la nombra.
   ------------------------------------------------------------------- */

/* Los tres archivos se sirven desde la misma carpeta que index.html.
   Con rutas relativas sin barra inicial, el tablero funciona igual en
   la raíz de un dominio que dentro de /Elecciones/ en GitHub Pages. */

function pantallaDeFalla(titulo, detalle) {
  var main = document.getElementById("tablero");
  if (!main) return;
  main.innerHTML =
    '<div class="falla"><h2></h2><p class="d"></p>' +
    "<p>Si el problema persiste, abre la pestaña Red de las herramientas del " +
    "navegador y busca el archivo que responde 404: los tres (index.html, " +
    "estilos.css y tablero.js) deben estar en la misma carpeta, junto a " +
    "<code>data.js</code>.</p></div>";
  main.querySelector("h2").textContent = titulo;
  main.querySelector(".d").textContent = detalle;
  var sello = document.getElementById("sello");
  if (sello) sello.textContent = "El tablero no pudo cargarse.";
}

/* Aviso de hoja de estilos ausente. :root declara --css-ok; si el valor
   no llega, estilos.css no se cargó y la página se ve como HTML crudo.
   Antes ese fallo no dejaba ningún rastro en pantalla. */
function avisarCssAusente() {
  var marca = getComputedStyle(document.documentElement)
    .getPropertyValue("--css-ok").trim();
  if (marca === "1") return;
  var aviso = document.createElement("div");
  aviso.setAttribute("role", "alert");
  aviso.style.cssText =
    "font:14px/1.5 system-ui,Arial,sans-serif;background:#8A1F1A;color:#fff;" +
    "padding:12px 16px;margin:0;text-align:left";
  aviso.textContent =
    "No se cargó estilos.css, por eso la página se ve sin formato. " +
    "El archivo debe estar en la misma carpeta que index.html.";
  document.body.insertBefore(aviso, document.body.firstChild);
}

/* -------------------------------------------------------------------
   1.b RESPALDO DE DATOS

   La ruta normal es data.js, que define window.DATA con una etiqueta
   <script>. Si ese archivo no llega, en lugar de rendirse se reconstruye
   el mismo objeto desde registro_full.json, que es el registro atómico
   del que data.js se deriva.

   La reconstrucción se verificó contra data.js celda por celda en las
   cinco secciones (meta, partido, precand, reeleccion y estatus): cero
   diferencias. Tres detalles del formato original que hay que respetar
   para que siga siendo así:
     · precand conserva los huecos como null; partido y reeleccion los
       omiten. Es una inconsistencia del generador, pero num() trata los
       dos casos igual y replicarla evita divergencias silenciosas.
     · registro_full.json duplica la última ola en dos páginas del
       informe. Gana el registro posterior, como en data.js. En diez
       celdas las dos páginas difieren entre 0.1 y 0.2 pp por redondeo,
       muy por debajo del error muestral de ±4.3.
     · el control de cierre se calcula deduplicando por actor; sin ese
       paso la última ola suma 200 y el control cae de 93/93 a 86/93.

   casa, n, me y derechos no están en el registro: son constantes del
   estudio y se declaran aquí tal como las trae data.js. ------------- */

var ORDEN_MUNI = [
  "Guadalajara", "Zapopan", "San Pedro Tlaquepaque", "Tlajomulco de Zúñiga",
  "Puerto Vallarta", "El Salto", "Tonalá"
];

function reconstruirDATA(registro) {
  var obs = registro && registro.observaciones;
  if (!obs || !obs.length) return null;

  var D = { meta: {}, partido: {}, precand: {}, reeleccion: {}, estatus: {} };
  var olas = {}, vistos = {}, munis = [];
  var conteo = { LITERAL: 0, PONDERADO: 0, AUSENTE: 0 };
  var grupos = {};

  function rama(o, k) { return (o[k] = o[k] || {}); }

  for (var i = 0; i < obs.length; i++) {
    var r = obs[i];
    if (!r || !r.municipio || !r.ola || !r.actor) continue;

    var m = r.municipio, o = r.ola, a = r.actor, t = r.tipo_pregunta;
    var ctx = (r.partido_contexto === null || r.partido_contexto === undefined)
      ? "None" : r.partido_contexto;
    var v = (typeof r.valor_pct === "number" && isFinite(r.valor_pct))
      ? r.valor_pct : null;

    olas[o] = true;
    if (!vistos[m]) { vistos[m] = true; munis.push(m); }
    if (r.estatus && conteo[r.estatus] !== undefined) conteo[r.estatus]++;
    if (r.estatus) D.estatus[m + "|" + t + "|" + ctx + "|" + a + "|" + o] = r.estatus;

    if (t === "INTENCION_PARTIDO") {
      rama(grupos, m + "|" + o)[a] = v;
      if (v !== null) rama(rama(D.partido, m), a)[o] = v;
    } else if (t === "PRECANDIDATO") {
      rama(rama(rama(D.precand, m), ctx), a)[o] = v;
    } else if (t === "REELECCION") {
      if (v !== null) rama(rama(D.reeleccion, m), a)[o] = v;
    }
  }

  var cerradas = 0, completas = 0;
  Object.keys(grupos).forEach(function (k) {
    var vs = [], completo = true;
    Object.keys(grupos[k]).forEach(function (a) {
      if (grupos[k][a] === null) completo = false; else vs.push(grupos[k][a]);
    });
    if (!completo || !vs.length) return;
    completas++;
    var suma = vs.reduce(function (x, y) { return x + y; }, 0);
    if (Math.abs(suma - 100) < 0.5) cerradas++;
  });

  munis.sort(function (a, b) {
    var ia = ORDEN_MUNI.indexOf(a), ib = ORDEN_MUNI.indexOf(b);
    if (ia < 0 && ib < 0) return 0;
    if (ia < 0) return 1;
    if (ib < 0) return -1;
    return ia - ib;
  });

  var listaOlas = Object.keys(olas).sort();
  D.meta = {
    casa: "Massive Caller",
    corte: listaOlas[listaOlas.length - 1],
    n: 600,
    me: 4.3,
    olas: listaOlas,
    municipios: munis,
    conteo: conteo,
    cierre: cerradas + " / " + completas,
    derechos: "D.R. © Massive Caller S.A. de C.V., 2026"
  };
  return D;
}

function datosListos() {
  return !!(window.DATA && window.DATA.meta && window.DATA.partido);
}

function fallaDeDatos(motivo) {
  pantallaDeFalla(
    "No se cargaron los datos",
    "data.js no definió window.DATA y el respaldo desde registro_full.json " +
      "tampoco funcionó" + (motivo ? " (" + motivo + ")" : "") +
      ". Sube data.js a la misma carpeta que index.html; es el archivo de " +
      "192 KB que ya venía en el repositorio."
  );
}

/* Resuelve el origen de los datos y solo entonces arranca el tablero. */
function resolverDatos(seguir) {
  if (datosListos()) { seguir(); return; }

  var sello = document.getElementById("sello");
  if (sello) sello.textContent = "data.js no respondió; reconstruyendo desde registro_full.json…";

  if (typeof fetch !== "function") { fallaDeDatos("el navegador no admite fetch"); return; }

  fetch("./registro_full.json", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (j) {
      var D = reconstruirDATA(j);
      if (!D) throw new Error("registro_full.json sin observaciones");
      window.DATA = D;
      seguir();
    })
    .catch(function (e) {
      fallaDeDatos(String((e && e.message) || e));
    });
}

function iniciarTablero() {
avisarCssAusente();

if (!window.DATA || !window.DATA.meta || !window.DATA.partido) {
  fallaDeDatos("window.DATA quedó incompleto");
  return;
}

var D = window.DATA;
var M = D.meta;
var OLAS = Array.isArray(M.olas) ? M.olas.slice().sort() : [];
var MUNIS = Array.isArray(M.municipios) ? M.municipios.slice() : [];

if (!OLAS.length || !MUNIS.length) {
  pantallaDeFalla(
    "Los metadatos están vacíos",
    "meta.olas o meta.municipios no traen elementos, de modo que no hay nada que graficar."
  );
  return;
}

/* Orden de lectura de las fuerzas políticas. ORDEN incluye el voto no
   declarado; PARTIDOS solo las fuerzas con candidatura. */
var ORDEN = ["MORENA", "MC", "PAN", "PRI", "PT", "PVEM", "AÚN NO DECIDE"];
var PARTIDOS = ["MORENA", "MC", "PAN", "PRI", "PT", "PVEM"];
var NO_DEC = "AÚN NO DECIDE";

/* Estado de la aplicación */
var estado = {
  muni: MUNIS[0],
  ola: OLAS[OLAS.length - 1],
  base: "total",
  partido: "MORENA",
  angosto: window.matchMedia("(max-width:700px)").matches
};

var graficas = {};

/* -------------------------------------------------------------------
   2. UTILIDADES
   ------------------------------------------------------------------- */

/* Toda cadena que provenga de los datos pasa por aquí antes de entrar
   al DOM como HTML. Los nombres de precandidatos traen comillas y
   podrían traer & o <. */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* Convierte a número solo lo que de verdad lo es. Cadenas vacías, null,
   undefined y NaN devuelven null, que es el valor con el que el resto
   del tablero sabe tratar. */
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  var n = typeof v === "number" ? v : parseFloat(v);
  return isFinite(n) ? n : null;
}

function fija(v, d) {
  return v === null || v === undefined ? "—" : v.toFixed(d === undefined ? 1 : d);
}

function signo(v) {
  return v > 0 ? "+" : "";
}

var MES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtOla(o) {
  if (!o) return "—";
  var a = String(o).split("-");
  return (MES[+a[1]] || a[1]) + " " + String(a[0]).slice(2);
}

function corto(m) {
  return String(m).replace("San Pedro ", "").replace(" de Zúñiga", "");
}

function $(sel) {
  return document.querySelector(sel);
}

function sinMovimiento() {
  return window.matchMedia("(prefers-reduced-motion:reduce)").matches;
}

/* -------------------------------------------------------------------
   3. TOKENS DE COLOR EN CACHÉ
   getComputedStyle fuerza recálculo de estilo. La versión anterior lo
   invocaba una vez por color y por celda: varios cientos de llamadas
   por render, con el consiguiente bloqueo del hilo principal. Ahora se
   leen todos de una vez y solo se releen al cambiar el tema.
   ------------------------------------------------------------------- */
var TOKENS = {};
var CLAVES_TOKEN = [
  "--morena", "--mc", "--pan", "--pri", "--pt", "--pvem", "--otros", "--nodec",
  "--ink", "--ink-soft", "--muted", "--surface", "--surface-2", "--surface-3",
  "--line", "--grid-line", "--brand", "--brand-deep", "--accent",
  "--ok", "--ok-ink", "--warn", "--warn-ink", "--risk", "--risk-ink"
];

function leerTokens() {
  var cs = getComputedStyle(document.documentElement);
  for (var i = 0; i < CLAVES_TOKEN.length; i++) {
    TOKENS[CLAVES_TOKEN[i]] = cs.getPropertyValue(CLAVES_TOKEN[i]).trim();
  }
  cacheTrama = {};
  if (typeof calcularAlfaTope === "function") calcularAlfaTope();
}

function c(clave) {
  return TOKENS[clave] || "#707070";
}

var VAR_PARTIDO = {
  MORENA: "--morena", MC: "--mc", PAN: "--pan", PRI: "--pri",
  PT: "--pt", PVEM: "--pvem", OTRO: "--otros"
};
VAR_PARTIDO[NO_DEC] = "--nodec";

function COL(p) {
  return c(VAR_PARTIDO[p] || "--otros");
}

/* --- Color: parseo, mezcla y contraste --------------------------- */

/* Acepta #rgb, #rrggbb, rgb() y rgba(). Antes solo #rrggbb: cualquier
   otra notación caía en un gris por defecto silencioso. */
function aRgb(color) {
  var s = String(color || "").trim();
  if (s.charAt(0) === "#") {
    if (s.length === 4) {
      return [
        parseInt(s.charAt(1) + s.charAt(1), 16),
        parseInt(s.charAt(2) + s.charAt(2), 16),
        parseInt(s.charAt(3) + s.charAt(3), 16)
      ];
    }
    if (s.length >= 7) {
      return [
        parseInt(s.substr(1, 2), 16),
        parseInt(s.substr(3, 2), 16),
        parseInt(s.substr(5, 2), 16)
      ];
    }
  }
  var m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    var p = m[1].split(/[,\s/]+/).map(parseFloat);
    if (p.length >= 3 && p.every(isFinite)) return [p[0], p[1], p[2]];
  }
  return [112, 112, 112];
}

function rgba(color, a) {
  var r = aRgb(color);
  return "rgba(" + r[0] + "," + r[1] + "," + r[2] + "," + a.toFixed(3) + ")";
}

function mezcla(frente, alfa, fondo) {
  var f = aRgb(frente), b = aRgb(fondo);
  return [0, 1, 2].map(function (i) {
    return Math.round(f[i] * alfa + b[i] * (1 - alfa));
  });
}

function luminancia(rgbArr) {
  var l = rgbArr.map(function (v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}

function contraste(a, b) {
  var la = luminancia(a), lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* Opacidad máxima a la que la tinta normal conserva 4.5:1 sobre el
   color de cada partido compuesto contra la superficie de la tarjeta.

   El criterio anterior decidía la tinta por el valor de opacidad y
   permitía llegar al 95 %: una celda de PVEM recibía texto blanco con
   2.57:1. Alternar blanco y tinta tampoco basta, porque entre el 55 % y
   el 75 % de opacidad ninguna de las dos alcanza 4.5:1 (el punto peor
   medido era 4.16:1). La escala se recorta hasta donde la tinta oscura
   sigue siendo legible, de modo que la intensidad sigue siendo monótona
   y comparable entre columnas, y el texto nunca cambia de color. */
var alfaTope = 0.55;
function calcularAlfaTope() {
  var tinta = aRgb(c("--ink"));
  var fondo = c("--surface");
  var tope = 1;
  PARTIDOS.forEach(function (p) {
    var color = COL(p);
    var a = 1;
    while (a > 0.2 && contraste(mezcla(color, a, fondo), tinta) < 4.5) a -= 0.02;
    if (a < tope) tope = a;
  });
  alfaTope = Math.max(0.35, Math.min(0.95, tope));
}

function tintaSobre(fondoRgb) {
  var blanco = [255, 255, 255];
  var tinta = aRgb(c("--ink"));
  return contraste(fondoRgb, tinta) >= contraste(fondoRgb, blanco)
    ? c("--ink")
    : "#FFFFFF";
}

/* Trama diagonal para el PT: su rojo (#E30613) y el del PRI (#E31B23)
   son prácticamente el mismo tono. El patrón se cachea por color. */
var cacheTrama = {};
function trama(color) {
  if (cacheTrama[color]) return cacheTrama[color];
  var lienzo = document.createElement("canvas");
  lienzo.width = 8;
  lienzo.height = 8;
  var x = lienzo.getContext("2d");
  x.fillStyle = color;
  x.fillRect(0, 0, 8, 8);
  x.strokeStyle = "rgba(255,255,255,.8)";
  x.lineWidth = 2.4;
  x.beginPath();
  x.moveTo(-2, 10); x.lineTo(10, -2);
  x.moveTo(2, 14); x.lineTo(14, 2);
  x.stroke();
  cacheTrama[color] = x.createPattern(lienzo, "repeat");
  return cacheTrama[color];
}

function relleno(p) {
  return p === "PT" ? trama(COL("PT")) : COL(p);
}

/* Punto de color de las tablas. El relleno va en background-color: el
   atajo background, aplicado en línea, borraba la trama del PT porque
   el estilo en línea gana a la hoja y el atajo restablece
   background-image a none. */
function punto(p) {
  return (
    '<span class="punto' + (p === "PT" ? " rayado" : "") +
    '" style="background-color:' + esc(COL(p)) + '"></span>'
  );
}

/* -------------------------------------------------------------------
   4. CAPA DE DATOS
   Regla que gobierna todo el módulo: ningún municipio puede asumir
   OLAS[0]. Tlajomulco y Tlaquepaque arrancan en jul-25; los otros
   cinco en ago-25. Y ninguna vista puede mostrar una ola posterior a
   la seleccionada: eso sería rellenar el pasado con el futuro.
   ------------------------------------------------------------------- */

function serie(m, p) {
  return (D.partido[m] && D.partido[m][p]) || {};
}

/* Unión de olas medidas en la plaza, sobre todas las fuerzas. La
   versión anterior consultaba solo la serie de MORENA y habría perdido
   olas presentes en otros partidos. */
var cacheOlas = {};
function olasDe(m) {
  if (cacheOlas[m]) return cacheOlas[m];
  var vistas = {};
  ORDEN.forEach(function (p) {
    var s = serie(m, p);
    OLAS.forEach(function (o) {
      if (num(s[o]) !== null) vistas[o] = true;
    });
  });
  cacheOlas[m] = OLAS.filter(function (o) { return vistas[o]; });
  return cacheOlas[m];
}

function primeraOla(m) {
  return olasDe(m)[0] || null;
}

function ultimaOla(m) {
  var k = olasDe(m);
  return k.length ? k[k.length - 1] : null;
}

function val(m, p, o) {
  if (!o) return null;
  return num(serie(m, p)[o]);
}

/* Ola efectiva: la más reciente que exista en la plaza y que NO sea
   posterior a la seleccionada. Devuelve null si la fuente todavía no
   medía esa plaza en esa fecha, en lugar de sustituirla en silencio
   por la última disponible, que es lo que hacía la versión anterior:
   al elegir jul-25 se comparaba Tlajomulco de jul-25 contra
   Guadalajara de ago-26 dentro de la misma matriz. */
function olaEfectiva(m, o) {
  var ks = olasDe(m);
  for (var i = ks.length - 1; i >= 0; i--) if (ks[i] <= o) return ks[i];
  return null;
}

function estatus(m, tipo, pregunta, serieNom, o) {
  return (D.estatus && D.estatus[m + "|" + tipo + "|" + pregunta + "|" + serieNom + "|" + o]) || "";
}

function marca(m, tipo, pregunta, serieNom, o) {
  return estatus(m, tipo, pregunta, serieNom, o) === "PONDERADO" ? "*" : "";
}

function rankMuni(m, o) {
  var oe = olaEfectiva(m, o);
  if (!oe) return [];
  return PARTIDOS.map(function (p) { return { p: p, v: val(m, p, oe) }; })
    .filter(function (x) { return x.v !== null; })
    .sort(function (a, b) { return b.v - a.v; });
}

function holgura(m, o) {
  var r = rankMuni(m, o);
  if (r.length < 2) return null;
  var dif = r[0].v - r[1].v;
  var me = meDif(r[0].v, r[1].v);
  return { muni: m, ola: olaEfectiva(m, o), p1: r[0], p2: r[1], dif: dif, me: me, holgura: dif - me };
}

function holgurasDe(o) {
  return MUNIS.map(function (m) { return holgura(m, o); }).filter(Boolean);
}

function sinMedicion(o) {
  return MUNIS.filter(function (m) { return !olaEfectiva(m, o); });
}

/* -------------------------------------------------------------------
   5. ESTADÍSTICA
   ------------------------------------------------------------------- */
var N = num(M.n) || 600;
var Z = 1.96;

function meProp(p, n, z) {
  n = n || N; z = z || Z;
  var q = Math.max(0, Math.min(100, p)) / 100;
  return 100 * z * Math.sqrt((q * (1 - q)) / n);
}

/* Error de la diferencia entre dos proporciones de la misma muestra. */
function meDif(p1, p2, n, z) {
  n = n || N; z = z || Z;
  var a = p1 / 100, b = p2 / 100;
  return 100 * z * Math.sqrt(Math.max(0, (a + b - (a - b) * (a - b)) / n));
}

/* Base de lectura. En "voto efectivo" se reparte el no declarado entre
   las fuerzas. La división se protege: con 100 % de no declarados el
   cálculo anterior devolvía Infinity. */
function baseAjustada(m, o) {
  var oe = olaEfectiva(m, o);
  if (!oe) return [];
  var r = ORDEN.map(function (p) { return { p: p, v: val(m, p, oe) }; })
    .filter(function (x) { return x.v !== null; });
  if (estado.base === "efectivo") {
    var nd = 0;
    r.forEach(function (x) { if (x.p === NO_DEC) nd = x.v; });
    var resto = 100 - nd;
    if (resto <= 0) return [];
    r = r.filter(function (x) { return x.p !== NO_DEC; })
      .map(function (x) { return { p: x.p, v: (x.v * 100) / resto }; });
  }
  return r.sort(function (a, b) { return b.v - a.v; });
}

/* -------------------------------------------------------------------
   6. CIMIENTOS DE CHART.JS
   ------------------------------------------------------------------- */

/* Mezcla profunda. La versión anterior fusionaba solo el primer nivel,
   de modo que pasar {plugins:{legend:…}} borraba por completo el
   tooltip y la leyenda por defecto: de ahí que cada gráfica tuviera
   que repetir la misma configuración de tooltip. */
function fusion(destino, extra) {
  if (!extra) return destino;
  Object.keys(extra).forEach(function (k) {
    var v = extra[k];
    if (v && typeof v === "object" && !Array.isArray(v) &&
        destino[k] && typeof destino[k] === "object" && !Array.isArray(destino[k])) {
      fusion(destino[k], v);
    } else {
      destino[k] = v;
    }
  });
  return destino;
}

function aplicarDefaults() {
  var f = Chart.defaults;
  f.font.family = "Inter, system-ui, Arial, sans-serif";
  f.font.size = 11;
  f.color = c("--muted");
  f.animation = sinMovimiento() ? false : { duration: 600, easing: "easeOutQuart" };
  f.plugins.legend.labels.color = c("--muted");
  f.plugins.legend.labels.usePointStyle = true;
  f.plugins.legend.labels.boxWidth = 7;
  f.plugins.tooltip.backgroundColor = c("--brand-deep");
  f.plugins.tooltip.padding = 9;
  f.plugins.tooltip.cornerRadius = 5;
  f.plugins.tooltip.titleFont = { family: "Poppins, Arial, sans-serif", size: 12 };
  f.maintainAspectRatio = false;
  f.responsive = true;
}

/* El objeto base deliberadamente NO define escalas. Si las definiera,
   la mezcla profunda arrastraría el callback de porcentaje hasta un eje
   de categorías y las etiquetas de municipio saldrían como "0%", "1%".
   Cada gráfica declara sus ejes completos con los ayudantes de abajo. */
function opciones(extra) {
  var base = {
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: true } }
  };
  return fusion(base, extra);
}

function ejePct(titulo) {
  return {
    grid: { color: c("--grid-line") },
    border: { display: false },
    ticks: { color: c("--muted"), callback: function (v) { return v + "%"; } },
    title: titulo ? { display: true, text: titulo, color: c("--muted") } : undefined
  };
}

function ejePp() {
  return {
    grid: { color: c("--grid-line") },
    border: { display: false },
    ticks: { color: c("--muted"), callback: function (v) { return v + " pp"; } }
  };
}

function ejeCategoria() {
  return {
    type: "category",
    grid: { display: false },
    border: { color: c("--grid-line") },
    ticks: {
      color: c("--ink"),
      font: { size: 10.5, weight: "600" },
      maxRotation: estado.angosto ? 0 : 34,
      autoSkip: false
    }
  };
}

function leyendaAbajo(sz) {
  return { position: "bottom", labels: { color: c("--muted"), font: { size: sz || 11 } } };
}

/* En pantallas angostas las barras por municipio giran a horizontal.
   Con siete etiquetas como "Tlajomulco" en un eje X de 320 px, Chart.js
   ocultaba la mitad y la gráfica dejaba de ser legible. */
function ejeIndice() {
  return estado.angosto ? "y" : "x";
}

/* Devuelve el valor de la barra sea cual sea la orientación. */
function valorBarra(ctx) {
  return estado.angosto ? ctx.parsed.x : ctx.parsed.y;
}

function ejesBarrasMuni(tipoValor) {
  var valor = tipoValor === "pp" ? ejePp() : ejePct();
  var cat = ejeCategoria();
  return estado.angosto ? { x: valor, y: cat } : { y: valor, x: cat };
}

/* Intervalo de confianza al 95 % dibujado sobre cada barra. */
var pluginIC = {
  id: "barrasIC",
  afterDatasetsDraw: function (chart, args, opts) {
    var ic = (opts && opts.ic) || [];
    if (!ic.length) return;
    var meta = chart.getDatasetMeta(0);
    var ctx = chart.ctx;
    var esH = chart.options.indexAxis === "y";
    var escala = esH ? chart.scales.x : chart.scales.y;
    if (!escala) return;
    ctx.save();
    ctx.strokeStyle = c("--ink-soft");
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.85;
    meta.data.forEach(function (barra, i) {
      if (ic[i] === null || ic[i] === undefined) return;
      var centro = chart.data.datasets[0].data[i];
      if (centro === null || centro === undefined) return;
      var lo = escala.getPixelForValue(Math.max(0, centro - ic[i]));
      var hi = escala.getPixelForValue(centro + ic[i]);
      var t = 9;
      ctx.beginPath();
      if (esH) {
        var y = barra.y;
        ctx.moveTo(lo, y); ctx.lineTo(hi, y);
        ctx.moveTo(lo, y - t / 2); ctx.lineTo(lo, y + t / 2);
        ctx.moveTo(hi, y - t / 2); ctx.lineTo(hi, y + t / 2);
      } else {
        var x = barra.x;
        ctx.moveTo(x, lo); ctx.lineTo(x, hi);
        ctx.moveTo(x - t / 2, lo); ctx.lineTo(x + t / 2, lo);
        ctx.moveTo(x - t / 2, hi); ctx.lineTo(x + t / 2, hi);
      }
      ctx.stroke();
    });
    ctx.restore();
  }
};

/* Etiquetas de porcentaje sobre los segmentos de la dona. */
var pluginDona = {
  id: "etiquetasDona",
  afterDatasetsDraw: function (chart) {
    var ctx = chart.ctx;
    var meta = chart.getDatasetMeta(0);
    var datos = chart.data.datasets[0].data;
    var total = datos.reduce(function (a, b) { return a + b; }, 0);
    if (!total) return;
    ctx.save();
    ctx.font = '600 11px Poppins, Arial, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    meta.data.forEach(function (arco, i) {
      var v = datos[i];
      if (v / total < 0.045) return;
      var pos = arco.getCenterPoint();
      ctx.strokeStyle = "rgba(0,0,0,.55)";
      ctx.lineWidth = 2.8;
      ctx.strokeText(v.toFixed(1) + "%", pos.x, pos.y);
      ctx.fillStyle = "#fff";
      ctx.fillText(v.toFixed(1) + "%", pos.x, pos.y);
    });
    ctx.restore();
  }
};

function destruir(clave) {
  if (graficas[clave]) {
    graficas[clave].destroy();
    delete graficas[clave];
  }
}

/* Crea la gráfica, retira el esqueleto y describe el lienzo para
   lectores de pantalla. */
function dibujar(clave, idLienzo, config, resumen) {
  var canvas = document.getElementById(idLienzo);
  if (!canvas) return null;
  destruir(clave);
  graficas[clave] = new Chart(canvas, config);
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", resumen || "");
  quitarEsqueleto(canvas.parentElement);
  return graficas[clave];
}

/* -------------------------------------------------------------------
   7. VISTAS
   ------------------------------------------------------------------- */

/* --- Panorama ----------------------------------------------------- */

function chispa(m, p) {
  var vs = olasDe(m).map(function (o) { return val(m, p, o); })
    .filter(function (v) { return v !== null; });
  if (vs.length < 3) return "";
  var w = 104, h = 26;
  var mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs);
  var r = mx - mn || 1;
  var pts = vs.map(function (v, i) {
    return [(i / (vs.length - 1)) * w, h - ((v - mn) / r) * (h - 4) - 2];
  });
  var d = pts.map(function (q, i) {
    return (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1);
  }).join(" ");
  var color = vs[vs.length - 1] >= vs[0] ? c("--ok-ink") : c("--risk-ink");
  var ult = pts[pts.length - 1];
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h +
    '" aria-hidden="true" focusable="false"><path d="' + d + '" fill="none" stroke="' +
    esc(color) + '" stroke-width="1.8" stroke-linejoin="round"/><circle cx="' +
    ult[0].toFixed(1) + '" cy="' + ult[1].toFixed(1) + '" r="2.4" fill="' + esc(color) +
    '"/></svg>';
}

function vAlerta() {
  var el = $("#alerta");
  var h = holgura(estado.muni, estado.ola);
  if (!h) {
    el.innerHTML = "<b>Sin medición.</b> La fuente no reporta intención de voto para " +
      esc(estado.muni) + " en la ola de " + esc(fmtOla(estado.ola)) +
      ". Elige una ola posterior o cambia de plaza.";
    return;
  }
  var empate = h.holgura <= 0;
  el.innerHTML = empate
    ? "<b>Plaza en disputa.</b> En " + esc(estado.muni) + ", la diferencia de " +
      fija(h.dif) + " pp entre " + esc(h.p1.p) + " y " + esc(h.p2.p) +
      " no supera el error de la diferencia (±" + fija(h.me) +
      " pp). Tratarla como competida, no como ganada."
    : "En " + esc(estado.muni) + ", " + esc(h.p1.p) + " aventaja a " + esc(h.p2.p) +
      " por " + fija(h.dif) + " pp, por encima del error de la diferencia (±" +
      fija(h.me) + " pp). La ventaja es estadísticamente significativa al 95 %.";
}

function vKpis() {
  var el = $("#kpis");
  var h = holgura(estado.muni, estado.ola);
  var r = baseAjustada(estado.muni, estado.ola);
  if (!h || !r.length) {
    el.innerHTML = '<div class="kpi"><div class="lab">Sin datos</div>' +
      '<div class="val">—</div><div class="sub">La fuente no mide esta plaza en la ola elegida.</div></div>';
    return;
  }
  var oe = h.ola;
  var p1 = r[0];
  var nd = val(estado.muni, NO_DEC, oe);
  var o0 = primeraOla(estado.muni);
  var v0 = val(estado.muni, h.p1.p, o0);
  var delta = v0 === null ? null : h.p1.v - v0;
  var empate = h.holgura <= 0;
  var efect = estado.base === "efectivo";

  var items = [
    ["Puntero",
      punto(p1.p) + esc(p1.p),
      fija(p1.v) + "% de intención" + (efect ? " (voto efectivo *)" : ""),
      "", "frase"],
    ["Ventaja sobre el segundo",
      fija(h.dif) + " pp",
      "error de la diferencia ±" + fija(h.me) + " pp, sobre la base total",
      ""],
    ["Lectura estadística",
      empate ? "Empate técnico" : "Ventaja significativa",
      empate
        ? esc(h.p1.p) + " y " + esc(h.p2.p) + " son indistinguibles al 95 %"
        : esc(h.p1.p) + " supera a " + esc(h.p2.p) + " al 95 % de confianza",
      "", "frase"],
    ["Voto no declarado",
      nd === null ? "—" : fija(nd) + "%",
      nd === null ? "la fuente no lo reporta en esta ola"
        : (nd > 15 ? "bolsa amplia sin asignar" : "bolsa contenida"),
      ""],
    ["Movimiento del puntero",
      delta === null ? "—" : signo(delta) + fija(delta) + " pp",
      "desde " + esc(fmtOla(o0)) + " hasta " + esc(fmtOla(oe)),
      chispa(estado.muni, h.p1.p)]
  ];

  el.innerHTML = items.map(function (a) {
    var esFrase = a[4] === "frase";
    return '<div class="kpi"><div class="lab">' + a[0] + '</div><div class="val' +
      (esFrase ? " frase" : "") + '">' + a[1] + '</div><div class="sub">' + a[2] +
      "</div>" + a[3] + "</div>";
  }).join("");
}

function vRank() {
  var r = baseAjustada(estado.muni, estado.ola);
  if (!r.length) { destruir("rank"); return; }
  var ic = r.map(function (x) { return meProp(x.v); });
  var mx = Math.max.apply(null, r.map(function (x, i) { return x.v + ic[i]; }));

  dibujar("rank", "g-rank", {
    type: "bar",
    data: {
      labels: r.map(function (x) { return x.p; }),
      datasets: [{
        data: r.map(function (x) { return x.v; }),
        backgroundColor: r.map(function (x) { return relleno(x.p); }),
        borderRadius: 3,
        barPercentage: 0.68
      }]
    },
    options: opciones({
      indexAxis: "y",
      scales: {
        x: {
          min: 0, max: Math.ceil(mx / 5) * 5,
          grid: { color: c("--grid-line") }, border: { display: false },
          ticks: { color: c("--muted"), callback: function (v) { return v + "%"; } }
        },
        y: {
          grid: { display: false }, border: { display: false },
          ticks: { color: c("--ink"), font: { family: "Poppins, Arial, sans-serif", size: 12, weight: "600" } }
        }
      },
      plugins: {
        legend: { display: false },
        barrasIC: { ic: ic },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var v = ctx.raw, e = meProp(v);
              return " " + fija(v) + "%   IC 95 %: " + fija(v - e) + " – " + fija(v + e);
            }
          }
        }
      }
    }),
    plugins: [pluginIC]
  },
  "Ranking de intención de voto en " + estado.muni + ": " +
    r.map(function (x) { return x.p + " " + fija(x.v) + "%"; }).join(", ") + ".");
}

function vTrack() {
  var os = olasDe(estado.muni);
  var titulo = $("#t-track");
  if (titulo) {
    titulo.textContent = os.length + " meses de tracking: la evolución es el dato, no la foto";
  }
  if (!os.length) { destruir("track"); return; }

  dibujar("track", "g-track", {
    type: "line",
    data: {
      labels: os.map(fmtOla),
      datasets: ORDEN.map(function (p) {
        return {
          label: p,
          data: os.map(function (o) { return val(estado.muni, p, o); }),
          borderColor: COL(p),
          backgroundColor: COL(p),
          borderWidth: p === NO_DEC ? 2 : 2.3,
          borderDash: p === NO_DEC ? [5, 3] : (p === "PT" ? [2, 2] : []),
          pointRadius: 2.3, pointHoverRadius: 5, tension: 0.25, spanGaps: true
        };
      })
    },
    options: opciones({
      plugins: {
        legend: leyendaAbajo(11),
        tooltip: {
          callbacks: {
            label: function (ctx) {
              if (ctx.parsed.y === null) return " " + ctx.dataset.label + ": —";
              return " " + ctx.dataset.label + ": " + fija(ctx.parsed.y) + "%" +
                marca(estado.muni, "INTENCION_PARTIDO", "None", ctx.dataset.label, os[ctx.dataIndex]);
            }
          }
        }
      },
      scales: {
        y: ejePct(),
        x: {
          grid: { display: false }, border: { color: c("--grid-line") },
          ticks: { color: c("--muted"), maxRotation: 45, autoSkipPadding: 8, font: { size: 10 } }
        }
      }
    })
  },
  "Serie mensual de intención de voto por partido en " + estado.muni +
    ", de " + fmtOla(os[0]) + " a " + fmtOla(os[os.length - 1]) + ".");
}

/* --- Los siete municipios ---------------------------------------- */

function ordenMunis() {
  return holgurasDe(estado.ola)
    .sort(function (a, b) { return b.p1.v - a.p1.v; })
    .map(function (h) { return h.muni; });
}

function colorHolgura(h) {
  return h <= 0 ? c("--risk") : (h < 5 ? c("--warn") : c("--ok"));
}
function tintaHolgura(h) {
  return h <= 0 ? c("--risk-ink") : (h < 5 ? c("--warn-ink") : c("--ok-ink"));
}

function vTermo() {
  var cont = $("#termo");
  var hs = holgurasDe(estado.ola).sort(function (a, b) { return a.holgura - b.holgura; });
  if (!hs.length) {
    cont.innerHTML = '<p class="pie-nota">La fuente no mide ninguna plaza en la ola de ' +
      esc(fmtOla(estado.ola)) + ".</p>";
    return;
  }
  var mx = Math.max.apply(null, hs.map(function (h) { return Math.max(h.dif, h.me); })) * 1.14;

  cont.innerHTML = hs.map(function (h) {
    var barra = colorHolgura(h.holgura);
    var tinta = tintaHolgura(h.holgura);
    var ancho = Math.max(2, (h.dif / mx) * 100);
    var umbral = (h.me / mx) * 100;
    var pie = h.holgura <= 0 ? "empate técnico" : fija(h.holgura) + " pp de holgura";
    return '<div class="termo-fila">' +
      '<div class="termo-mun">' + esc(h.muni) +
        '<div class="termo-duelo">' + esc(h.p1.p) + " sobre " + esc(h.p2.p) +
        (h.ola !== estado.ola ? " · ola " + esc(fmtOla(h.ola)) : "") + "</div></div>" +
      '<div class="termo-pista"><div class="termo-barra" data-w="' + ancho.toFixed(1) +
        '" style="background:' + esc(barra) + '"></div>' +
        '<div class="termo-umbral" style="left:' + umbral.toFixed(1) + '%"></div></div>' +
      '<div class="termo-et" style="color:' + esc(tinta) + '">' + fija(h.dif) +
        " pp<small>" + pie + "</small></div></div>";
  }).join("");

  /* Dos cuadros de espera: con uno solo, el navegador a veces aplica el
     ancho en el mismo ciclo de diseño en que se insertó el nodo y la
     transición no llega a ejecutarse. */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var barras = cont.querySelectorAll(".termo-barra");
      for (var i = 0; i < barras.length; i++) {
        barras[i].style.width = barras[i].getAttribute("data-w") + "%";
      }
    });
  });
}

function vMuniPartido() {
  var ms = ordenMunis();
  if (!ms.length) { destruir("muniPartido"); return; }

  dibujar("muniPartido", "g-muni-partido", {
    type: "bar",
    data: {
      labels: ms.map(corto),
      datasets: ORDEN.map(function (p) {
        return {
          label: p,
          data: ms.map(function (m) { return val(m, p, olaEfectiva(m, estado.ola)); }),
          backgroundColor: relleno(p),
          borderRadius: 2,
          borderColor: p === "PT" ? COL("PT") : "transparent",
          borderWidth: p === "PT" ? 1 : 0
        };
      })
    },
    options: opciones({
      indexAxis: ejeIndice(),
      plugins: {
        legend: leyendaAbajo(11),
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var v = valorBarra(ctx);
              return " " + ctx.dataset.label + ": " + (v === null ? "no se mide" : fija(v) + "%");
            }
          }
        }
      },
      scales: ejesBarrasMuni("pct")
    })
  },
  "Intención de voto por partido en " + ms.length + " municipios, ola de " + fmtOla(estado.ola) + ".");
}

function vVentaja() {
  var hs = holgurasDe(estado.ola).sort(function (a, b) { return b.dif - a.dif; });
  if (!hs.length) { destruir("ventaja"); return; }

  dibujar("ventaja", "g-ventaja", {
    data: {
      labels: hs.map(function (h) { return corto(h.muni); }),
      datasets: [
        {
          type: "bar", label: "Ventaja del puntero",
          data: hs.map(function (h) { return h.dif; }),
          backgroundColor: hs.map(function (h) { return colorHolgura(h.holgura); }),
          borderRadius: 3, barPercentage: 0.62, order: 2
        },
        {
          type: "line", label: "Margen de error de la diferencia",
          data: hs.map(function (h) { return h.me; }),
          borderColor: c("--ink-soft"), borderDash: [5, 4], borderWidth: 1.8,
          pointRadius: 3, pointBackgroundColor: c("--surface"), fill: false,
          tension: 0, order: 1
        }
      ]
    },
    options: opciones({
      indexAxis: ejeIndice(),
      plugins: {
        legend: leyendaAbajo(11),
        tooltip: {
          callbacks: {
            afterBody: function (items) {
              var h = hs[items[0].dataIndex];
              return h.holgura <= 0
                ? "Empate técnico: la ventaja cabe dentro del error."
                : "Ventaja significativa al 95 %.";
            }
          }
        }
      },
      scales: ejesBarrasMuni("pp")
    })
  },
  "Ventaja del puntero frente al margen de error de la diferencia, por municipio.");
}

function vNoDeclarado() {
  var ds = MUNIS.map(function (m) {
    return { m: m, v: val(m, NO_DEC, olaEfectiva(m, estado.ola)) };
  }).filter(function (x) { return x.v !== null; })
    .sort(function (a, b) { return b.v - a.v; });

  if (!ds.length) { destruir("noDeclarado"); return; }
  var prom = ds.reduce(function (a, b) { return a + b.v; }, 0) / ds.length;

  dibujar("noDeclarado", "g-no-decl", {
    data: {
      labels: ds.map(function (x) { return corto(x.m); }),
      datasets: [
        {
          type: "bar", label: "Voto no declarado",
          data: ds.map(function (x) { return x.v; }),
          backgroundColor: ds.map(function (x) { return x.v > prom ? c("--nodec") : c("--otros"); }),
          borderRadius: 3, barPercentage: 0.62, order: 2
        },
        {
          type: "line",
          label: "Promedio de las plazas medidas (" + fija(prom) + "%)",
          data: ds.map(function () { return prom; }),
          borderColor: c("--accent"), borderDash: [6, 4], borderWidth: 1.8,
          pointRadius: 0, fill: false, order: 1
        }
      ]
    },
    options: opciones({
      indexAxis: ejeIndice(),
      plugins: { legend: leyendaAbajo(11) },
      scales: ejesBarrasMuni("pct")
    })
  },
  "Voto no declarado por municipio. Promedio de " + fija(prom) + " por ciento.");
}

function vCalor() {
  var cont = $("#calor");
  var ms = ordenMunis();
  if (!ms.length) {
    cont.innerHTML = '<p class="pie-nota">Ninguna plaza tiene medición en la ola de ' +
      esc(fmtOla(estado.ola)) + ".</p>";
    return;
  }

  var vs = [];
  ms.forEach(function (m) {
    PARTIDOS.forEach(function (p) {
      var v = val(m, p, olaEfectiva(m, estado.ola));
      if (v !== null) vs.push(v);
    });
  });
  var mx = vs.length ? Math.max.apply(null, vs) : 1;
  var fondoTabla = c("--surface");

  /* Encabezados con punto de color más texto en tinta normal. Escribir
     el nombre del partido en su propio color reprobaba AA: MC sobre
     blanco da 2.49:1 y PVEM 2.57:1. */
  var h = '<div class="tabla-scroll" tabindex="0" role="region" ' +
    'aria-label="Matriz de intención de voto por municipio y partido">' +
    '<table class="calor"><thead><tr><th scope="col">Municipio</th>' +
    PARTIDOS.map(function (p) {
      return '<th scope="col" style="text-align:center"><span class="cab-partido">' +
        punto(p) + esc(p) + "</span></th>";
    }).join("") + "</tr></thead><tbody>";

  ms.forEach(function (m) {
    var oe = olaEfectiva(m, estado.ola);
    h += '<tr><th scope="row">' + esc(m) +
      (oe !== estado.ola ? ' <span class="etiqueta">ola ' + esc(fmtOla(oe)) + "</span>" : "") +
      "</th>";
    PARTIDOS.forEach(function (p) {
      var v = val(m, p, oe);
      if (v === null) {
        h += '<td style="color:var(--muted)">—</td>';
        return;
      }
      var alfa = 0.08 + (alfaTope - 0.08) * (v / mx);
      var compuesto = mezcla(COL(p), alfa, fondoTabla);
      h += '<td style="background:' + esc(rgba(COL(p), alfa)) + ";color:" +
        esc(tintaSobre(compuesto)) + '" title="' + esc(m + " · " + p + " · " + fmtOla(oe)) +
        '">' + fija(v) + marca(m, "INTENCION_PARTIDO", "None", p, oe) + "</td>";
    });
    h += "</tr>";
  });

  h += "</tbody></table></div>" +
    '<p class="pie-nota">Intensidad proporcional al porcentaje de intención dentro de la matriz. ' +
    "Las celdas con asterisco son datos ponderados. Un guion indica que la fuente no mide ese " +
    "partido en esa plaza. En pantallas angostas la tabla se desplaza en horizontal y la columna " +
    "de municipio queda fija.</p>";

  var faltan = sinMedicion(estado.ola);
  if (faltan.length) {
    h += '<p class="pie-nota"><b>Fuera de la matriz:</b> ' + esc(faltan.join(", ")) +
      ". La fuente todavía no medía estas plazas en " + esc(fmtOla(estado.ola)) +
      ", y no se sustituyen por una ola posterior.</p>";
  }

  cont.innerHTML = h;
}

function vReeleccion() {
  var ds = MUNIS.map(function (m) {
    var s = D.reeleccion && D.reeleccion[m] && D.reeleccion[m]["NO"];
    if (!s) return null;
    var disp = OLAS.filter(function (o) { return num(s[o]) !== null; });
    var oe = null;
    for (var i = disp.length - 1; i >= 0; i--) {
      if (disp[i] <= estado.ola) { oe = disp[i]; break; }
    }
    return oe ? { m: m, v: num(s[oe]), o: oe } : null;
  }).filter(Boolean).sort(function (a, b) { return b.v - a.v; });

  if (!ds.length) { destruir("reeleccion"); return; }
  var prom = ds.reduce(function (a, b) { return a + b.v; }, 0) / ds.length;

  dibujar("reeleccion", "g-reelec", {
    type: "bar",
    data: {
      labels: ds.map(function (x) { return corto(x.m); }),
      datasets: [{
        label: "Responde que NO",
        data: ds.map(function (x) { return x.v; }),
        backgroundColor: ds.map(function (x) { return x.v > prom + 12 ? c("--risk") : c("--brand"); }),
        borderRadius: 3, barPercentage: 0.62
      }]
    },
    options: opciones({
      indexAxis: ejeIndice(),
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return " " + fija(valorBarra(ctx)) + " % rechaza la reelección";
            },
            afterBody: function (items) {
              return "Ola: " + fmtOla(ds[items[0].dataIndex].o);
            }
          }
        }
      },
      scales: (function () {
        var e = ejesBarrasMuni("pct");
        var clave = estado.angosto ? "x" : "y";
        e[clave].min = 0;
        e[clave].max = 100;
        return e;
      })()
    })
  },
  "Rechazo a la reelección del alcalde en funciones, en " + ds.length + " municipios.");
}

function vDona() {
  var oe = olaEfectiva(estado.muni, estado.ola);
  var r = ORDEN.map(function (p) { return { p: p, v: val(estado.muni, p, oe) }; })
    .filter(function (x) { return x.v !== null && x.v > 0; });
  if (!r.length) { destruir("dona"); return; }

  dibujar("dona", "g-dona", {
    type: "doughnut",
    data: {
      labels: r.map(function (x) { return x.p; }),
      datasets: [{
        data: r.map(function (x) { return x.v; }),
        backgroundColor: r.map(function (x) { return relleno(x.p); }),
        borderColor: c("--surface"), borderWidth: 2
      }]
    },
    options: {
      cutout: "54%",
      interaction: { mode: "nearest", intersect: true },
      plugins: {
        legend: {
          position: estado.angosto ? "bottom" : "right",
          labels: { color: c("--muted"), font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function (ctx) { return " " + ctx.label + ": " + fija(ctx.parsed) + "%"; }
          }
        }
      }
    },
    plugins: [pluginDona]
  },
  "Composición del voto en " + estado.muni + " en la ola de " + fmtOla(oe) + ".");
}

/* --- Movimiento en el tiempo ------------------------------------- */

/* Siete tonos distinguibles para las series municipales. */
var COLM = ["#1F4E9C", "#E07B00", "#2E8B57", "#B7245C", "#00868B", "#7D5BA6", "#A0722B"];

function vComparaPartido() {
  dibujar("comparaPartido", "g-compara", {
    type: "line",
    data: {
      labels: OLAS.map(fmtOla),
      datasets: MUNIS.map(function (m, i) {
        return {
          label: m,
          data: OLAS.map(function (o) { return val(m, estado.partido, o); }),
          borderColor: COLM[i % COLM.length],
          backgroundColor: COLM[i % COLM.length],
          borderWidth: 2.1, pointRadius: 2.2, pointHoverRadius: 5,
          tension: 0.25, spanGaps: true
        };
      })
    },
    options: opciones({
      plugins: {
        legend: leyendaAbajo(10.5),
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return " " + ctx.dataset.label + ": " +
                (ctx.parsed.y === null ? "—" : fija(ctx.parsed.y) + "%");
            }
          }
        }
      },
      scales: {
        y: ejePct(),
        x: {
          grid: { display: false }, border: { color: c("--grid-line") },
          ticks: { color: c("--muted"), maxRotation: 45, autoSkipPadding: 8, font: { size: 10 } }
        }
      }
    })
  },
  "Trayectoria de " + estado.partido + " en las " + MUNIS.length + " plazas.");
}

function vDelta() {
  /* La variación se mide contra la primera ola de CADA plaza, no contra
     OLAS[0]: Guadalajara arranca en ago-25 y Tlajomulco en jul-25. */
  var ds = MUNIS.map(function (m) {
    var o0 = primeraOla(m), o1 = ultimaOla(m);
    var h = holgura(m, o1);
    if (!h || !o0 || !o1) return null;
    var a = val(m, h.p1.p, o0), b = val(m, h.p1.p, o1);
    return a === null || b === null ? null : { m: m, p: h.p1.p, v: b - a, o0: o0, o1: o1 };
  }).filter(Boolean).sort(function (a, b) { return b.v - a.v; });

  if (!ds.length) { destruir("delta"); return; }

  dibujar("delta", "g-delta", {
    type: "bar",
    data: {
      labels: ds.map(function (x) { return corto(x.m); }),
      datasets: [{
        data: ds.map(function (x) { return x.v; }),
        backgroundColor: ds.map(function (x) { return x.v >= 0 ? c("--ok") : c("--risk"); }),
        borderRadius: 3, barPercentage: 0.62
      }]
    },
    options: opciones({
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var x = ds[ctx.dataIndex];
              return " " + x.p + ": " + signo(x.v) + fija(x.v) + " pp entre " +
                fmtOla(x.o0) + " y " + fmtOla(x.o1);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: c("--grid-line") }, border: { display: false },
          ticks: { color: c("--muted"), callback: function (v) { return signo(v) + v + " pp"; } }
        },
        y: {
          grid: { display: false }, border: { display: false },
          ticks: { color: c("--ink"), font: { size: 11, weight: "600" } }
        }
      }
    })
  },
  "Variación del partido puntero entre la primera y la última ola de cada plaza.");
}

function vNoDec() {
  dibujar("noDec", "g-no-dec", {
    type: "line",
    data: {
      labels: OLAS.map(fmtOla),
      datasets: MUNIS.map(function (m, i) {
        return {
          label: m,
          data: OLAS.map(function (o) { return val(m, NO_DEC, o); }),
          borderColor: COLM[i % COLM.length],
          backgroundColor: COLM[i % COLM.length],
          borderWidth: 2, pointRadius: 2, pointHoverRadius: 5,
          tension: 0.25, spanGaps: true, fill: false
        };
      })
    },
    options: opciones({
      plugins: { legend: leyendaAbajo(10.5) },
      scales: {
        y: ejePct(),
        x: {
          grid: { display: false }, border: { color: c("--grid-line") },
          ticks: { color: c("--muted"), maxRotation: 45, autoSkipPadding: 8, font: { size: 10 } }
        }
      }
    })
  },
  "Evolución del voto no declarado en las " + MUNIS.length + " plazas.");
}

/* --- Internas ----------------------------------------------------- */

function precandidatos(m, part) {
  var pc = D.precand && D.precand[m] && D.precand[m][part];
  if (!pc) return [];
  return Object.keys(pc).filter(function (a) { return a !== "OTRO" && a !== NO_DEC; });
}

/* Ola de la interna. Dos correcciones respecto de la versión anterior:
   se exige que al menos dos precandidatos estén medidos (la ventaja del
   primero sobre el segundo no existe si solo hay uno), y se toma la ola
   más reciente que no sea posterior a la seleccionada.
   Antes se leía la cobertura de un único precandidato —el primero del
   objeto— y se caía a la última ola disponible aunque fuera futura. En
   El Salto / MORENA y en Tlajomulco / PRI ese primer precandidato tiene
   menos olas que el grupo, de modo que la ola elegida era arbitraria. */
function olaInterna(m, part, olaSel) {
  var pc = D.precand && D.precand[m] && D.precand[m][part];
  if (!pc) return null;
  var cands = precandidatos(m, part);
  if (cands.length < 2) return null;
  for (var i = OLAS.length - 1; i >= 0; i--) {
    var o = OLAS[i];
    if (o > olaSel) continue;
    var medidos = 0;
    for (var j = 0; j < cands.length; j++) {
      if (num(pc[cands[j]][o]) !== null) medidos++;
    }
    if (medidos >= 2) return o;
  }
  return null;
}

function filasInterna(m, part, oe) {
  var pc = D.precand[m][part];
  return precandidatos(m, part)
    .map(function (a) { return { a: a, v: num(pc[a][oe]) }; })
    .filter(function (x) { return x.v !== null; })
    .sort(function (x, y) { return y.v - x.v; });
}

var PARTIDOS_INTERNA = ["PAN", "PRI", "MORENA", "MC", "PVEM"];

function vInternas() {
  var ms = MUNIS.slice();
  var olasPorCelda = {};

  var datasets = PARTIDOS_INTERNA.map(function (part) {
    return {
      label: part,
      data: ms.map(function (m) {
        var oe = olaInterna(m, part, estado.ola);
        if (!oe) return null;
        var r = filasInterna(m, part, oe);
        if (r.length < 2) return null;
        olasPorCelda[part + "|" + m] = oe;
        return +(r[0].v - r[1].v).toFixed(1);
      }),
      backgroundColor: relleno(part),
      borderRadius: 2,
      borderColor: part === "PT" ? COL("PT") : "transparent",
      borderWidth: 0
    };
  });

  dibujar("internas", "g-internas", {
    type: "bar",
    data: { labels: ms.map(corto), datasets: datasets },
    options: opciones({
      indexAxis: ejeIndice(),
      plugins: {
        legend: leyendaAbajo(11),
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var v = valorBarra(ctx);
              if (v === null || v === undefined) {
                return " " + ctx.dataset.label + ": no se mide en esta plaza";
              }
              var oe = olasPorCelda[ctx.dataset.label + "|" + ms[ctx.dataIndex]];
              return " " + ctx.dataset.label + ": " + fija(v) +
                " pp del 1.º sobre el 2.º" + (oe ? " · ola " + fmtOla(oe) : "");
            }
          }
        }
      },
      scales: ejesBarrasMuni("pp")
    })
  },
  "Ventaja del precandidato puntero sobre el segundo, por partido y municipio.");
}

function vTabla() {
  var cont = $("#tabla");
  var pc = (D.precand && D.precand[estado.muni]) || {};
  var h = "";

  Object.keys(pc).forEach(function (part) {
    var oe = olaInterna(estado.muni, part, estado.ola);
    if (!oe) return;
    var filas = filasInterna(estado.muni, part, oe);
    if (filas.length < 2) return;

    var u1 = val(estado.muni, part, olaEfectiva(estado.muni, estado.ola));
    var primero = filas[0].v, segundo = filas[1].v;
    var abierta = primero - segundo <= meDif(primero, segundo);

    h += '<div class="tabla-scroll" tabindex="0" role="region" aria-label="Interna de ' +
      esc(part) + " en " + esc(estado.muni) + '" style="margin-bottom:16px">' +
      "<table><caption>" + punto(part) + esc(part) +
      '<span class="etiqueta' + (abierta ? " abierta" : "") + '">' +
      (abierta ? "interna abierta" : "candidato natural") + "</span>" +
      '<span class="etiqueta">ola ' + esc(fmtOla(oe)) + "</span></caption>" +
      '<thead><tr><th scope="col" style="width:44%">Precandidato</th>' +
      '<th scope="col">Preferencia interna (U2)</th>' +
      '<th scope="col">Voto del partido (U1)</th>' +
      '<th scope="col">Voto efectivo estimado *</th></tr></thead><tbody>';

    filas.forEach(function (f) {
      var ef = u1 === null ? null : (f.v * u1) / 100;
      h += "<tr><th scope=\"row\">" + esc(f.a) + '</th><td class="n">' + fija(f.v) +
        "%</td><td>" + (u1 === null ? "—" : fija(u1) + "%") + '</td><td class="n">' +
        (ef === null ? "—" : fija(ef) + "%") + ' <span class="est">*</span></td></tr>';
    });

    h += "</tbody></table></div>";
  });

  if (!h) {
    h = '<p class="pie-nota">La fuente no mide internas de partido en esta plaza para la ola de ' +
      esc(fmtOla(estado.ola)) + ", o solo reporta un precandidato, en cuyo caso no hay ventaja " +
      "sobre un segundo que medir.</p>";
  }

  h += '<p class="pie-nota">El <b>voto efectivo estimado</b> (U2 × U1 ÷ 100) es una métrica ' +
    "derivada por esta elaboración, no publicada por la fuente.</p>";

  cont.innerHTML = h;
}

/* --- Trazabilidad ------------------------------------------------- */

function vTraza() {
  var cont = $("#traza");
  var conteo = M.conteo || {};
  var lit = num(conteo.LITERAL) || 0;
  var pon = num(conteo.PONDERADO) || 0;
  var aus = num(conteo.AUSENTE) || 0;
  var total = lit + pon + aus;

  if (!total) {
    cont.innerHTML = '<p class="pie-nota">meta.conteo no trae el desglose por origen del dato.</p>';
    return;
  }
  function pct(x) { return ((100 * x) / total).toFixed(1) + "%"; }

  var filas = [
    [c("--ok"), "Literal", lit,
      "Valor impreso en la lámina y transcrito sin transformación."],
    [c("--warn"), "Ponderado *", pon,
      "Reconstruido de la gráfica de tracking, que no publica tabla de valores. Error máximo " +
      "de calibración: 0.257 pp, frente a ±" + (M.me || "—") + " pp de error muestral de la encuesta."],
    [c("--risk"), "Ausente", aus,
      "Marcador ocluido por otra serie del mismo color. No resuelto y no imputado. Listado en la " +
      "hoja PENDIENTES del libro de auditoría."]
  ];

  cont.innerHTML =
    '<p class="nota">Toda cifra del tablero se clasifica por origen. Ninguna se rellenó por ' +
    "analogía con otro mes o municipio, ni se ajustó para forzar el cierre al 100 %.</p>" +
    '<div class="tabla-scroll" tabindex="0" role="region" aria-label="Origen de los datos">' +
    '<table><thead><tr><th scope="col">Origen del dato</th><th scope="col">Celdas</th>' +
    '<th scope="col">Proporción</th><th scope="col" style="width:46%">Qué significa</th>' +
    "</tr></thead><tbody>" +
    filas.map(function (f) {
      return '<tr><th scope="row"><span class="punto" style="background-color:' + esc(f[0]) +
        '"></span>' + esc(f[1]) + '</th><td class="n">' + f[2] + "</td><td>" + pct(f[2]) +
        '</td><td style="text-align:left;white-space:normal">' + esc(f[3]) + "</td></tr>";
    }).join("") +
    '<tr><th scope="row"><b>Control de cierre</b></th><td class="n">' + esc(M.cierre || "—") +
    '</td><td>100%</td><td style="text-align:left;white-space:normal">Olas de intención de voto ' +
    "que suman 100 % sin que se impusiera la normalización. Es la validación independiente de la " +
    "reconstrucción.</td></tr></tbody></table></div>";
}

/* -------------------------------------------------------------------
   8. PROGRAMADOR DE RENDER
   La versión anterior destruía y reconstruía las trece gráficas en cada
   cambio de selector, incluidas las nueve que no dependen del municipio.
   Aquí cada vista declara de qué depende y solo se redibuja cuando algo
   suyo cambió y además está visible en pantalla.
   ------------------------------------------------------------------- */

var VISTAS = [
  { n: "alerta",         el: "#alerta",          dep: ["muni", "ola"],          fn: vAlerta },
  { n: "kpis",           el: "#kpis",            dep: ["muni", "ola", "base"],  fn: vKpis },
  { n: "rank",           el: "#g-rank",          dep: ["muni", "ola", "base"],  fn: vRank },
  { n: "track",          el: "#g-track",         dep: ["muni"],                 fn: vTrack },
  { n: "termo",          el: "#termo",           dep: ["ola"],                  fn: vTermo },
  { n: "muniPartido",    el: "#g-muni-partido",  dep: ["ola", "ancho"],         fn: vMuniPartido },
  { n: "ventaja",        el: "#g-ventaja",       dep: ["ola", "ancho"],         fn: vVentaja },
  { n: "noDeclarado",    el: "#g-no-decl",       dep: ["ola", "ancho"],         fn: vNoDeclarado },
  { n: "calor",          el: "#calor",           dep: ["ola"],                  fn: vCalor },
  { n: "reeleccion",     el: "#g-reelec",        dep: ["ola", "ancho"],         fn: vReeleccion },
  { n: "dona",           el: "#g-dona",          dep: ["muni", "ola", "ancho"], fn: vDona },
  { n: "comparaPartido", el: "#g-compara",       dep: ["partido"],              fn: vComparaPartido },
  { n: "delta",          el: "#g-delta",         dep: [],                       fn: vDelta },
  { n: "noDec",          el: "#g-no-dec",        dep: [],                       fn: vNoDec },
  { n: "internas",       el: "#g-internas",      dep: ["ola", "ancho"],         fn: vInternas },
  { n: "tabla",          el: "#tabla",           dep: ["muni", "ola"],          fn: vTabla },
  { n: "traza",          el: "#traza",           dep: [],                       fn: vTraza }
];

var sucias = {};
var visibles = {};
var porNombre = {};
VISTAS.forEach(function (v) {
  v.nodo = $(v.el);
  porNombre[v.n] = v;
  sucias[v.n] = true;
});

function contenedorDe(v) {
  if (!v.nodo) return null;
  return v.nodo.tagName === "CANVAS" ? v.nodo.parentElement : v.nodo;
}

function ponerEsqueleto(v) {
  var cont = contenedorDe(v);
  if (!cont || cont.querySelector(".sk")) return;
  var s = document.createElement("div");
  if (v.nodo.tagName === "CANVAS") {
    s.className = "sk sk-lienzo";
  } else {
    s.className = "sk";
    s.style.height = "120px";
    s.style.display = "block";
  }
  s.setAttribute("aria-hidden", "true");
  cont.appendChild(s);
}

function quitarEsqueleto(cont) {
  if (!cont) return;
  var s = cont.querySelectorAll(".sk");
  for (var i = 0; i < s.length; i++) s[i].remove();
}

function panelDe(nodo) {
  return nodo ? nodo.closest(".panel-cuerpo") : null;
}

function esVisible(v) {
  var p = panelDe(v.nodo);
  if (p && p.hasAttribute("hidden")) return false;
  return !!visibles[v.n];
}

function pintar(v) {
  try {
    v.fn();
  } catch (e) {
    /* Una vista que falle no debe tumbar el resto del tablero. */
    var cont = contenedorDe(v);
    quitarEsqueleto(cont);
    if (cont && v.nodo.tagName !== "CANVAS") {
      cont.innerHTML = '<p class="pie-nota">No se pudo construir esta vista con los datos actuales.</p>';
    }
    if (window.console) console.error("Vista «" + v.n + "»:", e);
  }
  sucias[v.n] = false;
  quitarEsqueleto(contenedorDe(v));
}

var pendiente = false;
function procesar() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(function () {
    pendiente = false;
    VISTAS.forEach(function (v) {
      if (sucias[v.n] && esVisible(v)) pintar(v);
    });
  });
}

function invalidar(motivo) {
  VISTAS.forEach(function (v) {
    if (motivo === "tema" || v.dep.indexOf(motivo) >= 0) {
      sucias[v.n] = true;
      if (motivo !== "tema") ponerEsqueleto(v);
    }
  });
  procesar();
}

/* Fuerza el dibujado de todo, visible o no. Se usa antes de imprimir. */
function pintarTodo() {
  VISTAS.forEach(function (v) {
    if (sucias[v.n]) pintar(v);
  });
}

/* Observador de visibilidad: una gráfica creada dentro de un panel
   plegado nacía con un lienzo de 0 × 0 px. */
if (window.IntersectionObserver) {
  var obsVistas = new IntersectionObserver(function (entradas) {
    var hay = false;
    entradas.forEach(function (e) {
      var nombre = e.target.getAttribute("data-vista-n");
      if (e.isIntersecting && nombre) {
        visibles[nombre] = true;
        hay = true;
      }
    });
    if (hay) procesar();
  }, { rootMargin: "250px 0px" });

  VISTAS.forEach(function (v) {
    var cont = contenedorDe(v);
    if (!cont) return;
    cont.setAttribute("data-vista-n", v.n);
    obsVistas.observe(cont);
  });
} else {
  VISTAS.forEach(function (v) { visibles[v.n] = true; });
}

/* -------------------------------------------------------------------
   9. INTERFAZ
   ------------------------------------------------------------------- */

function actualizarSello() {
  var oe = olaEfectiva(estado.muni, estado.ola);
  $("#sello").textContent =
    (M.casa || "Fuente") + " · ola " + fmtOla(oe || estado.ola) +
    " · corte del estudio " + fmtOla(M.corte) +
    " · N=" + N + " por municipio · M.E. ±" + (M.me || "—") + "%" +
    " · " + MUNIS.length + " municipios";
}

/* --- Selectores --------------------------------------------------- */
var selMuni = $("#sel-muni");
var selOla = $("#sel-ola");
var selPartido = $("#sel-partido");

MUNIS.forEach(function (m) { selMuni.add(new Option(m, m)); });
OLAS.slice().reverse().forEach(function (o) { selOla.add(new Option("Ola: " + fmtOla(o), o)); });
PARTIDOS.forEach(function (p) { selPartido.add(new Option("Partido: " + p, p)); });

selMuni.value = estado.muni;
selOla.value = estado.ola;
selPartido.value = estado.partido;

selMuni.addEventListener("change", function (e) {
  estado.muni = e.target.value;
  actualizarSello();
  invalidar("muni");
});

selOla.addEventListener("change", function (e) {
  estado.ola = e.target.value;
  actualizarSello();
  invalidar("ola");
});

selPartido.addEventListener("change", function (e) {
  estado.partido = e.target.value;
  invalidar("partido");
});

/* --- Botones ------------------------------------------------------ */
var btnBase = $("#btn-base");
btnBase.addEventListener("click", function () {
  estado.base = estado.base === "total" ? "efectivo" : "total";
  var efectivo = estado.base === "efectivo";
  this.textContent = efectivo ? "Base: voto efectivo *" : "Base: total";
  this.classList.toggle("activo", efectivo);
  this.setAttribute("aria-pressed", String(efectivo));
  invalidar("base");
});

$("#btn-tema").addEventListener("click", function () {
  var oscuro = document.documentElement.getAttribute("data-tema") === "oscuro";
  if (oscuro) document.documentElement.removeAttribute("data-tema");
  else document.documentElement.setAttribute("data-tema", "oscuro");
  try { localStorage.setItem("jal2027-tema", oscuro ? "claro" : "oscuro"); } catch (e) {}
  leerTokens();
  aplicarDefaults();
  invalidar("tema"); /* los colores salen de los tokens: hay que repintar */
});

$("#btn-imprimir").addEventListener("click", function () { window.print(); });

/* Antes de imprimir se abren todos los paneles y se dibuja lo pendiente:
   de otro modo salían en blanco las gráficas que nunca se vieron. */
var panelesCerradosAlImprimir = [];
window.addEventListener("beforeprint", function () {
  panelesCerradosAlImprimir = [];
  document.querySelectorAll(".panel-cab").forEach(function (cab) {
    if (cab.getAttribute("aria-expanded") === "false") {
      panelesCerradosAlImprimir.push(cab);
      abrirPanel(cab, true);
    }
  });
  VISTAS.forEach(function (v) { visibles[v.n] = true; });
  pintarTodo();
});
window.addEventListener("afterprint", function () {
  panelesCerradosAlImprimir.forEach(function (cab) { abrirPanel(cab, false); });
  panelesCerradosAlImprimir = [];
});

/* --- Filtros plegables en móvil ----------------------------------- */
var btnFiltros = $("#btn-filtros");
var cajaControles = $("#controles");

function filtros(abrir) {
  cajaControles.classList.toggle("abierto", abrir);
  btnFiltros.setAttribute("aria-expanded", String(abrir));
}

btnFiltros.addEventListener("click", function () {
  filtros(!cajaControles.classList.contains("abierto"));
});

/* La capa se cierra al elegir, al tocar fuera y con Escape. */
cajaControles.addEventListener("change", function () {
  if (window.matchMedia("(max-width:860px)").matches) filtros(false);
});
document.addEventListener("click", function (e) {
  if (!cajaControles.classList.contains("abierto")) return;
  if (cajaControles.contains(e.target) || btnFiltros.contains(e.target)) return;
  filtros(false);
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && cajaControles.classList.contains("abierto")) {
    filtros(false);
    btnFiltros.focus();
  }
});

/* --- Paneles ------------------------------------------------------ */
function abrirPanel(cab, abrir) {
  var cuerpo = document.getElementById(cab.getAttribute("aria-controls"));
  cab.setAttribute("aria-expanded", String(abrir));
  if (cuerpo) {
    if (abrir) cuerpo.removeAttribute("hidden");
    else cuerpo.setAttribute("hidden", "");
  }
  if (abrir) {
    procesar();
    Object.keys(graficas).forEach(function (k) { graficas[k].resize(); });
  }
}

document.querySelectorAll(".panel-cab").forEach(function (cab) {
  cab.addEventListener("click", function () {
    abrirPanel(cab, cab.getAttribute("aria-expanded") === "false");
  });
});

/* --- Cinta de navegación ------------------------------------------ */
var SECCIONES = [
  ["s-panorama", "Panorama"],
  ["s-comparativo", "Los 7 municipios"],
  ["s-evolucion", "Movimiento"],
  ["s-internas", "Internas"],
  ["s-traza", "Trazabilidad"]
];

$("#cinta").innerHTML = SECCIONES.map(function (s) {
  return '<a href="#' + s[0] + '" data-s="' + s[0] + '">' + s[1] + "</a>";
}).join("");

var obsCinta = null;
function montarObservadorCinta(altoBarra) {
  if (!window.IntersectionObserver) return;
  if (obsCinta) obsCinta.disconnect();
  obsCinta = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      document.querySelectorAll(".cinta a").forEach(function (a) {
        if (a.getAttribute("data-s") === e.target.id) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    });
  }, { rootMargin: "-" + Math.round(altoBarra + 12) + "px 0px -60% 0px" });

  SECCIONES.forEach(function (s) {
    var el = document.getElementById(s[0]);
    if (el) obsCinta.observe(el);
  });
}

/* --- Medición de la barra superior --------------------------------
   El anclaje de secciones y el observador de la cinta dependían de un
   118 px fijo. En móvil la barra mide bastante más y los saltos de
   navegación caían debajo del encabezado. */
var altoBarraPrevio = 0;
function medirBarra() {
  var barra = document.querySelector(".barra");
  if (!barra) return;
  var alto = Math.round(barra.getBoundingClientRect().height);
  if (!alto) return;
  document.documentElement.style.setProperty("--alto-barra", alto + "px");
  if (Math.abs(alto - altoBarraPrevio) > 6) {
    altoBarraPrevio = alto;
    montarObservadorCinta(alto);
  }
}

if (window.ResizeObserver) {
  new ResizeObserver(medirBarra).observe(document.querySelector(".barra"));
} else {
  window.addEventListener("resize", medirBarra);
}

/* --- Cambio de ancho: las barras por municipio giran --------------- */
var mqAngosto = window.matchMedia("(max-width:700px)");
function alCambiarAncho(e) {
  estado.angosto = e.matches;
  invalidar("ancho");
}
if (mqAngosto.addEventListener) mqAngosto.addEventListener("change", alCambiarAncho);
else if (mqAngosto.addListener) mqAngosto.addListener(alCambiarAncho);

/* --- Arranque ------------------------------------------------------ */
leerTokens();
aplicarDefaults();
actualizarSello();
VISTAS.forEach(ponerEsqueleto);
medirBarra();
montarObservadorCinta(altoBarraPrevio || 112);

/* Sin IntersectionObserver todo se marca visible; con él, el observador
   dispara el primer render de lo que esté en pantalla. */
procesar();

/* Red de seguridad: si por cualquier motivo el observador no llegara a
   disparar, a los 700 ms se dibuja lo que siga pendiente y visible. */
setTimeout(function () {
  VISTAS.forEach(function (v) {
    if (sucias[v.n] && !panelDe(v.nodo).hasAttribute("hidden")) visibles[v.n] = true;
  });
  procesar();
}, 700);

}

/* -------------------------------------------------------------------
   10. CARGA DE CHART.JS CON RESPALDO
   index.html pide la biblioteca al CDN principal. Si esa etiqueta
   falla —red corporativa que filtra el dominio, caída del CDN—, aquí
   se intenta un espejo y, por último, una copia local opcional. El
   tablero solo se declara inservible cuando se agotan las tres.
   ------------------------------------------------------------------- */
var ESPEJOS = [
  "https://unpkg.com/chart.js@4.4.3/dist/chart.umd.js",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.js",
  "./chart.umd.js"
];

function cargarChart(i) {
  if (typeof window.Chart !== "undefined") {
    resolverDatos(iniciarTablero);
    return;
  }
  if (i >= ESPEJOS.length) {
    avisarCssAusente();
    pantallaDeFalla(
      "No se cargó la biblioteca de gráficas",
      "Chart.js no respondió desde ninguno de los espejos públicos. Si la red " +
        "bloquea los CDN, descarga chart.umd.js de npm y colócalo junto a " +
        "index.html: el tablero lo tomará automáticamente."
    );
    return;
  }
  var etiqueta = document.createElement("script");
  etiqueta.src = ESPEJOS[i];
  etiqueta.onload = function () {
    /* Si el espejo respondió pero no definió Chart, se pasa al siguiente:
       volver a llamar con el mismo índice reintentaría el mismo archivo. */
    if (typeof window.Chart !== "undefined") resolverDatos(iniciarTablero);
    else cargarChart(i + 1);
  };
  etiqueta.onerror = function () { cargarChart(i + 1); };
  document.head.appendChild(etiqueta);
}

cargarChart(0);

})();
