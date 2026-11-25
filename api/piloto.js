const {randomUUID}=require('node:crypto');
const {requireLogin,sameOrigin}=require('../lib/session');
const {query}=require('../lib/db');
const trips='zeca_piloto.corridas',drivers='zeca_piloto.motoristas';
const active="('buscando','aceita','chegou','em_viagem')";
const categories=['eco','comfort','xl'];
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const fresh="d.online and d.visto>now()-interval '45 seconds' and d.situacao='aprovado'";
const eligible=`${fresh} and d.categoria=r.categoria and r.passageiro<>d.email
 and abs(d.lat-(r.origem->>'lat')::float8)<0.10 and abs(d.lon-(r.origem->>'lon')::float8)<0.10
 and not exists(select 1 from ${trips} b where (b.motorista=d.email or b.passageiro=d.email) and b.estado in ${active})
 and not exists(select 1 from zeca_piloto.recusas x where x.corrida=r.id and x.motorista=d.email)`;
function fail(status,message){throw Object.assign(Error(message),{status});}
function text(v,max){if(typeof v!=='string'||!v.trim()||v.length>max)fail(400,'Confira os campos.');return v.trim();}
function point(v){
 if(!v||!Number.isFinite(v.lat)||!Number.isFinite(v.lon)||Math.abs(v.lat+26.079)>.22||Math.abs(v.lon+53.053)>.22)fail(400,'Ponto fora da área de teste de Francisco Beltrão.');
 return {lat:v.lat,lon:v.lon,name:text(v.name,240)};
}
async function read(user){
 const email=user.email;
 await query(`update ${trips} set estado='expirada',ator='sistema',alterada=now() where estado='buscando' and alterada<now()-interval '5 minutes'`,[]);
 const [profile,rides,offers,requests]=await Promise.all([
 query(`select nome,veiculo,placa,categoria,situacao,online and visto>now()-interval '45 seconds' as online from ${drivers} where email=$1`,[email]),
 query(`select r.id,r.estado,r.origem,r.destino,r.km,r.minutos,r.pagamento,r.alterada,r.passageiro=$1 as sou_passageiro,d.nome,d.veiculo,d.placa,
 case when r.estado in ('aceita','chegou','em_viagem') and d.visto>now()-interval '45 seconds' then d.lat end as lat,
 case when r.estado in ('aceita','chegou','em_viagem') and d.visto>now()-interval '45 seconds' then d.lon end as lon,
 (select estrelas from zeca_piloto.avaliacoes where corrida=r.id and autor=$1) as nota
 from ${trips} r left join ${drivers} d on r.motorista=d.email where (r.passageiro=$1 or r.motorista=$1) and r.estado<>'cotacao' order by (r.estado in ${active}) desc,r.alterada desc limit 20`,[email]),
 query(`select r.id,r.km,r.minutos,r.categoria from ${trips} r join ${drivers} d on d.email=$1 where r.estado='buscando' and r.alterada>now()-interval '5 minutes' and ${eligible} order by r.alterada limit 8`,[email]),
 user.admin?query(`select email,nome,veiculo,placa,categoria,situacao from ${drivers} order by (situacao='pendente') desc,nome limit 100`,[]):[]]);
 return {profile:profile[0]||null,rides,offers,requests};
}
async function change(user,b){
 const email=user.email,action=b.action;
 if(action==='invite'){
  if(!user.admin)fail(403,'Acesso administrativo necessário.');
  const invited=text(b.email,254).toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(invited))fail(400,'E-mail inválido.');
  return query('insert into zeca_piloto.convidados values($1) on conflict(email) do update set email=excluded.email returning email',[invited]);
 }
 if(action==='register'){
  const name=text(b.name,80),vehicle=text(b.vehicle,80),plate=text(b.plate,8).replace('-','').toUpperCase();
  if(!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)||!categories.includes(b.category))fail(400,'Confira placa e categoria.');
  return query(`insert into ${drivers}(email,nome,veiculo,placa,categoria) values($1,$2,$3,$4,$5) on conflict(email) do update set nome=$2,veiculo=$3,placa=$4,categoria=$5,situacao='pendente',online=false where ${drivers}.situacao in ('pendente','rejeitado') returning situacao`,[email,name,vehicle,plate,b.category]);
 }
 if(action==='review'){
  if(!user.admin)fail(403,'Acesso administrativo necessário.');
  if(!['aprovado','bloqueado','rejeitado'].includes(b.status))fail(400,'Situação inválida.');
  return query(`with changed as(update ${drivers} set situacao=$1,online=false where email=$2 and not exists(select 1 from zeca_piloto.ocupacoes where email=$2) returning email)
    insert into zeca_piloto.eventos(ator,acao) select $3,$1||':'||email from changed returning seq`,[b.status,text(b.email,254),email]);
 }
 if(action==='position'||action==='offline'){
  if(action==='offline')return query(`update ${drivers} set online=false where email=$1 returning online`,[email]);
  const p=point({lat:b.lat,lon:b.lon,name:'GPS'});
  return query(`update ${drivers} set online=true,lat=$2,lon=$3,visto=now() where email=$1 and situacao='aprovado' returning online`,[email,p.lat,p.lon]);
 }
 if(action==='quote'){
  if(!user.admin&&!(await query('select 1 from zeca_piloto.convidados where email=$1',[email])).length)fail(403,'Solicite um convite para participar do teste.');
  const from=point(b.from),to=point(b.to);
  if(!categories.includes(b.category))fail(400,'Categoria inválida.');
  const [rate]=await query(`select count(*)::int as n from ${trips} where passageiro=$1 and criada>now()-interval '10 minutes'`,[email]);
  if(rate.n>=30)fail(429,'Aguarde antes de cotar novamente.');
  const url='https://router.project-osrm.org/route/v1/driving/'+from.lon+','+from.lat+';'+to.lon+','+to.lat+'?overview=false';
  const rr=await fetch(url,{signal:AbortSignal.timeout(8500)});
  const route=rr.ok&&(await rr.json()).routes?.[0];
  if(!route||!Number.isFinite(route.distance)||!Number.isFinite(route.duration)||route.distance<=0||route.duration<=0)fail(503,'Rota viária indisponível. Tente novamente.');
  return query(`insert into ${trips}(id,ator,passageiro,categoria,origem,destino,km,minutos) values($1,$2,$2,$3,$4::jsonb,$5::jsonb,$6,$7) returning id,km,minutos`,[randomUUID(),email,b.category,JSON.stringify(from),JSON.stringify(to),Math.max(.01,route.distance/1000).toFixed(2),Math.ceil(route.duration/60)]);
 }
 if(!uuid.test(b.id||''))fail(400,'Corrida inválida.');
 if(action==='confirm')return query(`update ${trips} set estado='buscando',ator=$2,alterada=now() where id=$1 and passageiro=$2 and estado='cotacao' and criada>now()-interval '5 minutes' and not exists(select 1 from ${trips} where motorista=$2 and estado in ${active}) returning id`,[b.id,email]);
 if(action==='refuse')return query(`insert into zeca_piloto.recusas select r.id,d.email from ${trips} r join ${drivers} d on d.email=$2 where r.id=$1 and r.estado='buscando' and ${eligible} on conflict do nothing returning corrida`,[b.id,email]);
 if(action==='accept')return query(`update ${trips} r set estado='aceita',motorista=d.email,ator=$2,alterada=now() from ${drivers} d where r.id=$1 and d.email=$2 and r.estado='buscando' and r.alterada>now()-interval '5 minutes' and ${eligible} returning r.id`,[b.id,email]);
 if(action==='cancel')return query(`update ${trips} set estado='cancelada',ator=$2,alterada=now() where id=$1 and (passageiro=$2 or motorista=$2) and estado in ('buscando','aceita','chegou') returning id`,[b.id,email]);
 const transitions={arrive:['aceita','chegou'],start:['chegou','em_viagem'],finish:['em_viagem','concluida']};
 if(Object.hasOwn(transitions,action)){
  const [before,after]=transitions[action];
  return query(`update ${trips} r set estado=$4,ator=$2,alterada=now() where r.id=$1 and r.motorista=$2 and r.estado=$3 and exists(select 1 from ${drivers} d where d.email=$2 and d.situacao='aprovado') returning id`,[b.id,email,before,after]);
 }
 if(action==='rate'&&Number.isInteger(b.stars)&&b.stars>=1&&b.stars<=5)return query(`insert into zeca_piloto.avaliacoes select id,$2,$3 from ${trips} where id=$1 and estado='concluida' and (passageiro=$2 or motorista=$2) on conflict do nothing returning estrelas`,[b.id,email,b.stars]);
 fail(400,'Operação inválida.');
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 if(process.env.VERCEL_ENV==='production')return res.status(403).json({error:'Operação restrita à homologação.'});
 try{
  const user=await requireLogin(req,res);if(!user)return;
  if(req.method==='GET')return res.json(await read(user));
  if(req.method!=='POST'||!sameOrigin(req))fail(403,'Origem não permitida.');
  const rows=await change(user,req.body||{});
  if(!rows.length)fail(409,'Operação indisponível. Confira o estado atualizado.');
  return res.json(rows[0]);
 }catch(e){const status=e.code==='23505'?409:e.status||503;return res.status(status).json({error:e.status?e.message:status===409?'Já existe uma corrida ativa.':'Serviço indisponível. Atualize o painel antes de repetir.'});}
};
