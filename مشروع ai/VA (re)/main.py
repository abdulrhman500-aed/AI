import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, request, jsonify, send_from_directory, url_for
import datetime
import random
from openai import OpenAI
from PIL import Image
import pytesseract
import io
import uuid # Import uuid for generating unique filenames
from tts_engine import text_to_speech

OPENAI_API_KEY_HARDCODED = "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"
client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=OPENAI_API_KEY_HARDCODED)

def query_openrouter_model(prompt):
    # Use Mistral 7B Instruct as the replacement model
    model_name = "mistralai/mistral-7b-instruct:free"
    print(f"Querying OpenRouter model: {model_name} with prompt: '{prompt}'") # Log the prompt
    try:
        response = client.chat.completions.create(
            model=model_name, 
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error querying OpenRouter model {model_name}: {e}")
        # Provide a user-friendly error message
        return "Sorry, I encountered an error trying to reach the AI model."

app = Flask(__name__, static_folder='static', static_url_path='/static')
UPLOAD_FOLDER = os.path.join(app.static_folder, 'uploads') # Define the upload folder within static
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Ensure the upload folder exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Keep the temporary upload folder for other potential uses, though not used for image saving now
TEMP_UPLOAD_FOLDER = ".uploads_temp"
if not os.path.exists(TEMP_UPLOAD_FOLDER):
    os.makedirs(TEMP_UPLOAD_FOLDER)

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/upload_image", methods=["POST"])
def upload_image():
    # image_url is no longer needed in the response
    try:
        if "image" not in request.files:
            err_msg = "No image file provided."
            audio_url = text_to_speech(err_msg)
            # Remove image_url from response
            return jsonify({"error": err_msg, "audio_url": audio_url}), 400
        
        file = request.files["image"]
        if file.filename == "":
            err_msg = "No image selected."
            audio_url = text_to_speech(err_msg)
            # Remove image_url from response
            return jsonify({"error": err_msg, "audio_url": audio_url}), 400

        # Generate a unique filename
        _, ext = os.path.splitext(file.filename)
        if not ext:
             # Handle cases like captured images without extension
             ext = '.png' if file.mimetype == 'image/png' else '.jpg'
        unique_filename = f"{uuid.uuid4()}{ext}"
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_filename)
        
        # Read image bytes, save to file, and also open with PIL
        img_bytes = file.read()
        # Save the image (still needed for processing, but URL not sent back)
        with open(save_path, 'wb') as f:
            f.write(img_bytes)
        print(f"Image saved to: {save_path}")
        # image_url = url_for('static', filename=f'uploads/{unique_filename}', _external=True) # No longer needed for response
        # print(f"Image URL: {image_url}")

        # Process image with PIL from bytes
        img_pil = Image.open(io.BytesIO(img_bytes))
        print(f"Attempting OCR on image: {file.filename}")

        ocr_text = pytesseract.image_to_string(img_pil, lang='eng').strip()

        response_payload = {}
        if ocr_text and len(ocr_text) > 5:
            print(f"OCR successful: {ocr_text[:100]}...")
            # Keep OCR text as is, it's usually short
            response_text = f"The image contains the following text: {ocr_text}"
            audio_url = text_to_speech(response_text)
            # Remove image_url from response
            response_payload = {"response": response_text, "audio_url": audio_url}
        else:
            print("OCR did not find significant text or text too short. Sending prompt for description.")
            # Modify the fallback prompt for brevity
            fallback_prompt = "Describe this image in one or two sentences maximum."
            response_text = query_openrouter_model(fallback_prompt)
            audio_url = text_to_speech(response_text)
            # Remove image_url from response
            response_payload = {"response": response_text, "audio_url": audio_url}
            
        return jsonify(response_payload)

    except pytesseract.TesseractNotFoundError:
        err_msg = "OCR engine (Tesseract) not found or not configured correctly on the server."
        print(f"Error: {err_msg}")
        audio_url = text_to_speech(err_msg)
        # Remove image_url from error response
        return jsonify({"error": err_msg, "audio_url": audio_url}), 500
    except Exception as e:
        err_msg = f"Unexpected error during image processing: {str(e)}"
        print(f"Error: {err_msg}")
        audio_url = text_to_speech(err_msg)
        # Remove image_url from error response
        return jsonify({"error": err_msg, "audio_url": audio_url}), 500

@app.route("/command", methods=["POST"])
def handle_command():
    data = request.get_json()
    command_text = data.get("command", "").lower().strip()
    response_text = ""
    action_data = {}

    if not command_text:
        response_text = "No command provided."
        audio_url = text_to_speech(response_text)
        return jsonify({"error": response_text, "audio_url": audio_url}), 400

    print(f"Received command: {command_text}")

    # Handle specific, short commands directly
    if "time" in command_text:
        now = datetime.datetime.now()
        response_text = f"The current time is {now.strftime('%I:%M %p')}."
    elif "date" in command_text: # Use elif for mutually exclusive commands
        now = datetime.datetime.now()
        response_text = f"Today's date is {now.strftime('%A, %B %d, %Y')}."
    elif "open google" in command_text:
        response_text = "Opening Google."
        action_data = {"action": "open_url", "url": "https://www.google.com"}
    elif "open youtube" in command_text:
        response_text = "Opening YouTube."
        action_data = {"action": "open_url", "url": "https://www.youtube.com"}
    else:
        # Modify the general command prompt for brevity
        short_prompt = f"Respond to the following in one or two sentences maximum: {command_text}"
        response_text = query_openrouter_model(short_prompt)

    audio_url = text_to_speech(response_text) # ElevenLabs will use English based on text
    
    response_payload = {"response": response_text, "audio_url": audio_url}
    if action_data:
        response_payload.update(action_data)
        
    return jsonify(response_payload)

if __name__ == "__main__":
    # Clean up temporary upload folder if it exists from a previous run
    if os.path.exists(TEMP_UPLOAD_FOLDER):
        import shutil
        try:
            shutil.rmtree(TEMP_UPLOAD_FOLDER)
            print(f"Cleaned up old temp upload folder: {TEMP_UPLOAD_FOLDER}")
        except Exception as e:
            print(f"Error cleaning up temp upload folder {TEMP_UPLOAD_FOLDER}: {e}")
    os.makedirs(TEMP_UPLOAD_FOLDER, exist_ok=True)
    
    # Note: The static uploads folder is NOT cleaned up automatically
    # You might want to add a cleanup mechanism if needed

    app.run(host="0.0.0.0", port=5000, debug=True)

