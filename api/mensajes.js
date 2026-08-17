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
    const conversacionId = req.query.conversacion_id;
    if (!conversacionId) {
      return res.status(400).json({ error: 'Falta conversacion_id' });
    }
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/mensajes?conversacion_id=eq.${conversacionId}&select=*&order=creado_en.asc`,
      { headers }
    );
    const data = await resp.json();
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { conversacion_id, telefono, texto } = req.body;
    if (!conversacion_id || !telefono || !texto) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const PHONE_NUMBER_ID = "1308175302369400";

    await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefono,
        text: { body: texto },
      }),
    });

    await fetch(`${SUPABASE_URL}/rest/v1/mensajes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversacion_id, direccion: 'saliente', contenido: texto, enviado_por: 'operador' }),
    });

    await fetch(`${SUPABASE_URL}/rest/v1/conversaciones?id=eq.${conversacion_id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ estado: 'atendido' }),
    });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
