// Paginación por CURSOR (startAfter) para Firestore.
//
// Por qué cursor y no offset: Firestore no tiene OFFSET real barato — saltar N
// documentos igual los LEE (y los cobra). startAfter(valor) salta sin releer.
// También evita el patrón actual de `.get()` sin límite, que trae la colección
// entera a memoria y escala linealmente en lecturas (costoso en plan Spark).
//
// Uso OPT-IN: una ruta expone ?limit= y ?cursor=. El `cursor` es opaco para el
// cliente (se lo devolvemos como `nextCursor` y nos lo reenvía tal cual).
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(raw, fallback = DEFAULT_LIMIT) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, MAX_LIMIT);
}

// Aplica orderBy + límite + startAfter a una query base. Devuelve la página de
// docs, si hay más, y el cursor para la siguiente. `decodeCursor`/`encodeCursor`
// permiten traducir el valor del campo de orden a/desde algo serializable en la
// URL (p. ej. un Timestamp ↔ ISO string).
async function paginateQuery(baseQuery, {
  orderField,
  direction = 'desc',
  limit,
  cursor,
  decodeCursor = (v) => v,
  encodeCursor = (v) => v,
}) {
  const pageSize = parseLimit(limit);
  let q = baseQuery.orderBy(orderField, direction).limit(pageSize + 1); // +1 para saber si hay más
  if (cursor !== undefined && cursor !== null && cursor !== '') {
    q = q.startAfter(decodeCursor(cursor));
  }
  const snap = await q.get();
  const docs = snap.docs.slice(0, pageSize);
  const hasMore = snap.docs.length > pageSize;
  const nextCursor = hasMore ? encodeCursor(docs[docs.length - 1].get(orderField)) : null;
  return { docs, hasMore, nextCursor };
}

module.exports = { paginateQuery, parseLimit, DEFAULT_LIMIT, MAX_LIMIT };
