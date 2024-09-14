const express = require('express');
const bodyParser = require('body-parser');
const { client, xml } = require('@xmpp/client');
const atob = require('atob');
const btoa = require('btoa');
const axios = require('axios');

// Desactiva la verificación de certificados autofirmados
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Asegúrate de que atob y btoa estén disponibles globalmente
global.atob = atob;
global.btoa = btoa;

const app = express();
app.use(bodyParser.json());

// URL del webhook (deberías configurar esto)
const WEBHOOK_URL = 'https://tu-url-de-webhook.com/endpoint';

// Crear una instancia del cliente XMPP
const xmpp = client({
  service: 'xmpp://redloop.yalovio.com:5222',
  domain: 'redloop.yalovio.com',
  resource: 'mac',
  username: 'mac',
  password: 'Koko1010',
});

// Manejar mensajes XMPP entrantes
xmpp.on('stanza', async (stanza) => {
  if (stanza.is('message') && stanza.getChild('body')) {
    const from = stanza.attrs.from;
    const body = stanza.getChildText('body');
    console.log(`Mensaje recibido de ${from}: ${body}`);

    // Enviar el mensaje al webhook
    try {
      await axios.post(WEBHOOK_URL, {
        from: from,
        message: body
      });
      console.log('Mensaje enviado al webhook');
    } catch (error) {
      console.error('Error al enviar mensaje al webhook:', error);
    }
  }
});

// Conectar al servidor XMPP
xmpp.start().catch(console.error);

// Ruta para enviar mensajes XMPP
app.post('/send-message', async (req, res) => {
    const { to, body } = req.body;
  if (!to || !body) {
    return res.status(400).json({ error: 'Se requieren los campos "to" y "body"' });
  }

  try {
    const message = xml(
      'message',
      { type: 'chat', to },
      xml('body', {}, body)
    );
    await xmpp.send(message);
    res.json({ success: true, message: 'Mensaje enviado con éxito' });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// Ruta para recibir mensajes del webhook
app.post('/webhook', (req, res) => {
  const { to, body } = req.body;
  if (!to || !body) {
    return res.status(400).json({ error: 'Se requieren los campos "to" y "body"' });
  }

  const message = xml(
    'message',
    { type: 'chat', to },
    xml('body', {}, body)
  );
  xmpp.send(message).catch(console.error);

  res.json({ success: true, message: 'Mensaje recibido y enviado' });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Servidor API escuchando en el puerto ${PORT}`);
});
