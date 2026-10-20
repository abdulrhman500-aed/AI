
const conversationBox = document.getElementById("conversationBox");
const micButton = document.getElementById("micButton");
const cameraButton = document.getElementById("cameraButton");
const uploadButtonLabel = document.getElementById("uploadButtonLabel");
const imageUpload = document.getElementById("imageUpload");
const replayButton = document.getElementById("replayButton");
const stopAudioButton = document.getElementById("stopAudioButton");
const cameraArea = document.getElementById("cameraArea");
const cameraPreview = document.getElementById("cameraPreview");
const captureCanvas = document.getElementById("captureCanvas");
const captureButton = document.getElementById("captureButton");
const closeCameraButton = document.getElementById("closeCameraButton");
const statusArea = document.getElementById("statusArea");
const audioPlayer = document.getElementById("audioPlayer");
const loadingSpinner = document.getElementById("loadingSpinner");

let stream = null;
let recognition = null;
let isListening = false;
let lastAudioUrl = null;

function clearConversationPlaceholder() {
    const placeholder = conversationBox.querySelector("p");
    if (placeholder && placeholder.textContent.includes("Your conversation will appear here")) {
        conversationBox.innerHTML = "";
    }
}

// Updated addMessage function: Text is now optional if imageUrl is provided for user messages
function addMessage(text, type, isError = false, imageUrl = null) {
    clearConversationPlaceholder();
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", type === "user" ? "user-message" : "assistant-message");
    if (type === "assistant" && isError) {
        messageDiv.classList.add("error");
    }

    // If an image URL is provided (primarily for user messages now)
    if (imageUrl) {
        const imgElement = document.createElement("img");
        imgElement.src = imageUrl;
        imgElement.alt = (type === "user") ? "Your uploaded/captured image" : "Assistant related image";
        imgElement.classList.add("conversation-image"); // Add a class for styling
        // Make image accessible by adding alt text or linking text
        imgElement.setAttribute("aria-label", imgElement.alt);
        messageDiv.appendChild(imgElement);
    }

    // Add the text content if provided
    if (text) {
        const textElement = document.createElement("p");
        textElement.textContent = text;
        messageDiv.appendChild(textElement);
    }

    conversationBox.appendChild(messageDiv);
    conversationBox.scrollTop = conversationBox.scrollHeight; // Scroll to the bottom
}

function showLoading(show) {
    loadingSpinner.style.display = show ? "block" : "none";
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US'; // Changed to English
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isListening = true;
        micButton.classList.add("listening");
        micButton.title = "Listening...";
        micButton.setAttribute("aria-label", "Stop Listening");
        statusArea.textContent = "Listening...";
        console.log("Voice recognition started.");
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("Transcript:", transcript);
        addMessage(transcript, "user"); // User voice commands don't have images
        sendCommand(transcript);
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        let errorMessage = "Speech recognition error.";
        if (event.error === 'no-speech') {
            errorMessage = "No speech detected. Please try again.";
        } else if (event.error === 'audio-capture') {
            errorMessage = "Microphone error. Please check permissions.";
        } else if (event.error === 'not-allowed') {
            errorMessage = "Microphone access denied.";
        }
        addMessage(errorMessage, "assistant", true); // Error messages don't have images
        playAudioFeedback(errorMessage);
    };

    recognition.onend = () => {
        isListening = false;
        micButton.classList.remove("listening");
        micButton.classList.remove("disabled");
        micButton.title = "Start/Stop Listening (Space)";
        micButton.setAttribute("aria-label", "Start Listening");
        statusArea.textContent = "Press Space to start/stop listening";
        console.log("Voice recognition ended.");
    };

} else {
    console.error("Speech Recognition API not supported in this browser.");
    micButton.disabled = true;
    micButton.classList.add("disabled");
    addMessage("Speech recognition not supported by this browser.", "assistant", true);
}

function playAudioUrl(url) {
    if (url) {
        lastAudioUrl = url;
        audioPlayer.src = url;
        audioPlayer.play().catch(e => {
            console.error("Error playing audio:", e);
            addMessage("Error playing audio.", "assistant", true);
        });
    } else {
        console.warn("No audio URL provided to playAudioUrl");
    }
}

function stopAllAudio() {
    // Stop ElevenLabs audio player
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
    // Stop browser's speech synthesis (fallback)
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    console.log("All audio playback stopped.");
}

function playAudioFeedback(message) {
    if ('speechSynthesis' in window) {
        stopAllAudio(); // Stop any previous audio before playing new feedback
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = 'en-US'; // Changed to English
        utterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance.onerror', event);
        };
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn("Text-to-Speech API not supported for feedback.");
    }
}

micButton.addEventListener("click", () => {
    if (!recognition) return;
    stopAllAudio(); // Stop any playing audio before starting recognition
    if (isListening) {
        recognition.stop();
    } else {
        try {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(() => {
                    recognition.start();
                })
                .catch(err => {
                    console.error("Microphone access error:", err);
                    addMessage("Microphone access denied. Please check permissions.", "assistant", true);
                });
        } catch (err) {
            console.error("Recognition start error:", err);
            addMessage("Error starting speech recognition.", "assistant", true);
        }
    }
});

