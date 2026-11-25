const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('jornada entre contas com PostgreSQL local, GPS e roteador simulados',async()=>{
 const pg=new PGlite();
 const originalFetch=global.fetch;
 try{
  await pg.exec(fs.readFileSync(require.resolve('../migrations/001-piloto.sql'),'utf8'));
  require('../lib/db').query=async(sql,params)=>(await pg.query(sql,params)).rows;
  require('../lib/session').requireLogin=async req=>req.user;
  global.fetch=async()=>({ok:true,json:async()=>({routes:[{distance:1800,duration:240}]})});
  const api=require('../api/piloto');
  async function call(email,body,expected=200){
   const req={user:{email,admin:email==='admin'},method:body?'POST':'GET',body,headers:{host:'test.local','content-type':'application/json'}};
   const res={n:200,setHeader(){},status(n){this.n=n;return this;},json(value){this.value=value;}};
   await api(req,res);assert.equal(res.n,expected,JSON.stringify({action:body?.action,reply:res.value}));return res.value;
  }
  const passenger='pass@example.invalid',drivers=['one@example.invalid','two@example.invalid'];
  await call('admin',{action:'invite',email:passenger});
  for(const [i,email] of drivers.entries()){
   await call(email,{action:'register',name:'Teste',vehicle:'Teste',plate:'ABC123'+i,category:'eco'});
   await call(email,{action:'position',lat:-26.08,lon:-53.05},409);
   await call('admin',{action:'review',email,status:'aprovado'});
   await call(email,{action:'position',lat:-26.08,lon:-53.05});
  }
  const quote=()=>call(passenger,{action:'quote',from:{name:'A',lat:-26.08,lon:-53.05},to:{name:'B',lat:-26.07,lon:-53.04},category:'eco'});
  const {id}=await quote();await call(passenger,{action:'confirm',id});
  assert.equal((await call(drivers[0])).offers.length,1);
  await Promise.all([call(drivers[0],{action:'accept',id}),call(drivers[1],{action:'accept',id},409)]);
  await call(drivers[0],{action:'start',id},409);
  assert.equal((await call(passenger)).rides[0].estado,'aceita');
  assert.equal((await call(drivers[1])).rides.length,0);
  for(const action of ['arrive','start','finish'])await call(drivers[0],{action,id});
  for(const email of [passenger,drivers[0]])await call(email,{action:'rate',id,stars:5});
  await call(passenger,{action:'rate',id,stars:5},409);
  const second=(await quote()).id;await call(passenger,{action:'confirm',id:second});
  await call(drivers[1],{action:'refuse',id:second});
  assert.equal((await call(drivers[1])).offers.length,0);
  await call(passenger,{action:'cancel',id:second});
  assert.equal((await call(passenger)).rides.length,2);
 }finally{global.fetch=originalFetch;await pg.close();}
});
