
  const API_URL = 'https://gen.pollinations.ai/v1/chat/completions';

  let chatHistory = [];
  let apiKey = null;

  const messagesEl = document.getElementById('messages');
  const emptyState = document.getElementById('empty-state');
  const inputEl = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const errorToast = document.getElementById('error-toast');
  const modelSelect = document.getElementById('model-select');
  const authArea = document.getElementById('auth-area');

  // ── Auth: check URL hash first, then sessionStorage ──
  function initAuth() {
    // After redirect, Pollinations puts the key in the hash fragment
    const hash = new URLSearchParams(location.hash.slice(1));
    const keyFromHash = hash.get('api_key');

    if (keyFromHash) {
      apiKey = keyFromHash;
      sessionStorage.setItem('polly_api_key', apiKey);
      // Clean the key out of the URL — don't leave it visible in the address bar
      window.history.replaceState(null, '', location.pathname + location.search);
    } else {
      apiKey = sessionStorage.getItem('polly_api_key');
    }

    renderAuthArea();
  }

  function renderAuthArea() {
    if (apiKey) {
      authArea.innerHTML = `
        <div class="auth-status">
          <div class="dot"></div>
          Connected
          <button class="disconnect-btn" id="disconnect-btn">Disconnect</button>
        </div>`;
      document.getElementById('disconnect-btn').addEventListener('click', disconnect);
    } else {
      authArea.innerHTML = `
        <button class="auth-btn" id="connect-btn">🌸 Connect Pollen</button>`;
      document.getElementById('connect-btn').addEventListener('click', authorize);
    }
  }

  function authorize() {
    const params = new URLSearchParams({ redirect_url: location.href });
    window.location.href = `https://enter.pollinations.ai/authorize?${params}`;
  }

  function disconnect() {
    apiKey = null;
    sessionStorage.removeItem('polly_api_key');
    renderAuthArea();
  }

  initAuth();

  // ── Auto-resize textarea ──
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
  });

  // ── Send on Enter (Shift+Enter = newline) ──
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  document.getElementById('clear-btn').addEventListener('click', () => {
    chatHistory = [];
    messagesEl.innerHTML = '';
    messagesEl.appendChild(emptyState);
    emptyState.style.display = '';
    hideError();
  });

  function showError(msg) {
    errorToast.textContent = msg;
    errorToast.classList.add('visible');
  }

  function hideError() {
    errorToast.classList.remove('visible');
  }

  function appendMessage(role, text) {
    emptyState.style.display = 'none';

    const msg = document.createElement('div');
    msg.className = `msg ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = role === 'user' ? 'U' : '🌸';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function appendTyping() {
    emptyState.style.display = 'none';
    const msg = document.createElement('div');
    msg.className = 'msg assistant';
    msg.id = 'typing-msg';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = '🌸';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    hideError();
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;

    // Add user message to chatHistory and UI
    chatHistory.push({ role: 'user', content: text });
    appendMessage('user', text);

    const typingEl = appendTyping();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelSelect.value,
          messages: chatHistory,
        }),
      });

      // Remove typing indicator
      typingEl.remove();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content;

      if (!reply) throw new Error('Empty response from API');

      // Add assistant reply to chatHistory so next turn stays coherent
      chatHistory.push({ role: 'assistant', content: reply });
      appendMessage('assistant', reply);

    } catch (err) {
      typingEl.remove();
      // Roll back the user message from chatHistory on failure
      chatHistory.pop();
      showError(`Error: ${err.message}`);
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }
