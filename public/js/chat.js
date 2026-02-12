// chat.js
// Chat interface logic for Prisma dashboard

// MOCK MODE for local testing without Vercel deployment
const MOCK_MODE = false; // Live mode — real Claude API calls via /api/chat

const Chat = {
  messages: [],           // Conversation history [{role, content}]
  isLoading: false,       // Prevents double-sends
  onDashboardUpdate: null,// Callback set by dashboard.js: (toolCall) => {}
  lastRequestTime: 0,     // For throttling
  MIN_REQUEST_INTERVAL: 3000 // 3 seconds between requests
};

// Initialize chat interface
Chat.init = function() {
  // Get DOM elements
  const sendBtn = document.getElementById('send-btn');
  const chatInput = document.getElementById('chat-input');
  const fileUpload = document.getElementById('file-upload');

  if (!sendBtn || !chatInput || !fileUpload) {
    console.error('Chat: Missing required DOM elements');
    return;
  }

  // Event listeners
  sendBtn.addEventListener('click', () => this.sendMessage());

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  });

  fileUpload.addEventListener('change', (e) => this.handleFileUpload(e));

  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    const maxHeight = parseInt(getComputedStyle(chatInput).lineHeight) * 4;
    const newHeight = Math.min(chatInput.scrollHeight, maxHeight);
    chatInput.style.height = newHeight + 'px';
  });

  // Show initial greeting from Prisma (upload-first flow)
  this.displayMessage('assistant', "Upload a CSV to start exploring your data. I'll generate dashboards, surface insights, and let you simulate decisions.");

  // Focus the textarea
  chatInput.focus();
};

