# Chá de Bebê — Maria Helena | Versão com áudio ajustado 🎀

## Problema da música e como usar esta versão

A versão anterior tinha **mais de 7 MB de áudio embutidos no `index.html`**. Esta versão usa um arquivo MP3 separado, compatível com navegadores comuns, sem imagem de capa nem metadados embutidos.

**MUITO IMPORTANTE:** envie **TODOS** os arquivos e pastas deste ZIP para a raiz do site publicado, mantendo os nomes idênticos. Em especial:

- `index.html` — convite atualizado
- `app.js` e `styles.css` — player novo e controles
- `musica-maria-helena.mp3` — **obrigatório, na MESMA PASTA que `index.html`**
- `teste-musica.html` — teste independente da música
- `admin.html`, `admin.js`, `data.js`, `config.js`, `assets/` — demais funções, preservadas

**Não basta substituir somente `index.html`**: se o MP3 não estiver no GitHub, o som não toca. O nome exato do arquivo é `musica-maria-helena.mp3` (sem espaços nem acentos).

### Como a música funciona

1. Ao tocar no selo para abrir o convite, o site tenta tocar a música **no mesmo toque do usuário**.
2. Também existe um botão grande **“♫ Tocar música”** e o botão de nota musical no topo para tocar/pausar manualmente.
3. O **player nativo com botão ▶ fica sempre visível** no topo; use-o se o toque no envelope não iniciar a música. Há também um link para abrir o MP3 diretamente.
4. O site mostra uma mensagem se a reprodução for bloqueada ou se o arquivo estiver ausente.

### Teste rápido para descobrir a causa

Depois de publicar, abra `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/teste-musica.html` substituindo a URL pela do seu site. Se não tocar ali, toque em **“Abrir o MP3 diretamente”**.

- Se esse link der **404**, o MP3 não foi publicado no local correto.
- Se o link abrir, mas só o player do site falhar, podemos diagnosticar o navegador. Tente tocar no player nativo.
- Se o site antigo continuar aparecendo, limpe o cache ou abra uma aba anônima. Os JS/CSS receberam versão nova.

No GitHub Pages, depois de subir os arquivos, aguarde a publicação concluir e **recarregue** a página. Se você usa um link de convite antigo, verifique se ele aponta para o repositório que acabou de atualizar.

**Aviso:** publicar uma gravação comercial pode exigir autorização dos titulares dos direitos autorais.

## Funções do convite preservadas

- Maria Helena, sábado, 23/01/2027 às 15h.
- Endereço omitido no convite público: após confirmação, a organizadora envia o local manualmente pelo WhatsApp.
- Presenças com telefone, presentes e quantidades com itens riscados quando completos.
- Área administrativa com senha e opção de registrar o envio do local a cada convidado.
- Para sincronizar reservas/presenças entre celulares e ter login seguro, configure Supabase seguindo o projeto original (`supabase.sql`, `CONFIGURAR_ACESSO_COM_SENHA.txt`). Sem configurar, funciona somente como demonstração local.
