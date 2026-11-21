const {parseAddress}=require('./_address');
const fs=require('fs');
const path=require('path');
const {gunzipSync}=require('zlib');

const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const streetKey=value=>norm(value).replace(/^(?:rua|r|avenida|av|travessa|tv) /,'');
let addresses;
function load(){
 if(addresses)return addresses;
 const file=path.join(process.cwd(),'data/cnefe/4108403.json.gz');
 const data=JSON.parse(gunzipSync(fs.readFileSync(file)).toString('utf8'));
 addresses=data.rows.map(row=>({row,street:streetKey(row[0]),details:norm([row[7],row[2],'Francisco Beltrão PR Paraná',row[3]].join(' '))}));
 return addresses;
}

function lookup({q,lat,lon,limit=12}){
 const withoutNumber=/(?:^|[\s,])(?:s\s*\/\s*n|sem n[uú]mero)(?=[\s,]|$)/i;
 const clean=q.replace(withoutNumber,',');
 const noNumber=withoutNumber.test(q);
 const parsed=parseAddress(clean);
 const road=noNumber?clean.split(',')[0].trim():parsed.street;
 const house=noNumber?null:parsed.house;
 const city=noNumber?clean.split(',').slice(1).join(','):parsed.city;
 const street=streetKey(road);
 if(street.length<2)return [];
 const filters=norm(city.replace(/\b(\d{5})-(\d{3})\b/g,'$1$2')).split(' ').filter(Boolean);
 const postal=q.match(/(?:^|,\s*)(\d{5})-?(\d{3})(?=,|$)/);
 if(postal)filters.push(postal[1]+postal[2]);
 const found=[];
 for(const entry of load()){
  const [name,number,area,cep,a,b,quality,detail]=entry.row;
  if(house ? entry.street!==street || number!==house : !entry.street.includes(street))continue;
  if(noNumber && number)continue;
  const detailTokens=entry.details.split(' ');
  if(!filters.every(word=>detailTokens.includes(word)))continue;
  const km=12742*Math.asin(Math.min(1,Math.sqrt(Math.sin((a-lat)*Math.PI/360)**2+Math.cos(lat*Math.PI/180)*Math.cos(a*Math.PI/180)*Math.sin((b-lon)*Math.PI/360)**2)));
  found.push({name:name+', '+(number||'s/n'),hint:[detail,area,'Francisco Beltrão','PR',cep].filter(Boolean).join(', '),lat:a,lon:b,houseNumber:number,numberRequested:!!house,exactNumber:!!house,type:'address',source:'IBGE CNEFE 2022',geocodingQuality:quality||null,km});
 }
 return found.sort((a,b)=>a.km-b.km).slice(0,limit);
}
module.exports={lookup};
