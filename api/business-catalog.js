const {refresh}=require('../lib/businesses');
module.exports=async(req,res)=>{
  if(req.method!=='GET')return res.status(405).end();
  try{
    const {updated,places}=await refresh();
    if(!updated)return res.status(503).json({status:'pending'});
    res.setHeader('Cache-Control','public, s-maxage=300');
    return res.json({updated,count:places.length});
  }catch{return res.status(503).json({status:'source-unavailable'});}
};
