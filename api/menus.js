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
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/menus?select=*&order=creado_en.asc`, { headers });
    const data = await resp.json();
    return res.status(200).json(data);
  }

  if (req.method === 'PATCH') {
    const { id, texto_intro } = req.body;
    if (!id || texto_intro === undefined) {
      return res.status(400).json({ error: 'Faltan datos' });
    }
    await fetch(`${SUPABASE_URL}/rest/v1/menus?id=eq.${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ texto_intro }),
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
