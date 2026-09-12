-- ============================================================================
-- Tacos Ruth · Centro de Control
-- Esquema de base de datos para Supabase (Postgres)
--
-- Cómo usarlo:
--   1. Abrí tu proyecto en https://app.supabase.com
--   2. Ir a "SQL Editor" -> "New query"
--   3. Pegar TODO este archivo y ejecutarlo (Run)
--   4. Ver el README.md para los pasos de creación de usuarios (socios)
-- ============================================================================

-- Extensión para generar UUIDs
create extension if not exists "pgcrypto";

-- ============================================================================
-- PERFILES (uno por socio, ligado a auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  email text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil de cada socio de Tacos Ruth, uno por usuario de auth.';

-- Crea automáticamente un perfil cuando se crea un usuario en auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- INSUMOS
-- ============================================================================
create table if not exists public.insumos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null check (categoria in (
    'carne', 'panificados', 'lacteos', 'verduleria', 'salsas',
    'papas', 'aceite', 'packaging', 'bebidas', 'otros'
  )),
  precio_compra numeric(12, 2) not null check (precio_compra >= 0),
  cantidad numeric(12, 3) not null check (cantidad > 0),
  unidad text not null check (unidad in ('kg', 'litro', 'unidad', 'docena', 'paquete', 'tanda')),
  costo_unitario numeric(12, 4) generated always as (precio_compra / cantidad) stored,
  proveedor text,
  actualizado_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.insumos is 'Todo lo que se compra para producir. El costo_unitario se calcula solo.';

-- Histórico de precios: guarda el valor ANTERIOR cada vez que cambia precio_compra o cantidad
create table if not exists public.insumos_historico (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid not null references public.insumos (id) on delete cascade,
  precio_compra numeric(12, 2) not null,
  cantidad numeric(12, 3) not null,
  costo_unitario numeric(12, 4) not null,
  registrado_at timestamptz not null default now()
);

comment on table public.insumos_historico is 'Snapshot del precio anterior de un insumo, para graficar su evolución.';

create or replace function public.registrar_historico_insumo()
returns trigger
language plpgsql
as $$
begin
  if (old.precio_compra is distinct from new.precio_compra)
     or (old.cantidad is distinct from new.cantidad) then
    insert into public.insumos_historico (insumo_id, precio_compra, cantidad, costo_unitario)
    values (old.id, old.precio_compra, old.cantidad, old.costo_unitario);
    new.actualizado_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_insumos_historico on public.insumos;
create trigger trg_insumos_historico
  before update on public.insumos
  for each row execute procedure public.registrar_historico_insumo();

-- ============================================================================
-- PRODUCTOS (recetas) y sus ingredientes
-- ============================================================================
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('hamburguesa', 'taco', 'combo')),
  precio_normal numeric(12, 2) not null check (precio_normal >= 0),
  precio_promo numeric(12, 2) check (precio_promo >= 0),
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.productos is 'Productos que se venden. El costo y el food cost se calculan desde producto_insumos.';

create table if not exists public.producto_insumos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id) on delete cascade,
  insumo_id uuid not null references public.insumos (id) on delete restrict,
  cantidad numeric(12, 4) not null check (cantidad > 0)
);

comment on table public.producto_insumos is 'Detalle de receta: qué insumos y cuánto de cada uno lleva un producto.';

-- ============================================================================
-- CONFIGURACIÓN GLOBAL (fila única)
-- ============================================================================
create table if not exists public.configuracion (
  id boolean primary key default true check (id = true), -- fuerza una sola fila
  promo_activa boolean not null default true,
  promo_vencimiento date not null default '2026-10-31',
  updated_at timestamptz not null default now()
);

insert into public.configuracion (id, promo_activa, promo_vencimiento)
values (true, true, '2026-10-31')
on conflict (id) do nothing;

-- ============================================================================
-- PEDIDOS
-- ============================================================================
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  zona text not null check (zona in ('Longchamps', 'Glew', 'Burzaco', 'Adrogué', 'Retiro')),
  costo_envio numeric(12, 2) not null default 0,
  metodo_pago text not null check (metodo_pago in ('efectivo', 'transferencia', 'mercadopago')),
  repartidor_id uuid references public.profiles (id),
  facturacion numeric(12, 2) not null default 0,
  costo_mercaderia numeric(12, 2) not null default 0,
  ganancia numeric(12, 2) not null default 0,
  creado_por uuid references public.profiles (id),
  creado_en_local_id text, -- id temporal generado offline, para evitar duplicados al sincronizar
  created_at timestamptz not null default now()
);

