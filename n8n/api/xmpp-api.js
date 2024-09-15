const express = require('express');
const bodyParser = require('body-parser');
const { client, xml } = require('@xmpp/client');
const fetch = require('node-fetch');

global.atob = require('atob');
global.btoa = require('btoa');

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

// Configurar el webhook URL de n8n
const webhookUrl = 'https://alamo.yalovio.com/webhook/277d7705-19f8-41bb-8a31-15e435fd0f31';

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

    // Enviar al webhook de n8n
    try {
      const response = await fetch(`${webhookUrl}?from=${encodeURIComponent(from)}&body=${encodeURIComponent(body)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        console.error('Error al enviar al webhook:', await response.text());
      } else {
        console.log('Mensaje enviado exitosamente al webhook de n8n');
      }
    } catch (error) {
      console.error('Error al enviar al webhook:', error);
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