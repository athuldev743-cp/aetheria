document.addEventListener('DOMContentLoaded', () => {
  const chatDisplay = document.getElementById('chat-display');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const voiceBtn = document.getElementById('voice-btn');
  const aiStatusIndicator = document.getElementById('ai-status');
  const statusMessage = document.getElementById('status-message');
  const suggestionBtns = document.querySelectorAll('.suggestion-btn');
  const uptimeElement = document.getElementById('uptime');

  // --- CONFIG ---
  const BACKEND_URL = "https://aetheria-backend.onrender.com"; // Backend URL

  // --- UTILITY FUNCTIONS ---
  function getTime() {
    return new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true });
  }

  function addMessage(sender, text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${type}-message`);

    const avatarDiv = document.createElement('div');
    avatarDiv.classList.add('avatar');
    avatarDiv.innerHTML = type==='user'?'<i class="fas fa-user"></i>':'<i class="fas fa-robot"></i>';

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.innerHTML = `<p>${text}</p><span class="timestamp">${getTime()}</span>`;

    if(type==='user'){ 
      messageDiv.appendChild(contentDiv); 
      messageDiv.appendChild(avatarDiv); 
    } else { 
      messageDiv.appendChild(avatarDiv); 
      messageDiv.appendChild(contentDiv); 
    }

    chatDisplay.appendChild(messageDiv);
    scrollToBottom();
  }

  function scrollToBottom() { chatDisplay.scrollTop = chatDisplay.scrollHeight; }

  function setAIStatus(status,message,showIndicator=true){
    aiStatusIndicator.className='status-indicator';
    if(showIndicator) aiStatusIndicator.classList.add(status);
    statusMessage.textContent = message;
  }

  function showTypingIndicator(){
    const typingDiv = document.createElement('div');
    typingDiv.classList.add('message','ai-message','typing-indicator-container');
    typingDiv.id='ai-typing-indicator';
    const avatarDiv = document.createElement('div');
    avatarDiv.classList.add('avatar');
    avatarDiv.innerHTML='<i class="fas fa-robot"></i>';
    const indicatorContent = document.createElement('div');
    indicatorContent.classList.add('typing-indicator');
    indicatorContent.innerHTML=`<span></span><span></span><span></span>`;
    typingDiv.appendChild(avatarDiv);
    typingDiv.appendChild(indicatorContent);
    chatDisplay.appendChild(typingDiv);
    scrollToBottom();
  }

  function removeTypingIndicator(){
    const typingIndicator = document.getElementById('ai-typing-indicator');
    if(typingIndicator) typingIndicator.remove();
  }

  // --- AI RESPONSE (BACKEND CALL) ---
   // --- AI RESPONSE (BACKEND CALL) ---
async function getAIResponse(payload, isAudio=false){
    setAIStatus('thinking','Aetheria is thinking...',true);
    showTypingIndicator();

    try {
        let res;
        if(isAudio){
            // For audio - already FormData
            res = await fetch(`${BACKEND_URL}/ai-response`, {
                method: 'POST',
                body: payload // FormData with audio
            });
        } else {
            // For text - use FormData instead of JSON
            const formData = new FormData();
            formData.append('prompt', payload);
            
            res = await fetch(`${BACKEND_URL}/ai-response`, {
                method: 'POST',
                body: formData // NO Content-Type header - browser sets it automatically
            });
        }

        const data = await res.json();
        removeTypingIndicator();
        setAIStatus('online','Online',true);
        return data.response || "Sorry, I couldn't generate a response.";
    } catch(err) {
        console.error(err);
        removeTypingIndicator();
        setAIStatus('offline','Backend error',true);
        return "Error connecting to backend. Please try again later.";
    }
}

  // --- SEND TEXT MESSAGE ---
  async function sendMessage() {
    const prompt = userInput.value.trim();
    if(!prompt) return;
    addMessage('user', prompt, 'user');
    userInput.value = '';
    const aiResponse = await getAIResponse(prompt, false);
    addMessage('ai', aiResponse, 'ai');
  }

  sendBtn.addEventListener('click', sendMessage);

  userInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      sendMessage();
    }
  });

   suggestionBtns.forEach(button => {
    button.addEventListener('click', async () => {
        const prompt = button.dataset.prompt;
        addMessage('user', prompt, 'user');
        userInput.value = '';
        const aiResponse = await getAIResponse(prompt, false); // false = text message
        addMessage('ai', aiResponse, 'ai');
    });
});

  // --- VOICE INPUT (RECORD + SEND) ---
 // --- VOICE INPUT (RECORD + SEND) ---
let mediaRecorder;
let audioChunks = [];

voiceBtn.addEventListener('click', async () => {
    if(mediaRecorder && mediaRecorder.state === 'recording'){
        mediaRecorder.stop();
        voiceBtn.classList.remove('recording');
        statusMessage.textContent = "Processing audio...";
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            } 
        });
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus' // Use webm format for better compatibility
        });
        
        audioChunks = [];

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };

        mediaRecorder.onstart = () => {
            voiceBtn.classList.add('recording');
            statusMessage.textContent = "Recording... Click to stop";
        };

        mediaRecorder.onstop = async () => {
            voiceBtn.classList.remove('recording');
            
            try {
                // Convert to WAV format for better backend compatibility
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.webm');

                statusMessage.textContent = "Processing audio...";
                
                const aiResponse = await getAIResponse(formData, true);
                addMessage('user', '[Voice Message]', 'user');
                addMessage('ai', aiResponse, 'ai');
                
            } catch (error) {
                console.error('Voice processing error:', error);
                addMessage('ai', "Sorry, I couldn't process your audio. Please try again or use text.", 'ai');
            } finally {
                statusMessage.textContent = "Online";
                // Clean up
                stream.getTracks().forEach(track => track.stop());
            }
        };

        mediaRecorder.start();
        
        // Auto-stop after 10 seconds to prevent long recordings
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                voiceBtn.classList.remove('recording');
            }
        }, 10000);
        
    } catch (error) {
        console.error('Microphone access error:', error);
        statusMessage.textContent = "Microphone access denied";
        addMessage('ai', "Please allow microphone access to use voice features.", 'ai');
    }
}); // REMOVED THE EXTRA }); AND DUPLICATE mediaRecorder.start()

    mediaRecorder.start();
  });

  // --- UPTIME ---
  const startTime = new Date();
  setInterval(() => {
    const now = new Date();
    const diff = now - startTime;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    let uptime = '';
    if(days>0) uptime += `${days}d `;
    if(hours%24>0) uptime += `${hours%24}h `;
    if(minutes%60>0) uptime += `${minutes%60}m `;
    uptime += `${seconds%60}s`;
    uptimeElement.textContent = uptime.trim();
  }, 1000);

  // --- AUTO RESIZE TEXTAREA ---
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
  });
