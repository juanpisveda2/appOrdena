# Ordena

![Ordena](assets/branding/appOrdena-portada.png)

**Ordena** es una aplicación de escritorio para **gestión de stock y ventas**, pensada para operaciones administrativas cotidianas con una interfaz clara, local-first y foco en trazabilidad.

## Qué resuelve

Ordena centraliza en una sola app:

- catálogo de productos
- control de stock e ingresos
- ventas con seguimiento de pagos
- liquidaciones con historial y exportación Excel
- persistencia local con SQLite

## Funcionalidades principales

- **Catálogo y stock**
  - alta de productos
  - ingresos adicionales con valores precargados
  - detalle de producto e historial de ingresos
- **Ventas**
  - armado de borrador
  - pago inicial y saldo pendiente
  - historial y detalle de ventas
- **Liquidaciones**
  - pendientes, revisión y confirmación
  - historial por lote
  - exportación de comprobantes
- **Instalador Windows**
  - asistente en español
  - accesos directos
  - desinstalador visible

## Stack técnico

| Área | Tecnología |
|---|---|
| Desktop app | Electron |
| UI | React |
| Build | Vite |
| Base de datos | SQLite (`better-sqlite3`) |
| ORM | Drizzle ORM |
| Instalador Windows | Inno Setup |

## Filosofía del proyecto

- **Local-first**: los datos viven en la PC del usuario.
- **Sin dependencias externas obligatorias**: no necesita Node.js ni herramientas de desarrollo en la máquina final.
- **Orientado a operación**: diseño administrativo, directo y con trazabilidad.

## Instalación para desarrollo

### Requisitos

- Node.js
- pnpm
- Windows para el flujo completo de Electron + instalador

### Pasos

```bash
pnpm install
pnpm dev
```

## Scripts útiles

```bash
pnpm dev          # entorno de desarrollo
pnpm test         # tests
pnpm typecheck    # chequeo de TypeScript
pnpm package:win  # empaqueta la app para Windows
pnpm installer    # genera el instalador Windows
```

## Instalador Windows

El instalador final queda en:

```text
dist/installer/Ordena-Setup-<version>.exe
```

Características del asistente:

- bienvenida
- ruta de instalación configurable
- acceso directo en escritorio (opcional)
- acceso directo en menú Inicio
- progreso de instalación
- opción de ejecutar Ordena al finalizar

## Persistencia de datos

Ordena usa SQLite y guarda los datos del usuario fuera de la carpeta de instalación, usando `app.getPath("userData")`.

Eso permite que:

- instalar una nueva versión no duplique la app
- los datos no se borren automáticamente al desinstalar
- la base no quede mezclada con archivos del programa

## Estado actual

El proyecto está activo y sigue evolucionando en:

- UX de catálogo
- UX de ventas
- UX de liquidaciones
- flujo de instalador Windows

## Importante

Aunque el instalador ya se genera correctamente en entorno de desarrollo, **no se afirma compatibilidad total con otras computadoras sin prueba manual real en esos equipos**.

## Roadmap corto

- validación del instalador en más PCs/VMs
- firma de código para distribución
- más pulido visual y consistencia entre módulos

## Link directo al instalador

https://drive.google.com/drive/folders/1sbADoOrOV388PT6bdgEZqDkJG8h5E0yA?usp=sharing

## Autoría

Proyecto: **Ordena**  
Descripción: **Gestión de stock y ventas**

 * Copyright (c) 2026 Juan Pablo Sveda
