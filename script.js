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
  async function getAIResponse(payload, isAudio=false){
    setAIStatus('thinking','Aetheria is thinking...',true);
    showTypingIndicator();

    try {
      let res;
      if(isAudio){
        res = await fetch(`${BACKEND_URL}/ai-response`, {
          method: 'POST',
          body: payload // FormData with audio
        });
      } else {
        res = await fetch(`${BACKEND_URL}/ai-response`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: payload })
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
      const aiResponse = await getAIResponse(prompt, false);
      addMessage('ai', aiResponse, 'ai');
    });
  });

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

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

    mediaRecorder.onstart = () => {
      voiceBtn.classList.add('recording');
      statusMessage.textContent = "Recording...";
    };

    mediaRecorder.onstop = async () => {
      voiceBtn.classList.remove('recording');
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice.wav');

      // Send audio to backend
      const aiResponse = await getAIResponse(formData, true);
      addMessage('user', '[Voice Message]', 'user');
      addMessage('ai', aiResponse, 'ai');
      statusMessage.textContent = "Online";
    };

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
});
