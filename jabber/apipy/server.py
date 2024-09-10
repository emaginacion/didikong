import asyncio
import logging
from typing import Dict
import threading
import time
import ssl

import slixmpp
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Configuración de logging
logging.basicConfig(level=logging.DEBUG,
                    format='%(asctime)s [%(levelname)s] %(message)s')

# Configuración XMPP
XMPP_JID = "roboto@msg.lapizypixel.com"
XMPP_PASSWORD = "Koko2020"
XMPP_HOST = "msg.lapizypixel.com"
XMPP_PORT = 5222  # Puerto estándar para XMPP

# Modelo de datos para el mensaje
class Message(BaseModel):
    to: str
    body: str

# Cliente XMPP
class XMPPBot(slixmpp.ClientXMPP):
    def __init__(self, jid, password):
        super().__init__(jid, password)

        self.user_states: Dict[str, str] = {}
        self.connected = threading.Event()

        # Registrar plugins
        self.register_plugin('xep_0030') # Service Discovery
        self.register_plugin('xep_0199') # XMPP Ping

        # Registrar manejadores de eventos
        self.add_event_handler("session_start", self.session_start)
        self.add_event_handler("message", self.message)
        self.add_event_handler("presence", self.presence)
        self.add_event_handler("disconnected", self.on_disconnected)

    async def session_start(self, event):
        self.send_presence()
        await self.get_roster()
        self.connected.set()
        logging.info("XMPP session started")

    def message(self, msg):
        if msg['type'] in ('chat', 'normal'):
            logging.info(f"Mensaje recibido de {msg['from']}: {msg['body']}")

    def presence(self, presence):
        from_jid = presence['from'].bare
        if presence['type'] == 'available':
            self.user_states[from_jid] = 'online'
        elif presence['type'] == 'unavailable':
            self.user_states[from_jid] = 'offline'
        logging.info(f"Actualización de presencia: {from_jid} está {self.user_states.get(from_jid, 'desconocido')}")

    def on_disconnected(self, event):
        logging.warning("XMPP client disconnected")
        self.connected.clear()

    def send_message_sync(self, to, body):
        if not self.connected.is_set():
            logging.error("XMPP client not connected")
            return False
        try:
            self.send_message(mto=to, mbody=body, mtype='chat')
            logging.info(f"Mensaje enviado a {to}: {body}")
            return True
        except Exception as e:
            logging.error(f"Error al enviar mensaje: {e}")
            return False

# Inicializar el cliente XMPP
xmpp = XMPPBot(XMPP_JID, XMPP_PASSWORD)

def run_xmpp_client():
    logging.info("Iniciando cliente XMPP...")
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    while True:
        try:
            # Configurar SSL
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

            if xmpp.connect((XMPP_HOST, XMPP_PORT), use_ssl=False, disable_starttls=False):
                xmpp.process(forever=True)
            else:
                logging.error("No se pudo conectar al servidor XMPP")
        except Exception as e:
            logging.error(f"Error en la conexión XMPP: {e}")
        time.sleep(5)  # Esperar antes de intentar reconectar

# Iniciar el cliente XMPP en un hilo separado
xmpp_thread = threading.Thread(target=run_xmpp_client)
xmpp_thread.daemon = True
xmpp_thread.start()

# Esperar a que el cliente XMPP se conecte
timeout = 60  # Aumentamos el tiempo de espera a 60 segundos
start_time = time.time()
while not xmpp.connected.is_set():
    if time.time() - start_time > timeout:
        logging.error("Timeout esperando la conexión XMPP")
        break
    time.sleep(1)

# Inicializar FastAPI
app = FastAPI()

@app.post("/send_message")
async def send_message(message: Message):
    logging.info(f"Intento de enviar mensaje a {message.to}: {message.body}")
    logging.info(f"Estados de usuario actuales: {xmpp.user_states}")
    
    if not xmpp.connected.is_set():
        raise HTTPException(status_code=503, detail="XMPP client not connected")
    
    if message.to not in xmpp.user_states:
        raise HTTPException(status_code=400, detail=f"Usuario {message.to} no encontrado en la lista de estados")
    
    if xmpp.user_states[message.to] != 'online':
        raise HTTPException(status_code=400, detail=f"Usuario {message.to} no está en línea. Estado actual: {xmpp.user_states[message.to]}")
    
    success = xmpp.send_message_sync(message.to, message.body)
    if success:
        return {"status": "success", "message": "Mensaje enviado"}
    else:
        raise HTTPException(status_code=500, detail="Error al enviar el mensaje")

@app.get("/user_states")
async def get_user_states():
    return xmpp.user_states

@app.get("/connection_status")
async def connection_status():
    return {"connected": xmpp.connected.is_set()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)