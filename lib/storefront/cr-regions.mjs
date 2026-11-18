/**
 * Colombia's departments and their main cities, for the delivery address.
 *
 * Colombian addresses are department → city, then a street address
 * (Calle/Carrera) typed into the address line. The export names are kept
 * (CR_REGIONS, PROVINCES, cantonsIn) so existing callers keep working; the
 * data and the form labels are Colombian.
 */
export const CR_REGIONS = {
  'Bogotá D.C.': ['Bogotá'],
  'Antioquia': ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Sabaneta', 'Rionegro', 'Apartadó', 'Turbo'],
  'Atlántico': ['Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga'],
  'Bolívar': ['Cartagena', 'Magangué', 'Turbaco'],
  'Boyacá': ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá'],
  'Caldas': ['Manizales', 'Villamaría', 'La Dorada'],
  'Caquetá': ['Florencia', 'San Vicente del Caguán'],
  'Casanare': ['Yopal', 'Aguazul'],
  'Cauca': ['Popayán', 'Santander de Quilichao'],
  'Cesar': ['Valledupar', 'Aguachica'],
  'Chocó': ['Quibdó', 'Istmina'],
  'Córdoba': ['Montería', 'Cereté', 'Lorica'],
  'Cundinamarca': ['Soacha', 'Chía', 'Zipaquirá', 'Facatativá', 'Fusagasugá', 'Girardot', 'Mosquera'],
  'Huila': ['Neiva', 'Pitalito', 'Garzón'],
  'La Guajira': ['Riohacha', 'Maicao', 'Uribia'],
  'Magdalena': ['Santa Marta', 'Ciénaga', 'Fundación'],
  'Meta': ['Villavicencio', 'Acacías', 'Granada'],
  'Nariño': ['Pasto', 'Tumaco', 'Ipiales'],
  'Norte de Santander': ['Cúcuta', 'Ocaña', 'Pamplona'],
  'Quindío': ['Armenia', 'Calarcá', 'Montenegro'],
  'Risaralda': ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal'],
  'Santander': ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja'],
  'Sucre': ['Sincelejo', 'Corozal'],
  'Tolima': ['Ibagué', 'Espinal', 'Melgar'],
  'Valle del Cauca': ['Cali', 'Palmira', 'Buenaventura', 'Tuluá', 'Cartago', 'Buga'],
  'Arauca': ['Arauca', 'Saravena', 'Tame'],
  'Putumayo': ['Mocoa', 'Puerto Asís'],
  'Guaviare': ['San José del Guaviare'],
  'Amazonas': ['Leticia', 'Puerto Nariño'],
  'San Andrés y Providencia': ['San Andrés'],
  'Guainía': ['Inírida'],
  'Vaupés': ['Mitú'],
  'Vichada': ['Puerto Carreño'],
};

export const PROVINCES = Object.keys(CR_REGIONS);

/** The cities in a department, or an empty list when none is chosen yet. */
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
