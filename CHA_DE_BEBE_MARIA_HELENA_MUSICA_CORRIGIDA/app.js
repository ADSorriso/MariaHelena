(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const store = window.MariaStore;
  const screens = {cover:$('#coverScreen'),invite:$('#inviteScreen'),gifts:$('#giftsScreen'),rsvp:$('#rsvpScreen')};
  let currentScreen='cover', gifts=[], currentCategory='Todos', chosenGift=null, busy=false, toastTimer;
  const iconCategory={'Fraldas':'🧷','Higiene':'🫧','Enxoval':'🧸','Roupinhas':'👶','Cuidados':'🌷'};
  const safe = s => String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),3800);}
  function go(screen){
    if(!screens[screen])return;
    currentScreen=screen;
    Object.entries(screens).forEach(([name,el])=>el.hidden=name!==screen);
    window.scrollTo({top:0,behavior:'smooth'});
    if(screen==='gifts')refreshGifts();
    if(screen==='rsvp')refreshRsvp();
  }
  // A música está incorporada no index.html. Não depende de um MP3 separado
  // no servidor e só começa após interação humana (exigência dos navegadores móveis).
  const backgroundMusic = $('#backgroundMusic');
  const musicToggle = $('#musicToggle');
  const musicAnnounce = $('#musicAnnounce');
  const musicFeedback = $('#musicFeedback');
  let musicManuallyPaused = false;
  backgroundMusic.volume = 1;
  backgroundMusic.muted = false;
  function updateMusicButton(){
    const playing = !backgroundMusic.paused && !backgroundMusic.ended;
    musicToggle.classList.toggle('playing', playing);
    musicToggle.setAttribute('aria-pressed', String(playing));
    musicToggle.setAttribute('aria-label', playing ? 'Pausar música' : 'Tocar música');
    musicToggle.title = playing ? 'Pausar música' : 'Tocar música — Pra Você Guardei o Amor';
    musicAnnounce.textContent = playing ? 'Música tocando' : 'Música pausada';
  }
  function musicAlert(message){
    musicFeedback.textContent = message;
    musicFeedback.hidden = false;
    toast(message);
  }
  // Chamado diretamente dentro do clique, sem aguardar animacoes ou Promises antes
  // de iniciar o audio. Isso e importante para o Safari/iPhone.
  function startMusic(showError = true){
    if(!backgroundMusic.paused) return;
    backgroundMusic.muted = false;
    try{
      const result = backgroundMusic.play();
      if(result && typeof result.catch === 'function'){
        result.then(() => {
          musicFeedback.hidden = true;
          updateMusicButton();
        }).catch((err) => {
          updateMusicButton();
          if(!showError) return;
          if(err && err.name === 'NotAllowedError'){
            musicAlert('Seu navegador bloqueou o áudio. Toque no botão ♫ no alto da tela para ouvir.');
          }else{
            musicAlert('Não foi possível reproduzir a música. Toque no botão ♫ para tentar novamente.');
          }
        });
      }
    }catch(_){
      updateMusicButton();
      if(showError) musicAlert('Não foi possível reproduzir a música. Toque no botão ♫ para tentar novamente.');
    }
  }
  musicToggle.addEventListener('click', () => {
    if(backgroundMusic.paused){
      musicManuallyPaused = false;
      startMusic(true);
    }else{
      musicManuallyPaused = true;
      backgroundMusic.pause();
    }
  });
  backgroundMusic.addEventListener('playing', () => {
    musicFeedback.hidden = true;
    updateMusicButton();
  });
  backgroundMusic.addEventListener('play',updateMusicButton);
  backgroundMusic.addEventListener('pause',updateMusicButton);
  backgroundMusic.addEventListener('ended',updateMusicButton);
  backgroundMusic.addEventListener('error', () => {
    musicAlert('Não foi possível carregar a música. Atualize a página ou toque no botão ♫.');
    updateMusicButton();
  });
  $('#openEnvelope').addEventListener('click', () => {
    const btn=$('#openEnvelope');
    if(btn.classList.contains('opening')) return;
    if(!musicManuallyPaused) startMusic(true);
    btn.classList.add('opening');
    setTimeout(() => {
      btn.classList.remove('opening');
      go('invite');
    },window.matchMedia('(prefers-reduced-motion:reduce)').matches?60:750);
  });
  $('#backCover').addEventListener('click',()=>go('cover'));
  document.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click',()=>go(el.dataset.go)));
  $('#shareBtn').addEventListener('click',async()=>{
    const data={title:'Chá de Bebê da Maria Helena',text:'Você está convidado para o chá de bebê da Maria Helena! 🧸💗 Dia 23/01/2027 às 15h.',url:location.href};
    try{if(navigator.share)await navigator.share(data);else if(navigator.clipboard){await navigator.clipboard.writeText(location.href);toast('Link do convite copiado! 💗');}else toast('Copie o endereço deste site para compartilhar.');}catch(e){if(e.name!=='AbortError')toast('Não foi possível compartilhar.');}
  });
  $('#calendarBtn').addEventListener('click',()=>{
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Convite Maria Helena//PT-BR','BEGIN:VEVENT','UID:maria-helena-20270123@convite','DTSTAMP:20261023T120000Z','DTSTART:20270123T150000','DTEND:20270123T180000','SUMMARY:Chá de Bebê da Maria Helena','DESCRIPTION:Vamos celebrar a chegada da Maria Helena!','END:VEVENT','END:VCALENDAR'];
    const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='cha-de-bebe-maria-helena.ics';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Evento adicionado ao arquivo do calendário ♡');
  });
  function availability(g){return Math.max(0,g.quantity-g.reserved);}
  function isDone(g){return g.completed||availability(g)===0;}
  function showGiftFilters(){
    const cats=['Todos',...new Set(gifts.map(g=>g.category))];
    if(!cats.includes(currentCategory))currentCategory='Todos';
    $('#giftFilters').innerHTML=cats.map(c=>`<button class="gift-filter ${currentCategory===c?'selected':''}" type="button" data-category="${safe(c)}">${safe(c)}</button>`).join('');
  }
  function showGifts(){
    const availableTotal=gifts.reduce((n,g)=>n+(g.completed?0:availability(g)),0),done=gifts.filter(isDone).length;
    $('#giftStats').innerHTML=`<div class="mini-stat"><strong>${gifts.length}</strong><span>Tipos de presentes</span></div><div class="mini-stat"><strong>${availableTotal}</strong><span>Unidades disponíveis</span></div><div class="mini-stat"><strong>${done}</strong><span>Já preenchidos</span></div>`;
    const shown=gifts.filter(g=>currentCategory==='Todos'||g.category===currentCategory);
    $('#giftList').innerHTML=shown.length?shown.map(g=>{
      const done=isDone(g),available=availability(g),percent=done?100:Math.round(Math.min(100,100*g.reserved/g.quantity));
      return `<article class="gift-card"><span class="gift-icon">${iconCategory[g.category]||'🎁'}</span><div class="gift-info"><h3 class="gift-title ${done?'crossed':''}">${safe(g.name)}</h3><p class="gift-description">${safe(g.description||g.category)}</p><div class="gift-meta"><span>Reservados: <strong>${g.reserved} de ${g.quantity}</strong></span><span>${done?'✓ Lista preenchida':`Faltam ${available}`}</span></div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>${done?'<span class="gift-status">✓ Presente já garantido</span>':`<button class="gift-action" type="button" data-gift-id="${safe(g.id)}">Escolher presente ♡</button>`}</div></article>`;
    }).join(''):'<p class="loading-state">Nenhum presente nesta categoria.</p>';
    if(!store.isCloud){$('#giftList').insertAdjacentHTML('beforeend','<p class="tiny-info"><strong>Modo demonstração:</strong> as escolhas são salvas somente neste navegador. Para sincronizar entre convidados, configure o Supabase.</p>');}
  }
  async function refreshGifts(){
    $('#giftList').innerHTML='<p class="loading-state">Organizando os presentinhos... 🎀</p>';
    try{gifts=await store.listGifts();showGiftFilters();showGifts();}catch(err){$('#giftList').innerHTML='<p class="loading-state">Não foi possível carregar a lista. Verifique sua conexão e tente novamente.</p>';toast(err.message);}
  }
  $('#giftFilters').addEventListener('click',e=>{
    const b=e.target.closest('[data-category]');if(!b)return;currentCategory=b.dataset.category;showGiftFilters();showGifts();
  });
  $('#giftList').addEventListener('click',e=>{
    const button=e.target.closest('[data-gift-id]');if(!button)return;
    chosenGift=gifts.find(g=>g.id===button.dataset.giftId);if(!chosenGift||isDone(chosenGift))return;
    const amount=Math.min(availability(chosenGift),20);
    $('#chosenGiftName').textContent=chosenGift.name;
    $('#reserveQty').innerHTML=Array.from({length:amount},(_,i)=>`<option value="${i+1}">${i+1} ${i?'unidades':'unidade'}</option>`).join('');
    $('#reserveName').value=localStorage.getItem('maria_helena_last_name')||'';
    $('#giftDialog').showModal();
  });
  $('#closeGiftDialog').addEventListener('click',()=>$('#giftDialog').close());
  $('#giftDialog').addEventListener('click',e=>{if(e.target===$('#giftDialog'))$('#giftDialog').close();});
  $('#reserveForm').addEventListener('submit',async e=>{
    e.preventDefault();if(busy||!chosenGift)return;
    const name=$('#reserveName').value.trim(),quantity=Number($('#reserveQty').value);
    if(name.length<2){toast('Digite seu nome, por favor.');return;}
    busy=true;$('#reserveSubmit').disabled=true;$('#reserveSubmit').textContent='Reservando...';
    try{await store.reserveGift({id:chosenGift.id,name,quantity});localStorage.setItem('maria_helena_last_name',name);$('#giftDialog').close();toast('Presente reservado com carinho! Obrigada 💗');await refreshGifts();}catch(err){toast(err.message);await refreshGifts();}
    finally{busy=false;$('#reserveSubmit').disabled=false;$('#reserveSubmit').textContent='Confirmar presente ♡';}
  });
  // O número é necessário somente para quem irá ao evento.
  const phoneDigits = value => String(value || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  const phoneValid = value => { const d=phoneDigits(value); return /^([1-9][0-9])(?:[2-9][0-9]{7}|9[0-9]{8})$/.test(d); };
  function updateAttendanceFields(){
    const attending=$('#attending').value==='yes';
    $('#peopleField').hidden=!attending;
    $('#guestPhone').required=attending;
    $('#phoneRequiredLabel').textContent=attending?'(obrigatório para receber o local)':'(opcional)';
  }
  $('#attending').addEventListener('change',updateAttendanceFields);
  $('#guestPhone').addEventListener('blur',()=>{
    const d=phoneDigits($('#guestPhone').value);
    if(d.length===11)$('#guestPhone').value=`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    else if(d.length===10)$('#guestPhone').value=`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  });
  async function refreshRsvp(){
    try{const totals=await store.getRsvpTotals();$('#rsvpTotal').innerHTML=`💗 <strong>${totals.people||0} ${Number(totals.people)===1?'pessoa confirmada':'pessoas confirmadas'}</strong> até agora${store.isCloud?'':' · demonstração local'}`;}catch(_){$('#rsvpTotal').textContent='Confirme sua presença com carinho 💗';}
    const saved=store.isCloud?JSON.parse(localStorage.getItem('maria_helena_my_rsvp_v1')||'null'):store.myDemoRsvp();
    if(saved){$('#guestName').value=saved.guest_name;$('#guestPhone').value=saved.phone||'';$('#attending').value=saved.attending?'yes':'no';$('#guestCount').value=String(saved.total_people||1);$('#guestMessage').value=saved.message||'';$('#rsvpSubmit').innerHTML='♡ Atualizar minha resposta';}updateAttendanceFields();
  }
  $('#rsvpForm').addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;
    const name=$('#guestName').value.trim(),attending=$('#attending').value==='yes',people=Number($('#guestCount').value),message=$('#guestMessage').value.trim(),phone=phoneDigits($('#guestPhone').value);
    if(name.length<2){toast('Digite seu nome completo.');return;}
    if((attending||phone)&&!phoneValid(phone)){toast('Digite um telefone com DDD válido, por exemplo (65) 99999-9999.');$('#guestPhone').focus();return;}
    busy=true;$('#rsvpSubmit').disabled=true;
    try{await store.saveRsvp({name,attending,people,message,phone});localStorage.setItem('maria_helena_my_rsvp_v1',JSON.stringify({guest_name:name,attending,total_people:attending?people:0,message,phone}));toast(attending?'Presença confirmada! A organizadora enviará o local pelo WhatsApp. 💗':'Sua resposta foi recebida. Obrigada por avisar!');$('#rsvpSubmit').textContent='♡ Atualizar minha resposta';await refreshRsvp();}catch(err){toast(err.message);}finally{busy=false;$('#rsvpSubmit').disabled=false;}
  });
  if(store.isCloud){setInterval(()=>{if(currentScreen==='gifts')refreshGifts();else if(currentScreen==='rsvp')store.getRsvpTotals().then(x=>{if(currentScreen==='rsvp')$('#rsvpTotal').innerHTML=`💗 <strong>${x.people||0} pessoas confirmadas</strong> até agora`;}).catch(()=>{});},25000);}
})();
