const express = require('express');
const bodyParser = require('body-parser');
const { client, xml } = require('@xmpp/client');

// Implementación de atob y btoa para Node.js
global.atob = function(b64Encoded) {
    return Buffer.from(b64Encoded, 'base64').toString('binary');
};

global.btoa = function(str) {
    return Buffer.from(str, 'binary').toString('base64');
};

// Desactiva la verificación de certificados autofirmados
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
app.use(bodyParser.json());

// Crear una instancia del cliente XMPP
const xmpp = client({
  service: 'xmpp://redloop.yalovio.com:5222',
  domain: 'redloop.yalovio.com',
  resource: 'mac',
  username: 'mac',
  password: 'Koko1010',
});

// Almacenar el webhook URL
let webhookUrl = '';

// Ruta para configurar el webhook
app.post('/set-webhook', (req, res) => {
  webhookUrl = req.body.url;
  res.json({ message: 'Webhook configurado correctamente' });
});

// Ruta para enviar mensajes
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
    res.json({ message: 'Mensaje enviado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
});

// Manejar conexión XMPP
xmpp.on('online', async (address) => {
  console.log(`Conectado como ${address.toString()}`);

  const presence = xml('presence', {});
  await xmpp.send(presence);
  console.log('Presencia enviada al servidor.');
});

// Escuchar mensajes entrantes
xmpp.on('stanza', async (stanza) => {
  if (stanza.is('message') && stanza.getChild('body')) {
    const from = stanza.attrs.from;
    const body = stanza.getChildText('body');
    console.log(`Mensaje recibido de ${from}: ${body}`);

    // Enviar al webhook si está configurado
    if (webhookUrl) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, body }),
        });
        if (!response.ok) {
          console.error('Error al enviar al webhook:', await response.text());
        }
      } catch (error) {
        console.error('Error al enviar al webhook:', error);
      }
    }
  }
});

// Manejar errores de conexión
xmpp.on('error', (err) => {
  console.error('Error de conexión XMPP:', err);
});

// Iniciar la conexión XMPP
xmpp.start().catch(console.error);

// Iniciar el servidor Express
const PORT = 3333;
app.listen(PORT, () => {
  console.log(`Servidor API corriendo en http://localhost:${PORT}`);
});