// Archivo: api/webhook.js

export default function handler(req, res) {
  // 1. WhatsApp nos hace un GET para verificar que nuestro servidor existe y es seguro.
  if (req.method === 'GET') {
    const VERIFY_TOKEN = "ASU_CLUB_SECRETO_2026"; // Esta es nuestra contraseña interna
    
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log("¡Verificación de WhatsApp exitosa!");
        return res.status(200).send(challenge);
      } else {
        return res.status(403).json({ error: 'Token de verificación inválido' });
      }
    }
    return res.status(400).json({ error: 'Faltan parámetros de Meta' });
  }

  // 2. WhatsApp nos hará un POST aquí cada vez que un socio envíe un mensaje a Asu.
  if (req.method === 'POST') {
    // Por ahora solo recibimos el mensaje en silencio para que Meta sepa que llegó bien.
    // En el próximo paso le agregaremos la lógica para leer qué dijo el socio.
    console.log("Mensaje recibido de un socio:", req.body);
    return res.status(200).send('EVENT_RECEIVED');
  }

  // Si intentan acceder de otra forma, bloqueamos la conexión.
  return res.status(405).json({ error: 'Método no permitido' });
}
