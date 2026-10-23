# Chá de Bebê da Maria Helena 🎀

Site interativo responsivo com envelope rosa, ursinhos, presente e confirmação de presença. Pode ser publicado no GitHub Pages, com Supabase para compartilhar as confirmações entre convidados e permitir à organizadora acessar as listas com senha.

## Data e privacidade do local

- **Maria Helena — sábado, 23 de janeiro de 2027, às 15h.**
- O **endereço não aparece** em nenhuma parte do convite público, no arquivo de calendário ou em botões do Google Maps.
- No cartão, abaixo de **Onde será?**, aparece: **“Assim que confirmada a presença, o local será enviado por WhatsApp.”**
- O convidado confirma presença e informa seu **número de WhatsApp com DDD** (obrigatório se for comparecer, opcional se não puder ir).
- O telefone consta apenas da lista **privada da organizadora** (em produção, protegida por Supabase Auth e RLS), não é divulgado para outros convidados.

## Como a organizadora envia o local

1. No convite, entre em **🔒 Área da organizadora** (`admin.html`) e faça login.
2. Abra a aba **💌 Presenças**. Ali aparecem nome, quantidade de participantes, WhatsApp, observações e status do envio.
3. Na seção **📍 Local para enviar no WhatsApp**, informe o endereço completo ou link do mapa e clique em **Salvar local neste aparelho**. Esse texto **não é inserido em arquivos públicos do site**: fica somente no armazenamento deste navegador usado pela organizadora. Em outro aparelho é necessário preenchê-lo novamente.
4. Para cada convidado confirmado, clique em **✆ Enviar local pelo WhatsApp**. Será aberta a conversa (`wa.me`) com o número informado e uma mensagem com nome do convidado, endereço e data.
5. A organizadora **precisa apertar Enviar no WhatsApp**. Depois, no painel, deve clicar em **✓ Marcar como enviado**. O site **não envia mensagens automaticamente**, nem presume que foram entregues ao só abrir o WhatsApp.
6. Os filtros **Aguardando endereço** e **Local enviado** ajudam a acompanhar quem recebeu a informação. O estado é guardado junto à confirmação no Supabase (ou somente neste navegador no modo demonstração).
7. A exportação CSV da lista de presenças inclui o número e o status de envio. Guarde o arquivo com cuidado porque contém dados pessoais.

## Presentes e presença

- Lista inicial de presentes com categorias, quantidades, total reservado e o que ainda falta. Itens completos ficam riscados automaticamente.
- Cada convidado informa seu nome e quantidades para reservar um presente.
- O formulário de presença solicita nome, WhatsApp, se comparecerá, quantidade de pessoas e recado opcional.
- O mesmo navegador pode alterar a resposta. Se mudar o WhatsApp ou desistir de ir, o controle de “local enviado” é reiniciado para essa confirmação.
- A organizadora pode editar presentes, cancelar reservas, excluir respostas, filtrar listas e exportar CSVs.

## Testar como demonstração

Abra `index.html` e `admin.html` no mesmo navegador por meio do **Live Server do VS Code** (localhost) ou HTTPS. No primeiro acesso ao painel você criará uma senha de demonstração com pelo menos 8 caracteres. Os dados da demonstração são salvos **somente no dispositivo/navegador atual**; não há sincronização com convidados em outros celulares. Essa senha é **local e não é uma proteção segura para um site publicado**. Não compartilhe o link do convite como site real até configurar o Supabase.

## Ativar banco compartilhado com autenticação real (Supabase)

1. Crie seu projeto no https://supabase.com.
2. Abra **SQL Editor** e execute todo o arquivo `supabase.sql` (ele também atualiza as colunas `phone` e `location_sent_at` de um projeto que utilizava uma versão anterior). Para dados antigos, o telefone aparecerá como “Não informado” até o convidado atualizar a resposta.
3. Em **Authentication → Users**, cadastre a organizadora com um e-mail e uma senha. Copie o UUID dela.
4. No SQL Editor execute:

   ```sql
   insert into public.baby_admins(user_id) values ('COLE-O-UUID-AQUI')
   on conflict(user_id) do nothing;
   ```

5. Em **Project Settings → API** pegue a URL do projeto e a chave **anon/public** (publishable, se disponível). Preencha `config.js`:

   ```javascript
   window.MARIA_CONFIG = {
     supabaseUrl: 'https://SEU-PROJETO.supabase.co',
     supabaseAnonKey: 'SUA-CHAVE-PUBLICA',
     organizerEmail: 'EMAIL-DA-ORGANIZADORA'
   };
   ```

6. Publique os arquivos no GitHub Pages. Faça testes reais usando **dois navegadores ou dois celulares diferentes**. O painel consultará os dados do Supabase; a senha da organizadora será validada pela autenticação do Supabase. **Nunca inclua `service_role` nem a senha de alguém nos arquivos públicos.**
7. O controle do local é **manual pelo WhatsApp**. É preciso verificar no WhatsApp se a mensagem foi enviada e então marcar o status no painel. Apenas o status do envio é sincronizado no banco; o endereço digitado na área privada continua salvo no navegador da organizadora.

## Publicar no GitHub Pages

Envie para a raiz do repositório `index.html`, `admin.html`, `styles.css`, `config.js`, `data.js`, `app.js`, `admin.js` e a pasta `assets/`. O SQL e este guia podem ficar fora da publicação, se preferir. Ative **Settings → Pages → Deploy from a branch → main / root**.

**Privacidade:** WhatsApps, nomes e respostas são dados pessoais. Compartilhe com os convidados que o telefone será usado para informar o local da festa, não para outros fins. Exclua os cadastros quando deixarem de ser necessários. As funções públicas de confirmação não exigem login; para um evento divulgado amplamente, considere proteção antispam e limites por IP antes da publicação.
