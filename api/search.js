const https=require('https');
const cache=new Map();
const get=url=>new Promise((resolve,reject)=>{const req=https.get(url,{headers:{'User-Agent':'VaiGoDemo/1.1 (prototype)','Accept':'application/json'}},res=>{let s='';res.on('data',x=>{s+=x;if(s.length>400000)req.destroy()});res.on('end',()=>{if(res.statusCode!==200)return reject(Error('HTTP '+res.statusCode));try{resolve(JSON.parse(s))}catch(e){reject(e)}})});req.setTimeout(8000,()=>req.destroy(Error('Timeout')));req.on('error',reject)});
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const dist=(a,b,c,d)=>{const r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,q=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(q)))};
module.exports=async(req,res)=>{
if(req.method!=='GET')return res.status(405).json({results:[]});
const q=String(req.query.q||'').trim().slice(0,160),mode=String(req.query.mode||'suggest');
const rawLat=Number(req.query.lat),rawLon=Number(req.query.lon);const hasCoords=req.query.lat!==undefined&&req.query.lon!==undefined&&Number.isFinite(rawLat)&&Number.isFinite(rawLon)&&Math.abs(rawLat)<=90&&Math.abs(rawLon)<=180;const lat=hasCoords?rawLat:-26.08,lon=hasCoords?rawLon:-53.05;
if(q.length<3)return res.status(400).json({results:[]});
const key=[normalize(q),mode,lat.toFixed(3),lon.toFixed(3)].join('|'),previous=cache.get(key);
if(previous&&Date.now()-previous.at<120000)return res.json({results:previous.data});
const results=[];const house=(q.match(/(?:^|[\s,])(\d{1,6})(?:[\s,]|$)/)||[])[1]||null;
const streetQuery=normalize(q.replace(/\b\d{1,6}\b/g,' ').replace(/\b(rua|r|avenida|av|travessa|tv)\b/g,' ').replace(/[^\p{L}\p{N} ]/gu,' ')).replace(/\s+/g,' ').trim();
const streetTokens=streetQuery.split(' ').filter(t=>t.length>1);
const streetOnly=q.replace(/(?:^|[\s,])\d{1,6}(?=[\s,]|$)/g,' ').replace(/\s+/g,' ').trim();
const addPhoton=(data)=>{for(const f of data.features||[]){const p=f.properties||{},c=f.geometry?.coordinates||[];if(c.length!==2||!Number.isFinite(Number(c[0]))||!Number.isFinite(Number(c[1])))continue;const number=String(p.housenumber||'').trim();results.push({name:number&&p.street?p.street+', '+number:p.name||p.street||'Local',hint:[p.street,p.city||p.county,p.state].filter(Boolean).join(', '),lat:Number(c[1]),lon:Number(c[0]),type:['shop','amenity','tourism','office'].includes(p.osm_key)?'place':'address',houseNumber:number||null,exactNumber:!!house&&number===house&&!!p.street,numberRequested:!!house});}};
try{addPhoton(await get('https://photon.komoot.io/api/?'+new URLSearchParams({q,limit:'20',lat:String(lat),lon:String(lon)})));}catch(e){}
if(house&&streetOnly.length>=3){try{addPhoton(await get('https://photon.komoot.io/api/?'+new URLSearchParams({q:streetOnly,limit:'30',lat:String(lat),lon:String(lon)})));}catch(e){}}

if(mode==='address'||results.length<7||house){
const queries=[q];const normalized=normalize(q);if(normalized!==q.toLowerCase())queries.push(normalized);
for(const query of queries){
try{const out=await get('https://nominatim.openstreetmap.org/search?'+new URLSearchParams({q:query,format:'jsonv2',addressdetails:'1',limit:'8',countrycodes:'br','accept-language':'pt-BR',viewbox:[lon-0.5,lat+0.5,lon+0.5,lat-0.5].join(','),bounded:'0'}));for(const p of out){if(!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lon))||Math.abs(Number(p.lat))>90||Math.abs(Number(p.lon))>180)continue;results.push({name:p.name||p.display_name.split(',').slice(0,2).join(','),hint:p.display_name,lat:Number(p.lat),lon:Number(p.lon),type:['highway','place'].includes(p.class)?'address':'place',houseNumber:p.address?.house_number||null,exactNumber:!!house&&String(p.address?.house_number||'')===house,numberRequested:!!house});}if(out.length)break}catch(e){}
}
}
// Tenta geocodificação estruturada para rua+número, distinguindo o resultado real do centro da rua.
if(house){
const street=q.replace(/\b\d{1,6}\b/g,' ').replace(/[,\s]+$/,'').trim();
if(street.length>=3&&hasCoords){try{
const structured='https://nominatim.openstreetmap.org/search?'+new URLSearchParams({q:house+' '+street,format:'jsonv2',limit:'5',addressdetails:'1',countrycodes:'br',viewbox:[lon-0.35,lat+0.35,lon+0.35,lat-0.35].join(','),bounded:'0'});
const found=await get(structured);
for(const p of found){if(!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lon))||Math.abs(Number(p.lat))>90||Math.abs(Number(p.lon))>180)continue;const addr=p.address||{};results.push({name:(addr.road||street)+(addr.house_number?', '+addr.house_number:''),hint:p.display_name,lat:Number(p.lat),lon:Number(p.lon),type:'address',houseNumber:addr.house_number||null,exactNumber:String(addr.house_number||'')===house,numberRequested:true});}
}catch(e){}}
}
// Para buscas por nome de local, a fonte Photon também devolve POIs com localização.
 // O ponto da residência só recebe confirmação se o provedor devolver explicitamente o mesmo número.
const score=p=>{const name=normalize((p.name||'')+' '+(p.hint||'')).replace(/[^\p{L}\p{N} ]/gu,' ');const hits=streetTokens.filter(t=>name.split(/\s+/).includes(t)).length;const match=streetTokens.length?hits/streetTokens.length:1;const km=dist(lat,lon,p.lat,p.lon);const exact=!!p.exactNumber&&match>=0.8;const nearbyNumber=house&&p.houseNumber&&Number.isFinite(Number(p.houseNumber))?Math.abs(Number(p.houseNumber)-Number(house)):null;return {match,km,exact,rank:match*100+(exact?60:0)+(nearbyNumber!==null?Math.max(0,25-nearbyNumber/15):0)-Math.min(km,1000)*0.8};};
const seen=new Set(),clean=results.map(p=>{const sc=score(p);return {...p,exactNumber:sc.exact,km:sc.km,_rank:sc.rank,_match:sc.match};}).filter(p=>p._match>=0.6&&(!hasCoords||p.km<=80)).filter(p=>{const k=p.lat.toFixed(4)+'|'+p.lon.toFixed(4)+'|'+normalize(p.name);if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>b._rank-a._rank).slice(0,15).map(({_rank,_match,...p})=>p);
cache.set(key,{at:Date.now(),data:clean});return res.status(200).json({results:clean});
};