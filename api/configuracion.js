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
        const tipoMensaje = mensajeEntrante.type;
        const textoUsuario = mensajeEntrante.text ? mensajeEntrante.text.body.trim().toLowerCase() : "";

        console.log(`Mensaje recibido de ${numeroRemitente} (tipo: ${tipoMensaje}): ${textoUsuario}`);

        let conversacion = await buscarOCrearConversacion(numeroRemitente);

        if (!conversacion) {
          console.error("No se pudo crear/obtener la conversación en Supabase.");
          return res.status(200).send('EVENT_RECEIVED');
        }

        if (conversacion.estado !== 'bot') {
          const timeoutMinutos = await obtenerConfigNumero('timeout_minutos', 120);
          const minutosInactiva = (Date.now() - new Date(conversacion.ultima_actividad).getTime()) / 60000;
          if (minutosInactiva > timeoutMinutos) {
            await volverABot(conversacion.id);
            conversacion.estado = 'bot';
            console.log(`Conversación de ${numeroRemitente} venció el timeout (${timeoutMinutos} min) — vuelve a modo bot.`);
          }
        }

        await tocarConversacion(conversacion.id);

        if (tipoMensaje === 'image' || tipoMensaje === 'document') {
          await guardarMensaje(conversacion.id, 'entrante', '[Comprobante recibido — ver adjunto en WhatsApp]');

          if (conversacion.estado === 'bot') {
            const mensajeComprobante = await obtenerConfigTexto(
              'mensaje_comprobante',
              'Recibimos tu comprobante, gracias 🙌 En breve lo vamos a confirmar desde administración.'
            );
            await enviarMensajeWhatsApp(numeroRemitente, mensajeComprobante);
            await guardarMensaje(conversacion.id, 'saliente', mensajeComprobante);
            await cambiarEstado(conversacion.id, 'revisar_pago');
          }

          return res.status(200).send('EVENT_RECEIVED');
        }

        await guardarMensaje(conversacion.id, 'entrante', textoUsuario);

        if (conversacion.estado !== 'bot') {
          console.log(`Conversación de ${numeroRemitente} en estado "${conversacion.estado}" — Azu no responde automático.`);
          return res.status(200).send('EVENT_RECEIVED');
        }

        await manejarMensajeDeMenu(conversacion, numeroRemitente, textoUsuario);
      }

      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error("Error en el webhook:", error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

async function manejarMensajeDeMenu(conversacion, numeroRemitente, textoUsuario) {
  let menuActualId = conversacion.menu_actual_id;
  if (!menuActualId) {
    const raiz = await obtenerMenuRaiz();
    menuActualId = raiz ? raiz.id : null;
    if (menuActualId) await cambiarMenuActual(conversacion.id, menuActualId);
  }

  if (['0', 'volver', 'atras', 'atrás'].includes(textoUsuario)) {
    const menu = await obtenerMenu(menuActualId);
    const padreId = menu && menu.padre_id ? menu.padre_id : menuActualId;
    await cambiarMenuActual(conversacion.id, padreId);
    return await mostrarMenu(conversacion.id, numeroRemitente, padreId);
  }
  if (['menu', 'menú', 'inicio'].includes(textoUsuario)) {
    const raiz = await obtenerMenuRaiz();
    if (raiz) {
      await cambiarMenuActual(conversacion.id, raiz.id);
      return await mostrarMenu(conversacion.id, numeroRemitente, raiz.id);
    }
  }

  const opcion = await buscarOpcionEnMenu(menuActualId, textoUsuario);

  if (!opcion) {
    return await mostrarMenu(conversacion.id, numeroRemitente, menuActualId);
  }

  if (opcion.tipo_respuesta === 'derivar_asesor') {
    await enviarMensajeWhatsApp(numeroRemitente, opcion.contenido);
    await guardarMensaje(conversacion.id, 'saliente', opcion.contenido);
    await cambiarEstado(conversacion.id, 'esperando_asesor');
    return;
  }

  if (opcion.tipo_respuesta === 'submenu' && opcion.menu_destino_id) {
    await cambiarMenuActual(conversacion.id, opcion.menu_destino_id);
    return await mostrarMenu(conversacion.id, numeroRemitente, opcion.menu_destino_id);
  }

  await enviarMensajeWhatsApp(numeroRemitente, opcion.contenido);
  await guardarMensaje(conversacion.id, 'saliente', opcion.contenido);
}

async function mostrarMenu(conversacionId, numeroRemitente, menuId) {
  const menu = await obtenerMenu(menuId);
  if (!menu) return;

  const opcionesResp = await fetch(
    `${SUPABASE_URL}/rest/v1/opciones?menu_id=eq.${menuId}&activo=eq.true&select=disparador,etiqueta&order=creado_en.asc`,
    { headers: supabaseHeaders }
  );
  const opciones = await opcionesResp.json();

  let textoIntro = menu.texto_intro;
  if (!menu.padre_id) {
    textoIntro = await obtenerConfigTexto('mensaje_bienvenida', menu.texto_intro);
  }

  let texto = textoIntro;
  if (Array.isArray(opciones) && opciones.length > 0) {
    texto += '\n\n' + opciones.map(o => {
      const primerDisparador = o.disparador.split(',')[0].trim();
      return `*${primerDisparador}* - ${o.etiqueta || primerDisparador}`;
    }).join('\n');
  }
  if (menu.padre_id) {
    texto += '\n\n*0* - Volver';
  }

  await enviarMensajeWhatsApp(numeroRemitente, texto);
  await guardarMensaje(conversacionId, 'saliente', texto);
}

async function obtenerMenuRaiz() {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/menus?padre_id=is.null&select=*&limit=1`,
    { headers: supabaseHeaders }
  );
  const datos = await resp.json();
  return Array.isArray(datos) && datos[0] ? datos[0] : null;
}

async function obtenerMenu(menuId) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/menus?id=eq.${menuId}&select=*`,
    { headers: supabaseHeaders }
  );
  const datos = await resp.json();
  return Array.isArray(datos) && datos[0] ? datos[0] : null;
}

async function cambiarMenuActual(conversacionId, menuId) {
  await fetch(`${SUPABASE_URL}/rest/v1/conversaciones?id=eq.${conversacionId}`, {
    method: 'PATCH',
    headers: supabaseHeaders,
    body: JSON.stringify({ menu_actual_id: menuId }),
  });
}

async function buscarOpcionEnMenu(menuId, textoUsuario) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/opciones?menu_id=eq.${menuId}&activo=eq.true&select=*`,
    { headers: supabaseHeaders }
  );
  const opciones = await resp.json();
  if (!Array.isArray(opciones)) return null;

  for (const opcion of opciones) {
    const disparadores = (opcion.disparador || '').split(',').map(d => d.trim().toLowerCase());
    if (disparadores.includes(textoUsuario)) {
      return opcion;
    }
  }
  return null;
}

async function buscarOCrearConversacion(telefono) {
  const buscar = await fetch(
    `${SUPABASE_URL}/rest/v1/conversaciones?telefono=eq.${telefono}&select=id,estado,ultima_actividad,menu_actual_id`,
    { headers: supabaseHeaders }
  );
  const encontradas = await buscar.json();

  if (Array.isArray(encontradas) && encontradas.length > 0) {
    return encontradas[0];
  }

  const raiz = await obtenerMenuRaiz();

  const crear = await fetch(`${SUPABASE_URL}/rest/v1/conversaciones`, {
    method: 'POST',
    headers: { ...supabaseHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({ telefono, estado: 'bot', menu_actual_id: raiz ? raiz.id : null }),
  });
  const creada = await crear.json();
  return Array.isArray(creada) ? creada[0] : null;
}

async function tocarConversacion(conversacionId) {
  await fetch(`${SUPABASE_URL}/rest/v1/conversaciones?id=eq.${conversacionId}`, {
    method: 'PATCH',
    headers: supabaseHeaders,
    body: JSON.stringify({ ultima_actividad: new Date().toISOString() }),
  });
}

async function cambiarEstado(conversacionId, estado) {
  await fetch(`${SUPABASE_URL}/rest/v1/conversaciones?id=eq.${conversacionId}`, {
    method: 'PATCH',
    headers: supabaseHeaders,
    body: JSON.stringify({ estado }),
  });
}

async function volverABot(conversacionId) {
  const raiz = await obtenerMenuRaiz();
  await fetch(`${SUPABASE_URL}/rest/v1/conversaciones?id=eq.${conversacionId}`, {
    method: 'PATCH',
    headers: supabaseHeaders,
    body: JSON.stringify({ estado: 'bot', menu_actual_id: raiz ? raiz.id : null }),
  });
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

async function obtenerConfigTexto(clave, valorPorDefecto) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/configuracion?clave=eq.${clave}&select=valor`,
    { headers: supabaseHeaders }
  );
  const resultados = await resp.json();
  return Array.isArray(resultados) && resultados[0] ? resultados[0].valor : valorPorDefecto;
}

async function obtenerConfigNumero(clave, valorPorDefecto) {
  const texto = await obtenerConfigTexto(clave, String(valorPorDefecto));
  const num = parseFloat(texto);
  return isNaN(num) ? valorPorDefecto : num;
}

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