comment on table public.pedidos is 'Un pedido cargado durante el servicio. facturacion/costo/ganancia vienen calculados desde el cliente en base a las recetas vigentes.';

-- Estado de cobro y datos del cliente (agregado después de la primera versión;
-- "add column if not exists" hace que correr este script de nuevo no rompa nada).
alter table public.pedidos add column if not exists cobrado boolean not null default false;
alter table public.pedidos add column if not exists cliente_nombre text;
alter table public.pedidos add column if not exists direccion text;
alter table public.pedidos add column if not exists notas text;

comment on column public.pedidos.cobrado is 'Si la plata de este pedido ya fue cobrada/rendida o sigue pendiente.';

create unique index if not exists uq_pedidos_local_id on public.pedidos (creado_en_local_id) where creado_en_local_id is not null;
create index if not exists idx_pedidos_cobrado on public.pedidos (cobrado) where cobrado = false;

create table if not exists public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  producto_id uuid references public.productos (id),
  producto_nombre text not null, -- copia del nombre al momento de vender, por si el producto cambia/borra
  cantidad int not null check (cantidad > 0),
  precio_unitario numeric(12, 2) not null,
  costo_unitario numeric(12, 2) not null
);

comment on table public.pedido_items is 'Líneas de un pedido, con precio y costo congelados al momento de la venta.';

-- ============================================================================
-- GASTOS
-- ============================================================================
create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  monto numeric(12, 2) not null check (monto >= 0),
  categoria text not null check (categoria in (
    'insumos', 'nafta', 'gas', 'packaging', 'imprenta', 'sueldos', 'servicios', 'otros'
  )),
  descripcion text,
  fecha date not null default current_date,
  pagado_por uuid not null references public.profiles (id),
  foto_url text,
  created_at timestamptz not null default now()
);

comment on table public.gastos is 'Cualquier gasto del negocio. pagado_por es clave para el balance entre socios.';

-- ============================================================================
-- TURNOS
-- ============================================================================
create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  socio_id uuid not null references public.profiles (id),
  rol text not null check (rol in ('cocina', 'delivery', 'atencion')),
  created_at timestamptz not null default now()
);

comment on table public.turnos is 'Quién trabajó, qué noche y en qué rol.';

-- ============================================================================
-- ÍNDICES ÚTILES
-- ============================================================================
create index if not exists idx_pedidos_created_at on public.pedidos (created_at);
create index if not exists idx_gastos_fecha on public.gastos (fecha);
create index if not exists idx_turnos_fecha on public.turnos (fecha);
create index if not exists idx_pedido_items_pedido on public.pedido_items (pedido_id);
create index if not exists idx_producto_insumos_producto on public.producto_insumos (producto_id);
create index if not exists idx_insumos_historico_insumo on public.insumos_historico (insumo_id);

-- ============================================================================
-- ROW LEVEL SECURITY: solo usuarios autenticados (los 5 socios) acceden
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.insumos enable row level security;
alter table public.insumos_historico enable row level security;
alter table public.productos enable row level security;
alter table public.producto_insumos enable row level security;
alter table public.configuracion enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;
alter table public.gastos enable row level security;
alter table public.turnos enable row level security;

