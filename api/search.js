const {requireLogin} = require('../lib/session');
const {parseAddress}=require('./_address');
const cnefe=require('./_cnefe');
const {snapshot}=require('../lib/businesses');
const https=require('https');
const cache=new Map();
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const distance=(a,b,c,d)=>{const r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,q=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(q)))};
function get(url) {
 return new Promise((resolve,reject)=>{
  const request=https.get(url,{headers:{'User-Agent':'ZECA-Prototype/1.3 (non-commercial testing)',Accept:'application/json'}},response=>{
   let body='';
   response.setEncoding('utf8');
   response.on('data',chunk=>{
    body+=chunk;
    if(body.length>350000) request.destroy(new Error('Resposta excessiva'));
   });
   response.on('error',reject);
   response.on('aborted',()=>reject(new Error('Resposta interrompida')));
   response.on('end',()=>{
    if(response.statusCode!==200) return reject(new Error('HTTP '+response.statusCode));
    try { resolve(JSON.parse(body)); } catch(error) { reject(error); }
   });
  });
  const deadline=setTimeout(()=>request.destroy(new Error('Tempo esgotado')),4200);
  request.on('close',()=>clearTimeout(deadline));
  request.on('error',reject);
 });
}
const placeCategories=new Set(['shop','amenity','tourism','office','craft','leisure','healthcare','industrial','commercial']);
function searchPoint({label,category,road,number,area,city,state,description,lat,lon},house){
 if(lat==null||lon==null||!Number.isFinite(+lat)||!Number.isFinite(+lon))return null;
 const isPlace=Boolean(label)&&placeCategories.has(category);
 const address=[road,number].filter(Boolean).join(', ');
 const name=isPlace?label:(road&&number?address:label||road||description?.split(',')[0]);
 if(!name)return null;
 const hint=[address,area,city,state].filter(Boolean).join(', ')||description||'';
 return {name,hint,lat:+lat,lon:+lon,type:isPlace?'place':'address',houseNumber:number?String(number):null,numberRequested:!isPlace&&!!house};
}
module.exports=async(req,res)=>{
 if(!await requireLogin(req,res))return;
 if(req.method!=='GET')return res.status(405).json({results:[]});
 const q=String(req.query.q||'').trim().slice(0,160),mode=String(req.query.mode||'suggest');
 if(q.length<3)return res.status(400).json({results:[]});
 const a=Number(req.query.lat),b=Number(req.query.lon),hasCoords=req.query.lat!==undefined&&req.query.lon!==undefined&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)<=90&&Math.abs(b)<=180;
 const lat=hasCoords?a:-26.08,lon=hasCoords?b:-53.05;
 const key=[norm(q),mode,lat.toFixed(3),lon.toFixed(3)].join('|');
 const old=cache.get(key);if(old&&Date.now()-old.at<120000)return res.json(old.data);
 const {street,house,city}=parseAddress(q);
 const streetTerms=norm(street).replace(/\b(rua|r|avenida|av|travessa|tv)\b/g,' ').split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>1);
 const preferredCity=norm(city).includes('francisco beltrao')?'francisco beltrao':(!city&&distance(lat,lon,-26.079,-53.053)<30?'francisco beltrao':norm(city.split(',')[0]));
 const local=cnefe.lookup({q,lat,lon});
 const inRegion=distance(lat,lon,-26.079,-53.053)<100;
 const historic=inRegion?cnefe.lookupPlaces(q):[];
 if(local.length && !historic.length && (house || /(?:s\s*\/\s*n|sem n[uú]mero)/i.test(q))){
  const exact=local.some(point=>point.exactNumber);
  const data={results:local,numberFound:exact,requestedNumber:exact?house:null,partial:false,providerStatus:'ok'};
  return res.status(200).json(data);
 }
 const candidates=[q];
 if(house&&street.length>2)candidates.push([street,city].filter(Boolean).join(', '));
 if(!house&&city)candidates.push(street);
 if(house&&street.length>2)candidates.push(street);
 const queries=[...new Set(candidates)].slice(0,3);
 const tasks=queries.map(query=>get('https://photon.komoot.io/api/?'+new URLSearchParams({q:query,limit:'20',lat:String(lat),lon:String(lon)})).then(data=>({kind:'photon',data})));
 // Uma única consulta ao Nominatim por busca evita sequências longas e respeita melhor o serviço público.
 if(mode==='address')tasks.push(get('https://nominatim.openstreetmap.org/search?'+new URLSearchParams({q,format:'jsonv2',addressdetails:'1',limit:'10',countrycodes:'br','accept-language':'pt-BR',viewbox:[lon-0.45,lat+0.45,lon+0.45,lat-0.45].join(','),bounded:'0'})).then(data=>({kind:'nominatim',data})));
 if(distance(lat,lon,-26.079,-53.053)<100){
  tasks.push(snapshot().then(({places})=>({kind:'catalog',data:places})));
 }
 const settled=await Promise.allSettled(tasks);
 const found=[];
 for(const item of settled){if(item.status!=='fulfilled')continue;const {kind,data}=item.value;
  if(kind==='catalog')for(const p of data){
   const words=norm(p.name+' '+p.aliases).split(/[^\p{L}\p{N}]+/u);
   if(streetTerms.length&&streetTerms.every(t=>words.some(w=>w.startsWith(t))))found.push(p);
  }
  if(kind==='photon')for(const feature of data.features||[]){
   const p=feature.properties||{}, [lon,lat]=feature.geometry?.coordinates||[];
   const point=searchPoint({label:p.name,category:p.osm_key,road:p.street,number:p.housenumber,area:p.district,city:p.city||p.county,state:p.state,lat,lon},house);
   if(point)found.push(point);
  }
  if(kind==='nominatim')for(const p of data||[]){
   const a=p.address||{},category=p.category||p.class;
   const point=searchPoint({label:p.name||a[category],category,road:a.road||a.pedestrian,number:a.house_number,area:a.suburb||a.neighbourhood,city:a.city||a.town||a.village||a.municipality,state:a.state,description:p.display_name,lat:p.lat,lon:p.lon},house);
   if(point)found.push(point);
  }
 }
 found.unshift(...local);
 found.push(...historic);
 const seen=new Set();
 const ranked=found.map(p=>{const tokens=norm(p.name+' '+p.hint).split(/[^\p{L}\p{N}]+/u);const placeWords=p.type==='place'?norm(p.name+' '+(p.aliases||'')).split(/[^\p{L}\p{N}]+/u):[];
 const hits=streetTerms.filter(t=>tokens.includes(t)||placeWords.some(w=>w.startsWith(t))).length;
 const nameMatch=placeWords.length&&streetTerms.length&&streetTerms.every(t=>placeWords.some(w=>w.startsWith(t)));const match=streetTerms.length?hits/streetTerms.length:1;const km=distance(lat,lon,p.lat,p.lon);const inCity=!!preferredCity&&norm(p.hint).includes(preferredCity);const roadKey=value=>norm(value).replace(/^(rua|r\.?|avenida|av\.?|travessa|tv\.?)\s+/,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();const exact=p.type!=='place'&&!!house&&p.houseNumber===house&&roadKey(p.name.split(',')[0])===roadKey(street)&&(!city||inCity);const numberDiff=house&&p.houseNumber&&/^\d+$/.test(p.houseNumber)?Math.abs(+p.houseNumber-+house):null;return {...p,km,exactNumber:exact,_match:match,_rank:match*100+(nameMatch?65:0)+(p.type==='place'&&norm(p.name)===norm(q.split(',')[0])?95:0)-(p.source==='CNEFE — Censo 2022'?8:0)+(p.source==='IBGE CNEFE 2022'?120:0)+(inCity?70:0)+(exact?85:0)+(numberDiff!==null?Math.max(0,20-numberDiff/30):0)-Math.min(km,100)*.8}}).filter(p=>p._match>=.5&&(!hasCoords||p.km<80)).sort((a,b)=>b._rank-a._rank).filter(p=>{const id=p.source==='IBGE CNEFE 2022'?[p.name,p.hint,p.lat,p.lon].join('|'):norm(p.name)+'|'+(norm(p.hint).includes('francisco beltrao')?'francisco beltrao':norm(p.hint).split(',').slice(-2).join(','))+'|'+(p.houseNumber||'')+'|'+(p.type==='place'?p.lat.toFixed(3)+'|'+p.lon.toFixed(3):'');if(seen.has(id))return false;seen.add(id);return true}).slice(0,15).map(({_rank,_match,...p})=>p);
 const result={results:ranked,numberFound:!!house&&ranked.some(p=>p.exactNumber),requestedNumber:house,partial:!!house&&!ranked.some(p=>p.exactNumber),providerStatus:found.length||settled.some(x=>x.status==='fulfilled'&&x.value.kind!=='catalog')?'ok':'unavailable'};
 if(cache.size>400)cache.clear();cache.set(key,{at:Date.now(),data:result});
 return res.status(200).json(result);
};
