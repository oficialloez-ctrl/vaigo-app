const {query}=require('./db');
const area='area["name"="Francisco Beltrão"]["boundary"="administrative"]["admin_level"="8"]->.city;';
const tags=['shop','amenity','office','craft','tourism','leisure','healthcare','industrial','commercial'];
const filter=tags.map(tag=>'nwr(area.city)["'+tag+'"]["name"];').join('');
const statement='[out:json][timeout:20];'+area+'('+filter+');out tags center;';
let cached,expires=0;
async function snapshot(){
  if(cached&&Date.now()<expires)return cached;
  const [row]=await query('select settings from zeca_config where id=4',[]);
  cached=row?.settings||{places:[]};
  expires=Date.now()+60000;
  return cached;
}
function convert(element){
  const t=element.tags||{},point=element.center||element;
  if(!t.name||!Number.isFinite(point.lat)||!Number.isFinite(point.lon))return null;
  const street=t['addr:street']||t['addr:place'],number=t['addr:housenumber'];
  const hint=[street,number,t['addr:suburb']||t['addr:neighbourhood'],t['addr:city']||'Francisco Beltrão','PR'].filter(Boolean).join(', ');
  return {name:t.name,aliases:[t.brand,t.alt_name,t.short_name,t.official_name].filter(Boolean).join(' '),hint:(!street?'Rua sem cadastro · ':'')+hint,lat:point.lat,lon:point.lon,type:'place',houseNumber:number||null,source:'OpenStreetMap'};
}
async function refresh(){
  const current=await snapshot();
  if(Date.now()-Date.parse(current.updated)<86400000)return current;
  const lease=await query(`insert into zeca_config(id,settings) values(3,to_jsonb(now())) on conflict(id) do update set settings=excluded.settings where (zeca_config.settings#>>'{}')::timestamptz < now()-interval '10 minutes' returning id`,[]);
  if(!lease.length)return current;
  let places;
  for(const host of ['maps.mail.ru/osm/tools/overpass','overpass.private.coffee','overpass-api.de']){
    try{
      const url=new URL('https://'+host+'/api/interpreter');
      url.searchParams.set('data',statement);
      const response=await fetch(url,{signal:AbortSignal.timeout(14000),headers:{Accept:'application/json','User-Agent':'ZECA-Mobilidade/1.0'}});
      if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json();
      if(data.remark||!Array.isArray(data.elements))throw Error('Resposta incompleta');
      const rows=data.elements.map(convert).filter(Boolean);
      if(!rows.length)throw Error('Consulta sem estabelecimentos');
      places=rows;break;
    }catch(error){console.warn('Catálogo municipal',host,error.message);}
  }
  if(!places)throw Error('Fontes indisponíveis');
  const next={updated:new Date().toISOString(),places};
  await query('insert into zeca_config(id,settings) values(4,$1::jsonb) on conflict(id) do update set settings=excluded.settings',[JSON.stringify(next)]);
  cached=next;expires=Date.now()+60000;
  return next;
}
module.exports={snapshot,refresh};
