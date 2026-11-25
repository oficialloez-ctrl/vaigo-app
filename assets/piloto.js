function setupPilot(account,tripInput,refreshFleet,displayTrips){
 const $=id=>document.getElementById(id),dialog=$('pilot'),body=$('pilotContent'),message=$('pilotMessage');
 const active=new Set(['buscando','aceita','chegou','em_viagem']);
 const labels={buscando:'Procurando motorista',aceita:'Motorista a caminho',chegou:'Motorista no embarque',em_viagem:'Viagem em andamento',concluida:'Viagem concluída',cancelada:'Viagem cancelada',expirada:'Nenhum motorista aceitou a tempo'};
 let tab='passenger',data=null,quote=null,watch=null,heartbeat=null,epoch=0,lastPosition=0,duty=false,busy=false,reading=false,viewKey='',revision=0;
 async function api(payload){
  const r=await fetch('/api/piloto',{method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json'}:{},body:payload&&JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(14000)});
  const v=await r.json();if(!r.ok)throw Error(v.error||'Falha na conexão.');return v;
 }
 function node(tag,value,parent=body){const e=document.createElement(tag);if(value)e.textContent=value;parent.append(e);return e;}
 function button(title,fn,parent=body){const b=node('button',title,parent);b.type='button';b.onclick=()=>run(fn);return b;}
 async function run(fn){if(busy)return;busy=true;message.textContent='';
  try{await fn();}catch(e){message.textContent=e.message;}finally{busy=false;await refresh();}
 }
 async function refresh(){
  if(reading||busy||document.hidden)return;
  reading=true;const current=revision;
  try{const v=await api();if(current!==revision)return;data=v;displayTrips(v.rides);if(dialog.open)draw();}
  catch(e){if(dialog.open)message.textContent=e.message;}finally{reading=false;}
 }
 function stopTracking(){duty=false;epoch++;clearInterval(heartbeat);if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;lastPosition=0;}
 function startTracking(){
  if(!navigator.geolocation)throw Error('GPS indisponível neste navegador.');
  stopTracking();duty=true;viewKey='';draw();
  const token=epoch;const send=async p=>{
   if(token!==epoch||!duty||document.hidden||Date.now()-lastPosition<7000)return;
   if(Date.now()-p.timestamp>30000||p.coords.accuracy>250){message.textContent='Aguardando uma posição mais precisa.';return;}
   lastPosition=Date.now();try{await api({action:'position',lat:p.coords.latitude,lon:p.coords.longitude});refreshFleet();await refresh();}catch(e){message.textContent=e.message;}
  };const gpsError=e=>{message.textContent='GPS indisponível. Confira a permissão e o sinal.';if(e.code===1){stopTracking();viewKey='';draw();}};const opts={enableHighAccuracy:true,maximumAge:5000,timeout:15000};
  watch=navigator.geolocation.watchPosition(send,gpsError,opts);heartbeat=setInterval(()=>navigator.geolocation.getCurrentPosition(send,gpsError,opts),15000);
 }
 function open(mode){tab=mode;quote=null;viewKey='';revision++;if(!dialog.open)dialog.showModal();message.textContent='';draw();refresh();}
 function action(title,id,op){button(title,()=>api({action:op,id}));}
 function draw(){
  const key=JSON.stringify([tab,data,quote,duty]);if(key===viewKey)return;viewKey=key;body.replaceChildren();
  $('pilotTitle').textContent=({passenger:'Minhas corridas',driver:'Motorista',admin:'Gestão de motoristas'})[tab];
  if(!data){node('p','Carregando…');return;}
  if(tab==='admin'){
   const field=node('label','Convidar passageiro para o piloto'),mail=node('input','',field);mail.type='email';
   button('Liberar passageiro',async()=>{await api({action:'invite',email:mail.value});message.textContent='Passageiro liberado.';});
   if(!data.requests.length)node('p','Nenhum cadastro de motorista.');
   for(const d of data.requests){node('h3',d.nome);node('p',[d.veiculo,d.placa,d.categoria,d.email,d.situacao].join(' · '));
    for(const [title,status] of [['Aprovar','aprovado'],['Rejeitar','rejeitado'],['Bloquear','bloqueado']])if(d.situacao!==status)button(title,()=>api({action:'review',email:d.email,status}));
   }return;
  }
  if(tab==='driver'){
   const d=data.profile;
   if(!d||d.situacao==='rejeitado'){
    const form=node('form');const fields={};
    for(const [key,label,max] of [['name','Nome do motorista',80],['vehicle','Modelo e cor do veículo',80],['plate','Placa',8]]){const l=node('label',label,form),i=node('input','',l);i.required=true;i.maxLength=max;fields[key]=i;}
    const label=node('label','Categoria',form),sel=node('select','',label);
    for(const [v,t] of [['eco','ZECA X'],['comfort','Comfort'],['xl','XL']])node('option',t,sel).value=v;
    node('button','Enviar para aprovação',form).type='submit';
    form.onsubmit=e=>{e.preventDefault();run(()=>api({action:'register',category:sel.value,...Object.fromEntries(Object.entries(fields).map(([k,i])=>[k,i.value]))}));};return;
   }
   node('p',[d.veiculo,d.placa,d.situacao].join(' · '));
   if(d.situacao==='aprovado')button(duty?'Ficar offline':'Ativar disponibilidade e GPS',async()=>{if(duty){stopTracking();await api({action:'offline'});}else startTracking();});
   for(const offer of data.offers){node('h3','Solicitação próxima');node('p',offer.km+' km de viagem · '+offer.minutos+' min');action('Aceitar',offer.id,'accept');action('Recusar',offer.id,'refuse');}
  }
  if(quote){
   node('p',quote.km+' km · '+quote.minutos+' min · teste sem cobrança');
   button('Confirmar solicitação',async()=>{await api({action:'confirm',id:quote.id});quote=null;});button('Descartar cotação',()=>{quote=null;});return;
  }
  const rides=data.rides.filter(r=>r.sou_passageiro===(tab==='passenger'));
  if(!rides.length)node('p',tab==='driver'?'Nenhuma viagem atribuída.':'Nenhuma corrida solicitada.');
  for(const r of rides){
   node('h3',labels[r.estado]);node('p',r.origem.name+' → '+r.destino.name);node('small',r.km+' km · '+r.minutos+' min · sem cobrança');
   if(r.sou_passageiro&&r.nome)node('p',[r.nome,r.veiculo,r.placa].join(' · '));
   if(active.has(r.estado)){
    const target=r.sou_passageiro?(r.lat!=null&&r.lon!=null?{lat:r.lat,lon:r.lon}:null):(r.estado==='em_viagem'?r.destino:r.origem);
    if(target){const a=node('a',r.sou_passageiro?'Ver posição atual do motorista':'Abrir navegação');a.href=r.sou_passageiro?'https://www.openstreetmap.org/?mlat='+Number(target.lat)+'&mlon='+Number(target.lon):'https://www.google.com/maps/dir/?api=1&destination='+Number(target.lat)+','+Number(target.lon);a.target='_blank';a.rel='noopener noreferrer';}
    if(!r.sou_passageiro){const op={aceita:['Cheguei','arrive'],chegou:['Confirmar embarque e iniciar','start'],em_viagem:['Encerrar viagem','finish']}[r.estado];if(op)action(op[0],r.id,op[1]);}
    if(r.estado!=='em_viagem')action('Cancelar corrida',r.id,'cancel');
    if(navigator.share)button('Compartilhar trajeto',()=>navigator.share({text:r.origem.name+' → '+r.destino.name+' · '+labels[r.estado]}));
   }
   if(r.estado==='concluida'&&!r.nota){const l=node('label','Avaliar viagem '),sel=node('select','',l);for(let i=5;i>=1;i--)node('option',String(i),sel);button('Enviar avaliação',()=>api({action:'rate',id:r.id,stars:Number(sel.value)}));}
  }
 }
 $('closePilot').onclick=()=>dialog.close();
 $('myRides').onclick=()=>open('passenger');
 $('pilotDriver').onclick=()=>open('driver');
 $('pilotAdmin').hidden=!account.admin;$('pilotAdmin').onclick=()=>open('admin');
 $('requestButton').onclick=()=>{open('passenger');run(async()=>{const input=tripInput();if(!input)throw Error('Escolha o embarque e o destino.');quote=await api({action:'quote',...input});});};
 refresh();setInterval(()=>{if(dialog.open||data?.rides.some(r=>active.has(r.estado)))refresh();},5000);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&duty){stopTracking();api({action:'offline'}).catch(()=>{});}else if(dialog.open)refresh();});
}
