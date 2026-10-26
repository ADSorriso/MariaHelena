-- CHÁ DE BEBÊ MARIA HELENA — banco para site público e painel privado.
-- Cole no SQL Editor do projeto cha-maria-helena e execute UMA vez.
create extension if not exists pgcrypto;

create table if not exists public.baby_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.baby_gifts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 100),
  category text not null check (length(trim(category)) between 1 and 60),
  description text not null default '' check (length(description) <= 180),
  quantity integer not null default 1 check (quantity between 1 and 1000),
  reserved integer not null default 0 check (reserved between 0 and quantity),
  completed boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.baby_reservations (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.baby_gifts(id) on delete restrict,
  guest_name text not null check (length(trim(guest_name)) between 2 and 90),
  guest_phone text not null check (guest_phone ~ '^([1-9][0-9])([2-9][0-9]{7}|9[0-9]{8})$'),
  quantity integer not null check (quantity between 1 and 20),
  created_at timestamptz not null default now(),
  unique (gift_id, guest_phone)
);

create table if not exists public.baby_rsvps (
  id uuid primary key default gen_random_uuid(),
  secret uuid not null unique,
  guest_name text not null check (length(trim(guest_name)) between 2 and 90),
  phone text not null default '' check (phone = '' or phone ~ '^([1-9][0-9])([2-9][0-9]{7}|9[0-9]{8})$'),
  attending boolean not null,
  total_people integer not null default 0 check (total_people between 0 and 10),
  message text not null default '' check (length(message) <= 350),
  location_sent_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint baby_attendance_count check (
    (attending and total_people >= 1 and phone <> '')
    or (not attending and total_people = 0)
  )
);
create unique index if not exists baby_rsvps_phone_unique
  on public.baby_rsvps(phone) where phone <> '';
create index if not exists baby_reservations_gift_idx on public.baby_reservations(gift_id);

-- Permissões: visitantes veem somente a lista pública de presentes.
alter table public.baby_admins enable row level security;
alter table public.baby_gifts enable row level security;
alter table public.baby_reservations enable row level security;
alter table public.baby_rsvps enable row level security;

create or replace function public.baby_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.baby_admins where user_id = (select auth.uid())
); $$;

drop policy if exists gifts_public_read on public.baby_gifts;
create policy gifts_public_read on public.baby_gifts
  for select to anon, authenticated using (true);
drop policy if exists gifts_admin_manage on public.baby_gifts;
create policy gifts_admin_manage on public.baby_gifts
  for all to authenticated using ((select public.baby_is_admin()))
  with check ((select public.baby_is_admin()));
drop policy if exists reservations_admin_manage on public.baby_reservations;
create policy reservations_admin_manage on public.baby_reservations
  for all to authenticated using ((select public.baby_is_admin()))
  with check ((select public.baby_is_admin()));
drop policy if exists rsvps_admin_manage on public.baby_rsvps;
create policy rsvps_admin_manage on public.baby_rsvps
  for all to authenticated using ((select public.baby_is_admin()))
  with check ((select public.baby_is_admin()));

