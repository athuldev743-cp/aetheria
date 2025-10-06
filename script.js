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
  const BACKEND_URL = "https://aetheria-backend.onrender.com";

  // --- UTILITY FUNCTIONS ---
  function getTime() {
    return new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true });
  }

  // Text-to-Speech function
  function speakText(text) {
    if ('speechSynthesis' in window) {
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;    // Speaking rate
      utterance.pitch = 1.0;   // Pitch
      utterance.volume = 0.8;  // Volume
      
      // Get available voices and prefer English voices
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(voice => 
        voice.lang.includes('en') && voice.name.includes('Female')
      ) || voices.find(voice => voice.lang.includes('en'));
      
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      
      window.speechSynthesis.speak(utterance);
      return true;
    } else {
      console.warn('Text-to-speech not supported in this browser');
      return false;
    }
  }

  // Create voice play button
  function createVoiceButton(text) {
    const voiceButton = document.createElement('button');
    voiceButton.innerHTML = '🔊';
    voiceButton.title = 'Play message';
    voiceButton.className = 'voice-play-btn';
    voiceButton.style.cssText = `
      margin-left: 10px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      padding: 4px;
      border-radius: 50%;
      transition: background 0.2s;
    `;
    
    voiceButton.addEventListener('mouseenter', () => {
      voiceButton.style.background = 'rgba(0,0,0,0.1)';
    });
    
    voiceButton.addEventListener('mouseleave', () => {
      voiceButton.style.background = 'none';
    });
    
    voiceButton.addEventListener('click', (e) => {
      e.stopPropagation();
      speakText(text);
    });
    
    return voiceButton;
  }

  function addMessage(sender, text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${type}-message`);

    const avatarDiv = document.createElement('div');
    avatarDiv.classList.add('avatar');
    avatarDiv.innerHTML = type==='user'?'<i class="fas fa-user"></i>':'<i class="fas fa-robot"></i>';

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    
    // Add voice button for AI messages
    if (type === 'ai') {
      const voiceButton = createVoiceButton(text);
      contentDiv.innerHTML = `<p>${text}</p><span class="timestamp">${getTime()}</span>`;
      contentDiv.appendChild(voiceButton);
    } else {
      contentDiv.innerHTML = `<p>${text}</p><span class="timestamp">${getTime()}</span>`;
    }

    if(type==='user'){ 
      messageDiv.appendChild(contentDiv); 
      messageDiv.appendChild(avatarDiv); 
    } else { 
      messageDiv.appendChild(avatarDiv); 
      messageDiv.appendChild(contentDiv); 
    }

    chatDisplay.appendChild(messageDiv);
    scrollToBottom();
    
    // Auto-speak AI responses if user sent voice
    if (type === 'ai' && window.lastInputWasVoice) {
      setTimeout(() => speakText(text), 500);
      window.lastInputWasVoice = false;
    }
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
        // For audio - already FormData
        res = await fetch(`${BACKEND_URL}/ai-response`, {
          method: 'POST',
          body: payload
        });
      } else {
        // For text - use FormData
        const formData = new FormData();
        formData.append('prompt', payload);
        
        res = await fetch(`${BACKEND_URL}/ai-response`, {
          method: 'POST',
          body: formData
        });
      }

      if (!res.ok) {
        let errorDetail = `HTTP error! status: ${res.status}`;
        try {
          const errorData = await res.json();
          errorDetail += ` - ${errorData.detail || JSON.stringify(errorData)}`;
        } catch (e) {
          const errorText = await res.text();
          errorDetail += ` - ${errorText}`;
        }
        throw new Error(errorDetail);
      }

      const data = await res.json();
      removeTypingIndicator();
      setAIStatus('online','Online',true);
      return data.response;

    } catch(err) {
      console.error('API Error:', err);
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
      const aiResponse = await getAIResponse(prompt, false);
      addMessage('ai', aiResponse, 'ai');
    });
  });

  // --- VOICE INPUT (RECORD + SEND) ---
  let mediaRecorder;
  let audioChunks = [];

  voiceBtn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      voiceBtn.classList.remove('recording');
      statusMessage.textContent = "Processing audio...";
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
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
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'audio.webm');

          statusMessage.textContent = "Processing audio...";
          
          const aiResponse = await getAIResponse(formData, true);
          addMessage('user', '[Voice Message]', 'user');
          addMessage('ai', aiResponse, 'ai');
          
          // Mark that the last input was voice for auto-speak
          window.lastInputWasVoice = true;
          
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

  // Initialize speech synthesis voices
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      console.log('Voices loaded:', window.speechSynthesis.getVoices().length);
    };
  }
});