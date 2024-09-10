const express = require('express');
const xmpp = require('simple-xmpp');

const app = express();
app.use(express.json());

const XMPP_JID = process.env.XMPP_JID || 'roboto@msg.lapizypixel.com';
const XMPP_PASSWORD = process.env.XMPP_PASSWORD || 'Koko2020';
const XMPP_HOST = process.env.XMPP_HOST || 'msg.lapizypixel.com';
const XMPP_PORT = process.env.XMPP_PORT || 5222;

let messageStore = [];
let userStates = new Map();

xmpp.connect({
    jid: XMPP_JID,
    password: XMPP_PASSWORD,
    host: XMPP_HOST,
    port: XMPP_PORT
});

xmpp.on('online', () => {
    console.log('Connected to XMPP server');
    xmpp.getRoster();
});

xmpp.on('error', (err) => {
    console.error('XMPP Error:', err);
});

xmpp.on('chat', (from, message) => {
    console.log(`Received message from ${from}: ${message}`);
    messageStore.push({ from, message, timestamp: new Date() });
});

xmpp.on('buddy', (jid, state, statusText) => {
    console.log(`Buddy ${jid} is ${state} (${statusText})`);
    userStates.set(jid, { state, statusText });
});

xmpp.on('subscribe', (from) => {
    console.log(`Subscription request from ${from}`);
    xmpp.acceptSubscription(from);
});

xmpp.on('stanza', (stanza) => {
    console.log('Received stanza:', stanza.toString());
    if (stanza.is('message') && stanza.attrs.type === 'error') {
        console.error('Error stanza received:', stanza.toString());
        const errorEl = stanza.getChild('error');
        if (errorEl) {
            const errorType = errorEl.attrs.type;
            const errorCondition = errorEl.children[0].name;
            console.error(`Error type: ${errorType}, condition: ${errorCondition}`);
        }
    }
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendMessageWithRetry(to, message, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`Attempt ${i + 1} to send message to ${to}`);
            await new Promise((resolve, reject) => {
                xmpp.send(to, message, 'chat', (err, stanza) => {
                    if (err) {
                        console.error('Error while sending message:', err);
                    } else {
                        console.log('Sent stanza:', stanza.toString());
                    }
                });
            });
            return; // Message sent successfully
        } catch (error) {
            console.error(`Error on attempt ${i + 1}:`, error);
            if (i === maxRetries - 1) {
                throw error; // Throw error on last attempt
            }
            await sleep(1000 * (i + 1)); // Wait before retrying
        }
    }
}

app.post('/send-message', async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log(`Attempting to send message to ${to}: ${message}`);
    console.log(`Current user state: ${JSON.stringify(userStates.get(to))}`);

    const userState = userStates.get(to);
    if (!userState || ['offline', 'xa', 'away', 'dnd'].includes(userState.state)) {
        return res.status(400).json({ error: 'User is not available', userState });
    }

    try {
        await sendMessageWithRetry(to, message);
        res.json({ success: true, message: 'Message sent' });
    } catch (error) {
        console.error('Failed to send message after retries:', error);
        res.status(500).json({ success: false, error: 'Failed to send message', details: error.message });
    }
});

app.post('/add-contact', (req, res) => {
    const { jid } = req.body;
    if (!jid) {
        return res.status(400).json({ error: 'Missing JID parameter' });
    }

    xmpp.subscribe(jid);
    res.json({ success: true, message: `Subscription sent to ${jid}` });
});

app.get('/read-messages', (req, res) => {
    res.json(messageStore);
});

app.get('/user-states', (req, res) => {
    const states = Object.fromEntries(userStates);
    res.json(states);
});

app.post('/clear-messages', (req, res) => {
    messageStore = [];
    res.json({ success: true, message: 'Message store cleared' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Verificación periódica de conexión
setInterval(() => {
    if (xmpp.conn.connected) {
        console.log('XMPP connection is active');
    } else {
        console.log('XMPP connection is not active, attempting to reconnect...');
        xmpp.connect({
            jid: XMPP_JID,
            password: XMPP_PASSWORD,
            host: XMPP_HOST,
            port: XMPP_PORT
        });
    }
}, 60000); // Verifica cada minuto