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
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/conversaciones?select=*&order=ultima_actividad.desc`,
      { headers }
    );
    const data = await resp.json();
    return res.status(200).json(data);
  }

  if (req.method === 'PATCH') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Falta id' });

    console.log("Finalizando chat, id:", id);

    const respConfig = await fetch(
      `${SUPABASE_URL}/rest/v1/configuracion?clave=eq.mensaje_despedida&select=valor`,
      { headers }
    );
    const config = await respConfig.json();
    const despedida = Array.isArray(config) && config[0] ? config[0].valor : null;
    console.log("Mensaje de despedida a usar:", despedida);

    const respConv = await fetch(
      `${SUPABASE_URL}/rest/v1/conversaciones?id=eq.${id}&select=telefono`,
      { headers }
    );
    const conv = await respConv.json();
    const telefono = Array.isArray(conv) && conv[0] ? conv[0].telefono : null;
    console.log("Teléfono encontrado:", telefono);

    if (despedida && telefono) {
      const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
      const PHONE_NUMBER_ID = "1308175302369400";
      const respMeta = await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: telefono,
          text: { body: despedida },
        }),
      });
      const resultadoMeta = await respMeta.json();
      if (!respMeta.ok) {
        console.error("Meta rechazó el mensaje de despedida:", JSON.stringify(resultadoMeta));
      } else {
        console.log("Despedida enviada OK:", JSON.stringify(resultadoMeta));
      }

      await fetch(`${SUPABASE_URL}/rest/v1/mensajes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ conversacion_id: id, direccion: 'saliente', contenido: despedida, enviado_por: 'sistema' }),
      });
    } else {
      console.log("No se envió despedida — faltaba mensaje configurado o teléfono.");
    }

    const respEstado = await fetch(`${SUPABASE_URL}/rest/v1/conversaciones?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ estado: 'bot' }),
    });
    const resultadoEstado = await respEstado.json();
    console.log("Estado actualizado a bot:", JSON.stringify(resultadoEstado));

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}