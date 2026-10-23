/**
 * Costa Rica's seven provinces and their cantons, for the delivery address.
 *
 * Taken from the supplied design. The canton list is what the courier desk
 * needs to route a parcel; the district and the "otras señas" line are typed
 * in, because Costa Rican addresses are directions rather than street numbers.
 */
export const CR_REGIONS = {
  'San José': ['San José', 'Escazú', 'Desamparados', 'Puriscal', 'Tarrazú', 'Aserrí', 'Mora', 'Goicoechea', 'Santa Ana', 'Alajuelita', 'Vázquez de Coronado', 'Acosta', 'Tibás', 'Moravia', 'Montes de Oca', 'Turrubares', 'Dota', 'Curridabat', 'Pérez Zeledón', 'León Cortés Castro'],
  Alajuela: ['Alajuela', 'San Ramón', 'Grecia', 'San Mateo', 'Atenas', 'Naranjo', 'Palmares', 'Poás', 'Orotina', 'San Carlos', 'Zarcero', 'Sarchí', 'Upala', 'Los Chiles', 'Guatuso', 'Río Cuarto'],
  Cartago: ['Cartago', 'Paraíso', 'La Unión', 'Jiménez', 'Turrialba', 'Alvarado', 'Oreamuno', 'El Guarco'],
  Heredia: ['Heredia', 'Barva', 'Santo Domingo', 'Santa Bárbara', 'San Rafael', 'San Isidro', 'Belén', 'Flores', 'San Pablo', 'Sarapiquí'],
  Guanacaste: ['Liberia', 'Nicoya', 'Santa Cruz', 'Bagaces', 'Carrillo', 'Cañas', 'Abangares', 'Tilarán', 'Nandayure', 'La Cruz', 'Hojancha'],
  Puntarenas: ['Puntarenas', 'Esparza', 'Buenos Aires', 'Montes de Oro', 'Osa', 'Quepos', 'Golfito', 'Coto Brus', 'Parrita', 'Corredores', 'Garabito', 'Monteverde', 'Puerto Jiménez'],
  Limón: ['Limón', 'Pococí', 'Siquirres', 'Talamanca', 'Matina', 'Guácimo'],
};

export const PROVINCES = Object.keys(CR_REGIONS);

/** The cantons in a province, or an empty list when none is chosen yet. */
export function cantonsIn(province) {
  return CR_REGIONS[province] || [];
}

/** The address as one line, the way it is stored on the order. */
export function formatAddress({ province, canton, district, directions }) {
  return [directions, district, canton, province]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}