// Send a message to the API
Chat.sendMessage = async function() {
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');

  if (!chatInput || !sendBtn) return;

  const text = chatInput.value.trim();

  // Validation
  if (!text) return;
  if (this.isLoading) return;

  // Throttling check
  const now = Date.now();
  if (now - this.lastRequestTime < this.MIN_REQUEST_INTERVAL) {
    const waitTime = Math.ceil((this.MIN_REQUEST_INTERVAL - (now - this.lastRequestTime)) / 1000);
    this.displayMessage('system', `Please wait ${waitTime} more second${waitTime > 1 ? 's' : ''} before sending another message.`);
    return;
  }

  // Clear textarea and add user message
  chatInput.value = '';
  chatInput.style.height = 'auto';

  this.messages.push({ role: 'user', content: text });
  this.displayMessage('user', text);

  // Show typing indicator and disable input
  this.showTypingIndicator();
  this.isLoading = true;
  sendBtn.disabled = true;
  this.lastRequestTime = now;

  try {
    let response;

    // MOCK MODE for local testing
    if (typeof MOCK_MODE !== 'undefined' && MOCK_MODE) {
      await new Promise(r => setTimeout(r, 1500));

      // Simulate different responses based on message count
      if (this.messages.length === 1) {
        response = {
          message: "I understand you're facing a decision. Let me ask a few questions to map out the situation.\n\nHow many people or units are involved in your operation? For example, if it's about delivery drivers, how many drivers do you currently have?",
          toolCall: null,
          stopReason: 'end_turn'
        };
      } else if (this.messages.length === 3) {
        response = {
          message: "Got it. Now, what's the key metric you're trying to optimize? For example: monthly profit, customer satisfaction, delivery time, or something else?",
          toolCall: null,
          stopReason: 'end_turn'
        };
      } else if (this.messages.length === 5) {
        response = {
          message: "Perfect. Carlo is now building a causal map of your decision...",
          toolCall: {
            id: 'toolu_mock_1',
            name: 'update_dashboard',
            input: {
              phase: 'causal_graph',
              prismaData: {
                meta: {
                  title: 'Sample Decision',
                  summary: 'Testing the causal graph visualization',
                  tier: 1,
                  generatedAt: new Date().toISOString()
                },
                variables: [
                  { id: 'driver_count', label: 'Number of Drivers', value: 5, min: 3, max: 8, distribution: 'fixed', unit: 'drivers', isInput: true },
                  { id: 'daily_deliveries', label: 'Daily Deliveries', value: 80, min: 60, max: 110, distribution: 'normal', unit: 'deliveries', isInput: false }
                ],
                edges: [
                  { from: 'driver_count', to: 'daily_deliveries', effect: 'positive', strength: 0.8 }
                ],
                feedbackLoops: []
              }
            }
          },
          stopReason: 'tool_use'
        };
      } else {
        response = {
          message: "I can help you explore more scenarios or refine the analysis. What would you like to know?",
          toolCall: null,
          stopReason: 'end_turn'
        };
      }
    } else {
      // Trim conversation to prevent overflow (keep CSV context + recent messages)
      const trimmedMessages = Chat._trimMessages(this.messages);

      // Real API call
      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: trimmedMessages })
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${apiResponse.status}`);
      }

      response = await apiResponse.json();
    }

    // Hide typing indicator and re-enable input
    this.hideTypingIndicator();
    this.isLoading = false;
    sendBtn.disabled = false;

    // Handle error response
    if (response.error) {
      this.displayMessage('error', response.error);
      return;
    }

    // Display assistant's message
    if (response.message) {
      this.displayMessage('assistant', response.message);
    }

    // Handle tool call
    if (response.toolCall) {
      // Forward to dashboard if callback is set
      if (this.onDashboardUpdate) {
        this.onDashboardUpdate(response.toolCall);
      }

      // If stopReason is tool_use, the model expects a continuation
      if (response.stopReason === 'tool_use') {
        // Add the assistant's response with tool_use to messages
        this.messages.push({
          role: 'assistant',
          content: [
            ...(response.message ? [{ type: 'text', text: response.message }] : []),
            {
              type: 'tool_use',
              id: response.toolCall.id || 'tool_1',
              name: response.toolCall.name || 'update_dashboard',
              input: response.toolCall.input
            }
          ]
        });

        // Add a synthetic tool_result
        this.messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: response.toolCall.id || 'tool_1',
            content: 'Dashboard updated successfully.'
          }]
        });

        // Automatically send a follow-up to get the model's next message
        await this.sendFollowUp();
      } else {
        // Just add the message to history normally
        if (response.message) {
          this.messages.push({ role: 'assistant', content: response.message });
        }
      }
    } else {
      // No tool call, just add the message to history
      if (response.message) {
        this.messages.push({ role: 'assistant', content: response.message });
      }
    }

  } catch (error) {
    console.error('Chat error:', error);
    this.hideTypingIndicator();
    this.isLoading = false;
    sendBtn.disabled = false;

    let errorMessage = 'Failed to connect to Prisma. Please try again.';
    if (error.message.includes('429')) {
      errorMessage = 'Too many requests. Please wait a moment and try again.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    this.displayMessage('error', errorMessage);
  }
};

// Send a follow-up request after a tool_use (auto-continuation)
Chat.sendFollowUp = async function() {
  const sendBtn = document.getElementById('send-btn');
  if (!sendBtn) return;

  // Show typing indicator
  this.showTypingIndicator();
  this.isLoading = true;
  sendBtn.disabled = true;

  try {
    let response;

    // MOCK MODE
    if (typeof MOCK_MODE !== 'undefined' && MOCK_MODE) {
      await new Promise(r => setTimeout(r, 1000));
      response = {
        message: "The causal graph is now visible on your dashboard. Carlo is running 1,000 possible futures for each scenario...",
        toolCall: null,
        stopReason: 'end_turn'
      };
    } else {
      // Real API call (trimmed to prevent overflow)
      const trimmedMessages = Chat._trimMessages(this.messages);
      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: trimmedMessages })
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${apiResponse.status}`);
      }

      response = await apiResponse.json();
    }

    // Hide typing indicator
    this.hideTypingIndicator();
    this.isLoading = false;
    sendBtn.disabled = false;

    // Display message
    if (response.message) {
      this.displayMessage('assistant', response.message);
    }

    // Handle another tool call if present
    if (response.toolCall) {
      if (this.onDashboardUpdate) {
        this.onDashboardUpdate(response.toolCall);
      }

      // Check if we need another continuation
      if (response.stopReason === 'tool_use') {
        this.messages.push({
          role: 'assistant',
          content: [
            ...(response.message ? [{ type: 'text', text: response.message }] : []),
            {
              type: 'tool_use',
              id: response.toolCall.id || 'tool_2',
              name: response.toolCall.name || 'update_dashboard',
              input: response.toolCall.input
            }
          ]
        });

        this.messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: response.toolCall.id || 'tool_2',
            content: 'Dashboard updated successfully.'
          }]
        });

        // Recursively continue (with a limit to prevent infinite loops)
        if (this.messages.length < 60) {
          await this.sendFollowUp();
        }
      } else {
        if (response.message) {
          this.messages.push({ role: 'assistant', content: response.message });
        }
      }
    } else {
      if (response.message) {
        this.messages.push({ role: 'assistant', content: response.message });
      }
    }

  } catch (error) {
    console.error('Follow-up error:', error);
    this.hideTypingIndicator();
    this.isLoading = false;
    sendBtn.disabled = false;
    // Don't show error for follow-ups — the dashboard already rendered from the tool call.
    // The follow-up is just for Claude's chat message, which is nice-to-have, not critical.
    console.log('[Chat] Follow-up failed (non-critical — dashboard already updated)');
  }
};

