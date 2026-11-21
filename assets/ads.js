function setupAds(admin,api){
  const el=id=>document.getElementById(id);
  const carousel=el('adCarousel'),dots=el('adDots'),image=el('adImage');
  let rotation,slides=[],index=0,draft=[],revision='',dirty=false,loading=false;
  function select(i){
    index=i;
    image.src=slides[i];
    image.alt='Publicidade '+(i+1)+' de '+slides.length;
    Array.from(dots.children).forEach((button,n)=>button.setAttribute('aria-current',String(i===n)));
  }
  function display(config){
    clearInterval(rotation);
    slides=config.visible?config.images:[];
    carousel.hidden=!slides.length;dots.replaceChildren();
    if(!slides.length){image.removeAttribute('src');return;}
    if(slides.length>1){
      slides.forEach((_,i)=>{
        const button=document.createElement('button');
        button.type='button';button.setAttribute('aria-label','Ver anúncio '+(i+1));
        button.onclick=()=>select(i);dots.append(button);
      });
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches)
        rotation=setInterval(()=>{if(!document.hidden&&carousel.offsetHeight&&!carousel.contains(document.activeElement))select((index+1)%slides.length);},6000);
    }
    select(0);
  }
  function preview(){
    const list=el('adPreview');list.replaceChildren();
    draft.forEach((src,i)=>{
      const row=document.createElement('div'),thumb=document.createElement('img');
      thumb.src=src;thumb.alt='Imagem '+(i+1);row.append(thumb);
      function action(label,fn){
        const b=document.createElement('button');b.type='button';b.textContent=label;
        b.onclick=()=>{fn();dirty=true;preview();};row.append(b);
      }
      if(i)action('Mover antes',()=>{[draft[i-1],draft[i]]=[draft[i],draft[i-1]];});
      action('Remover',()=>{draft.splice(i,1);if(!draft.length)el('adVisible').checked=false;});
      list.append(row);
    });
  }
  async function refresh(){
    if(loading)return;
    loading=true;
    try{
      const cfg=await api('ads');
      display(cfg);
      if(admin&&!dirty){
        draft=[...cfg.images];revision=cfg.revision;el('adVisible').checked=cfg.visible;
        preview();el('adFields').disabled=false;
      }
    }catch(e){if(admin)el('adStatus').textContent=e.message;}
    finally{loading=false;}
  }
  refresh();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  if(!admin)return;
  el('adVisible').onchange=()=>{dirty=true;};
  el('adFile').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    const url=URL.createObjectURL(file);el('adFields').disabled=true;
    try{
      if(draft.length>=6)throw Error('O carrossel comporta até seis imagens.');
      const pic=new Image();pic.src=url;await pic.decode();
      const scale=Math.min(1,960/pic.naturalWidth,440/pic.naturalHeight);
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(pic.naturalWidth*scale));canvas.height=Math.max(1,Math.round(pic.naturalHeight*scale));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(pic,0,0,canvas.width,canvas.height);
      let src=canvas.toDataURL('image/jpeg',0.82);
      if(src.length>170000)src=canvas.toDataURL('image/jpeg',0.5);
      if(src.length>170000)throw Error('Selecione uma imagem menor.');
      draft.push(src);dirty=true;preview();el('adStatus').textContent='Imagem pronta para salvar.';
    }catch(e){el('adStatus').textContent=e.message||'Não foi possível abrir a imagem.';}
    finally{URL.revokeObjectURL(url);event.target.value='';el('adFields').disabled=false;}
  };
  el('adSave').onclick=async()=>{
    el('adFields').disabled=true;
    try{
      const cfg=await api('ads',{visible:el('adVisible').checked,images:draft,revision});
      revision=cfg.revision;dirty=false;display(cfg);el('adStatus').textContent='Publicidade salva.';
    }catch(e){el('adStatus').textContent=e.message;}
    finally{el('adFields').disabled=false;}
  };
}