-- Uma confirmação por WhatsApp. A mesma pessoa pode corrigir usando o mesmo navegador.
create or replace function public.save_baby_rsvp(
  p_secret uuid, p_guest_name text, p_attending boolean,
  p_total_people integer, p_message text, p_phone text
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_phone text := coalesce(p_phone,'');
begin
  if p_secret is null or p_guest_name is null
     or length(trim(p_guest_name)) not between 2 and 90
     or p_attending is null or p_total_people is null
     or (p_attending and p_total_people not between 1 and 10)
     or (not p_attending and p_total_people <> 0)
     or length(coalesce(p_message,'')) > 350
     or (v_phone <> '' and v_phone !~ '^([1-9][0-9])([2-9][0-9]{7}|9[0-9]{8})$')
     or (p_attending and v_phone = '') then
    raise exception 'Verifique os dados da confirmação e o WhatsApp com DDD.';
  end if;
  if v_phone <> '' and exists (
    select 1 from public.baby_rsvps where phone = v_phone and secret <> p_secret
  ) then
    raise exception 'Este WhatsApp já tem uma confirmação. Fale com a organizadora para alterar.';
  end if;
  insert into public.baby_rsvps
    (secret,guest_name,phone,attending,total_people,message,updated_at)
  values
    (p_secret,trim(p_guest_name),v_phone,p_attending,p_total_people,coalesce(p_message,''),now())
  on conflict (secret) do update set
    guest_name=excluded.guest_name,
    phone=excluded.phone,
    attending=excluded.attending,
    total_people=excluded.total_people,
    message=excluded.message,
    location_sent_at=case
      when public.baby_rsvps.phone is distinct from excluded.phone
        or public.baby_rsvps.attending is distinct from excluded.attending then null
      else public.baby_rsvps.location_sent_at end,
    updated_at=now();
exception when unique_violation then
  raise exception 'Este WhatsApp já tem uma confirmação. Fale com a organizadora para alterar.';
end; $$;

-- Reserva de presentes atômica: não ultrapassa estoque, mesmo com acessos simultâneos.
-- O mesmo telefone não consegue reservar o mesmo item duas vezes.
create or replace function public.reserve_baby_gift(
  p_gift_id uuid, p_guest_name text, p_qty integer, p_guest_phone text
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_gift_id is null or p_guest_name is null or length(trim(p_guest_name)) not between 2 and 90
     or p_qty is null or p_qty not between 1 and 20
     or p_guest_phone is null
     or p_guest_phone !~ '^([1-9][0-9])([2-9][0-9]{7}|9[0-9]{8})$' then
    raise exception 'Confira nome, WhatsApp com DDD e quantidade.';
  end if;
  if exists (select 1 from public.baby_reservations
    where gift_id=p_gift_id and guest_phone=p_guest_phone) then
    raise exception 'Você já reservou este presente. Fale com a organizadora para alterar.';
  end if;
  update public.baby_gifts
     set reserved=reserved+p_qty
   where id=p_gift_id and completed=false and reserved+p_qty <= quantity;
  if not found then
    raise exception 'Presente esgotado ou quantidade indisponível.';
  end if;
  insert into public.baby_reservations(gift_id,guest_name,guest_phone,quantity)
  values (p_gift_id,trim(p_guest_name),p_guest_phone,p_qty);
exception when unique_violation then
  raise exception 'Você já reservou este presente. Fale com a organizadora para alterar.';
end; $$;

create or replace function public.baby_restore_reservation()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin
  update public.baby_gifts
  set reserved=greatest(0,reserved-OLD.quantity) where id=OLD.gift_id;
  return OLD;
end; $$;
drop trigger if exists baby_reservation_deleted on public.baby_reservations;
create trigger baby_reservation_deleted
  after delete on public.baby_reservations for each row
  execute function public.baby_restore_reservation();

create or replace function public.baby_rsvp_totals()
returns table(people bigint, guests bigint)
language sql stable security definer set search_path = ''
as $$ select coalesce(sum(total_people),0)::bigint, count(*)::bigint
  from public.baby_rsvps where attending=true; $$;

-- Permissões explícitas para o front-end público e o painel com autenticação.
revoke all on public.baby_admins from anon, authenticated;
revoke all on public.baby_gifts from anon, authenticated;
revoke all on public.baby_reservations from anon, authenticated;
revoke all on public.baby_rsvps from anon, authenticated;
grant select on public.baby_gifts to anon, authenticated;
grant insert, update, delete on public.baby_gifts to authenticated;
grant select, delete on public.baby_reservations to authenticated;
grant select, update, delete on public.baby_rsvps to authenticated;

revoke all on function public.baby_is_admin() from public, anon, authenticated;
revoke all on function public.save_baby_rsvp(uuid,text,boolean,integer,text,text) from public, anon, authenticated;
revoke all on function public.reserve_baby_gift(uuid,text,integer,text) from public, anon, authenticated;
revoke all on function public.baby_rsvp_totals() from public, anon, authenticated;
revoke all on function public.baby_restore_reservation() from public, anon, authenticated;
grant execute on function public.baby_is_admin() to authenticated;
grant execute on function public.save_baby_rsvp(uuid,text,boolean,integer,text,text) to anon, authenticated;
grant execute on function public.reserve_baby_gift(uuid,text,integer,text) to anon, authenticated;
grant execute on function public.baby_rsvp_totals() to anon, authenticated;

-- Lista inicial de presentes (editável pela organizadora no painel).
insert into public.baby_gifts(name,category,description,quantity,sort_order) values
('Fraldas descartáveis RN','Fraldas','Pacotes para os primeiros dias',3,1),
('Fraldas descartáveis P','Fraldas','Pacotes tamanho P',10,2),
('Fraldas descartáveis M','Fraldas','Pacotes tamanho M',14,3),
('Fraldas descartáveis G','Fraldas','Pacotes tamanho G',8,4),
('Lenços umedecidos','Higiene','Pacotes sem perfume',12,5),
('Pomada para assaduras','Higiene','Unidades',5,6),
('Sabonete líquido infantil','Higiene','Suave, próprio para bebê',4,7),
('Shampoo infantil','Higiene','Suave, próprio para bebê',3,8),
('Algodão para bebê','Higiene','Pacotes de algodão',4,9),
('Toalha de banho com capuz','Enxoval','Toalha macia',3,10),
('Manta de bebê','Enxoval','Manta aconchegante',3,11),
('Paninhos de boca','Enxoval','Conjuntos de paninhos',5,12),
('Body de bebê','Roupinhas','Tamanhos P ou M',6,13),
('Macacão de bebê','Roupinhas','Tamanhos P ou M',4,14),
('Meias de bebê','Roupinhas','Pares ou kits',5,15),
('Kit escova e pente','Cuidados','Próprio para bebês',2,16),
('Termômetro digital','Cuidados','Unidade',1,17)
on conflict (name) do nothing;