// Keyboard shortcut - Space to toggle listening
document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        micButton.click();
    }
});

// Camera functionality
cameraButton.addEventListener("click", async () => {
    try {
        stopAllAudio();
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraPreview.srcObject = stream;
        cameraArea.style.display = "block";
        statusArea.textContent = "Camera ready";
    } catch (err) {
        console.error("Camera error:", err);
        addMessage("Could not access camera. Please check permissions.", "assistant", true);
        playAudioFeedback("Could not access camera. Please check permissions.");
    }
});

captureButton.addEventListener("click", () => {
    if (!stream) return;

    // Set canvas dimensions to match video
    captureCanvas.width = cameraPreview.videoWidth;
    captureCanvas.height = cameraPreview.videoHeight;

    // Draw current video frame to canvas
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(cameraPreview, 0, 0, captureCanvas.width, captureCanvas.height);

    // Convert canvas to blob
    captureCanvas.toBlob(async (blob) => {
        // Close camera immediately after capture
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        cameraPreview.srcObject = null;
        cameraArea.style.display = "none";
        statusArea.textContent = "Processing image...";

        // Create a temporary URL for the blob to display it immediately
        const tempImageUrl = URL.createObjectURL(blob);
        
        // Add the captured image as a USER message
        addMessage(null, "user", false, tempImageUrl); // Display image only for user message

        // Play capture sound feedback
        playAudioFeedback("Image captured. Processing...");

        // Process image in background
        try {
            showLoading(true);
            const formData = new FormData();
            formData.append('image', blob, 'capture.png');

            const response = await fetch('/upload_image', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            showLoading(false);

            // Add the ASSISTANT's text response (no image here)
            if (response.ok) {
                addMessage(data.response, "assistant");
                if (data.audio_url) {
                    playAudioUrl(data.audio_url);
                }
            } else {
                addMessage(data.error || "Error processing image", "assistant", true);
                if (data.audio_url) {
                    playAudioUrl(data.audio_url);
                }
            }
        } catch (err) {
            console.error("Upload error:", err);
            addMessage("Error processing image", "assistant", true);
            playAudioFeedback("Error processing image");
            showLoading(false);
        } finally {
            // Clean up the temporary URL
            URL.revokeObjectURL(tempImageUrl);
        }

        statusArea.textContent = "Press Space to start/stop listening";
    }, 'image/png');
});

closeCameraButton.addEventListener("click", () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    cameraPreview.srcObject = null;
    cameraArea.style.display = "none";
    statusArea.textContent = "Press Space to start/stop listening";
});

// Image upload functionality
imageUpload.addEventListener("change", async (e) => {
    if (e.target.files.length === 0) return;

    const file = e.target.files[0];
    
    // Create a temporary URL for the file to display it immediately
    const tempImageUrl = URL.createObjectURL(file);

    // Add the uploaded image as a USER message
    addMessage(null, "user", false, tempImageUrl); // Display image only for user message

    const formData = new FormData();
    formData.append('image', file);

    try {
        showLoading(true);
        const response = await fetch('/upload_image', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        showLoading(false);

        // Add the ASSISTANT's text response (no image here)
        if (response.ok) {
            addMessage(data.response, "assistant");
            if (data.audio_url) {
                playAudioUrl(data.audio_url);
            }
        } else {
            addMessage(data.error || "Error processing image", "assistant", true);
            if (data.audio_url) {
                playAudioUrl(data.audio_url);
            }
        }
    } catch (err) {
        console.error("Upload error:", err);
        addMessage("Error uploading image", "assistant", true);
        playAudioFeedback("Error uploading image");
        showLoading(false);
    } finally {
        // Clean up the temporary URL
        URL.revokeObjectURL(tempImageUrl);
        // Reset the input to allow uploading the same file again
        e.target.value = ''; 
    }
});

replayButton.addEventListener("click", () => {
    if (lastAudioUrl) {
        playAudioUrl(lastAudioUrl);
    } else {
        playAudioFeedback("No audio to replay");
    }
});

stopAudioButton.addEventListener("click", stopAllAudio);

// Handle command sending to server
async function sendCommand(command) {
    try {
        showLoading(true);
        const response = await fetch('/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ command })
        });

        const data = await response.json();
        showLoading(false);

        if (response.ok) {
            addMessage(data.response, "assistant"); // Regular commands don't have images
            if (data.audio_url) {
                playAudioUrl(data.audio_url);
            }
            if (data.action === "open_url" && data.url) {
                window.open(data.url, "_blank");
            }
        } else {
            addMessage(data.error || "Error processing command", "assistant", true);
            if (data.audio_url) {
                playAudioUrl(data.audio_url);
            }
        }
    } catch (err) {
        console.error("Command error:", err);
        addMessage("Error sending command", "assistant", true);
        playAudioFeedback("Error sending command");
        showLoading(false);
    }
}

// Initialize with welcome message
window.addEventListener("load", () => {
    setTimeout(() => {
        const welcomeMessage = "Welcome to the Voice Assistant. Press the microphone button or space key to start speaking.";
        addMessage(welcomeMessage, "assistant");
        playAudioFeedback(welcomeMessage);
    }, 1000);
});

