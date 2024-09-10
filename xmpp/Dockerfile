# Utilizamos una imagen base de Debian
FROM debian:latest

# Actualizamos e instalamos dependencias
RUN apt-get update && apt-get install -y \
    prosody \
    certbot \
    ufw

# Copiamos los archivos de configuración del servidor y los certificados SSL
COPY prosody.cfg.lua /etc/prosody/prosody.cfg.lua
COPY certs/ /etc/prosody/certs/

# Asignamos los permisos necesarios a los archivos de configuración y certificados
RUN chown -R prosody:prosody /etc/prosody/certs && \
    chmod -R 755 /etc/prosody/certs

# Exponemos los puertos necesarios para XMPP (5222 para clientes y 5269 para servidores)
EXPOSE 5222 5269

# Definimos el comando de inicio del servidor Prosody
CMD ["prosodyctl", "start"]
