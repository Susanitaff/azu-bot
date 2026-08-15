// Archivo: api/webhook.js

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const VERIFY_TOKEN = "ASU_CLUB_SECRETO_2026";
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
      } else {
        return res.status(403).json({ error: 'Token inválido' });
      }
    }
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  if (req.method === 'POST') {
    const body = req.body;

    try {
      if (
        body.object &&
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const mensajeEntrante = body.entry[0].changes[0].value.messages[0];
        const numeroRemitente = mensajeEntrante.from;
        const textoUsuario = mensajeEntrante.text ? mensajeEntrante.text.body.trim().toLowerCase() : "";

        console.log(`Mensaje recibido de ${numeroRemitente}: ${textoUsuario}`);

        const conversacion = await buscarOCrearConversacion(numeroRemitente);

        if (!conversacion) {
          console.error("No se pudo crear/obtener la conversación en Supabase — mirar el log de arriba.");
          return res.status(200).send('EVENT_RECEIVED');
        }

        await guardarMensaje(conversacion.id, 'entrante', textoUsuario);

        if (conversacion.estado !== 'bot') {
          console.log(`Conversación de ${numeroRemitente} en estado "${conversacion.estado}" — Azu no responde automático.`);
          return res.status(200).send('EVENT_RECEIVED');
        }

        const opcion = await buscarOpcion(textoUsuario);
        const respuestaTexto = opcion
          ? opcion.contenido
          : '¡Hola! Soy Azu 👋 Escribí *1* para ver los horarios o *2* para conocer las actividades.';

        await enviarMensajeWhatsApp(numeroRemitente, respuestaTexto);
        await guardarMensaje(conversacion.id, 'saliente', respuestaTexto);
      }

      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error("Error en el webhook:", error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// --- Funciones que hablan con Supabase ---

async function buscarOCrearConversacion(telefono) {
  const buscar = await fetch(
    `${SUPABASE_URL}/rest/v1/conversaciones?telefono=eq.${telefono}&select=id,estado`,
    { headers: supabaseHeaders }
  );
  const encontradas = await buscar.json();
  console.log("Supabase SELECT conversaciones:", buscar.status, JSON.stringify(encontradas));

  if (Array.isArray(encontradas) && encontradas.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/conversaciones?id=eq.${encontradas[0].id}`, {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify({ ultima_actividad: new Date().toISOString() }),
    });
    return encontradas[0];
  }

  const crear = await fetch(`${SUPABASE_URL}/rest/v1/conversaciones`, {
    method: 'POST',
    headers: { ...supabaseHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({ telefono, estado: 'bot' }),
  });
  const creada = await crear.json();
  console.log("Supabase INSERT conversaciones:", crear.status, JSON.stringify(creada));

  return Array.isArray(creada) ? creada[0] : null;
}

async function buscarOpcion(disparador) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/opciones?disparador=eq.${disparador}&activo=eq.true&select=*`,
    { headers: supabaseHeaders }
  );
  const resultados = await resp.json();
  console.log("Supabase SELECT opciones:", resp.status, JSON.stringify(resultados));
  return Array.isArray(resultados) ? (resultados[0] || null) : null;
}

async function guardarMensaje(conversacionId, direccion, contenido) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/mensajes`, {
    method: 'POST',
    headers: supabaseHeaders,
    body: JSON.stringify({ conversacion_id: conversacionId, direccion, contenido }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    console.error("Supabase INSERT mensajes falló:", resp.status, JSON.stringify(err));
  }
}

// Función para enviar el mensaje a la API de Meta
async function enviarMensajeWhatsApp(numeroDestino, textoRespuesta) {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  const PHONE_NUMBER_ID = "1308175302369400";

  try {
    const respuestaMeta = await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: numeroDestino,
        text: { body: textoRespuesta },
      }),
    });
    const resultado = await respuestaMeta.json();
    if (!respuestaMeta.ok) {
      console.error("Meta rechazó el envío:", JSON.stringify(resultado));
    } else {
      console.log("Mensaje enviado OK:", JSON.stringify(resultado));
    }
  } catch (error) {
    console.error("Error enviando mensaje a WhatsApp:", error);
  }
}