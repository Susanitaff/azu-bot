export default async function handler(req, res) {
  const password = req.query.password;
  if (password !== process.env.PANEL_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  if (req.method === 'GET') {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/opciones?select=*&order=disparador.asc`, { headers });
    const data = await resp.json();
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { disparador, tipo_respuesta, contenido } = req.body;
    if (!disparador || !contenido) {
      return res.status(400).json({ error: 'Faltan datos' });
    }
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/opciones`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        disparador: disparador.trim().toLowerCase(),
        tipo_respuesta: tipo_respuesta || 'texto',
        contenido,
      }),
    });
    const data = await resp.json();
    return res.status(200).json(data);
  }

  if (req.method === 'PATCH') {
    const { id, contenido, activo } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Falta id' });
    }
    const cambios = {};
    if (contenido !== undefined) cambios.contenido = contenido;
    if (activo !== undefined) cambios.activo = activo;

    await fetch(`${SUPABASE_URL}/rest/v1/opciones?id=eq.${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(cambios),
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}