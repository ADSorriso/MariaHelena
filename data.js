/* Camada de dados: demonstração local ou Supabase compartilhado. */
(function () {
  'use strict';
  const localKey = 'maria_helena_cha_data_v1';
  const tokenKey = 'maria_helena_rsvp_token_v1';
  const cfg = window.MARIA_CONFIG || {};
  const cloud = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  let supabasePromise;
  const initialGifts = [
    {id:'fraldas-rn',name:'Fraldas descartáveis RN',category:'Fraldas',description:'Pacotes para os primeiros dias',quantity:3,icon:'🍼'},
    {id:'fraldas-p',name:'Fraldas descartáveis P',category:'Fraldas',description:'Pacotes tamanho P',quantity:10,icon:'🧷'},
    {id:'fraldas-m',name:'Fraldas descartáveis M',category:'Fraldas',description:'Pacotes tamanho M',quantity:14,icon:'🧷'},
    {id:'fraldas-g',name:'Fraldas descartáveis G',category:'Fraldas',description:'Pacotes tamanho G',quantity:8,icon:'🧷'},
    {id:'lencos',name:'Lenços umedecidos',category:'Higiene',description:'Pacotes sem perfume, para bebês',quantity:12,icon:'🫧'},
    {id:'pomada',name:'Pomada para assaduras',category:'Higiene',description:'Unidades',quantity:5,icon:'🧴'},
    {id:'sabonete',name:'Sabonete líquido infantil',category:'Higiene',description:'Suave, próprio para recém-nascidos',quantity:4,icon:'🧼'},
    {id:'shampoo',name:'Shampoo infantil',category:'Higiene',description:'Suave, próprio para bebês',quantity:3,icon:'🫧'},
    {id:'algodao',name:'Algodão para bebê',category:'Higiene',description:'Pacotes de algodão macio',quantity:4,icon:'☁️'},
    {id:'toalha',name:'Toalha de banho com capuz',category:'Enxoval',description:'Toalha macia de bebê',quantity:3,icon:'🛁'},
    {id:'manta',name:'Manta de bebê',category:'Enxoval',description:'Levinha e aconchegante',quantity:3,icon:'🧸'},
    {id:'paninho',name:'Paninhos de boca',category:'Enxoval',description:'Conjuntos de paninhos',quantity:5,icon:'🎀'},
    {id:'body',name:'Body de bebê',category:'Roupinhas',description:'Tamanhos P ou M',quantity:6,icon:'👶'},
    {id:'macacao',name:'Macacão de bebê',category:'Roupinhas',description:'Tamanhos P ou M',quantity:4,icon:'🩷'},
    {id:'meinhas',name:'Meias de bebê',category:'Roupinhas',description:'Pares ou kits',quantity:5,icon:'🧦'},
    {id:'lixinhas',name:'Kit escova e pente',category:'Cuidados',description:'Próprio para cabelo delicado',quantity:2,icon:'🌷'},
    {id:'termometro',name:'Termômetro digital',category:'Cuidados',description:'Unidade',quantity:1,icon:'🌡️'}
  ];
  function initialState() {return {gifts:initialGifts.map((g,i)=>({...g,reserved:0,completed:false,sort_order:i+1})),reservations:[],rsvps:[]};}
  function readLocal() {try{const x=JSON.parse(localStorage.getItem(localKey));if(x&&Array.isArray(x.gifts))return x;}catch(_){}const d=initialState();saveLocal(d);return d;}
  function saveLocal(data){localStorage.setItem(localKey,JSON.stringify(data));}
  function normalizeError(err){if(err instanceof Error)return err;return new Error(err?.message||'Não foi possível concluir. Tente novamente.');}
  async function client(){
    if(!cloud)throw new Error('O Supabase ainda não foi configurado.');
    if(!supabasePromise)supabasePromise=import('https://esm.sh/@supabase/supabase-js@2').then(m=>m.createClient(cfg.supabaseUrl.replace(/\/$/,''),cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}}));
    return supabasePromise;
  }
  function uid(){if(window.crypto?.randomUUID)return crypto.randomUUID();return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{let r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16);});}
  function getRsvpToken(){let t=localStorage.getItem(tokenKey);if(!t){t=uid();localStorage.setItem(tokenKey,t);}return t;}
  async function listGifts(){
    if(!cloud)return readLocal().gifts.sort((a,b)=>a.sort_order-b.sort_order);
    const s=await client();const {data,error}=await s.from('baby_gifts').select('id,name,category,description,quantity,reserved,completed,sort_order').order('sort_order',{ascending:true}).order('name',{ascending:true});if(error)throw normalizeError(error);return data;
  }
  async function reserveGift({id,name,quantity}){
    name=String(name||'').trim();quantity=Number(quantity);
    if(name.length<2||name.length>90||!Number.isInteger(quantity)||quantity<1||quantity>20)throw new Error('Confira seu nome e a quantidade escolhida.');
    if(!cloud){let d=readLocal(),g=d.gifts.find(x=>x.id===id);if(!g)throw new Error('Presente não encontrado.');if(g.completed||g.reserved+quantity>g.quantity)throw new Error('Essa quantidade não está mais disponível.');g.reserved+=quantity;d.reservations.unshift({id:uid(),gift_id:id,guest_name:name,quantity,created_at:new Date().toISOString()});saveLocal(d);return;}
    const s=await client();const {error}=await s.rpc('reserve_baby_gift',{p_gift_id:id,p_guest_name:name,p_qty:quantity});if(error)throw normalizeError(error);
  }
  async function saveRsvp({name,attending,people,message}){
    name=String(name||'').trim();message=String(message||'').trim();people=attending?Number(people):0;
    if(name.length<2||name.length>90||message.length>350||(attending&&(!Number.isInteger(people)||people<1||people>10)))throw new Error('Confira os dados da confirmação.');
    const token=getRsvpToken();
    if(!cloud){const d=readLocal();const found=d.rsvps.find(x=>x.secret===token);const body={secret:token,guest_name:name,attending:!!attending,total_people:people,message,updated_at:new Date().toISOString()};if(found)Object.assign(found,body);else d.rsvps.unshift({id:uid(),...body});saveLocal(d);return;}
    const s=await client();const {error}=await s.rpc('save_baby_rsvp',{p_secret:token,p_guest_name:name,p_attending:!!attending,p_total_people:people,p_message:message});if(error)throw normalizeError(error);
  }
  async function getRsvpTotals(){
    if(!cloud){const r=readLocal().rsvps.filter(x=>x.attending);return{people:r.reduce((a,b)=>a+b.total_people,0),guests:r.length};}
    const s=await client();const {data,error}=await s.rpc('baby_rsvp_totals');if(error)throw normalizeError(error);return data?.[0]||{people:0,guests:0};
  }
  function myDemoRsvp(){const r=readLocal().rsvps.find(x=>x.secret===getRsvpToken());return r||null;}
  async function adminSignIn(email,password){const s=await client();const{data,error}=await s.auth.signInWithPassword({email,password});if(error)throw normalizeError(error);const {data:admin,error:err}=await s.rpc('baby_is_admin');if(err||!admin){await s.auth.signOut();throw new Error('Esta conta não tem permissão de organizadora.');}return data;}
  async function adminSession(){if(!cloud)return{demo:true};const s=await client();const{data}=await s.auth.getSession();if(!data.session)return null;const {data:allowed,error}=await s.rpc('baby_is_admin');if(error||!allowed)return null;return data.session;}
  async function adminSignOut(){if(cloud){const s=await client();await s.auth.signOut();}}
  async function adminReservations(){if(!cloud)return readLocal().reservations;const s=await client();const {data,error}=await s.from('baby_reservations').select('id,gift_id,guest_name,quantity,created_at').order('created_at',{ascending:false});if(error)throw normalizeError(error);return data;}
  async function adminRsvps(){if(!cloud)return readLocal().rsvps;const s=await client();const {data,error}=await s.from('baby_rsvps').select('id,guest_name,attending,total_people,message,updated_at').order('updated_at',{ascending:false});if(error)throw normalizeError(error);return data;}
  async function updateGift(gift){
    const body={name:String(gift.name||'').trim(),category:String(gift.category||'').trim(),description:String(gift.description||'').trim(),quantity:Number(gift.quantity),completed:Boolean(gift.completed),sort_order:Number(gift.sort_order)||100};
    if(!body.name||!body.category||body.quantity<1||!Number.isInteger(body.quantity)||body.quantity>1000)throw new Error('Confira nome, categoria e quantidade.');
    if(!cloud){let d=readLocal();let g=d.gifts.find(x=>x.id===gift.id);if(g){if(body.quantity<g.reserved)throw new Error('A quantidade não pode ser menor que as reservas atuais.');Object.assign(g,body);}else d.gifts.push({id:uid(),reserved:0,...body});saveLocal(d);return;}
    const s=await client();const out=gift.id?await s.from('baby_gifts').update(body).eq('id',gift.id):await s.from('baby_gifts').insert(body);if(out.error)throw normalizeError(out.error);
  }
  async function removeGift(id){if(!cloud){let d=readLocal();if(d.reservations.some(r=>r.gift_id===id))throw new Error('Exclua as reservas desse item antes.');d.gifts=d.gifts.filter(x=>x.id!==id);saveLocal(d);return;}const s=await client();const {error}=await s.from('baby_gifts').delete().eq('id',id);if(error)throw normalizeError(error);}
  async function removeReservation(id){if(!cloud){const d=readLocal();const r=d.reservations.find(x=>x.id===id);if(r){const g=d.gifts.find(x=>x.id===r.gift_id);if(g)g.reserved=Math.max(0,g.reserved-r.quantity);}d.reservations=d.reservations.filter(x=>x.id!==id);saveLocal(d);return;}const s=await client();const{error}=await s.from('baby_reservations').delete().eq('id',id);if(error)throw normalizeError(error);}
  async function removeRsvp(id){if(!cloud){let d=readLocal();d.rsvps=d.rsvps.filter(x=>x.id!==id);saveLocal(d);return;}const s=await client();const{error}=await s.from('baby_rsvps').delete().eq('id',id);if(error)throw normalizeError(error);}
  window.MariaStore={isCloud:cloud,client,listGifts,reserveGift,saveRsvp,getRsvpTotals,myDemoRsvp,adminSignIn,adminSession,adminSignOut,adminReservations,adminRsvps,updateGift,removeGift,removeReservation,removeRsvp};
})();
