FROM pytorch/pytorch:latest

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copiar los archivos necesarios
COPY requirements.txt .
COPY narration_api.py .

# Crear el directorio para el archivo de muestra
RUN mkdir -p /app/narration_tool/sample_es

# Copiar el archivo de muestra
COPY sample_es/output.wav /app/narration_tool/sample_es/output.wav

# Instalar dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt

# Pre-descargar el modelo TTS
ENV COQUI_TOS_AGREED=1
RUN python -c "from TTS.api import TTS; TTS(model_name='tts_models/multilingual/multi-dataset/xtts_v2', progress_bar=False)"

# Exponer el puerto 5000
EXPOSE 5000

# Comando para ejecutar la aplicación
CMD ["python", "narration_api.py"]