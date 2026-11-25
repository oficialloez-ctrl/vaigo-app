const {query}=require('../lib/db');
const {requireLogin}=require('../lib/session');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 if(!await requireLogin(req,res))return;
 if(req.method!=='GET')return res.status(405).end();
 const lat=Number(req.query.lat),lon=Number(req.query.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return res.status(400).end();
 try{
  const drivers=await query(`select round(d.lat::numeric,3) as lat,round(d.lon::numeric,3) as lon,0 as heading
   from zeca_piloto.motoristas d where situacao='aprovado' and online and visto>now()-interval '45 seconds'
   and abs(d.lat-$1)<0.15 and abs(d.lon-$2)<0.15 and not exists(select 1 from zeca_piloto.corridas r where r.motorista=d.email and r.estado in ('aceita','chegou','em_viagem')) limit 100`,[lat,lon]);
  return res.json({drivers});
 }catch{return res.status(503).json({error:'Frota indisponível.'});}
};
