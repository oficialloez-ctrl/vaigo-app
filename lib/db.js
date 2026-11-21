async function query(sql, params) {
  const connection = process.env.ZECA_FLEET_DATABASE_URL;
  const endpoint = new URL(connection);
  const response = await fetch('https://' + endpoint.hostname + '/sql', {
    method: 'POST',
    headers: {'Content-Type':'application/json', 'Neon-Connection-String':connection},
    body: JSON.stringify({query:sql,params}),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw Error('Database unavailable');
  return (await response.json()).rows;
}
module.exports = {query};
