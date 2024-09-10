from contextlib import asynccontextmanager
import asyncio
from server import xmpp

@asynccontextmanager
async def lifespan(app):
    # Código que se ejecuta antes de que la aplicación comience
    xmpp.connect()
    asyncio.create_task(xmpp.process(forever=False))
    
    yield  # La aplicación se ejecuta aquí
    
    # Código que se ejecuta cuando la aplicación se cierra
    xmpp.disconnect()