// Display a message in the chat
Chat.displayMessage = function(role, text) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';

  if (role === 'user') {
    messageDiv.classList.add('user-message');
  } else if (role === 'assistant') {
    messageDiv.classList.add('prisma-message');
  } else if (role === 'system' || role === 'error') {
    messageDiv.classList.add('system-message');
    if (role === 'error') {
      messageDiv.classList.add('error-message');
    }
  }

  // Decode unicode escapes like \u20ac → €
  text = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Format text with basic paragraph/line break support
  // Split by double newlines for paragraphs
  const paragraphs = text.split('\n\n');

  paragraphs.forEach((para, index) => {
    const paraDiv = document.createElement('div');

    // Split by single newlines within paragraph
    const lines = para.split('\n');
    lines.forEach((line, lineIndex) => {
      const lineSpan = document.createElement('span');
      lineSpan.textContent = line; // XSS protection: use textContent
      paraDiv.appendChild(lineSpan);

      // Add line break if not the last line
      if (lineIndex < lines.length - 1) {
        paraDiv.appendChild(document.createElement('br'));
      }
    });

    messageDiv.appendChild(paraDiv);

    // Add spacing between paragraphs
    if (index < paragraphs.length - 1) {
      paraDiv.style.marginBottom = '1em';
    }
  });

  chatMessages.appendChild(messageDiv);

  // Detect numbered options in assistant messages (last paragraph only)
  if (role === 'assistant') {
    const lastPara = paragraphs[paragraphs.length - 1];
    if (lastPara) {
      const lines = lastPara.trim().split('\n');
      const optionRegex = /^\d+\.\s+(.+)$/;
      const allOptions = lines.every(line => optionRegex.test(line.trim()));
      if (allOptions && lines.length >= 2 && lines.length <= 6) {
        const options = lines.map(line => {
          const match = line.trim().match(optionRegex);
          return match ? match[1].replace(/\*\*/g, '').trim() : line.trim();
        });
        Chat.displayOptions(options, messageDiv);
      }
    }
  }

  // Auto-scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
};

// Display clickable option chips below an assistant message
Chat.displayOptions = function(options, parentDiv) {
  if (!options || options.length === 0) return;

  const container = document.createElement('div');
  container.className = 'chat-options';

  options.forEach(optionText => {
    const chip = document.createElement('button');
    chip.className = 'chat-option-chip';
    chip.textContent = optionText.length > 60 ? optionText.substring(0, 57) + '...' : optionText;
    chip.addEventListener('click', () => {
      if (Chat.isLoading) return;
      Chat.lastRequestTime = 0;
      container.querySelectorAll('.chat-option-chip').forEach(c => c.disabled = true);
      const chatInput = document.getElementById('chat-input');
      if (chatInput) chatInput.value = optionText;
      Chat.sendMessage();
    });
    container.appendChild(chip);
  });

  // "Other..." chip — focuses the input so user can type a custom answer
  const otherChip = document.createElement('button');
  otherChip.className = 'chat-option-chip chat-option-other';
  otherChip.textContent = 'Other...';
  otherChip.addEventListener('click', () => {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.focus();
      chatInput.placeholder = 'Type your answer...';
    }
    container.querySelectorAll('.chat-option-chip').forEach(c => c.disabled = true);
  });
  container.appendChild(otherChip);

  parentDiv.appendChild(container);
};

