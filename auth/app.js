import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';
const el=id=>document.getElementById(id);
const status=(msg,error=false)=>{el('status').textContent=msg;el('status').classList.toggle('error',error)};
const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(SUPABASE_URL)
  && /^(sb_publishable_|eyJ)/.test(SUPABASE_PUBLISHABLE_KEY);
let db=null,user=null,mode='in';
function toggle(next){
 mode=next;const up=mode==='up';
 el('tabIn').setAttribute('aria-pressed',String(!up));
 el('tabUp').setAttribute('aria-pressed',String(up));
 el('nameRow').hidden=!up;el('kindRow').hidden=!up;
 el('vehicleRow').hidden=!up||el('kind').value!=='driver';
 el('submit').textContent=up?'Cadastrar':'Entrar';
 el('status').textContent='';
}
async function profile(current){
 const existing=await db.from('vaigo_profiles').select('id,display_name,role').eq('id',current.id).maybeSingle();
 if(existing.error)throw existing.error;
 if(existing.data)return existing.data;
 const name=String(current.user_metadata?.display_name||current.email?.split('@')[0]||'Passageiro VaiGo').trim().slice(0,100);
 const result=await db.from('vaigo_profiles').insert({id:current.id,display_name:name.length>=2?name:'Passageiro VaiGo',role:'rider'}).select('id,display_name,role').single();
 if(result.error)throw result.error;
 return result.data;
}
async function application(){
 const r=await db.from('vaigo_driver_applications').select('status,vehicle_model').eq('user_id',user.id).maybeSingle();
 if(r.error)throw r.error;
 return r.data;
}
async function requestDriver(model){
 const vehicle=String(model||'').trim();
 if(vehicle.length<2)throw Error('Informe o modelo do veículo.');
 const prev=await application();
 if(prev)return prev;
 const r=await db.from('vaigo_driver_applications').insert({user_id:user.id,vehicle_model:vehicle,status:'pending'}).select('status,vehicle_model').single();
 if(r.error)throw r.error;
 return r.data;
}
async function refresh(){
 const r=await db.auth.getUser();
 user=r.data?.user||null;
 el('account').hidden=!!user;
 el('tabs').hidden=!!user;
 el('profile').hidden=!user;
 if(!user)return;
 const p=await profile(user);
 el('welcome').textContent='Olá, '+p.display_name;
 let app=await application();
 const meta=user.user_metadata||{};
 if(!app&&meta.wants_driver&&meta.vehicle_model)app=await requestDriver(meta.vehicle_model);
 el('driverStatus').textContent=app?'Cadastro motorista: '+app.status:'Perfil passageiro ativo; solicite análise para trabalhar como motorista.';
 el('apply').disabled=!!app;
 if(app)el('driverVehicle').value=app.vehicle_model;
}
el('tabIn').addEventListener('click',()=>toggle('in'));
el('tabUp').addEventListener('click',()=>toggle('up'));
el('kind').addEventListener('change',()=>el('vehicleRow').hidden=el('kind').value!=='driver');
el('account').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!db)return status('Projeto Supabase do VaiGo ainda não conectado.',true);
 const btn=el('submit');btn.disabled=true;
 try{
  const email=el('email').value.trim(),password=el('password').value;
  if(mode==='in'){
   const r=await db.auth.signInWithPassword({email,password});
   if(r.error)throw r.error;
   await refresh();status('Acesso realizado com sucesso.');
  }else{
   const name=el('name').value.trim(),wantsDriver=el('kind').value==='driver',vehicle=el('vehicle').value.trim();
   if(name.length<2)throw Error('Informe seu nome.');
   if(wantsDriver&&vehicle.length<2)throw Error('Informe o modelo do veículo.');
   const r=await db.auth.signUp({email,password,options:{
    emailRedirectTo:new URL('./auth.html',location.href).href,
    data:{display_name:name,wants_driver:wantsDriver,vehicle_model:wantsDriver?vehicle:''}
   }});
   if(r.error)throw r.error;
   if(r.data?.session){await refresh();status('Cadastro concluído.');}
   else status('Confira seu e-mail para confirmar a conta. Depois volte aqui e entre.');
  }
 }catch(e){status(e.message||'Erro na autenticação.',true)}
 finally{btn.disabled=false}
});
el('apply').addEventListener('click',async()=>{
 try{if(!user)throw Error('Entre na sua conta antes.');const app=await requestDriver(el('driverVehicle').value);el('driverStatus').textContent='Cadastro motorista: '+app.status;el('apply').disabled=true;status('Solicitação enviada para análise.')}
 catch(e){status(e.message,true)}
});
el('logout').addEventListener('click',async()=>{if(db){await db.auth.signOut();user=null;await refresh();status('Sessão encerrada.')}});
toggle('in');
if(!configured){
 el('account').querySelectorAll('input,select,button').forEach(input=>input.disabled=true);
 status('Aguardando projeto Supabase exclusivo do VaiGo. O formulário estará disponível depois da configuração.');
}else{
 db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 try{await refresh()}catch(e){status('Banco não configurado ou migrações ainda não aplicadas: '+e.message,true)}
}
