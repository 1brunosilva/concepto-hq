-- ═══════════════════════════════════════════════════════════════
-- CONCEPTO HQ — Login seguro: migración de hq_data + RLS
-- Correr en Supabase (proyecto zngbeqbvmbxeweldmyaf, org escuela-naval)
-- SQL editor, como rol postgres. ORDEN IMPORTA. RLS va ÚLTIMO.
-- ═══════════════════════════════════════════════════════════════

-- ── PASO 0 (en la UI, no SQL) ──
-- Authentication → Providers → habilitar "Email".
-- Authentication → Users → Add user → tu mail + una contraseña. Copiá el UUID del user creado.

-- ── PASO 1: columna user_id ──
alter table public.hq_data add column if not exists user_id uuid references auth.users(id);

-- ── PASO 2: asignar la fila actual ('bruno') a tu usuario ──
-- Reemplazá <UUID_DEL_USER> por el UUID copiado en el Paso 0.
update public.hq_data set user_id = '<UUID_DEL_USER>' where id = 'bruno';

-- ── PASO 3: único por usuario (necesario para el upsert de la app) ──
create unique index if not exists hq_data_user_id_key on public.hq_data(user_id);

-- ⏸️ ACÁ PARÁ. Probá el login en el ensayo (preview). Confirmá que entrás,
--    ves tus datos y sincroniza (puntito verde). RECIÉN DESPUÉS seguí con el Paso 4.

-- ── PASO 4: RLS — cerrar la puerta (cada usuario solo ve lo suyo) ──
alter table public.hq_data enable row level security;
revoke all on public.hq_data from anon;
create policy hq_select on public.hq_data for select to authenticated using (user_id = auth.uid());
create policy hq_insert on public.hq_data for insert to authenticated with check (user_id = auth.uid());
create policy hq_update on public.hq_data for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── VERIFICACIÓN (tras Paso 4) ──
-- Con la clave PUBLISHABLE (anon), esto debe devolver vacío/permiso denegado:
--   curl "https://zngbeqbvmbxeweldmyaf.supabase.co/rest/v1/hq_data?select=payload" \
--        -H "apikey: sb_publishable_nNQhjFQGR4n8FuSLCjOA0Q_2FsgmXUA"

-- ── ROLLBACK (si algo sale mal) ──
-- alter table public.hq_data disable row level security;
-- (los datos nunca se tocan; solo se cambia quién puede leerlos)
