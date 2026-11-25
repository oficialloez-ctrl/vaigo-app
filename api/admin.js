const {query}=require('../lib/db');
const {requireLogin,OWNER,sameOrigin}=require('../lib/session');
module.exports=async(req,res)=>{
  const user=await requireLogin(req,res);
  if(!user)return;
  if(!user.admin)return res.status(403).json({error:'Acesso restrito.'});
  try{
    if(req.method==='GET'){
      const admins=user.owner?await query('select email from zeca_admin_grants order by email',[]):[];
      return res.json({admins:admins.map(row=>row.email)});
    }
    if(req.method!=='POST'||!sameOrigin(req))return res.status(403).end();
    const {action}=req.body||{};
    if(action==='settings'){
      const ranges={fuelPrice:[0.1,30],kmPerLiter:[1,60],commission:[0,80],baseFare:[0,100],priceKm:[0,50],priceMinute:[0,10]};
      const values={};
      for(const [key,[min,max]] of Object.entries(ranges)){
        const n=req.body.settings?.[key];if(!Number.isFinite(n)||n<min||n>max)return res.status(400).json({error:'Confira os valores.'});values[key]=n;
      }
      await query('insert into zeca_config values(1,$1::jsonb) on conflict(id) do update set settings=excluded.settings',[JSON.stringify(values)]);
    }else{
      if(!user.owner)return res.status(403).json({error:'Apenas o titular pode alterar acessos.'});
      const email=String(req.body.email||'').trim().toLowerCase();
      if(email===OWNER||email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Informe outro e-mail válido.'});
      if(action==='grant')await query('insert into zeca_admin_grants values ($1) on conflict do nothing',[email]);
      else if(action==='revoke')await query('delete from zeca_admin_grants where email=$1',[email]);
      else return res.status(400).end();
    }
    return res.json({ok:true});
  }catch{return res.status(503).json({error:'Erro ao acessar a administração.'});}
};