-- Política genérica: cualquier usuario autenticado puede leer y escribir todo.
-- (Todos los socios ven y editan todo, según el pedido original.)
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'profiles', 'insumos', 'insumos_historico', 'productos', 'producto_insumos',
    'configuracion', 'pedidos', 'pedido_items', 'gastos', 'turnos'
  ])
  loop
    execute format('drop policy if exists "socios_all_access" on public.%I;', t);
    execute format(
      'create policy "socios_all_access" on public.%I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ============================================================================
-- STORAGE: bucket para fotos de tickets de gastos
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('tickets', 'tickets', true)
on conflict (id) do nothing;

drop policy if exists "tickets_socios_select" on storage.objects;
create policy "tickets_socios_select" on storage.objects
  for select to authenticated using (bucket_id = 'tickets');

drop policy if exists "tickets_socios_insert" on storage.objects;
create policy "tickets_socios_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'tickets');

drop policy if exists "tickets_socios_delete" on storage.objects;
create policy "tickets_socios_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'tickets');

-- ============================================================================
-- DATOS PRECARGADOS: INSUMOS
-- ============================================================================
insert into public.insumos (nombre, categoria, precio_compra, cantidad, unidad, proveedor) values
  ('Roast beef', 'carne', 14000, 1, 'kg', null),
  ('Preparación de carne para tacos (bondiola + tapa)', 'carne', 42000, 25, 'tanda', null),
  ('Tortillas', 'panificados', 12500, 12, 'docena', null),
  ('Pan de hamburguesa', 'panificados', 500, 1, 'unidad', null),
  ('Cheddar', 'lacteos', 169, 1, 'unidad', null),
  ('Papas', 'papas', 1500, 1, 'kg', null),
  ('Aceite', 'aceite', 15700, 1, 'unidad', null),
  ('Salsa', 'salsas', 3000, 1, 'litro', null),
  ('Packaging hamburguesa - caja', 'packaging', 240, 1, 'unidad', null),
  ('Packaging hamburguesa - parafolio', 'packaging', 44, 1, 'unidad', null),
  ('Packaging hamburguesa - aluminio', 'packaging', 47, 1, 'unidad', null),
  ('Packaging hamburguesa - dip', 'packaging', 158, 1, 'unidad', null),
  ('Packaging hamburguesa - bolsa', 'packaging', 160, 1, 'unidad', null),
  ('Packaging hamburguesa - calco', 'packaging', 5, 1, 'unidad', null),
  ('Packaging tacos', 'packaging', 910, 1, 'paquete', null)
on conflict do nothing;

-- ============================================================================
-- DATOS PRECARGADOS: PRODUCTOS Y RECETAS
-- ============================================================================
-- Nota: la cantidad de "Tortillas" está en docenas (1 docena = 12 unidades),
-- por lo que 3 tacos = 3/12 = 0.25 docena, 5 tacos = 5/12 ≈ 0.4167 docena, etc.
-- Los costos calculados por la app deberían aproximar los costos del pedido original.

do $$
declare
  v_roast uuid; v_carne_taco uuid; v_tortillas uuid; v_pan uuid; v_cheddar uuid;
  v_papas uuid; v_aceite uuid; v_salsa uuid;
  v_caja uuid; v_parafolio uuid; v_aluminio uuid; v_dip uuid; v_bolsa uuid; v_calco uuid;
  v_pack_tacos uuid;
  v_prod uuid;
begin
  select id into v_roast from public.insumos where nombre = 'Roast beef';
  select id into v_carne_taco from public.insumos where nombre like 'Preparación de carne para tacos%';
  select id into v_tortillas from public.insumos where nombre = 'Tortillas';
  select id into v_pan from public.insumos where nombre = 'Pan de hamburguesa';
  select id into v_cheddar from public.insumos where nombre = 'Cheddar';
  select id into v_papas from public.insumos where nombre = 'Papas';
  select id into v_aceite from public.insumos where nombre = 'Aceite';
  select id into v_salsa from public.insumos where nombre = 'Salsa';
  select id into v_caja from public.insumos where nombre = 'Packaging hamburguesa - caja';
  select id into v_parafolio from public.insumos where nombre = 'Packaging hamburguesa - parafolio';
  select id into v_aluminio from public.insumos where nombre = 'Packaging hamburguesa - aluminio';
  select id into v_dip from public.insumos where nombre = 'Packaging hamburguesa - dip';
  select id into v_bolsa from public.insumos where nombre = 'Packaging hamburguesa - bolsa';
  select id into v_calco from public.insumos where nombre = 'Packaging hamburguesa - calco';
  select id into v_pack_tacos from public.insumos where nombre = 'Packaging tacos';

  -- Hamburguesa Simple
  insert into public.productos (nombre, tipo, precio_normal, precio_promo, orden)
  values ('Hamburguesa Simple', 'hamburguesa', 12500, 10000, 1)
  returning id into v_prod;
  insert into public.producto_insumos (producto_id, insumo_id, cantidad) values
    (v_prod, v_roast, 0.120),
    (v_prod, v_pan, 1),
    (v_prod, v_cheddar, 1),
    (v_prod, v_papas, 0.25),
    (v_prod, v_aceite, 0.02),
    (v_prod, v_caja, 1), (v_prod, v_parafolio, 1), (v_prod, v_aluminio, 1),
    (v_prod, v_dip, 1), (v_prod, v_bolsa, 1), (v_prod, v_calco, 1);

  -- Hamburguesa Doble
  insert into public.productos (nombre, tipo, precio_normal, precio_promo, orden)
  values ('Hamburguesa Doble', 'hamburguesa', 15000, 12000, 2)
  returning id into v_prod;
  insert into public.producto_insumos (producto_id, insumo_id, cantidad) values
    (v_prod, v_roast, 0.240),
    (v_prod, v_pan, 1),
    (v_prod, v_cheddar, 2),
    (v_prod, v_papas, 0.25),
    (v_prod, v_aceite, 0.02),
    (v_prod, v_caja, 1), (v_prod, v_parafolio, 1), (v_prod, v_aluminio, 1),
    (v_prod, v_dip, 1), (v_prod, v_bolsa, 1), (v_prod, v_calco, 1);

  -- Hamburguesa Triple
  insert into public.productos (nombre, tipo, precio_normal, precio_promo, orden)
  values ('Hamburguesa Triple', 'hamburguesa', 18000, 15000, 3)
  returning id into v_prod;
  insert into public.producto_insumos (producto_id, insumo_id, cantidad) values
    (v_prod, v_roast, 0.360),
    (v_prod, v_pan, 1),
    (v_prod, v_cheddar, 3),
    (v_prod, v_papas, 0.25),
    (v_prod, v_aceite, 0.02),
    (v_prod, v_caja, 1), (v_prod, v_parafolio, 1), (v_prod, v_aluminio, 1),
    (v_prod, v_dip, 1), (v_prod, v_bolsa, 1), (v_prod, v_calco, 1);

  -- Menú 1: 3 tacos + papas
  insert into public.productos (nombre, tipo, precio_normal, precio_promo, orden)
  values ('Menú 1 (3 tacos + papas)', 'taco', 15000, null, 4)
  returning id into v_prod;
  insert into public.producto_insumos (producto_id, insumo_id, cantidad) values
    (v_prod, v_carne_taco, 3 / 25.0 * 25), -- 3 tacos equivalen a 3/25 de la tanda
    (v_prod, v_tortillas, 3 / 12.0),
    (v_prod, v_papas, 0.25),
    (v_prod, v_aceite, 0.02),
    (v_prod, v_salsa, 0.05),
    (v_prod, v_pack_tacos, 1);

  -- Menú 2: 5 tacos
  insert into public.productos (nombre, tipo, precio_normal, precio_promo, orden)
  values ('Menú 2 (5 tacos)', 'taco', 20000, null, 5)
  returning id into v_prod;
  insert into public.producto_insumos (producto_id, insumo_id, cantidad) values
    (v_prod, v_carne_taco, 5 / 25.0 * 25),
    (v_prod, v_tortillas, 5 / 12.0),
    (v_prod, v_salsa, 0.08),
    (v_prod, v_pack_tacos, 1);

  -- Menú 3: bandeja de papas con carne
  insert into public.productos (nombre, tipo, precio_normal, precio_promo, orden)
  values ('Menú 3 (bandeja de papas con carne)', 'taco', 15000, null, 6)
  returning id into v_prod;
  insert into public.producto_insumos (producto_id, insumo_id, cantidad) values
    (v_prod, v_carne_taco, 3 / 25.0 * 25),
    (v_prod, v_papas, 0.5),
    (v_prod, v_salsa, 0.05),
    (v_prod, v_pack_tacos, 1);

  -- Combo 2x Hamburguesas dobles
  insert into public.productos (nombre, tipo, precio_normal, precio_promo, orden)
  values ('Combo 2x Hamburguesas dobles', 'combo', 30000, 25000, 7)
  returning id into v_prod;
  insert into public.producto_insumos (producto_id, insumo_id, cantidad) values
    (v_prod, v_roast, 0.480),
    (v_prod, v_pan, 2),
    (v_prod, v_cheddar, 4),
    (v_prod, v_papas, 0.5),
    (v_prod, v_aceite, 0.04),
    (v_prod, v_caja, 2), (v_prod, v_parafolio, 2), (v_prod, v_aluminio, 2),
    (v_prod, v_dip, 2), (v_prod, v_bolsa, 2), (v_prod, v_calco, 2);

  -- Combo Taco y Burger (1 doble + Menú 1)
  insert into public.productos (nombre, tipo, precio_normal, precio_promo, orden)
  values ('Combo Taco y Burger', 'combo', 30000, 26000, 8)
  returning id into v_prod;
  insert into public.producto_insumos (producto_id, insumo_id, cantidad) values
    (v_prod, v_roast, 0.240),
    (v_prod, v_pan, 1),
    (v_prod, v_cheddar, 2),
    (v_prod, v_papas, 0.5),
    (v_prod, v_aceite, 0.04),
    (v_prod, v_caja, 1), (v_prod, v_parafolio, 1), (v_prod, v_aluminio, 1),
    (v_prod, v_dip, 1), (v_prod, v_bolsa, 1), (v_prod, v_calco, 1),
    (v_prod, v_carne_taco, 3 / 25.0 * 25),
    (v_prod, v_tortillas, 3 / 12.0),
    (v_prod, v_salsa, 0.05),
    (v_prod, v_pack_tacos, 1);
end $$;
