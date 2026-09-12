# Tacos Ruth · Centro de Control

PWA interna para gestionar el emprendimiento de tacos y hamburguesas
delivery **Tacos Ruth** (Longchamps, Buenos Aires). No es una app de cara al
cliente: es la herramienta de trabajo de los 5 socios para insumos, recetas,
pedidos, gastos, turnos, balance y cuentas entre socios.

Stack: React + Vite (vanilla, sin frameworks pesados) + Supabase
(base de datos, auth y storage) + PWA instalable (manifest + service worker).

## 1. Crear el proyecto en Supabase

1. Entrá a [app.supabase.com](https://app.supabase.com) y creá un proyecto
   nuevo (plan Free anda perfecto para este uso).
2. Anotá la **URL del proyecto** y la **anon key** (Settings → API).

## 2. Correr el esquema SQL

1. En el panel de Supabase, ir a **SQL Editor → New query**.
2. Abrir el archivo [`schema.sql`](./schema.sql) de este repo, copiar todo
   su contenido y pegarlo en el editor.
3. Ejecutar (**Run**). Esto crea todas las tablas, los triggers de
   histórico de precios, las políticas de Row Level Security, el bucket de
   Storage para fotos de tickets, y precarga los insumos y productos del
   menú actual.

> Podés volver a correr el script sin problema: usa `if not exists` /
> `on conflict do nothing` en casi todo. Los `insert` de insumos y
> productos precargados sólo se cargan la primera vez.

## 3. Crear los usuarios de los 5 socios

Supabase Auth no permite crear usuarios con contraseña directamente por SQL,
así que se hace desde el panel:

1. Ir a **Authentication → Users → Add user → Create new user**.
2. Crear un usuario por cada socio, con su email y una contraseña
   provisoria (después cada uno la puede cambiar con "Forgot password" o
   vos se la cambiás manualmente desde el mismo panel):
   - Juan Cruz Vena
   - Lautaro Berardi
   - Corrado Agustín
   - Nicolás Dalpra
   - Santiago Vigolo
3. Al crear cada usuario, un trigger (`on_auth_user_created`) crea
   automáticamente su fila en `public.profiles`, usando el email como
   nombre por defecto. Para que se vea el nombre real de cada socio en la
   app, correr en el **SQL Editor**:

```sql
update public.profiles set nombre = 'Juan Cruz Vena'   where email = 'EMAIL_DE_JUAN';
update public.profiles set nombre = 'Lautaro Berardi'  where email = 'EMAIL_DE_LAUTARO';
update public.profiles set nombre = 'Corrado Agustín'  where email = 'EMAIL_DE_CORRADO';
update public.profiles set nombre = 'Nicolás Dalpra'   where email = 'EMAIL_DE_NICOLAS';
update public.profiles set nombre = 'Santiago Vigolo'  where email = 'EMAIL_DE_SANTIAGO';
```

Todos los socios ven y editan todo (no hay roles ni permisos distintos
entre ellos) — eso ya está resuelto por las políticas de RLS del
`schema.sql`, que dan acceso completo a cualquier usuario autenticado.

> **Tu usuario (Santiago):** creá el tuyo con el email
> `santiagovigolo7@gmail.com` y la contraseña que quieras en el paso 1 de
> arriba, y después corré:
> ```sql
> update public.profiles set nombre = 'Santiago Vigolo' where email = 'santiagovigolo7@gmail.com';
> ```

## 4. Configurar las variables de entorno

Copiá `.env.example` a `.env` y completá con los datos de tu proyecto:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

## 5. Correr en desarrollo

```bash
npm install
npm run dev
```

Abrí la URL que muestra la terminal desde el navegador del celular (misma
red WiFi) para probarla en el teléfono mientras desarrollás.

## 6. Build de producción

```bash
npm run build
npm run preview   # para probar el build localmente
```

Esto genera la carpeta `dist/` con la PWA lista, incluyendo
`manifest.webmanifest` y el service worker (`sw.js`) para que se pueda
instalar en la pantalla de inicio del celular.

## 7. Desplegar en Cloudflare Pages

Pasos exactos, tal cual hay que hacerlos:

1. Pusheá este repo a GitHub (si no lo hiciste ya).
2. Entrá a [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
   → **Create** → pestaña **Pages** → **Connect to Git**.
3. Elegí este repositorio y autorizá el acceso.
4. En **Set up builds and deployments**:
   - **Framework preset**: `Vite` (si no aparece, dejalo en "None" y completá
     los dos campos de abajo a mano).
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. En **Environment variables** (antes de darle a Deploy, o después en
   Settings → Environment variables) agregá:
   - `VITE_SUPABASE_URL` = la URL de tu proyecto Supabase
   - `VITE_SUPABASE_ANON_KEY` = la anon key de tu proyecto Supabase
6. **Save and Deploy**. Cloudflare va a instalar dependencias, correr el
   build y publicarlo en una URL tipo `tu-proyecto.pages.dev`.
7. (Opcional) **Custom domains** → agregar tu dominio propio si tenés uno,
   y seguir las instrucciones de DNS que te muestra Cloudflare.

> El archivo [`public/_redirects`](./public/_redirects) ya está incluido en
> el repo con `/* /index.html 200`. Es necesario para que Cloudflare Pages
> sirva bien las rutas internas de la app (`/balance`, `/historial`, etc.)
> cuando alguien entra directo a esa URL o refresca la página — sin esto,
> esas rutas dan 404. No hace falta que hagas nada, ya viene configurado.

Cualquier otro hosting de sitios estáticos también sirve si preferís
(Vercel, Netlify): mismo build command (`npm run build`) y carpeta de
salida (`dist`), configurando las mismas dos variables de entorno. Con
Netlify, `public/_redirects` también resuelve el mismo problema de rutas.

Importante: la PWA necesita **HTTPS** para poder instalarse y para que el
service worker funcione (Cloudflare Pages lo da gratis y automático).

Una vez desplegada, cada socio la abre desde el celular y usa la opción
"Agregar a pantalla de inicio" del navegador (Chrome/Safari) para que quede
como una app más.

## Cómo está organizada la app

- **Insumos**: todo lo que se compra, con costo unitario calculado
  automáticamente y un histórico de precios (con gráfico) cada vez que se
  edita un precio o cantidad.
- **Recetas y productos**: cada producto se arma eligiendo insumos y
  cantidades; el costo, el food cost (%) y la ganancia se calculan solos.
  Semáforo verde ≤35%, amarillo 35-40%, rojo >40%. Switch global de promo
  activa + fecha de vencimiento.
- **Carga de pedidos**: pantalla rápida para usar durante el servicio,
  pensada para el celular. Tiene dos modos: manual (tocando los productos)
  o pegando directo el mensaje de pedido de WhatsApp, que se analiza solo
  (productos, cantidades, cliente, dirección, zona y método de pago) y
  queda para revisar/corregir antes de guardar. Si no hay internet, el
  pedido se guarda en el celular (`localStorage`) y se sincroniza solo
  apenas vuelve la conexión.
- **Historial y cobros** (dentro de "Más"): lista de pedidos con un estado
  de **Cobrado / Pendiente** por pedido (para plata en efectivo que todavía
  no se rindió, o transferencias que hay que confirmar).
- **Gastos**: cualquier gasto del negocio, con quién lo pagó (clave para
  las cuentas entre socios) y foto de ticket opcional (Supabase Storage).
- **Turnos**: quién trabajó cada noche y en qué rol, con resumen mensual
  de noches por socio.
- **Balance**: vista semanal/mensual con facturación, costos, gastos,
  resultado neto, reparto en 6 partes (5 socios + 1 para la empresa),
  pendientes de cobro, ranking de productos, ticket promedio, pedidos por
  zona y evolución. Se puede exportar a CSV.
- **Cuentas entre socios**: para el período elegido, cuánto puso cada
  socio, cuánto le correspondía poner, el saldo (a favor/en contra) y
  quién le tiene que transferir a quién para quedar todos a cero — al lado
  de las noches que trabajó cada uno.

## Notas técnicas

- Todos los montos se calculan con los datos reales cargados en Supabase
  (insumos, recetas, pedidos y gastos), no hay números fijos salvo la
  carga inicial del menú.
- El histórico de precios de insumos se genera automáticamente por un
  trigger en la base: cada vez que cambia `precio_compra` o `cantidad`,
  el valor anterior queda guardado en `insumos_historico`.
- Row Level Security está activo en todas las tablas: sólo usuarios
  autenticados (los 5 socios) pueden leer o escribir datos.
