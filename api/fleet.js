const {createHash} = require('node:crypto');

const {query} = require('../lib/db');
const {requireLogin} = require('../lib/session');
const valid = (n, limit) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit;
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','private, no-store');
  try {
    if (!await requireLogin(req,res)) return;
    if (req.method === 'GET') {
      const {lat,lon} = req.query;
      if (!lat || !lon || !valid(Number(lat),90) || !valid(Number(lon),180)) return res.status(400).end();
      const rows = await query(`with cleanup as (delete from fleet_presence where seen < now()-interval '2 minutes')
        select lat,lon,heading from fleet_presence where seen > now()-interval '45 seconds'
        and abs(lat-$1)<0.15 and abs(lon-$2)<0.15 order by seen desc limit 100`,[Number(lat),Number(lon)]);
      return res.json({drivers:rows});
    }
    if (req.method !== 'POST') return res.status(405).end();
    const body = req.body || {};
    if (!/^[a-f0-9]{64}$/.test(body.token || '')) return res.status(400).end();
    const hash = createHash('sha256').update(body.token).digest('hex');
    if (body.offline === true) await query('delete from fleet_presence where session_hash=$1',[hash]);
    else {
      if (!valid(body.lat,90) || !valid(body.lon,180)) return res.status(400).end();
      const heading = valid(body.heading,360) ? Math.round(body.heading) : 0;
      await query(`insert into fleet_presence (session_hash,lat,lon,heading) values ($1,$2,$3,$4)
        on conflict (session_hash) do update set lat=excluded.lat,lon=excluded.lon,heading=excluded.heading,seen=now()`,
        [hash,Number(body.lat.toFixed(3)),Number(body.lon.toFixed(3)),heading]);
    }
    return res.status(204).end();
  } catch { return res.status(503).json({error:'GPS temporariamente indisponível'}); }
};
