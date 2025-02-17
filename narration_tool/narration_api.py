import os
import json
import subprocess
import shlex
from TTS.api import TTS
from flask import Flask, request, jsonify
import tempfile

# Establecer las variables de entorno para aceptar los términos de servicio
os.environ["COQUI_TOS_AGREED"] = "1"

app = Flask(__name__)

BASE_DIR = 'narration_output'
JSON_FILE_NAME = 'progress.json'
MP3_PARTS_DIR = 'mp3_parts'
NARRATED_MD_DIR = 'transcripts_narrated_md'
SAMPLE_FILE = '/app/narration_tool/sample_es/output.wav'

# Usar CPU
device = os.environ.get('TORCH_DEVICE', 'cpu')
print(f"Using device: {device}")

# Inicializar el TTS una vez al inicio
def initialize_tts():
    try:
        return TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=False).to(device)
    except Exception as e:
        print(f"Error initializing TTS: {str(e)}")
        return None

tts = initialize_tts()

def ensure_directory_exists(directory):
    os.makedirs(directory, exist_ok=True)

def escape_shell(cmd):
    return shlex.quote(cmd)

def clean_filename(filename):
    return filename.replace("'", "").replace('"', "").replace("\\", "").replace("/", "_")

def group_text_algorithmic_250(input_text, max_length=250):
    sentences = input_text.split('. ')
    groups = []
    current_group = []
    current_length = 0

    for sentence in sentences:
        sentence_length = current_length + len(sentence) + (1 if current_group else 0)

        if sentence_length <= max_length:
            current_group.append(sentence)
            current_length = sentence_length
        else:
            groups.append({
                'title': f'Group {len(groups) + 1}',
                'content': '. '.join(current_group) + '.'
            })
            current_group = [sentence]
            current_length = len(sentence)

    if current_group:
        groups.append({
            'title': f'Group {len(groups) + 1}',
            'content': '. '.join(current_group) + '.'
        })

    print(f"Groups Text: {json.dumps(groups, indent=2)}\n\n")
    return groups

def text_to_wav(text, output_file, language):
    max_text_length = 10000
    truncated_text = text[:max_text_length] + '...' if len(text) > max_text_length else text

    try:
        tts.tts_to_file(text=truncated_text, file_path=output_file, speaker_wav=SAMPLE_FILE, language=language)
    except RuntimeError as e:
        print(f"Error en text_to_wav: {str(e)}")
        print("Intentando con un fragmento más corto...")
        half_length = len(truncated_text) // 2
        tts.tts_to_file(text=truncated_text[:half_length], file_path=output_file, speaker_wav=SAMPLE_FILE, language=language)

def wav_to_mp3(input_file, output_file):
    command = f"ffmpeg -i {escape_shell(input_file)} -acodec libmp3lame -b:a 128k {escape_shell(output_file)}"
    subprocess.run(command, shell=True, check=True)

def concatenate_mp3_files(input_files, output_file):
    def escape_path(path):
        return path.replace("'", "'\\''").replace('"', '\\"')

    file_list_content = '\n'.join("file '{}'".format(escape_path(file)) for file in input_files)
    list_file_path = os.path.join(os.getcwd(), 'file_list.txt')

    with open(list_file_path, 'w') as f:
        f.write(file_list_content)

    output_dir = os.path.dirname(output_file)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    command = 'ffmpeg -f concat -safe 0 -i "{}" -c copy "{}"'.format(list_file_path, escape_path(output_file))
    print('Executing command:', command)

    subprocess.run(command, shell=True, check=True)
    os.remove(list_file_path)

def initialize_or_load_progress(md_file_name, groups):
    progress_file_path = os.path.join(BASE_DIR, md_file_name, JSON_FILE_NAME)
    if os.path.exists(progress_file_path):
        with open(progress_file_path, 'r') as f:
            return json.load(f)
    else:
        progress = [
            {
                'groupIndex': index,
                'content': group['content'],
                'mp3FileName': f'group_{index}.mp3',
                'completed': False
            }
            for index, group in enumerate(groups)
        ]
        with open(progress_file_path, 'w') as f:
            json.dump(progress, f, indent=2)
        return progress

def update_progress(md_file_name, group_index):
    progress_file_path = os.path.join(BASE_DIR, md_file_name, JSON_FILE_NAME)
    with open(progress_file_path, 'r') as f:
        progress = json.load(f)
    progress[group_index]['completed'] = True
    with open(progress_file_path, 'w') as f:
        json.dump(progress, f, indent=2)

@app.route('/narrate', methods=['POST'])
def narrate():
    data = request.json
    input_text = data.get('text')
    language = data.get('language', 'es')

    if not input_text:
        return jsonify({"error": "No text provided"}), 400

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            md_file_name = "temp_narration"
            md_dir = os.path.join(temp_dir, md_file_name)
            mp3_parts_full_dir = os.path.join(md_dir, MP3_PARTS_DIR)
            os.makedirs(mp3_parts_full_dir, exist_ok=True)

            groups = group_text_algorithmic_250(input_text, 250)
            progress = initialize_or_load_progress(md_file_name, groups)
            mp3_files = []

            for i, group in enumerate(progress):
                print(f"Processing group {i + 1} of {len(progress)}")
                wav_file = os.path.join(mp3_parts_full_dir, f"group_{i}.wav")
                try:
                    text_to_wav(group['content'], wav_file, language)
                except Exception as e:
                    print(f"Error processing group {i + 1}: {str(e)}")
                    continue

                mp3_file = os.path.join(mp3_parts_full_dir, group['mp3FileName'])
                wav_to_mp3(wav_file, mp3_file)
                mp3_files.append(mp3_file)

                os.remove(wav_file)
                update_progress(md_file_name, i)

            final_mp3_file = os.path.join(md_dir, f"{md_file_name}_final.mp3")
            concatenate_mp3_files(mp3_files, final_mp3_file)

            with open(final_mp3_file, 'rb') as f:
                mp3_data = f.read()

        return mp3_data, 200, {'Content-Type': 'audio/mpeg'}

    except Exception as error:
        return jsonify({"error": str(error)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)