// Preserve numbers in street names such as "Rua 7 de Setembro".
function parseAddress(query) {
  const [first = '', ...parts] = query.split(',').map(part => part.trim()).filter(Boolean);
  const numberPart = /^(?:n[º°o.]?\s*)?(\d{1,6})$/i.exec(parts[0] || '');
  const suffix = first.match(/^(.+?)\s+(?:n[º°o.]?\s*)?(\d{1,6})$/);
  const house = numberPart ? numberPart[1] : suffix?.[2] || null;
  if (numberPart) parts.shift();
  const street = !numberPart && suffix ? suffix[1] : first;
  const city = parts.filter(part => !/^\d{5}-?\d{3}$/.test(part)).join(', ');
  return { street, house, city };
}
module.exports = { parseAddress };
