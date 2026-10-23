# Chá de Bebê da Maria Helena 💗

Site interativo em português, compatível com celular e computador, inspirado no convite rosa com ursinhos e envelope. Pode ser publicado gratuitamente no **GitHub Pages**.

## Informações do evento

- **Maria Helena**
- **Sábado, 23 de janeiro de 2027, às 15h**
- **Rua Nossa Senhora de Fátima, Quadra 12, Casa 12, Santa Maria 1**
- O botão de localização abre uma busca no Google Maps pelo endereço fornecido. **Confirme o município/estado e o pin antes de enviar o convite**, pois eles não foram informados.

## Funcionalidades

1. Envelope rosa com selo: ao tocar, abre o cartão.
2. Cartão do evento com local, data, horário e botões de interação.
3. Lista de presentes com categorias, quantidade desejada, quantidade reservada e progresso. Quando tudo estiver reservado, o presente é **riscado automaticamente**.
4. Convidado escolhe presente, informa nome e quantidade; a lista é atualizada.
5. Confirmação de presença com nome, número de pessoas e recado. O mesmo navegador pode atualizar a resposta.
6. Área da organizadora (`admin.html`) com lista privada de respostas, reservas, cadastro de presentes e opção de **riscar/desmarcar** itens manualmente.
7. Botão de compartilhar o convite e arquivo de calendário (.ics).

## Testar rapidamente

Abra `index.html` no navegador. Também pode usar Live Server no VS Code. Sem configuração adicional, o site roda em **modo demonstração local**, salvando as escolhas no navegador atual. A demonstração serve para validar o visual e as ações, **não sincroniza visitantes diferentes**. Não envie um convite real nesse modo esperando receber dados de outras pessoas.

Para testar o painel, abra `admin.html` no mesmo navegador. Em demonstração o painel não exige senha e só altera os dados locais.

## Ativar a lista compartilhada de verdade (Supabase)

1. Crie um projeto em https://supabase.com, de preferência dedicado a este convite.
2. Abra **SQL Editor** e execute o arquivo `supabase.sql` inteiro.
3. Vá em **Authentication → Users** e crie um usuário para a organizadora com e-mail e senha. Copie o **UUID** do usuário.
4. Execute no **SQL Editor**, substituindo o UUID:

   ```sql
   insert into public.baby_admins(user_id) values ('COLE-O-UUID-AQUI');
   ```

5. Vá em **Project Settings → API / Data API** (a nomenclatura pode variar). Copie a **Project URL** e a chave **anon/public** (ou a **publishable key**) para `config.js`:

   ```js
   window.MARIA_CONFIG = {
     supabaseUrl: 'https://SEU-PROJETO.supabase.co',
     supabaseAnonKey: 'SUA-CHAVE-PUBLICA'
   };
   ```

6. Salve e publique os arquivos. Convidados verão as quantidades e confirmações globais. A organizadora abre `admin.html` e entra com o e-mail/senha do passo 3.

**Segurança:** nunca use uma chave `service_role`, `secret` ou senha de administradora nos arquivos públicos. O SQL usa RLS para restringir a lista de nomes e as alterações a uma conta autorizada. As funções públicas de reserva e confirmação não exigem login; para um evento com exposição ampla, acrescente limitação de solicitações ou proteção antispam (por exemplo, Edge Function/Turnstile) antes da divulgação. Os nomes das reservas e confirmações são dados pessoais: informe os convidados sobre o uso dessas informações e exclua-os quando não forem mais necessários.

## Publicar no GitHub Pages

1. Crie um repositório GitHub, por exemplo `cha-maria-helena`.
2. Envie para a raiz do repositório `index.html`, `admin.html`, `styles.css`, `config.js`, `data.js`, `app.js`, `admin.js`, `supabase.sql` e a pasta `assets/`.
3. Em **Settings → Pages**, use **Deploy from a branch**, **main**, pasta **/(root)**.
4. Espere a publicação pelo próprio GitHub, abra a URL indicada em Pages e teste em dois aparelhos diferentes.

## Personalizar

- Textos, nome, data, localização e links: `index.html`.
- Visual, tamanho e cores: `styles.css`.
- Ursinha e balões vetoriais: `assets/ursinha.svg` e `assets/balloons.svg`.
- Lista inicial de demonstração: `data.js` (`initialGifts`).
- Lista inicial compartilhada: linhas `insert into ... baby_gifts` em `supabase.sql` (ou edite pelo painel depois da configuração).
- Painel da organizadora: `admin.html`.

**Observações:** o evento é sábado, **23/01/2027**. O convite não informa cidade/estado porque não foram fornecidos; revise o resultado do Google Maps. O horário no arquivo de calendário é 15h no horário local do calendário de quem importar.
