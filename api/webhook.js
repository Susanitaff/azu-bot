// Archivo: api/webhook.js

export default async function handler(req, res) {
  // 1. Verificación de seguridad de Meta (GET)
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

  // 2. Recepción y respuesta automática de mensajes (POST)
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
        const textoUsuario = mensajeEntrante.text ? mensajeEntrante.text.body.trim().toLowerCase() : '';

        console.log(`Mensaje recibido de ${numeroRemitente}: ${textoUsuario}`);

        // Menú de opciones de Azu (Versión 1)
        let respuestaTexto = "¡Hola! Bienvenido a Azu, el asistente virtual del club. Por el momento estoy en versión de pruebas 🚀.\n\nEscribí:\n1️⃣ Para ver los horarios\n2️⃣ Para consultar actividades";

        if (textoUsuario === '1' || textoUsuario.includes('horario')) {
          respuestaTexto = "🕒 Horarios del club:\nLunes a Viernes de 08:00 a 21:00 hs.\nSábados de 09:00 a 18:00 hs.";
        } else if (textoUsuario === '2' || textoUsuario.includes('actividad')) {
          respuestaTexto = "🎾 Actividades disponibles:\n- Tenis\n- Fútbol\n- Natación\n- Gimnasio";
        }

        // Enviamos la respuesta a WhatsApp
        await enviarMensajeWhatsApp(numeroRemitente, respuestaTexto);
      }

      return res.status(200).send('EVENT_RECEIVED');
      
    } catch (error) {
      console.error("Error en el webhook:", error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// Función para enviar el mensaje a la API de Meta
async function enviarMensajeWhatsApp(numeroDestino, textoRespuesta) {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN; 
  const PHONE_NUMBER_ID = "1280442445157814"; // Tu Phone Number ID de pruebas

  try {
    await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
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
  } catch (error) {
    console.error("Error enviando mensaje a WhatsApp:", error);
  }
}
