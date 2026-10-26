/* Camada de dados: demonstração local ou Supabase compartilhado. */
(function () {
  'use strict';
  const localKey = 'maria_helena_cha_data_v2';
  const tokenKey = 'maria_helena_rsvp_token_v1';
  const cfg = window.MARIA_CONFIG || {};
  const cloud = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  let supabasePromise;
  const initialGifts = [
    {id:'presente-01',name:"Almofada de amamentação",category:"Amamentação",description:"Unidade",quantity:1,icon:'🎁'},
    {id:'presente-02',name:"Chupeta tamanho 0",category:"Acessórios",description:"0 a 2 meses",quantity:1,icon:'🎁'},
    {id:'presente-03',name:"Chupeta tamanho 1",category:"Acessórios",description:"0 a 6 meses",quantity:1,icon:'🎁'},
    {id:'presente-04',name:"Naninha",category:"Enxoval",description:"Unidades",quantity:2,icon:'🎁'},
    {id:'presente-05',name:"Kit Mamadeiras Avent",category:"Alimentação",description:"Kit",quantity:1,icon:'🎁'},
    {id:'presente-06',name:"Escova para limpeza de mamadeiras",category:"Alimentação",description:"Unidade",quantity:1,icon:'🎁'},
    {id:'presente-07',name:"Meias",category:"Roupinhas",description:"Pares",quantity:10,icon:'🎁'},
    {id:'presente-08',name:"Fraldas de boca",category:"Enxoval",description:"Unidades",quantity:10,icon:'🎁'},
    {id:'presente-09',name:"Manta / cobertor",category:"Enxoval",description:"Unidades",quantity:5,icon:'🎁'},
    {id:'presente-10',name:"Toalha de banho com capuz",category:"Enxoval",description:"Unidades",quantity:6,icon:'🎁'},
    {id:'presente-11',name:"Kit mamãe e bebê Natura",category:"Cuidados",description:"Kits",quantity:6,icon:'🎁'},
    {id:'presente-12',name:"Saída de maternidade",category:"Roupinhas",description:"Conjunto",quantity:1,icon:'🎁'},
    {id:'presente-13',name:"Kit enxoval de berço",category:"Enxoval",description:"Kit",quantity:1,icon:'🎁'},
    {id:'presente-14',name:"Ninho redutor de berço",category:"Enxoval",description:"Unidade",quantity:1,icon:'🎁'},
    {id:'presente-15',name:"Body manga longa P",category:"Roupinhas",description:"Tamanho P",quantity:10,icon:'🎁'},
    {id:'presente-16',name:"Body manga longa M",category:"Roupinhas",description:"Tamanho M",quantity:10,icon:'🎁'},
    {id:'presente-17',name:"Body manga longa G",category:"Roupinhas",description:"Tamanho G",quantity:10,icon:'🎁'},
    {id:'presente-18',name:"Body manga curta P",category:"Roupinhas",description:"Tamanho P",quantity:10,icon:'🎁'},
    {id:'presente-19',name:"Body manga curta M",category:"Roupinhas",description:"Tamanho M",quantity:10,icon:'🎁'},
    {id:'presente-20',name:"Body manga curta G",category:"Roupinhas",description:"Tamanho G",quantity:10,icon:'🎁'},
    {id:'presente-21',name:"Macacão longo / curto com zíper P",category:"Roupinhas",description:"Tamanho P",quantity:10,icon:'🎁'},
    {id:'presente-22',name:"Macacão longo / curto com zíper M",category:"Roupinhas",description:"Tamanho M",quantity:10,icon:'🎁'},
    {id:'presente-23',name:"Macacão longo / curto com zíper G",category:"Roupinhas",description:"Tamanho G",quantity:10,icon:'🎁'},
    {id:'presente-24',name:"Calça de malha / mijões",category:"Roupinhas",description:"Tamanhos P, M ou G",quantity:10,icon:'🎁'},
    {id:'presente-25',name:"Conjuntos / vestidos",category:"Roupinhas",description:"Unidades",quantity:10,icon:'🎁'},
    {id:'presente-26',name:"Jogo de lençol de berço",category:"Enxoval",description:"Jogos",quantity:2,icon:'🎁'},
    {id:'presente-27',name:"Pomada para assaduras",category:"Higiene",description:"Unidades",quantity:5,icon:'🎁'},
    {id:'presente-28',name:"Banheira",category:"Cuidados",description:"Unidade",quantity:1,icon:'🎁'},
    {id:'presente-29',name:"Kit primeiros cuidados",category:"Cuidados",description:"Kits",quantity:2,icon:'🎁'},
    {id:'presente-30',name:"Kit higiene",category:"Higiene",description:"Kits",quantity:10,icon:'🎁'},
    {id:'presente-31',name:"Lenços umedecidos",category:"Higiene",description:"Pacotes",quantity:15,icon:'🎁'},
    {id:'presente-32',name:"Fralda descartável RN",category:"Fraldas",description:"Huggies, MamyPoko ou Pampers",quantity:4,icon:'🎁'},
    {id:'presente-33',name:"Fralda descartável P",category:"Fraldas",description:"Huggies, MamyPoko ou Pampers",quantity:10,icon:'🎁'},
    {id:'presente-34',name:"Fralda descartável M",category:"Fraldas",description:"Huggies, MamyPoko ou Pampers",quantity:10,icon:'🎁'},
    {id:'presente-35',name:"Fralda descartável G",category:"Fraldas",description:"Huggies, MamyPoko ou Pampers",quantity:10,icon:'🎁'}
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
    const s=await client();const {data,error}=await s.from('baby_gifts').select('id,name,category,description,quantity,reserved,completed,sort_order').eq('active',true).order('sort_order',{ascending:true}).order('name',{ascending:true});if(error)throw normalizeError(error);return data;
  }
  async function reserveGift({id,name,quantity,phone}){
    name=String(name||'').trim();quantity=Number(quantity);
    if(name.length<2||name.length>90||!Number.isInteger(quantity)||quantity<1||quantity>20)throw new Error('Confira seu nome e a quantidade escolhida.');
    if(!cloud){let d=readLocal(),g=d.gifts.find(x=>x.id===id);if(!g)throw new Error('Presente não encontrado.');if(g.completed||g.reserved+quantity>g.quantity)throw new Error('Essa quantidade não está mais disponível.');g.reserved+=quantity;d.reservations.unshift({id:uid(),gift_id:id,guest_name:name,quantity,created_at:new Date().toISOString()});saveLocal(d);return;}
    phone=String(phone||'').replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'');
    if(!/^([1-9][0-9])(?:[2-9][0-9]{7}|9[0-9]{8})$/.test(phone))
      throw new Error('Informe um WhatsApp com DDD válido.');
    const s=await client();const {error}=await s.rpc('reserve_baby_gift',{
      p_gift_id:id,p_guest_name:name,p_qty:quantity,p_guest_phone:phone
    });if(error)throw normalizeError(error);
  }
  async function saveRsvp({name,attending,people,message,phone}){
    name=String(name||'').trim();message=String(message||'').trim();people=attending?Number(people):0;
    phone=String(phone||'').replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'');
    if(name.length<2||name.length>90||message.length>350||(attending&&(!Number.isInteger(people)||people<1||people>10)))throw new Error('Confira os dados da confirmação.');
    if((attending||phone)&&!/^([1-9][0-9])(?:[2-9][0-9]{7}|9[0-9]{8})$/.test(phone))throw new Error('Informe um WhatsApp válido com DDD para receber o local.');
    const token=getRsvpToken();
    if(!cloud){const d=readLocal();const found=d.rsvps.find(x=>x.secret===token);const body={secret:token,guest_name:name,attending:!!attending,total_people:people,phone,message,updated_at:new Date().toISOString(),location_sent_at:found?.phone===phone&&found?.attending===!!attending?found?.location_sent_at||null:null};if(found)Object.assign(found,body);else d.rsvps.unshift({id:uid(),...body});saveLocal(d);return;}
    const s=await client();const {error}=await s.rpc('save_baby_rsvp',{p_secret:token,p_guest_name:name,p_attending:!!attending,p_total_people:people,p_message:message,p_phone:phone});if(error)throw normalizeError(error);
  }
  async function getRsvpTotals(){
    if(!cloud){const r=readLocal().rsvps.filter(x=>x.attending);return{people:r.reduce((a,b)=>a+b.total_people,0),guests:r.length};}
    const s=await client();const {data,error}=await s.rpc('baby_rsvp_totals');if(error)throw normalizeError(error);return data?.[0]||{people:0,guests:0};
  }
  function myDemoRsvp(){const r=readLocal().rsvps.find(x=>x.secret===getRsvpToken());return r||null;}
  async function verifyAdmin(s){
    const {data:userData,error:userError}=await s.auth.getUser();
    if(userError||!userData?.user)throw new Error('Sua sessão expirou. Faça login novamente.');
    const {data:membership,error}=await s.from('baby_admins').select('user_id').eq('user_id',userData.user.id).maybeSingle();
    if(error)throw new Error('Falha ao conferir autorização: '+error.message);
    if(!membership)throw new Error('Esta conta não tem permissão de organizadora.');
    return true;
  }
  async function adminSignIn(email,password){
    const s=await client();const {data,error}=await s.auth.signInWithPassword({email,password});
    if(error)throw normalizeError(error);
    try {await verifyAdmin(s);return data;}
    catch(e){await s.auth.signOut();throw e;}
  }
  async function adminSession(){
    if(!cloud)return{demo:true};
    const s=await client();const {data}=await s.auth.getSession();
    if(!data?.session)return null;
    await verifyAdmin(s);return data.session;
  }
  async function adminSignOut(){if(cloud){const s=await client();await s.auth.signOut();}}
  async function adminReservations(){if(!cloud)return readLocal().reservations;const s=await client();const {data,error}=await s.from('baby_reservations').select('id,gift_id,guest_name,guest_phone,quantity,created_at,baby_gifts(name,active)').order('created_at',{ascending:false});if(error)throw normalizeError(error);return data;}
  async function adminRsvps(){if(!cloud)return readLocal().rsvps;const s=await client();const {data,error}=await s.from('baby_rsvps').select('id,guest_name,attending,total_people,phone,location_sent_at,message,updated_at').order('updated_at',{ascending:false});if(error)throw normalizeError(error);return data;}
  async function updateGift(gift){
    const body={name:String(gift.name||'').trim(),category:String(gift.category||'').trim(),description:String(gift.description||'').trim(),quantity:Number(gift.quantity),completed:Boolean(gift.completed),sort_order:Number(gift.sort_order)||100};
    if(!body.name||!body.category||body.quantity<1||!Number.isInteger(body.quantity)||body.quantity>1000)throw new Error('Confira nome, categoria e quantidade.');
    if(!cloud){let d=readLocal();let g=d.gifts.find(x=>x.id===gift.id);if(g){if(body.quantity<g.reserved)throw new Error('A quantidade não pode ser menor que as reservas atuais.');Object.assign(g,body);}else d.gifts.push({id:uid(),reserved:0,...body});saveLocal(d);return;}
    const s=await client();const out=gift.id?await s.from('baby_gifts').update(body).eq('id',gift.id):await s.from('baby_gifts').insert(body);if(out.error)throw normalizeError(out.error);
  }
  async function removeGift(id){if(!cloud){let d=readLocal();if(d.reservations.some(r=>r.gift_id===id))throw new Error('Exclua as reservas desse item antes.');d.gifts=d.gifts.filter(x=>x.id!==id);saveLocal(d);return;}const s=await client();const {error}=await s.from('baby_gifts').delete().eq('id',id);if(error)throw normalizeError(error);}
  async function removeReservation(id){if(!cloud){const d=readLocal();const r=d.reservations.find(x=>x.id===id);if(r){const g=d.gifts.find(x=>x.id===r.gift_id);if(g)g.reserved=Math.max(0,g.reserved-r.quantity);}d.reservations=d.reservations.filter(x=>x.id!==id);saveLocal(d);return;}const s=await client();const{error}=await s.from('baby_reservations').delete().eq('id',id);if(error)throw normalizeError(error);}
  async function setLocationSent(id,sent){
    if(!cloud){const d=readLocal();const r=d.rsvps.find(x=>x.id===id);if(!r)throw new Error('Convidado não encontrado.');r.location_sent_at=sent?new Date().toISOString():null;saveLocal(d);return;}
    const s=await client();const {error}=await s.from('baby_rsvps').update({location_sent_at:sent?new Date().toISOString():null}).eq('id',id);
    if(error)throw normalizeError(error);
  }
  async function removeRsvp(id){if(!cloud){let d=readLocal();d.rsvps=d.rsvps.filter(x=>x.id!==id);saveLocal(d);return;}const s=await client();const{error}=await s.from('baby_rsvps').delete().eq('id',id);if(error)throw normalizeError(error);}
  window.MariaStore={isCloud:cloud,client,listGifts,reserveGift,saveRsvp,getRsvpTotals,myDemoRsvp,adminSignIn,adminSession,adminSignOut,adminReservations,adminRsvps,setLocationSent,updateGift,removeGift,removeReservation,removeRsvp};
})();
