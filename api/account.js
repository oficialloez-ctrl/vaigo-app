const {randomBytes,scrypt,timingSafeEqual}=require('node:crypto');
const derive=require('node:util').promisify(scrypt);
function passwordDigest(password,salt){
  return derive(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
}
const {query}=require('../lib/db');
const {account,sessionKey,cookieName,hash,sameOrigin}=require('../lib/session');
const auth='https://ep-fragrant-bonus-bdjm541h.neonauth.c-8.us-east-2.aws.neon.tech/neondb/auth';
const origin='https://vaigo-gps-corridas-git-fix-busca-endere-d9ea0b-oficialloez-3374.vercel.app';
async function allowed(key,limit){
  const bucket=Math.floor(Date.now()/600000);
  const rows=await query(`with clean as (delete from zeca_auth_limits where bucket<$2-1 and key<>$1)
    insert into zeca_auth_limits values($1,$2,1) on conflict(key) do update set bucket=$2,
    attempts=case when zeca_auth_limits.bucket=$2 then zeca_auth_limits.attempts+1 else 1 end returning attempts`,[hash(key),bucket]);
  return Number(rows[0].attempts)<=limit;
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  try {
    if(req.method==='GET'){
      const user=await account(req);
      if(!user)return res.json({user:null});
      const [cfg]=await query('select (select settings from zeca_config where id=1) as settings, (select first_name from zeca_profile_names where email=$1) as name',[user.email]);
      user.name=cfg?.name||(user.owner?'Luiz':'');
      return res.json({user,settings:cfg?.settings||{}});
    }
    if(req.method!=='POST'||!sameOrigin(req))return res.status(403).end();
    const {action,otp}=req.body||{};
    const cookie=(token,seconds)=>res.setHeader('Set-Cookie',cookieName+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+seconds);
    if(action==='profile'){
      const user=await account(req);
      if(!user)return res.status(401).json({error:'Entre para salvar seu nome.'});
      const name=String(req.body.name||'').trim().replace(/\s+/g,' ');
      if(!name||name.length>40)return res.status(400).json({error:'Informe um nome de até 40 caracteres.'});
      await query('insert into zeca_profile_names values($1,$2) on conflict(email) do update set first_name=excluded.first_name',[user.email,name]);
      return res.json({name});
    }
    if(action==='logout'){
      await query('delete from zeca_sessions where digest=$1',[sessionKey(req)]);
      cookie('',0);return res.status(204).end();
    }
    const email=String(req.body.email||'').trim().toLowerCase();
    if(!['send','verify','password','setPassword'].includes(action)||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Informe um e-mail válido.'});
    if((action==='verify'||action==='setPassword')&&!/^\d{6}$/.test(otp))return res.status(400).json({error:'Digite os seis números do código.'});
    const ip=req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'';
    if(!await allowed(action+':ip:'+ip,60)||!await allowed(action+':email:'+email,action==='send'?5:12))return res.status(429).json({error:'Muitas tentativas. Aguarde alguns minutos.'});
    const password=req.body.password;
    if(['password','setPassword'].includes(action) && (typeof password!=='string'||!password.length||password.length>128||(action==='setPassword'&&password.length<8)))return res.status(400).json({error:'Use uma senha de 8 a 128 caracteres.'});
    const token=randomBytes(32).toString('hex');
    if(action==='password'){
      const [stored]=await query('select salt,digest from zeca_passwords where email=$1',[email]);
      const actual=await passwordDigest(password,stored?.salt||'5eb07ab2de19413b619bfc099dd08b21');
      if(!stored||!timingSafeEqual(actual,Buffer.from(stored.digest,'hex')))return res.status(401).json({error:'E-mail ou senha incorretos.'});
      const rows=await query(`insert into zeca_sessions select $1,email,now()+interval '7 days' from zeca_passwords
        where email=$2 and digest=$3 for share returning email`,[hash(token),email,stored.digest]);
      if(!rows.length)return res.status(401).json({error:'Entre com a senha atual.'});
    }else{
      const send=action==='send';
      const response=await fetch(auth+(send?'/email-otp/send-verification-otp':'/sign-in/email-otp'),{method:'POST',
        headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(send?{email,type:'sign-in'}:{email,otp}),signal:AbortSignal.timeout(15000)});
      const result=await response.json();
      if(!response.ok)return res.status(response.status===429?429:400).json({error:send?'Não foi possível enviar o código. Tente novamente em instantes.':'Código inválido ou expirado.'});
      if(send)return res.json({sent:true});
      if(!result.token||result.user?.emailVerified!==true||result.user.email.toLowerCase()!==email)return res.status(401).json({error:'Confirme seu e-mail para entrar.'});
      if(action==='setPassword'){
        const salt=randomBytes(16).toString('hex'),digest=(await passwordDigest(password,salt)).toString('hex');
        await query(`with credential as (insert into zeca_passwords values($1,$2,$3)
          on conflict(email) do update set salt=excluded.salt,digest=excluded.digest returning email),
          revoke as (delete from zeca_sessions where email=$1)
          insert into zeca_sessions select $4,email,now()+interval '7 days' from credential`,[email,salt,digest,hash(token)]);
      }else{
        await query(`with clean as (delete from zeca_sessions where expires_at<=now())
          insert into zeca_sessions values ($1,$2,now()+interval '7 days')`,[hash(token),email]);
      }
    }
    cookie(token,604800);return res.json({ok:true});
  }catch{return res.status(503).json({error:'Serviço indisponível. Tente novamente.'});}
};
