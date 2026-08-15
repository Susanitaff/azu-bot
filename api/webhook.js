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

  // 2. Recepción de mensajes de los socios (POST)
  if (req.method === 'POST') {
    const body = req.body;

    try {
      // Verificamos si es un mensaje de WhatsApp válido
      if (
        body.object &&
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const mensajeEntrante = body.entry[0].changes[0].value.messages[0];
        const numeroRemitente = mensajeEntrante.from; // Número de celular del socio
        const textoUsuario = mensajeEntrante.text ? mensajeEntrante.text.body : '';

        console.log(`Mensaje de ${numeroRemitente}: ${textoUsuario}`);

        // Aquí es donde en el futuro conectaremos la lógica de contabilidad y de "Mi Club".
        // Por ahora, Azu responde un saludo formal de prueba:
      }

      // Siempre respondemos 200 OK inmediatamente a Meta para que no reintente el envío
      return res.status(200).send('EVENT_RECEIVED');
      
    } catch (error) {
      console.error("Error procesando el webhook:", error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

