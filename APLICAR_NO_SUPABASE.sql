-- MARIA HELENA - MIGRAÇÃO SEGURA DA LISTA DE PRESENTES
-- Execute somente no Supabase do projeto cha-maria-helena, SQL Editor > Run.
-- NÃO APAGA presenças, nem reservas existentes. Itens antigos ficam arquivados.
-- Pode executar mais de uma vez: não duplica nomes.

BEGIN;

ALTER TABLE public.baby_gifts
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Arquiva a lista antiga; mantém seus IDs e reservas para auditoria.
UPDATE public.baby_gifts SET active = false WHERE active = true;

WITH novos(nome, categoria, descricao, qtd, ordem) AS (
 VALUES
  ('Almofada de amamentação','Amamentação','Unidade',1,1),
  ('Chupeta tamanho 0','Acessórios','0 a 2 meses',1,2),
  ('Chupeta tamanho 1','Acessórios','0 a 6 meses',1,3),
  ('Naninha','Enxoval','Unidades',2,4),
  ('Kit Mamadeiras Avent','Alimentação','Kit',1,5),
  ('Escova para limpeza de mamadeiras','Alimentação','Unidade',1,6),
  ('Meias','Roupinhas','Pares',10,7),
  ('Fraldas de boca','Enxoval','Unidades',10,8),
  ('Manta / cobertor','Enxoval','Unidades',5,9),
  ('Toalha de banho com capuz','Enxoval','Unidades',6,10),
  ('Kit mamãe e bebê Natura','Cuidados','Kits',6,11),
  ('Saída de maternidade','Roupinhas','Conjunto',1,12),
  ('Kit enxoval de berço','Enxoval','Kit',1,13),
  ('Ninho redutor de berço','Enxoval','Unidade',1,14),
  ('Body manga longa P','Roupinhas','Tamanho P',10,15),
  ('Body manga longa M','Roupinhas','Tamanho M',10,16),
  ('Body manga longa G','Roupinhas','Tamanho G',10,17),
  ('Body manga curta P','Roupinhas','Tamanho P',10,18),
  ('Body manga curta M','Roupinhas','Tamanho M',10,19),
  ('Body manga curta G','Roupinhas','Tamanho G',10,20),
  ('Macacão longo / curto com zíper P','Roupinhas','Tamanho P',10,21),
  ('Macacão longo / curto com zíper M','Roupinhas','Tamanho M',10,22),
  ('Macacão longo / curto com zíper G','Roupinhas','Tamanho G',10,23),
  ('Calça de malha / mijões','Roupinhas','Tamanhos P, M ou G',10,24),
  ('Conjuntos / vestidos','Roupinhas','Unidades',10,25),
  ('Jogo de lençol de berço','Enxoval','Jogos',2,26),
  ('Pomada para assaduras','Higiene','Unidades',5,27),
  ('Banheira','Cuidados','Unidade',1,28),
  ('Kit primeiros cuidados','Cuidados','Kits',2,29),
  ('Kit higiene','Higiene','Kits',10,30),
  ('Lenços umedecidos','Higiene','Pacotes',15,31),
  ('Fralda descartável RN','Fraldas','Huggies, MamyPoko ou Pampers',4,32),
  ('Fralda descartável P','Fraldas','Huggies, MamyPoko ou Pampers',10,33),
  ('Fralda descartável M','Fraldas','Huggies, MamyPoko ou Pampers',10,34),
  ('Fralda descartável G','Fraldas','Huggies, MamyPoko ou Pampers',10,35)
)
INSERT INTO public.baby_gifts
  (name, category, description, quantity, reserved, completed, sort_order, active)
SELECT nome, categoria, descricao, qtd, 0, false, ordem, true
FROM novos
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  quantity = GREATEST(EXCLUDED.quantity, public.baby_gifts.reserved),
  sort_order = EXCLUDED.sort_order,
  active = true;

-- Visitantes só enxergam presentes ativos; admins podem consultar o histórico.
ALTER TABLE public.baby_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gifts_public_read ON public.baby_gifts;
CREATE POLICY gifts_public_read ON public.baby_gifts FOR SELECT
  TO anon,authenticated USING (active = true);

DROP POLICY IF EXISTS gifts_admin_manage ON public.baby_gifts;
CREATE POLICY gifts_admin_manage ON public.baby_gifts FOR ALL
  TO authenticated USING ((SELECT public.baby_is_admin()))
  WITH CHECK ((SELECT public.baby_is_admin()));

-- O admin consegue verificar seu próprio ID sem ver os outros admins.
GRANT SELECT (user_id) ON public.baby_admins TO authenticated;
DROP POLICY IF EXISTS baby_admins_read_own ON public.baby_admins;
CREATE POLICY baby_admins_read_own ON public.baby_admins
 FOR SELECT TO authenticated
 USING (user_id = (SELECT auth.uid()));

-- A reserva de itens antigos continua consultável/cancelável pelo administrador.
DROP POLICY IF EXISTS reservations_admin_manage ON public.baby_reservations;
CREATE POLICY reservations_admin_manage ON public.baby_reservations FOR ALL
  TO authenticated USING ((SELECT public.baby_is_admin()))
  WITH CHECK ((SELECT public.baby_is_admin()));

-- Impede reservar itens arquivados, esgotados ou manualmente concluídos.
CREATE OR REPLACE FUNCTION public.reserve_baby_gift(
 p_gift_id uuid, p_guest_name text, p_qty int, p_guest_phone text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF p_gift_id IS NULL
 OR length(trim(coalesce(p_guest_name,''))) NOT BETWEEN 2 AND 90
 OR p_qty IS NULL OR p_qty NOT BETWEEN 1 AND 20
 OR p_guest_phone IS NULL
 OR p_guest_phone !~ '^[1-9][0-9]9?[0-9]{8}$'
 THEN RAISE EXCEPTION 'Confira nome, telefone e quantidade.';
 END IF;

 IF EXISTS (
   SELECT 1 FROM public.baby_reservations
   WHERE gift_id=p_gift_id AND guest_phone=p_guest_phone
 ) THEN RAISE EXCEPTION 'Este telefone ja reservou este presente.';
 END IF;

 UPDATE public.baby_gifts SET reserved=reserved+p_qty
 WHERE id=p_gift_id AND active = true AND completed = false
   AND reserved+p_qty <= quantity;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Presente indisponivel ou quantidade esgotada.';
 END IF;
 INSERT INTO public.baby_reservations
  (gift_id, guest_name, guest_phone, quantity)
 VALUES (p_gift_id, trim(p_guest_name), p_guest_phone, p_qty);
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION 'Este telefone ja reservou este presente.';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_baby_gift(uuid,text,integer,text)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_baby_gift(uuid,text,integer,text)
TO anon,authenticated;

COMMIT;

-- Conferência: resultado esperado = 35 presentes, pelo menos 226 unidades
-- (se houver reservas antigas com mesmo nome e quantidade maior, o total pode subir).
SELECT count(*) AS tipos, sum(quantity) AS unidades,
 sum(reserved) AS unidades_reservadas
FROM public.baby_gifts WHERE active = true;
