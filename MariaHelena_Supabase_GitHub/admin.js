(() => {
  'use strict';
  const store = window.MariaStore;
  const cfg = window.MARIA_CONFIG || {};
  const $ = s => document.querySelector(s);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean = v => String(v ?? '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const demoCredentialsKey = 'maria_helena_admin_demo_credentials_v2';
  const demoSessionKey = 'maria_helena_admin_demo_session_v2';
  const organizerLocationKey = 'maria_helena_local_organizer_private_v1';
  let gifts = [], reservations = [], rsvps = [], selectedTab = 'presencas', working = false;
  let noticeTimer;

  function notice(msg) {
    const t = $('#adminNotice'); t.textContent = msg; t.classList.add('visible');
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => t.classList.remove('visible'), 4500);
  }
  function niceDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'});
  }
  function isDone(g) { return Boolean(g.completed || g.reserved >= g.quantity); }
  function showLogin() {
    const demoSetup = !store.isCloud && !localStorage.getItem(demoCredentialsKey);
    $('#loginArea').hidden = false;
    $('#dashboard').hidden = true;
    $('#confirmPasswordField').hidden = !demoSetup;
    $('#confirmPassword').required = demoSetup;
    $('#emailField').hidden = !store.isCloud || Boolean(cfg.organizerEmail);
    $('#adminEmail').required = store.isCloud && !cfg.organizerEmail;
    $('#adminPassword').autocomplete = demoSetup ? 'new-password' : 'current-password';
    $('#loginHeading').textContent = demoSetup ? 'Crie uma senha de teste' : 'Área da Organizadora';
    $('#loginIntro').textContent = demoSetup
      ? 'Escolha uma senha para entrar no painel de demonstração neste navegador.'
      : 'Digite sua senha para consultar a lista de presença e os presentes da Maria Helena.';
    $('#passwordLabel').textContent = demoSetup ? 'Crie sua senha (mínimo de 8 caracteres)' : 'Senha de acesso';
    $('#loginBtn').textContent = demoSetup ? '🔒 Criar senha e entrar' : '🔓 Entrar no painel';
    $('#loginHelp').textContent = store.isCloud
      ? (cfg.organizerEmail ? 'Entre com a senha da conta de organizadora cadastrada no Supabase.' : 'Use o e-mail e a senha da conta autorizada no Supabase.')
      : 'Modo de demonstração: senha local, sem segurança de servidor. Configure o Supabase antes de compartilhar o site.';
  }
  async function deriveDemoHash(password, salt) {
    if (!globalThis.crypto?.subtle) throw new Error('Para configurar a senha de teste, abra o site por HTTPS ou localhost (Live Server).');
    const bytes = new TextEncoder().encode(password);
    const key = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:new Uint8Array(salt),iterations:150000,hash:'SHA-256'}, key, 256);
    return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2,'0')).join('');
  }
  async function loginDemo(password) {
    const stored = localStorage.getItem(demoCredentialsKey);
    if (!stored) {
      if (password !== $('#confirmPassword').value) throw new Error('As duas senhas não coincidem.');
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
      const hash = await deriveDemoHash(password, salt);
      localStorage.setItem(demoCredentialsKey, JSON.stringify({salt, hash}));
    } else {
      const {salt, hash} = JSON.parse(stored);
      const supplied = await deriveDemoHash(password, salt);
      if (supplied !== hash) throw new Error('Senha incorreta. Tente novamente.');
    }
    sessionStorage.setItem(demoSessionKey, 'true');
  }
  async function openDashboard() {
    $('#secretLocation').value = localStorage.getItem(organizerLocationKey) || '';
    $('#loginArea').hidden = true;
    $('#dashboard').hidden = false;
    $('#logoutBtn').hidden = false;
    await refresh();
  }
  async function start() {
    if (!store.isCloud) {
      $('#adminDemo').hidden = false;
      if (sessionStorage.getItem(demoSessionKey) === 'true' && localStorage.getItem(demoCredentialsKey)) await openDashboard();
      else showLogin();
      return;
    }
    try {
      if (await store.adminSession()) await openDashboard();
      else showLogin();
    } catch (error) {
      showLogin();
      $('#loginError').textContent = 'Falha ao conectar: ' + error.message;
    }
  }

  $('#showPassword').addEventListener('click', () => {
    const field = $('#adminPassword');
    field.type = field.type === 'password' ? 'text' : 'password';
    $('#showPassword').setAttribute('aria-label', field.type === 'password' ? 'Mostrar senha' : 'Ocultar senha');
  });
  $('#loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const b = $('#loginBtn');
    b.disabled = true;
    $('#loginError').textContent = '';
    const label = b.textContent;
    b.textContent = 'Verificando...';
    try {
      if (store.isCloud) {
        const email = (cfg.organizerEmail || $('#adminEmail').value).trim();
        if (!email) throw new Error('Configure o e-mail da organizadora.');
        await store.adminSignIn(email, $('#adminPassword').value);
      } else {
        await loginDemo($('#adminPassword').value);
      }
      $('#adminPassword').value = '';
      $('#confirmPassword').value = '';
      await openDashboard();
    } catch (error) {
      $('#loginError').textContent = error.message || 'Não foi possível entrar.';
    } finally { b.disabled = false; b.textContent = label; }
  });
  $('#logoutBtn').addEventListener('click', async () => {
    if (store.isCloud) await store.adminSignOut();
    else sessionStorage.removeItem(demoSessionKey);
    $('#dashboard').hidden = true;
    showLogin();
  });
  $('#refreshAdmin').addEventListener('click', refresh);
  $('#locationForm').addEventListener('submit', e => {
    e.preventDefault();
    const location = $('#secretLocation').value.trim();
    if (location.length < 5) { notice('Informe o endereço ou link completo.'); return; }
    localStorage.setItem(organizerLocationKey, location);
    notice('Local salvo somente neste navegador. Você já pode abrir o WhatsApp de cada convidado.');
  });
  const phoneDigits = value => String(value || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  const validPhone = phone => /^([1-9][0-9])(?:[2-9][0-9]{7}|9[0-9]{8})$/.test(phoneDigits(phone));
  const formatPhone = phone => {
    const d = phoneDigits(phone);
    return d.length === 11 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}` :
      d.length === 10 ? `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}` : 'Não informado';
  };
  function whatsappText(person, location) {
    return `Oi, ${person.guest_name}! 💗 Obrigada por confirmar sua presença no Chá de Bebê da Maria Helena! 🧸🎀\n\n📍 Local da festa: ${location}\n📅 Sábado, 23/01/2027, às 15h.\n\nEsperamos você com muito carinho! ♡`;
  }

  async function refresh() {
    try {
      [gifts, reservations, rsvps] = await Promise.all([
        store.listGifts(), store.adminReservations(), store.adminRsvps()
      ]);
      render();
    } catch (error) { notice('Erro ao carregar os dados: ' + error.message); }
  }
  function render() {
    const attending = rsvps.filter(r => r.attending);
    const people = attending.reduce((sum, r) => sum + Number(r.total_people || 0), 0);
    const reserved = gifts.reduce((sum, g) => sum + g.reserved, 0);
    const missing = gifts.reduce((sum, g) => sum + (g.completed ? 0 : Math.max(0, g.quantity - g.reserved)), 0);
    $('#adminKpis').innerHTML = [
      [people, 'Pessoas confirmadas'], [attending.length, 'Confirmações de presença'],
      [reserved, 'Presentes reservados'], [missing, 'Unidades que ainda faltam']
    ].map(([number, label]) => `<div class="admin-kpi"><strong>${number}</strong><span>${label}</span></div>`).join('');
    renderRsvps(); renderGifts(); renderReservations();
  }
  function renderGifts() {
    const status = $('#giftStatus').value, search = clean($('#giftSearch').value);
    const shown = gifts.filter(g =>
      (status === 'all' || (status === 'done' ? isDone(g) : !isDone(g))) &&
      clean(g.name + ' ' + g.category).includes(search)
    );
    $('#giftAdminList').innerHTML = shown.length ? shown.map(g => `
      <article class="admin-item"><div>
        <div class="admin-item-name" style="${isDone(g) ? 'text-decoration:line-through' : ''}">${safe(g.name)}</div>
        <div class="admin-item-sub">${safe(g.category)} · ${g.reserved} de ${g.quantity} reservados · ${isDone(g) ? '✓ Preenchido' : `Faltam ${g.quantity - g.reserved}`}${g.completed ? ' · Riscado manualmente' : ''}</div>
      </div><div class="admin-buttons">
        <button class="admin-small-btn" data-action="edit" data-id="${safe(g.id)}">Editar</button>
        <button class="admin-small-btn" data-action="complete" data-id="${safe(g.id)}">${g.completed ? 'Desmarcar' : '✓ Riscar'}</button>
        <button class="admin-small-btn danger" data-action="delete-gift" data-id="${safe(g.id)}">Excluir</button>
      </div></article>`).join('') : '<p class="admin-empty">Nenhum presente encontrado para esse filtro.</p>';
  }
  function renderReservations() {
    const search = clean($('#reservationSearch').value);
    const shown = reservations.filter(r => {
      const gift = gifts.find(g => g.id === r.gift_id);
      return clean(r.guest_name + ' ' + (r.guest_phone || '') + ' ' + (gift?.name || '')).includes(search);
    });
    $('#reservationsAdminList').innerHTML = shown.length ? shown.map(r => {
      const g = gifts.find(x => x.id === r.gift_id);
      return `<article class="admin-item"><div><div class="admin-item-name">🎁 ${safe(r.guest_name)}</div>
      <div class="admin-item-sub">${Number(r.quantity)} × ${safe(g?.name || 'Presente removido')} · WhatsApp: ${safe(r.guest_phone || 'não informado')} · ${niceDate(r.created_at)}</div></div>
      <div class="admin-buttons"><button class="admin-small-btn danger" data-action="delete-reservation" data-id="${safe(r.id)}">Cancelar reserva</button></div></article>`;
    }).join('') : '<p class="admin-empty">Nenhuma reserva encontrada.</p>';
  }
  function renderRsvps() {
    const status = $('#rsvpStatus').value, search = clean($('#rsvpSearch').value);
    const shown = rsvps.filter(r => {
      const match = status === 'all' || (status === 'yes' && r.attending) ||
        (status === 'no' && !r.attending) || (status === 'pending' && r.attending && !r.location_sent_at) ||
        (status === 'sent' && r.attending && !!r.location_sent_at);
      return match && clean(r.guest_name + ' ' + (r.phone||'')).includes(search);
    });
    $('#rsvpAdminList').innerHTML = shown.length ? shown.map(r => `
      <article class="admin-item"><div><div class="admin-item-name">${r.attending ? '💗' : '✉️'} ${safe(r.guest_name)}</div>
      <div class="admin-item-sub">${r.attending ? '✓ Vai comparecer · ' + Number(r.total_people) + ' pessoa(s)' : 'Não poderá comparecer'} · ${niceDate(r.updated_at)}<br>📱 WhatsApp: <strong>${safe(formatPhone(r.phone))}</strong>${r.attending ? '<br><span class="' + (r.location_sent_at ? 'admin-sent' : 'admin-pending') + '">' + (r.location_sent_at ? '✓ Local marcado como enviado em '+niceDate(r.location_sent_at) : '⏳ Local ainda não enviado') + '</span>' : ''}${r.message ? '<br>Recado: ' + safe(r.message) : ''}</div></div>
      <div class="admin-buttons">
      ${r.attending && validPhone(r.phone) ? `<button class="admin-small-btn admin-whatsapp" type="button" data-action="whatsapp-rsvp" data-id="${safe(r.id)}">✆ Enviar local pelo WhatsApp</button>` : ''}
      ${r.attending ? `<button class="admin-small-btn" type="button" data-action="toggle-sent-rsvp" data-id="${safe(r.id)}">${r.location_sent_at ? '↶ Desmarcar envio' : '✓ Marcar como enviado'}</button>` : ''}
      <button class="admin-small-btn danger" type="button" data-action="delete-rsvp" data-id="${safe(r.id)}">Excluir resposta</button>
      </div></article>`).join('') : '<p class="admin-empty">Nenhuma resposta encontrada para esse filtro.</p>';
  }

  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
    selectedTab = button.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach(tab => tab.classList.toggle('active', tab === button));
    $('#presentesPanel').hidden = selectedTab !== 'presentes';
    $('#reservasPanel').hidden = selectedTab !== 'reservas';
    $('#presencasPanel').hidden = selectedTab !== 'presencas';
  }));
  ['giftSearch','giftStatus'].forEach(id => $('#' + id).addEventListener('input', renderGifts));
  $('#reservationSearch').addEventListener('input', renderReservations);
  ['rsvpSearch','rsvpStatus'].forEach(id => $('#' + id).addEventListener('input', renderRsvps));

  function exportCsv(filename, headers, rows) {
    const csvCell = value => {
      let s = String(value ?? '').replace(/\r\n?/g, '\n');
      if (/^[\s]*[=+@-]/.test(s)) s = "'" + s; // Proteção ao abrir a planilha no Excel.
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const csv = '\ufeff' + [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    notice('Lista baixada com sucesso.');
  }
  $('#exportRsvps').addEventListener('click', () => exportCsv('maria-helena-presencas.csv',
    ['Convidado','Confirmação','Total de pessoas','WhatsApp','Local enviado em','Recado','Atualizado em'],
    rsvps.map(r => [r.guest_name, r.attending ? 'Sim' : 'Não', r.total_people, formatPhone(r.phone), r.location_sent_at ? niceDate(r.location_sent_at) : '', r.message, niceDate(r.updated_at)])));
  $('#exportGifts').addEventListener('click', () => exportCsv('maria-helena-presentes.csv',
    ['Presente','Categoria','Quantidade desejada','Reservados','Faltam','Concluído'],
    gifts.map(g => [g.name,g.category,g.quantity,g.reserved,Math.max(0,g.quantity-g.reserved),isDone(g)?'Sim':'Não'])));
  $('#exportReservations').addEventListener('click', () => exportCsv('maria-helena-reservas.csv',
    ['Convidado','Presente','Quantidade','Reservado em'],
    reservations.map(r => [r.guest_name, gifts.find(g => g.id === r.gift_id)?.name || '',r.quantity,niceDate(r.created_at)])));

  function resetEditor() {
    $('#giftEditor').reset(); $('#editId').value = '';
    $('#editOrder').value = '100'; $('#editQuantity').value = '1';
    $('#giftEditorTitle').textContent = 'Adicionar presente';
  }
  $('#clearEditor').addEventListener('click', resetEditor);
  $('#giftEditor').addEventListener('submit', async e => {
    e.preventDefault(); if (working) return; working = true; $('#saveGiftBtn').disabled = true;
    const gift = {
      id:$('#editId').value || null, name:$('#editName').value, category:$('#editCategory').value,
      description:$('#editDescription').value, quantity:Number($('#editQuantity').value),
      sort_order:Number($('#editOrder').value), completed:$('#editCompleted').checked
    };
    try { await store.updateGift(gift); notice('Presente salvo com sucesso!'); resetEditor(); await refresh(); }
    catch (error) { notice(error.message); }
    finally { working = false; $('#saveGiftBtn').disabled = false; }
  });
  $('#giftAdminList').addEventListener('click', async e => {
    const b = e.target.closest('[data-action]'); if (!b || working) return;
    const action = b.dataset.action, g = gifts.find(x => x.id === b.dataset.id); if (!g) return;
    if (action === 'edit') {
      $('#editId').value = g.id; $('#editName').value = g.name;
      $('#editCategory').value = g.category; $('#editDescription').value = g.description || '';
      $('#editQuantity').value = g.quantity; $('#editOrder').value = g.sort_order || 100;
      $('#editCompleted').checked = g.completed;
      $('#giftEditorTitle').textContent = 'Editar presente';
      $('#giftEditor').scrollIntoView({behavior:'smooth',block:'center'}); return;
    }
    if (action === 'complete') {
      working = true;
      try { await store.updateGift({...g,completed:!g.completed}); notice('Presente atualizado.'); await refresh(); }
      catch (error) { notice(error.message); } finally { working = false; } return;
    }
    if (action === 'delete-gift') {
      if (!confirm(`Excluir "${g.name}"? Cancele primeiro as reservas vinculadas.`)) return;
      working = true;
      try { await store.removeGift(g.id); await refresh(); notice('Presente excluído.'); }
      catch (error) { notice(error.message); } finally { working = false; }
    }
  });
  $('#reservationsAdminList').addEventListener('click', async e => {
    const b = e.target.closest('[data-action="delete-reservation"]'); if (!b || working) return;
    if (!confirm('Cancelar esta reserva? A quantidade voltará a ficar disponível.')) return;
    working = true;
    try { await store.removeReservation(b.dataset.id); await refresh(); notice('Reserva cancelada.'); }
    catch (error) { notice(error.message); } finally { working = false; }
  });
  $('#rsvpAdminList').addEventListener('click', async e => {
    const b = e.target.closest('[data-action]'); if (!b || working) return;
    const person = rsvps.find(r => String(r.id) === b.dataset.id);
    if (!person) return;
    if (b.dataset.action === 'whatsapp-rsvp') {
      const location = ($('#secretLocation').value || '').trim();
      const savedLocation = localStorage.getItem(organizerLocationKey);
      if (location.length < 5) { $('#secretLocation').focus(); notice('Preencha o endereço privado da festa antes de enviar.'); return; }
      if (location !== savedLocation) { $('#secretLocation').focus(); notice('Clique em “Salvar local neste aparelho” antes de enviar.'); return; }
      if (!validPhone(person.phone)) { notice('O convidado precisa informar um número válido.'); return; }
      const url = `https://wa.me/55${phoneDigits(person.phone)}?text=${encodeURIComponent(whatsappText(person, location))}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      notice('WhatsApp aberto com a mensagem pronta. Após enviar, clique em “Marcar como enviado”.');
      return;
    }
    if (b.dataset.action === 'toggle-sent-rsvp') {
      working = true;
      try { await store.setLocationSent(person.id, !person.location_sent_at); await refresh(); notice(person.location_sent_at ? 'Status de envio removido.' : 'Status marcado como enviado.'); }
      catch (error) { notice(error.message); } finally { working = false; }
      return;
    }
    if (b.dataset.action === 'delete-rsvp') {
      if (!confirm('Excluir esta resposta de presença?')) return;
      working = true;
      try { await store.removeRsvp(b.dataset.id); await refresh(); notice('Resposta excluída.'); }
      catch (error) { notice(error.message); } finally { working = false; }
    }
  });
  start();
})();
