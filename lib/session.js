const {createHash} = require('node:crypto');
const {query} = require('./db');
const OWNER = 'oficialloez@gmail.com';
const cookieName = '__Host-zeca';
const hash = value => createHash('sha256').update(value).digest('hex');
function sessionKey(req) {
  const token=(req.headers.cookie||'').match(/(?:^|;\s*)__Host-zeca=([a-f0-9]{64})(?:;|$)/);
  return token && hash(token[1]);
}
async function account(req) {
  const key=sessionKey(req);
  if(!key)return null;
  const [row]=await query(`select s.email, exists(select 1 from zeca_admin_grants g where g.email=s.email) as delegated
    from zeca_sessions s where s.digest=$1 and s.expires_at>now()`,[key]);
  if(!row)return null;
  const owner=row.email===OWNER;
  return {email:row.email,owner,admin:owner||row.delegated===true||row.delegated==='t'};
}
async function requireLogin(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  try {
    const user=await account(req);
    if(user)return user;
    res.status(401).json({error:'Entre para continuar.'});
  } catch {res.status(503).json({error:'Login temporariamente indisponível.'});}
  return null;
}
function sameOrigin(req) {
  return (!req.headers.origin || req.headers.origin==='https://'+req.headers.host)
    && /^application\/json(?:;|$)/i.test(req.headers['content-type']||'');
}
module.exports={OWNER,cookieName,sessionKey,account,requireLogin,hash,sameOrigin};
