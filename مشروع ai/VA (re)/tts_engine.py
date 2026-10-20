import os
import requests
# from dotenv import load_dotenv # Removed
import uuid

# load_dotenv() # Removed

ELEVENLABS_API_KEY_HARDCODED = "sk_96a85c6b45c700b6316dd903e2df4d02b59fa471c0d2447e"
VOICE_ID = "UgBBYS2sOqTuMpoF3BR0"  # Replace with your actual voice ID if different

def text_to_speech(text, voice_id=VOICE_ID):
    if not text: # Prevent API call with empty text
        print("[TTS] Error: Empty text provided for speech synthesis.")
        return None
    try:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": ELEVENLABS_API_KEY_HARDCODED,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2", # Changed to multilingual v2 for better Arabic support
            "voice_settings": {
                "stability": 0.55,
                "similarity_boost": 0.70,
                "style": 0.3, # Added style parameter for potential expressiveness
                "use_speaker_boost": True
            }
        }

        print(f"[DEBUG] text_to_speech called with: '{text[:50]}...' for voice_id: {voice_id}")

        response = requests.post(url, headers=headers, json=payload, timeout=20) # Added timeout
        response.raise_for_status() # Will raise an HTTPError if the HTTP request returned an unsuccessful status code

        audio_data = response.content
        filename = f"speech_{uuid.uuid4().hex}.mp3"
        
        # Ensure the static directory exists
        static_dir = "static"
        if not os.path.exists(static_dir):
            os.makedirs(static_dir)
            print(f"[TTS] Created directory: {static_dir}")

        audio_path = os.path.join(static_dir, filename)

        with open(audio_path, "wb") as f:
            f.write(audio_data)

        print(f"[TTS] Audio saved to {audio_path}")
        return f"/{static_dir}/{filename}"  # Return URL to be used in frontend

    except requests.exceptions.RequestException as e:
        print(f"[TTS] Network/Request Error: {e}")
        # Optionally, return a pre-recorded error sound or a silent sound
        return None # Or a path to a generic error audio file
    except Exception as e:
        print(f"[TTS] General Error: {e}")
        return None

