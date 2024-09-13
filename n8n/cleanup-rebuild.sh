#!/bin/bash

# Detener todos los contenedores
echo "Deteniendo todos los contenedores..."
docker-compose down

# Eliminar todos los contenedores (incluidos los detenidos)
echo "Eliminando todos los contenedores..."
docker rm -f $(docker ps -a -q)

# Eliminar todas las imágenes
echo "Eliminando todas las imágenes..."
docker rmi -f $(docker images -q)

# Eliminar todos los volúmenes (opcional, descomentar si se desea una limpieza completa)
echo "Eliminando todos los volúmenes..."
docker volume rm $(docker volume ls -q)

# Eliminar todas las redes personalizadas (excepto las predeterminadas)
echo "Eliminando todas las redes personalizadas..."
docker network prune -f

# Limpiar el caché de construcción
echo "Limpiando el caché de construcción..."
docker builder prune -af

# Reconstruir y reiniciar los servicios
echo "Reconstruyendo y reiniciando los servicios..."
docker-compose up -d --build

echo "Proceso completado. Los servicios deberían estar ejecutándose con imágenes recién construidas."