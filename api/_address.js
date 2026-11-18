// Preserve numbers in street names such as "Rua 7 de Setembro".
function parseAddress(query) {
  const [first = '', ...parts] = query.split(',').map(part => part.trim()).filter(Boolean);
  const separateNumber = /^\d{1,6}$/.test(parts[0] || '');
  const suffix = first.match(/^(.+?)\s+(\d{1,6})$/);
  const house = separateNumber ? parts.shift() : suffix?.[2] || null;
  const street = !separateNumber && suffix ? suffix[1] : first;
  const city = parts.filter(part => !/^\d{5}-?\d{3}$/.test(part)).join(', ');
  return { street, house, city };
}
module.exports = { parseAddress };
