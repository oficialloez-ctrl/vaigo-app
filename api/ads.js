const {query}=require('../lib/db');
const {requireLogin,sameOrigin}=require('../lib/session');
const {randomUUID}=require('node:crypto');

module.exports=async(req,res)=>{
  const user=await requireLogin(req,res);
  if(!user)return;
  try{
    if(req.method==='GET'){
      const [row]=await query('select settings from zeca_config where id=2',[]);
      const config=row?.settings||{visible:false,images:[],revision:''};
      return res.json(user.admin?config:{visible:config.visible,images:config.visible?config.images:[]});
    }
    if(req.method!=='POST')return res.status(405).end();
    if(!user.admin||!sameOrigin(req))return res.status(403).end();
    const {visible,images,revision}=req.body||{};
    if(typeof visible!=='boolean'||typeof revision!=='string'||!Array.isArray(images)||images.length>6||(visible&&!images.length))
      return res.status(400).json({error:'Adicione pelo menos uma imagem para ativar o carrossel.'});
    for(const img of images){
      if(typeof img!=='string'||img.length>170000||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(img))
        return res.status(400).json({error:'Imagem inválida. Selecione o arquivo novamente.'});
    }
    const config={visible,images,revision:randomUUID()};
    const rows=await query(`insert into zeca_config values(2,$1::jsonb) on conflict(id) do update
      set settings=excluded.settings where coalesce(zeca_config.settings->>'revision','')=$2 returning id`,[JSON.stringify(config),revision]);
    if(!rows.length)return res.status(409).json({error:'Outro administrador atualizou o carrossel. Reabra o ZECA antes de editar.'});
    return res.json(config);
  }catch{return res.status(503).json({error:'Não foi possível acessar o carrossel.'});}
};