// Show typing indicator
Chat.showTypingIndicator = function() {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  // Remove existing indicator if present
  this.hideTypingIndicator();

  const indicator = document.createElement('div');
  indicator.className = 'message prisma-message typing-indicator-msg';
  indicator.id = 'typing-indicator';

  // Create typing animation with DOM methods (avoid innerHTML)
  const typingDiv = document.createElement('div');
  typingDiv.className = 'typing-indicator';

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    typingDiv.appendChild(dot);
  }

  indicator.appendChild(typingDiv);
  chatMessages.appendChild(indicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
};

// Hide typing indicator
Chat.hideTypingIndicator = function() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    indicator.remove();
  }
};

// Handle file upload (legacy event handler → delegates to handleCSVUpload)
Chat.handleFileUpload = async function(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  await this.handleCSVUpload(files[0]);
  event.target.value = '';
};

/**
 * Handle CSV upload from landing zone or chat paperclip.
 * Core flow: Parse → Analyze → Store → Send to Claude → Render dashboard
 * @param {File} file - the CSV file
 */
Chat.handleCSVUpload = async function(file) {
  if (!file) return;

  if (!file.name.endsWith('.csv')) {
    this.displayMessage('error', 'Please upload a CSV file.');
    return;
  }

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    this.displayMessage('error', 'File too large. Maximum 10MB.');
    return;
  }

  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.disabled = true;

  this.displayMessage('system', `Analyzing ${file.name}...`);

  // Show skeleton loading in dashboard immediately
  if (typeof Dashboard !== 'undefined' && Dashboard.showSkeletonLoading) {
    Dashboard.showSkeletonLoading();
  }

  try {
    // 1. Parse with PapaParse
    const result = await new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: resolve,
        error: reject
      });
    });

    if (result.errors && result.errors.length > 0) {
      console.warn('CSV parse warnings:', result.errors);
    }

    const data = result.data;
    if (!data || data.length === 0) {
      this.displayMessage('error', 'File is empty or could not be parsed.');
      if (sendBtn) sendBtn.disabled = false;
      return;
    }

    // 2. Run CSVAnalyzer
    const analysis = CSVAnalyzer.analyze(data, file.name);
    const columnTypes = CSVAnalyzer.detectColumnTypes(data);

    // 3. Store raw data in Dashboard for chart rendering
    if (typeof Dashboard !== 'undefined') {
      Dashboard._csvData = data;
      Dashboard._csvAnalysis = analysis;
    }

    // 4. Build message for Claude
    const statsText = CSVAnalyzer.formatForChat(analysis);
    const columns = Object.keys(data[0] || {});
    const sampleRows = JSON.stringify(data.slice(0, 5));

    const columnTypesText = Object.entries(columnTypes)
      .map(([col, type]) => `${col}: ${type}`)
      .join(', ');

    const messageContent = `[CSV_UPLOAD]
Filename: ${file.name}
Rows: ${data.length}
Columns: ${columns.join(', ')}
Column types: ${columnTypesText}

${statsText}

Sample rows (first 5):
${sampleRows}

Analyze this data. Generate chart specs, KPI cards, and insights with simulation suggestions.`;

    // 5. Display user message (short version) and send to API
    this.displayMessage('user', `Uploaded ${file.name} (${data.length.toLocaleString()} rows)`);
    this.messages.push({ role: 'user', content: messageContent });

    this.showTypingIndicator();
    this.isLoading = true;

    try {
      const trimmedMessages = Chat._trimMessages(this.messages);
      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: trimmedMessages })
      });

      this.hideTypingIndicator();
      this.isLoading = false;
      if (sendBtn) sendBtn.disabled = false;

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}));
        this.displayMessage('error', errorData.error || 'Failed to analyze data.');
        return;
      }

      const response = await apiResponse.json();

      // Display Claude's chat message
      if (response.message) {
        this.displayMessage('assistant', response.message);
      }

      // Handle tool call (data_overview or simulation)
      if (response.toolCall) {
        if (this.onDashboardUpdate) {
          this.onDashboardUpdate(response.toolCall);
        }

        // Combine text + tool_use in ONE assistant message (API requires alternating roles)
        this.messages.push({
          role: 'assistant',
          content: [
            ...(response.message ? [{ type: 'text', text: response.message }] : []),
            {
              type: 'tool_use',
              id: response.toolCall.id || 'tool_1',
              name: response.toolCall.name || 'update_dashboard',
              input: response.toolCall.input
            }
          ]
        });
        this.messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: response.toolCall.id || 'tool_1',
            content: 'Dashboard updated successfully.'
          }]
        });

        // Follow up if needed
        if (response.stopReason === 'tool_use' && this.messages.length < 60) {
          await this.sendFollowUp();
        }
      } else if (response.message) {
        // No tool call — just add text to history
        this.messages.push({ role: 'assistant', content: response.message });
      }

    } catch (fetchError) {
      console.error('API call error:', fetchError);
      this.hideTypingIndicator();
      this.isLoading = false;
      if (sendBtn) sendBtn.disabled = false;
      this.displayMessage('error', 'Failed to reach Prisma. Please try again.');
    }

  } catch (parseError) {
    console.error('CSV parse error:', parseError);
    this.displayMessage('error', 'Failed to parse file. Please ensure it\'s a valid CSV.');
    if (sendBtn) sendBtn.disabled = false;
  }
};

