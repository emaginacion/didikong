const express = require('express');
const xmpp = require('node-xmpp-client');
const { Buffer } = require('buffer');

global.atob = (b64Encoded) => Buffer.from(b64Encoded, 'base64').toString('utf8');
global.btoa = (str) => Buffer.from(str, 'utf8').toString('base64');

const app = express();
const port = process.env.PORT || 3333;

const xmppOptions = {
  jid: 'mac@redloop.yalovio.com/mac',
  password: 'Koko1010',
  host: 'redloop.yalovio.com',
  port: 5222,
  reconnect: true,
  legacySSL: true,
  preferredSaslMechanism: 'PLAIN'
};

const client = new xmpp.Client(xmppOptions);

client.on('online', () => {
  console.log('XMPP client is online');
  client.send(new xmpp.Element('presence'));
});

client.on('error', (err) => {
  console.error('XMPP client error:', err);
});

client.on('stanza', (stanza) => {
  console.log('Incoming stanza: ', stanza.toString());
});

app.use(express.json());

app.post('/send-message', (req, res) => {
  const { to, body } = req.body;

  if (!to || !body) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const stanza = new xmpp.Element('message', { to: to, type: 'chat' })
      .c('body')
      .t(body);

    client.send(stanza);
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error sending XMPP message:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'XMPP API is running' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`XMPP API listening at http://0.0.0.0:${port}`);
});