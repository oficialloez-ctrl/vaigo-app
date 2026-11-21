(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  async function api(path,body){
    const response=await fetch('/api/'+path,{method:body?'POST':'GET',credentials:'same-origin',
      ...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),cache:'no-store'});
    if(response.status===401&&path==='admin')location.reload();
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||'Não foi possível concluir. Tente novamente.');
    return data;
  }
  const message=(id,error)=>el(id).textContent=error.message||error;
  let mode='login',sent=false;
  function showMode(next,codeSent=false){
    mode=next;sent=codeSent;
    const login=mode==='login',setting=mode==='create'||mode==='reset';
    el('authTitle').textContent={login:'Entrar no ZECA',create:'Criar minha senha',reset:'Redefinir senha',code:'Entrar com código'}[mode];
    el('loginEmail').readOnly=sent;
    el('codeRow').hidden=!sent;el('loginCode').required=sent;el('loginCode').value='';
    el('passwordRow').hidden=!(login||(setting&&sent));
    const pw=el('loginPassword');
    pw.required=!el('passwordRow').hidden;pw.minLength=login?1:8;pw.value='';
    pw.autocomplete=login?'current-password':'new-password';
    el('passwordLabel').textContent=login?'Senha':'Nova senha (mínimo de 8 caracteres)';
    el('loginSubmit').textContent=login?'Entrar':!sent?'Receber código':setting?'Salvar senha e entrar':'Entrar';
    el('authActions').hidden=!login;el('changeEmail').hidden=login;
    message('loginMsg',sent?'Confira o código de seis números no seu e-mail.':'');
    (sent?el('loginCode'):el('loginEmail')).focus();
  }
  for(const button of document.querySelectorAll('[data-auth]'))button.onclick=()=>showMode(button.dataset.auth);
  el('changeEmail').onclick=()=>showMode('login');
  el('loginForm').onsubmit=async event=>{
    event.preventDefault();
    const action=mode==='login'?'password':!sent?'send':mode==='code'?'verify':'setPassword';
    const body={action,email:el('loginEmail').value.trim()};
    if(action==='password'||action==='setPassword')body.password=el('loginPassword').value;
    if(sent)body.otp=el('loginCode').value.trim();
    const buttons=el('loginForm').querySelectorAll('button');
    buttons.forEach(button=>button.disabled=true);
    try{
      await api('account',body);
      if(action==='send')showMode(mode,true);
      else location.reload();
    }catch(e){message('loginMsg',e);}
    finally{buttons.forEach(button=>button.disabled=false);}
  };
  async function grants(){
    const {admins}=await api('admin');
    const list=el('grantList');list.replaceChildren();
    for(const email of admins){
      const item=document.createElement('li'),remove=document.createElement('button');
      item.append(document.createTextNode(email+' '));
      remove.type='button';remove.textContent='Remover acesso';
      remove.onclick=async()=>{try{await api('admin',{action:'revoke',email});await grants();message('grantStatus','Acesso removido.');}catch(e){message('grantStatus',e);}};
      item.append(remove);list.append(item);
    }
  }
  async function open(){
    const {user,settings}=await api('account');
    if(!user)return;
    const app=document.querySelector('.app');
    el('loginScreen').hidden=true;app.hidden=false;
    startZeca(user,settings);
    setupAds(user.admin,api);
    let name=user.name||'';
    function greet(){
      const hour=new Date().getHours();
      const greeting=hour>=5&&hour<12?'Bom dia':hour>=12&&hour<18?'Boa tarde':'Boa noite';
      el('tripGreeting').textContent=name?greeting+', '+name:greeting;
      el('editGreeting').textContent=name?'Editar nome':'Adicionar nome';
    }
    greet();setInterval(greet,60000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)greet();});
    el('editGreeting').onclick=()=>{
      el('greetingForm').hidden=!el('greetingForm').hidden;
      if(!el('greetingForm').hidden){el('firstName').value=name;el('firstName').focus();}
    };
    el('greetingForm').onsubmit=async event=>{
      event.preventDefault();
      try{
        const data=await api('account',{action:'profile',name:el('firstName').value});
        name=data.name;greet();el('nameStatus').textContent='';el('greetingForm').hidden=true;
      }catch(e){message('nameStatus',e);}
    };
    el('managePassword').onclick=()=>{
      app.hidden=true;el('loginScreen').hidden=false;el('loginEmail').value=user.email;
      showMode('reset');
    };
    el('logoutButton').onclick=async()=>{try{await api('account',{action:'logout'});location.reload();}catch(e){alert(e.message);}};
    if(user.admin){
      el('saveSettings').onclick=async()=>{try{
        const settings={};for(const key of ['fuelPrice','kmPerLiter','commission','baseFare','priceKm','priceMinute'])settings[key]=el(key).valueAsNumber;
        await api('admin',{action:'settings',settings});message('settingsStatus','Tarifas salvas.');
      }catch(e){message('settingsStatus',e);}};
    }
    if(user.owner){
      el('grantForm').onsubmit=async event=>{
        event.preventDefault();
        try{await api('admin',{action:'grant',email:el('grantEmail').value});el('grantEmail').value='';await grants();message('grantStatus','Acesso adicionado.');}
        catch(e){message('grantStatus',e);}
      };
      await grants().catch(e=>message('grantStatus',e));
    }
  }
  open().catch(e=>message('loginMsg',e));
})();