/**
 * Trigger a Monte Carlo simulation from an insight's "Simulate this" button.
 * @param {string} prompt - The what-if question
 */
Chat.triggerSimulation = function(prompt) {
  if (this.isLoading) return;
  // Store the simulation label so we can show it in the teaser
  Dashboard._lastSimulationPrompt = prompt;
  const chatInput = document.getElementById('chat-input');
  if (chatInput) chatInput.value = prompt;
  this.sendMessage();
};

/**
 * Compress a single message, stripping bulky tool_use inputs down to phase name.
 * Keeps the tool_use structure valid (prismaData as object, not string).
 */
Chat._compressMessage = function(msg) {
  if (!Array.isArray(msg.content)) return msg;

  const compressed = msg.content.map(block => {
    if (block.type === 'tool_use') {
      // Keep only the phase — drop the massive prismaData payload
      // prismaData must stay an object (not string) to pass API schema validation
      return {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: { phase: block.input?.phase || 'simulation', prismaData: { _compressed: true } }
      };
    }
    return block;
  });

  return { role: msg.role, content: compressed };
};

/**
 * Trim conversation messages to prevent overflow.
 * Keeps the first message (CSV context) + last 12 messages.
 * Compresses tool_use blocks in older messages to save tokens.
 */
Chat._trimMessages = function(messages) {
  // Compress ALL tool_use blocks (even recent ones) to prevent payload bloat
  const compressed = messages.map(msg => Chat._compressMessage(msg));

  if (compressed.length <= 14) return compressed;

  // Keep first message (CSV upload context) and last 12
  const first = compressed[0];
  const recent = compressed.slice(-12);

  const trimmed = [first];

  // Bridge message so Claude knows there was prior conversation
  trimmed.push({
    role: 'user',
    content: '[Prior conversation trimmed for context. Data overview was generated and dashboard is active. User is asking follow-up or simulation questions.]'
  });
  trimmed.push({
    role: 'assistant',
    content: 'Understood. I have the data context from the CSV upload and prior analysis. Ready for the next question.'
  });

  trimmed.push(...recent);

  return trimmed;
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  Chat.init();
});
