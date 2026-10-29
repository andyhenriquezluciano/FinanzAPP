<p align="center">
  <img src="src/Icons/android-chrome-192x192.png" width="80" alt="Logo de FinanzApp">
</p>

<h1 align="center">FinanzApp</h1>

<p align="center">
  Organiza tus ingresos, controla tus gastos y da seguimiento a tus presupuestos.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&amp;logo=html5&amp;logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS-663399?style=for-the-badge&amp;logo=css&amp;logoColor=white" alt="CSS">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&amp;logo=javascript&amp;logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&amp;logo=vite&amp;logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Firebase-DD2C00?style=for-the-badge&amp;logo=firebase&amp;logoColor=white" alt="Firebase">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express-303030?style=for-the-badge&amp;logo=express&amp;logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&amp;logo=chartdotjs&amp;logoColor=white" alt="Chart.js">
</p>

<p align="center">
  <a href="https://github.com/andyhenriquezluciano/FinanzAPP/actions/workflows/ci.yml">
    <img src="https://github.com/andyhenriquezluciano/FinanzAPP/actions/workflows/ci.yml/badge.svg" alt="Estado de las pruebas y compilación">
  </a>
</p>

FinanzApp es una aplicación web de finanzas personales. Permite registrar movimientos por categoría, consultar el balance y visualizar cómo cambian los ingresos y gastos a lo largo del tiempo. Puedes utilizarla como invitado o iniciar sesión para trabajar con tu cuenta.

![Categorías de ingresos y gastos con filtros, indicadores y formularios para registrar transacciones](.github/assets/categorias.jpg)

*Vista de categorías y transacciones en modo oscuro.*

## Funcionalidades

- **Categorías y transacciones:** registro de ingresos y gastos con monto, descripción y fecha; búsqueda y filtros por año y mes.
- **Presupuestos:** límites por categoría y período, seguimiento del gasto, saldo disponible y barras de progreso.
- **Estadísticas:** indicadores financieros, evolución mensual y distribución de movimientos por categoría y día del mes.
- **Sincronización de correo:** detección de movimientos a partir de notificaciones bancarias mediante Gmail e IMAP, con configuración adicional del backend.
- **Importación y respaldos:** importación de archivos JSON y CSV, exportación de respaldos JSON e informes PDF.
- **Personalización:** temas claro y oscuro, vista compacta de categorías, moneda y formatos de números y fechas.
- **Acceso desde distintos dispositivos:** interfaz adaptable a escritorio y móvil, con almacenamiento local para el modo invitado.

## Capturas

### Presupuestos

Consulta cuánto has presupuestado, cuánto has gastado y cuánto queda disponible en cada categoría.

![Panel de presupuestos con importes asignados, gastos, saldo restante y barras de progreso](.github/assets/presupuestos.jpg)

### Estadísticas y evolución mensual

Resumen financiero con totales, promedios, cantidad de transacciones y comparación mensual de ingresos, gastos y balance neto.

![Indicadores financieros y gráfico de flujo mensual de ingresos, gastos y balance neto](.github/assets/estadisticas.jpg)

### Distribución diaria

Gráficos para identificar en qué días del mes se concentran los ingresos y los gastos.

![Gráficos de barras de ingresos y gastos por día del mes](.github/assets/estadisticas-diarias.jpg)

### Transacciones detectadas

Panel de notificaciones para consultar los movimientos detectados al configurar la sincronización de correo.

<p align="center">
  <img src=".github/assets/notificaciones.png" width="351" alt="Panel de transacciones detectadas con descripción, importe y fecha">
</p>

## Tecnologías

| Área | Tecnologías |
| --- | --- |
| Interfaz | HTML, CSS y JavaScript con módulos ES |
| Desarrollo y compilación | Vite, Node.js y npm |
| Autenticación | Firebase Authentication y Google Identity Services |
| Datos | Cloud Firestore y almacenamiento local del navegador |
| Backend | Cloud Functions for Firebase, Express e integración con Gmail e IMAP |
| Gráficos e informes | Chart.js y jsPDF |
| Pruebas y automatización | Vitest, Playwright y GitHub Actions |

## Estructura del proyecto

```text
src/              Páginas, componentes, estilos y recursos de la aplicación
functions/        Backend de sincronización y gestión de credenciales
scripts/          Compilación, revisión de CSS y herramientas de desarrollo
tests/            Pruebas unitarias y datos ficticios de prueba
e2e/              Pruebas de navegación e interacción en el navegador
.github/          Automatización y capturas utilizadas en este README
```

Desarrollado por [andyhenriquezluciano](https://github.com/andyhenriquezluciano).
