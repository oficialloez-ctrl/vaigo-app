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
  function codeStep(active){
    el('codeRow').hidden=el('changeEmail').hidden=!active;
    el('loginEmail').readOnly=active;
    el('loginCode').required=active;
    el('loginSubmit').textContent=active?'Entrar':'Receber código';
    el('loginCode').value='';
    (active?el('loginCode'):el('loginEmail')).focus();
  }
  el('changeEmail').onclick=()=>{codeStep(false);message('loginMsg','');};
  el('loginForm').onsubmit=async event=>{
    event.preventDefault();
    const email=el('loginEmail').value.trim(),send=el('codeRow').hidden;
    el('loginSubmit').disabled=true;
    try{
      await api('account',{action:send?'send':'verify',email,otp:el('loginCode').value.trim()});
      if(send){codeStep(true);message('loginMsg','Confira o código de seis números no seu e-mail.');}
      else location.reload();
    }catch(e){message('loginMsg',e);}
    finally{el('loginSubmit').disabled=false;}
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
