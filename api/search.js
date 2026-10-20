const https=require('https');
const cache=new Map();
const get=url=>new Promise((resolve,reject)=>{const req=https.get(url,{headers:{'User-Agent':'VaiGoDemo/1.1 (prototype)','Accept':'application/json'}},res=>{let s='';res.on('data',x=>{s+=x;if(s.length>400000)req.destroy()});res.on('end',()=>{if(res.statusCode!==200)return reject(Error('HTTP '+res.statusCode));try{resolve(JSON.parse(s))}catch(e){reject(e)}})});req.setTimeout(8000,()=>req.destroy(Error('Timeout')));req.on('error',reject)});
const dist=(a,b,c,d)=>{const r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,q=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(q)))};
module.exports=async(req,res)=>{
if(req.method!=='GET')return res.status(405).json({results:[]});
const q=String(req.query.q||'').trim().slice(0,160),mode=String(req.query.mode||'suggest');
const rawLat=Number(req.query.lat),rawLon=Number(req.query.lon);const lat=req.query.lat!==undefined&&Number.isFinite(rawLat)&&Math.abs(rawLat)<=90?rawLat:-26.08,lon=req.query.lon!==undefined&&Number.isFinite(rawLon)&&Math.abs(rawLon)<=180?rawLon:-53.05;
if(q.length<3)return res.status(400).json({results:[]});
const key=[q,mode,lat.toFixed(2),lon.toFixed(2)].join('|'),previous=cache.get(key);
if(previous&&Date.now()-previous.at<120000)return res.json({results:previous.data});
const results=[];const house=(q.match(/(?:^|[\s,])(\d{1,6})(?:[\s,]|$)/)||[])[1]||null;
try{
const ph=await get('https://photon.komoot.io/api/?'+new URLSearchParams({q,limit:'12',lat:String(lat),lon:String(lon)}));
for(const f of ph.features||[]){const p=f.properties||{},c=f.geometry?.coordinates||[];if(c.length!==2||!Number.isFinite(Number(c[0]))||!Number.isFinite(Number(c[1]))||Math.abs(Number(c[0]))>180||Math.abs(Number(c[1]))>90)continue;results.push({name:p.housenumber&&p.street?p.street+', '+p.housenumber:p.name||p.street||'Local',hint:[p.street,p.city||p.county,p.state].filter(Boolean).join(', '),lat:c[1],lon:c[0],type:['shop','amenity','tourism','office'].includes(p.osm_key)?'place':'address',exactNumber:!!house&&String(p.housenumber||'')===house&&!!p.street,numberRequested:!!house});}
}catch(e){}
if(mode==='address'||results.length<7||house){
const queries=[q];if(!/francisco beltr|paran|\bpr\b|\bbrasil\b|\b[a-záàâãéêíóôõúç]+\s*-\s*[a-z]{2}\b/i.test(q))queries.unshift(q+', Francisco Beltrão, Paraná, Brasil');
for(const query of queries.slice(0,2)){
try{const out=await get('https://nominatim.openstreetmap.org/search?'+new URLSearchParams({q:query,format:'jsonv2',addressdetails:'1',limit:'8',countrycodes:'br','accept-language':'pt-BR'}));for(const p of out){if(!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lon))||Math.abs(Number(p.lat))>90||Math.abs(Number(p.lon))>180)continue;results.push({name:p.name||p.display_name.split(',').slice(0,2).join(','),hint:p.display_name,lat:Number(p.lat),lon:Number(p.lon),type:['highway','place'].includes(p.class)?'address':'place',exactNumber:!!house&&String(p.address?.house_number||'')===house,numberRequested:!!house});}if(out.length)break}catch(e){}
}
}
// Tenta geocodificação estruturada para rua+número, distinguindo o resultado real do centro da rua.
if(house){
const street=q.replace(/\b\d{1,6}\b/g,' ').replace(/,?\s*(Francisco Beltrão|PR|Paraná|Brasil).*$/i,'').replace(/[,\s]+$/,'').trim();
if(street.length>=3){try{
const structured='https://nominatim.openstreetmap.org/search?'+new URLSearchParams({street:house+' '+street,city:'Francisco Beltrão',state:'Paraná',country:'Brasil',format:'jsonv2',limit:'5',addressdetails:'1',countrycodes:'br'});
const found=await get(structured);
for(const p of found){if(!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lon))||Math.abs(Number(p.lat))>90||Math.abs(Number(p.lon))>180)continue;const addr=p.address||{};results.push({name:(addr.road||street)+(addr.house_number?', '+addr.house_number:''),hint:p.display_name,lat:Number(p.lat),lon:Number(p.lon),type:'address',exactNumber:String(addr.house_number||'')===house,numberRequested:true});}
}catch(e){}}
}
// Para buscas por nome de local, a fonte Photon também devolve POIs com localização.
 // O ponto da residência só recebe confirmação se o provedor devolver explicitamente o mesmo número.
const seen=new Set(),clean=results.filter(p=>{const key=p.lat.toFixed(4)+'|'+p.lon.toFixed(4)+'|'+p.name.toLowerCase();if(seen.has(key))return false;seen.add(key);return true}).map(p=>({...p,km:dist(lat,lon,p.lat,p.lon)})).sort((a,b)=>(b.exactNumber?1:0)-(a.exactNumber?1:0)||(a.km>30)-(b.km>30)||a.km-b.km).slice(0,15);
cache.set(key,{at:Date.now(),data:clean});return res.status(200).json({results:clean});
};