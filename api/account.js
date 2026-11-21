const {randomBytes}=require('node:crypto');
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
      const [cfg]=await query('select settings from zeca_config where id=1',[]);
      return res.json({user,settings:cfg?.settings||{}});
    }
    if(req.method!=='POST'||!sameOrigin(req))return res.status(403).end();
    const {action,otp}=req.body||{};
    const cookie=(token,seconds)=>res.setHeader('Set-Cookie',cookieName+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+seconds);
    if(action==='logout'){
      await query('delete from zeca_sessions where digest=$1',[sessionKey(req)]);
      cookie('',0);return res.status(204).end();
    }
    const email=String(req.body.email||'').trim().toLowerCase();
    if(!['send','verify'].includes(action)||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Informe um e-mail válido.'});
    if(action==='verify'&&!/^\d{6}$/.test(otp))return res.status(400).json({error:'Digite os seis números do código.'});
    const ip=req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'';
    if(!await allowed(action+':ip:'+ip,60)||!await allowed(action+':email:'+email,action==='send'?5:12))return res.status(429).json({error:'Muitas tentativas. Aguarde alguns minutos.'});
    const send=action==='send';
    const response=await fetch(auth+(send?'/email-otp/send-verification-otp':'/sign-in/email-otp'),{method:'POST',
      headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(send?{email,type:'sign-in'}:{email,otp}),signal:AbortSignal.timeout(15000)});
    const result=await response.json();
    if(!response.ok)return res.status(response.status===429?429:400).json({error:send?'Não foi possível enviar o código. Tente novamente em instantes.':'Código inválido ou expirado.'});
    if(send)return res.json({sent:true});
    if(!result.token||result.user?.emailVerified!==true||result.user.email.toLowerCase()!==email)return res.status(401).json({error:'Confirme seu e-mail para entrar.'});
    const token=randomBytes(32).toString('hex');
    await query(`with clean as (delete from zeca_sessions where expires_at<=now())
      insert into zeca_sessions values ($1,$2,now()+interval '7 days')`,[hash(token),email]);
    cookie(token,604800);return res.json({ok:true});
  }catch{return res.status(503).json({error:'Serviço indisponível. Tente novamente.'});}
};
