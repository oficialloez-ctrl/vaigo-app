// Optional CNEFE search layer. No data means no behavior change.
const fs=require('fs'),path=require('path');
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const memo=new Map();
function load(code){
 if(memo.has(code))return memo.get(code);
 const filename=path.join(process.cwd(),'data','cnefe',code+'.json');
 if(!fs.existsSync(filename))return null;
 try{const data=JSON.parse(fs.readFileSync(filename,'utf8'));const rows=Array.isArray(data.rows)?data.rows:[];memo.set(code,rows);return rows;}catch(e){return null;}
}
function lookup({q,lat,lon,limit=12}){
 const query=norm(q),number=(query.match(/\b\d{1,6}\b/)||[])[0];
 const street=norm(query.split(',')[0].replace(/\b\d{1,6}\b/g,'').replace(/\b(rua|r|avenida|av|travessa|tv)\b/g,' ')).replace(/\s+/g,' ').trim();
 if(street.length<3)return [];
 const codes=['4108403']; // Add municipalities only after their files are imported and validated.
 const found=[];
 for(const code of codes){const rows=load(code);if(!rows)continue;
  for(const row of rows){const [road,num,neighborhood,cep,a,b,quality]=row;
   if(!Number.isFinite(a)||!Number.isFinite(b))continue;
   const roadNorm=norm(road).replace(/\b(rua|r|avenida|av|travessa|tv)\b/g,' ').replace(/\s+/g,' ').trim();
   if(!roadNorm.includes(street)&&!street.includes(roadNorm))continue;
   if(number&&String(num)!==number)continue;
   const km=12742*Math.asin(Math.min(1,Math.sqrt(Math.sin((a-lat)*Math.PI/360)**2+Math.cos(lat*Math.PI/180)*Math.cos(a*Math.PI/180)*Math.sin((b-lon)*Math.PI/360)**2)));
   found.push({name:road+', '+num,hint:[neighborhood,'Francisco Beltrão','PR',cep].filter(Boolean).join(', '),lat:a,lon:b,houseNumber:String(num),numberRequested:!!number,exactNumber:!!number&&String(num)===number,type:'address',source:'IBGE CNEFE 2022',geocodingQuality:quality||null,km});
  }
 }
 return found.sort((a,b)=>a.km-b.km).slice(0,limit);
}
module.exports={lookup};
