-- CHÁ DA MARIA HELENA | Execute uma vez no SQL Editor do Supabase.
-- NÃO compartilhe a chave service_role no site.
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
  reserved integer not null default 0 check (reserved >= 0 and reserved <= quantity),
  completed boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.baby_reservations (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.baby_gifts(id) on delete restrict,
  guest_name text not null check (length(trim(guest_name)) between 2 and 90),
  quantity integer not null check (quantity between 1 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.baby_rsvps (
  id uuid primary key default gen_random_uuid(),
  secret uuid not null unique,
  guest_name text not null check (length(trim(guest_name)) between 2 and 90),
  attending boolean not null,
  total_people integer not null default 0 check (total_people between 0 and 10),
  phone text not null default '' check (phone = '' or phone ~ '^([1-9][0-9])([2-9][0-9]{7}|9[0-9]{8})$'),
  location_sent_at timestamptz,
  message text not null default '' check (length(message) <= 350),
  updated_at timestamptz not null default now(),
  constraint attendance_count_consistent check ((attending and total_people>=1) or (not attending and total_people=0))
);

-- Atualização idempotente para bancos criados com versões anteriores deste convite.
alter table public.baby_rsvps add column if not exists phone text not null default '';
alter table public.baby_rsvps add column if not exists location_sent_at timestamptz;

create or replace function public.baby_is_admin()
returns boolean language sql stable security definer set search_path=public
as $$select exists(select 1 from public.baby_admins where user_id=auth.uid());$$;

-- Bloqueia leitura da lista privada e alterações diretas por visitantes.
alter table public.baby_admins enable row level security;
alter table public.baby_gifts enable row level security;
alter table public.baby_reservations enable row level security;
alter table public.baby_rsvps enable row level security;

drop policy if exists "gifts_public_read" on public.baby_gifts;
create policy "gifts_public_read" on public.baby_gifts for select to anon,authenticated using (true);
drop policy if exists "gifts_admin_manage" on public.baby_gifts;
create policy "gifts_admin_manage" on public.baby_gifts for all to authenticated
using (public.baby_is_admin()) with check (public.baby_is_admin());
drop policy if exists "reservations_admin_manage" on public.baby_reservations;
create policy "reservations_admin_manage" on public.baby_reservations for all to authenticated
using (public.baby_is_admin()) with check (public.baby_is_admin());
drop policy if exists "rsvps_admin_manage" on public.baby_rsvps;
create policy "rsvps_admin_manage" on public.baby_rsvps for all to authenticated
using (public.baby_is_admin()) with check (public.baby_is_admin());

-- Reserva atômica: não permite mais unidades do que o total, inclusive com vários visitantes ao mesmo tempo.
create or replace function public.reserve_baby_gift(p_gift_id uuid,p_guest_name text,p_qty integer)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if p_guest_name is null or length(trim(p_guest_name)) not between 2 and 90
     or p_qty is null or p_qty not between 1 and 20 then
    raise exception 'Verifique o nome e a quantidade (máximo de 20 unidades).';
  end if;
  update public.baby_gifts
     set reserved = reserved + p_qty
   where id = p_gift_id and completed = false and reserved + p_qty <= quantity;
  if not found then
    raise exception 'Esse presente está preenchido ou a quantidade não está mais disponível.';
  end if;
  insert into public.baby_reservations(gift_id,guest_name,quantity)
  values(p_gift_id,trim(p_guest_name),p_qty);
end;
$$;

-- Ao cancelar uma reserva pelo painel, a disponibilidade é reposta automaticamente.
create or replace function public.baby_restore_reservation()
returns trigger language plpgsql security definer set search_path=public
as $$begin
  update public.baby_gifts set reserved=greatest(0,reserved-OLD.quantity) where id=OLD.gift_id;
  return OLD;
end;$$;
drop trigger if exists baby_reservation_deleted on public.baby_reservations;
create trigger baby_reservation_deleted after delete on public.baby_reservations
for each row execute function public.baby_restore_reservation();

-- Cada navegador recebe um código aleatório para que o convidado atualize a própria resposta.
-- Substitui a versão antiga que não solicitava o WhatsApp.
drop function if exists public.save_baby_rsvp(uuid,text,boolean,integer,text);
create or replace function public.save_baby_rsvp(
  p_secret uuid,p_guest_name text,p_attending boolean,p_total_people integer,p_message text,p_phone text
) returns void language plpgsql security definer set search_path=public
as $$
begin
  if p_secret is null or p_guest_name is null or length(trim(p_guest_name)) not between 2 and 90
  or p_attending is null or p_total_people is null
  or (p_attending and p_total_people not between 1 and 10)
  or (not p_attending and p_total_people <> 0)
  or length(coalesce(p_message,'')) > 350
  or (coalesce(p_phone,'') <> '' and p_phone !~ '^([1-9][0-9])([2-9][0-9]{7}|9[0-9]{8})$')
  or (p_attending and coalesce(p_phone,'') = '') then
    raise exception 'Verifique os dados da confirmação.';
  end if;
  insert into public.baby_rsvps(secret,guest_name,attending,total_people,phone,message,updated_at)
  values(p_secret,trim(p_guest_name),p_attending,p_total_people,coalesce(p_phone,''),coalesce(p_message,''),now())
  on conflict(secret) do update set
    guest_name=excluded.guest_name,
    attending=excluded.attending,
    total_people=excluded.total_people,
    location_sent_at=case when public.baby_rsvps.phone is distinct from excluded.phone
        or public.baby_rsvps.attending is distinct from excluded.attending then null
        else public.baby_rsvps.location_sent_at end,
    phone=excluded.phone,
    message=excluded.message,
    updated_at=now();
end;$$;

-- A página pública só recebe o total; nomes e recados ficam visíveis apenas para a organizadora.
create or replace function public.baby_rsvp_totals()
returns table(people bigint,guests bigint)
language sql stable security definer set search_path=public
as $$select coalesce(sum(total_people),0)::bigint,count(*)::bigint
from public.baby_rsvps where attending=true;$$;

revoke all on public.baby_admins from anon,authenticated;
revoke all on public.baby_reservations from anon,authenticated;
revoke all on public.baby_rsvps from anon,authenticated;
revoke all on public.baby_gifts from anon,authenticated;
grant select on public.baby_gifts to anon,authenticated;
grant insert,update,delete on public.baby_gifts to authenticated;
grant select,delete on public.baby_reservations to authenticated;
grant select,update,delete on public.baby_rsvps to authenticated;
revoke all on function public.baby_is_admin() from public;
revoke all on function public.reserve_baby_gift(uuid,text,integer) from public;
revoke all on function public.save_baby_rsvp(uuid,text,boolean,integer,text,text) from public;
revoke all on function public.baby_rsvp_totals() from public;
grant execute on function public.baby_is_admin() to authenticated;
grant execute on function public.reserve_baby_gift(uuid,text,integer) to anon,authenticated;
grant execute on function public.save_baby_rsvp(uuid,text,boolean,integer,text,text) to anon,authenticated;
grant execute on function public.baby_rsvp_totals() to anon,authenticated;

insert into public.baby_gifts(name,category,description,quantity,sort_order) values
('Fraldas descartáveis RN','Fraldas','Pacotes para os primeiros dias',3,1),
('Fraldas descartáveis P','Fraldas','Pacotes tamanho P',10,2),
('Fraldas descartáveis M','Fraldas','Pacotes tamanho M',14,3),
('Fraldas descartáveis G','Fraldas','Pacotes tamanho G',8,4),
('Lenços umedecidos','Higiene','Pacotes sem perfume, para bebês',12,5),
('Pomada para assaduras','Higiene','Unidades',5,6),
('Sabonete líquido infantil','Higiene','Suave, próprio para recém-nascidos',4,7),
('Shampoo infantil','Higiene','Suave, próprio para bebês',3,8),
('Algodão para bebê','Higiene','Pacotes de algodão macio',4,9),
('Toalha de banho com capuz','Enxoval','Toalha macia de bebê',3,10),
('Manta de bebê','Enxoval','Levinha e aconchegante',3,11),
('Paninhos de boca','Enxoval','Conjuntos de paninhos',5,12),
('Body de bebê','Roupinhas','Tamanhos P ou M',6,13),
('Macacão de bebê','Roupinhas','Tamanhos P ou M',4,14),
('Meias de bebê','Roupinhas','Pares ou kits',5,15),
('Kit escova e pente','Cuidados','Próprio para cabelo delicado',2,16),
('Termômetro digital','Cuidados','Unidade',1,17)
on conflict(name) do nothing;

-- ÚLTIMO PASSO (execute separado após criar um usuário em Authentication > Users):
-- insert into public.baby_admins(user_id) values ('UUID-DO-USUARIO');
