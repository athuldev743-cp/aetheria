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

  function scrollToBottom() { 
    chatDisplay.scrollTop = chatDisplay.scrollHeight; 
  }

  function setAIStatus(status, message, showIndicator=true){
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
async function getAIResponse(payload, isAudio=false){
    setAIStatus('thinking','Aetheria is thinking...',true);
    showTypingIndicator();

    try {
        let res;
        if(isAudio){
            console.log('🔊 Sending AUDIO request');
            console.log('Audio payload type:', typeof payload);
            console.log('Is FormData:', payload instanceof FormData);
            
            // Check what's in the FormData
            if (payload instanceof FormData) {
                for (let pair of payload.entries()) {
                    console.log('FormData entry:', pair[0], pair[1]);
                }
            }
            
            res = await fetch(`${BACKEND_URL}/ai-response`, {
                method: 'POST',
                body: payload
            });
        } else {
            const formData = new FormData();
            formData.append('prompt', payload);
            console.log('📝 Sending TEXT request - prompt:', payload);
            
            res = await fetch(`${BACKEND_URL}/ai-response`, {
                method: 'POST',
                body: formData
            });
        }

        console.log('Response status:', res.status);
        console.log('Response headers:', res.headers);
        
        if (!res.ok) {
            let errorDetail = `HTTP error! status: ${res.status}`;
            try {
                const errorData = await res.json();
                console.log('Error response data:', errorData);
                errorDetail += ` - ${errorData.detail || JSON.stringify(errorData)}`;
            } catch (e) {
                const errorText = await res.text();
                console.log('Error response text:', errorText);
                errorDetail += ` - ${errorText}`;
            }
            throw new Error(errorDetail);
        }

        const data = await res.json();
        removeTypingIndicator();
        setAIStatus('online','Online',true);
        return data.response;

    } catch(err) {
        console.error('❌ API Error:', err);
        removeTypingIndicator();
        setAIStatus('offline','Backend error',true);
        return `Error: ${err.message}`;
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
// --- VOICE INPUT (RECORD + SEND) ---
let mediaRecorder;
let audioChunks = [];

voiceBtn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        voiceBtn.classList.remove('recording');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Use default MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstart = () => {
            voiceBtn.classList.add('recording');
            statusMessage.textContent = "Recording... Click to stop";
        };

        mediaRecorder.onstop = async () => {
            voiceBtn.classList.remove('recording');
            
            try {
                // Create audio blob
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                console.log('🎵 Audio blob created:', {
                    size: audioBlob.size,
                    type: audioBlob.type
                });

                if (audioBlob.size === 0) {
                    throw new Error('No audio data recorded');
                }

                const formData = new FormData();
                formData.append('audio', audioBlob, 'audio.webm');

                statusMessage.textContent = "Processing audio...";
                
                const aiResponse = await getAIResponse(formData, true);
                addMessage('user', '[Voice Message]', 'user');
                addMessage('ai', aiResponse, 'ai');
                
            } catch (error) {
                console.error('Voice processing error:', error);
                addMessage('ai', `Audio error: ${error.message}`, 'ai');
            } finally {
                statusMessage.textContent = "Online";
                stream.getTracks().forEach(track => track.stop());
            }
        };

        mediaRecorder.start();
        
        // Auto-stop after 5 seconds
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                voiceBtn.classList.remove('recording');
            }
        }, 5000);

    } catch (error) {
        console.error('Microphone error:', error);
        statusMessage.textContent = "Microphone access denied";
        addMessage('ai', "Please allow microphone access.", 'ai');
    }
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
});