const test = require('node:test');
const assert = require('node:assert/strict');
const {requireLogin,sameOrigin} = require('../lib/session');
const session = require('../lib/session');
const db = require('../lib/db');
let currentUser = null;
session.requireLogin = async (req,res) => currentUser || requireLogin(req,res);
let statements = [];
db.query = async (sql,params) => { statements.push({sql,params}); return []; };
const handler = require('../api/piloto');
async function request(body,origin='https://test.local'){
 const res={code:200,setHeader(){},status(n){this.code=n;return this;},json(v){this.value=v;return this;}};
 await handler({method:'POST',headers:{host:'test.local',origin,'content-type':'application/json'},body},res);
 return res.code;
}
test('visitante precisa de sessão',async()=>assert.equal(await request({}),401));
test('origem externa recusada antes de escrita',async()=>{currentUser={email:'teste@example.invalid'};assert.equal(await request({},'https://externo.invalid'),403);});
test('passageiro não revisa cadastro nem convida usuários',async()=>{
 for(const action of ['review','invite'])assert.equal(await request({action}),403);
});
test('área e placa inválidas',async()=>{
 assert.equal(await request({action:'position',lat:0,lon:0}),400);
 assert.equal(await request({action:'register',name:'Teste',vehicle:'Modelo',plate:'x',category:'eco'}),400);
});
test('cotação exige convite',async()=>assert.equal(await request({action:'quote'}),403));
test('mudança em corrida inexistente retorna conflito',async()=>assert.equal(await request({action:'start',id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}),409));
test('ambiente de produção bloqueado',async()=>{const old=process.env.VERCEL_ENV;try{process.env.VERCEL_ENV='production';assert.equal(await request({}),403);}finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}});
