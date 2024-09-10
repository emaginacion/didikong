const express = require('express');
const xmpp = require('simple-xmpp');

const app = express();
app.use(express.json());

const XMPP_JID = process.env.XMPP_JID || 'roboto@msg.lapizypixel.com';
const XMPP_PASSWORD = process.env.XMPP_PASSWORD || 'Koko2020';
const XMPP_HOST = process.env.XMPP_HOST || 'msg.lapizypixel.com';
const XMPP_PORT = process.env.XMPP_PORT || 5222;

// Almacén de mensajes en memoria
let messageStore = [];

xmpp.connect({
    jid: XMPP_JID,
    password: XMPP_PASSWORD,
    host: XMPP_HOST,
    port: XMPP_PORT
});

xmpp.on('online', () => {
    console.log('Connected to XMPP server');
});

xmpp.on('error', (err) => {
    console.error('XMPP Error:', err);
});

// Manejar mensajes entrantes
xmpp.on('chat', (from, message) => {
    console.log(`Received message from ${from}: ${message}`);
    messageStore.push({ from, message, timestamp: new Date() });
});

app.post('/send-message', (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    xmpp.send(to, message, 'chat');
    res.json({ success: true, message: 'Message sent' });
});

// Nuevo endpoint para leer mensajes
app.get('/read-messages', (req, res) => {
    res.json(messageStore);
});

// Nuevo endpoint para limpiar el almacén de mensajes
app.post('/clear-messages', (req, res) => {
    messageStore = [];
    res.json({ success: true, message: 'Message store cleared' });
});

app.get('/test', (req, res) => {
    res.send('Test route working');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});