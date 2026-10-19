/** Translate repeated city table copy while preserving every spintax branch. */
import { readFile, writeFile } from 'node:fs/promises';

const apply = process.argv.includes('--apply');
const translations = new Map([
  ['{Residents and Regular Customers|', '{Residentes y clientes habituales|Atención para residentes y clientes recurrentes|Asistencia para pedidos de clientes locales} : {Los residentes pueden solicitar detalles actuales de los productos, opciones de viales disponibles y precios actualizados antes de realizar un pedido.|Los clientes pueden consultar existencias actuales, especificaciones de productos y precios antes de confirmar un pedido.|Los clientes locales y recurrentes pueden revisar los productos, cantidades y precios disponibles antes de pagar.} {Esto ofrece un proceso de pedido más claro para quienes prefieren atención en Costa Rica en lugar de depender de envíos internacionales inciertos.|El proceso brinda asistencia directa para hacer pedidos en Costa Rica sin la incertidumbre de los envíos desde el extranjero.|Esto permite planificar los pedidos con atención local en vez de depender de envíos internacionales impredecibles.}'],
  ['{Professional and Research-Focused Customers|', '{Clientes profesionales y dedicados a la investigación|Atención para necesidades de investigación definidas|Información de productos para clientes de investigación} : {Los clientes con necesidades de investigación claramente definidas pueden consultar tamaños de vial disponibles, inventario actual e información relevante de los productos.|Los clientes dedicados a la investigación pueden solicitar información sobre productos disponibles, opciones de viales, cantidades y existencias actuales.|Los clientes profesionales con necesidades de investigación específicas pueden confirmar detalles de productos, formatos disponibles e inventario antes de hacer un pedido.} {[xfield_company-name] puede verificar si el producto y la cantidad solicitados están disponibles antes del pago.|El equipo puede comprobar el producto, la opción de vial y la cantidad requerida antes de que el cliente pague.|La disponibilidad del producto seleccionado y la cantidad solicitada puede confirmarse antes de realizar cualquier pago.}'],
  ['{Businesses and Customers Requiring Planned Delivery|', '{Empresas y clientes que necesitan planificar la entrega|Planificación de entregas para empresas y otros clientes|Atención para pedidos con requisitos específicos de entrega} : {Las empresas y los clientes con requisitos específicos de destino u horario deben proporcionar su ubicación completa, número de contacto y referencias útiles para la entrega.|Los clientes que necesitan una entrega planificada deben compartir su destino completo, información de contacto y detalles de acceso pertinentes.|Las empresas y otros clientes con necesidades especiales de entrega deben proporcionar una ubicación precisa, datos de contacto y puntos de referencia cercanos.} {Esto es especialmente importante para comunidades residenciales, zonas agrícolas, centros comerciales y destinos de montaña en [region].|Los detalles completos del destino son especialmente útiles para entregas a zonas residenciales, comunidades agrícolas, áreas comerciales y lugares de mayor altitud en [region].|La información precisa facilita la planificación de entregas en zonas residenciales, áreas agrícolas, comunidades comerciales y destinos de mayor altitud.} {Los detalles de entrega se confirman después de revisar el producto, el método de pago y la información del destino.|El plan de entrega solo se finaliza después de confirmar la disponibilidad del producto, los detalles del pago y el destino.|La coordinación de la entrega se realiza una vez verificados los productos seleccionados, las condiciones de pago y la ubicación completa.}'],
  ['Pricing Factors: {', 'Factores de precio: {Los precios de los péptidos en [location] pueden variar según el producto seleccionado, el tamaño del vial, la cantidad requerida, la disponibilidad actual y las necesidades de entrega.|El precio final del péptido puede depender del producto elegido, la presentación del vial, el número de viales, las existencias actuales y los detalles de entrega.|Los precios de los péptidos en Guanacaste pueden variar según el producto solicitado, el tamaño del vial, la cantidad, la disponibilidad y las necesidades de entrega.}'],
  ['Bulk Discounts: {', 'Descuentos por volumen: {Cualquier descuento por volumen aplicable a los péptidos debe incluirse al calcular el total final.|El importe final debe reflejar cualquier descuento por volumen aplicable a varios viales del mismo producto.|Cuando se aplique un descuento por volumen, debe confirmarse como parte del total completo del pedido.}'],
  ['Payment Options: {', 'Opciones de pago: {Las opciones de pago disponibles para péptidos en Costa Rica pueden incluir SINPE, Zelle y efectivo si se aprueba y coordina con antelación.|Los clientes pueden pagar mediante SINPE, Zelle o un acuerdo aprobado para pagar en efectivo.|Los métodos de pago aceptados pueden incluir SINPE, Zelle y efectivo cuando se confirmen previamente.}'],
]);

const path = 'data/pages/city.json';
const document = JSON.parse(await readFile(path, 'utf8'));
const counts = new Map([...translations.keys()].map((key) => [key, 0]));
function walk(node) {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== 'object') return;
  for (const [key, english] of Object.entries(node)) {
    if (key.endsWith('_en') && Array.isArray(english) && Array.isArray(node[`${key.slice(0, -3)}_es`])) {
      const spanish = node[`${key.slice(0, -3)}_es`];
      function update(enItems, esItems) {
        enItems.forEach((value, index) => {
          if (Array.isArray(value)) return update(value, esItems[index]);
          if (typeof value !== 'string' || esItems[index] !== value) return;
          for (const [prefix, translated] of translations) {
            if (!value.startsWith(prefix)) continue;
            for (const delimiter of ['{', '}', '|']) {
              if (value.split(delimiter).length !== translated.split(delimiter).length) {
                throw new Error(`Spintax delimiter changed for ${prefix}`);
              }
            }
            esItems[index] = translated;
            counts.set(prefix, counts.get(prefix) + 1);
          }
        });
      }
      update(english, spanish);
    } else if (english && typeof english === 'object') walk(english);
  }
}
walk(document);
if (apply) await writeFile(path, `${JSON.stringify(document, null, 2)}\n`);
console.log(JSON.stringify({ apply, counts: Object.fromEntries(counts) }));
