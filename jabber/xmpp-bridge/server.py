import logging
from flask import Flask, request, jsonify
from slixmpp import ClientXMPP
import asyncio
import ssl

# Configuración del logger
logging.basicConfig(level=logging.DEBUG, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

user_states = {}  # Para almacenar el estado de los usuarios

class XmppClient(ClientXMPP):
    def __init__(self, jid, password):
        super().__init__(jid, password)
        self.add_event_handler("session_start", self.start)
        self.add_event_handler("message", self.message)
        self.add_event_handler("presence", self.presence)
        self.messages = []
        self.connected_event = asyncio.Event()
        self.message_sent = asyncio.Event()

    async def start(self, event):
        self.send_presence()
        await self.get_roster()
        self.connected_event.set()
        logger.info(f"Session started for {self.boundjid.bare}")

    def message(self, msg):
        if msg['type'] in ('chat', 'normal'):
            logger.info(f"Message received: {msg['body']}")
            self.messages.append({
                'from': str(msg['from']),
                'body': msg['body'],
                'timestamp': str(msg['timestamp'])
            })

    def presence(self, presence):
        user = str(presence['from']).split('/')[0]
        user_states[user] = presence['type']
        logger.info(f"Presence update: {user} - {presence['type']}")

    async def send_message_to(self, to, body):
        await self.send_message(mto=to, mbody=body, mtype='chat')
        self.message_sent.set()
        logger.info(f"Message sent to {to}")

    async def get_messages(self):
        return self.messages

async def send_xmpp_message(jid, password, to, message):
    xmpp = XmppClient(jid, password)
    
    try:
        xmpp.ssl_version = ssl.PROTOCOL_TLSv1_2
        xmpp.ca_certs = None  # Usar los certificados del sistema
        logger.info(f"Attempting to connect to XMPP server as {jid}")
        await xmpp.connect(('msg.lapizypixel.com', 5222))
        logger.info("Connection established, waiting for session start")
        await asyncio.wait_for(xmpp.connected_event.wait(), timeout=10)
        logger.info("Session started, sending message")
        await xmpp.send_message_to(to, message)
        logger.info("Waiting for message to be sent")
        await asyncio.wait_for(xmpp.message_sent.wait(), timeout=10)
        logger.info("Message sent successfully")
        await xmpp.disconnect()
        return True
    except asyncio.TimeoutError:
        logger.error("Timeout while connecting or sending message")
        return False
    except Exception as e:
        logger.error(f"Error sending message: {str(e)}")
        return False

async def fetch_xmpp_messages(jid, password):
    xmpp = XmppClient(jid, password)
    
    try:
        xmpp.ssl_version = ssl.PROTOCOL_TLSv1_2
        xmpp.ca_certs = None
        logger.info(f"Attempting to connect to XMPP server as {jid} to fetch messages")
        await xmpp.connect(('msg.lapizypixel.com', 5222))
        logger.info("Connection established, waiting for session start")
        await asyncio.wait_for(xmpp.connected_event.wait(), timeout=10)
        logger.info("Session started, fetching messages")
        messages = await xmpp.get_messages()
        logger.info(f"Fetched {len(messages)} messages")
        await xmpp.disconnect()
        return messages
    except asyncio.TimeoutError:
        logger.error("Timeout while connecting to fetch messages")
        return []
    except Exception as e:
        logger.error(f"Error fetching messages: {str(e)}")
        return []

@app.route('/send-message', methods=['POST'])
def send_message():
    data = request.json
    jid = data.get('jid')
    password = data.get('password')
    to = data.get('to')
    message = data.get('message')

    if not jid or not password or not to or not message:
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        success = asyncio.run(send_xmpp_message(jid, password, to, message))
        if success:
            return jsonify({'success': True, 'message': 'Message sent'}), 200
        else:
            return jsonify({'error': 'Failed to send message'}), 500
    except Exception as e:
        logger.error(f"Exception in send_message route: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/read-messages', methods=['POST'])
def read_messages():
    data = request.json
    jid = data.get('jid')
    password = data.get('password')

    if not jid or not password:
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        messages = asyncio.run(fetch_xmpp_messages(jid, password))
        return jsonify(messages), 200
    except Exception as e:
        logger.error(f"Exception in read_messages route: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/user-states', methods=['GET'])
def user_states_endpoint():
    return jsonify(user_states)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3001, debug=True)