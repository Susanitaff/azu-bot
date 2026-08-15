export default async function handler(req, res) {
  const password = req.query.password || req.headers['x-panel-password'];
  if (password !== process.env.PANEL_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/conversaciones?select=*&order=ultima_actividad.desc`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const data = await resp.json();
  return res.status(200).json(data);
}
