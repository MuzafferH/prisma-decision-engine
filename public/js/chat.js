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

  // Show initial greeting from Prisma
  this.displayMessage('assistant', "What decision are you facing? Describe the situation — I'll help you see the consequences before you commit.");

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
      // Real API call
      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: this.messages })
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
            { type: 'text', text: response.message || '' },
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
      // Real API call
      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: this.messages })
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
            { type: 'text', text: response.message || '' },
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
        if (this.messages.length < 25) {
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
    this.displayMessage('error', 'Failed to continue the conversation. Please try sending another message.');
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

  // Auto-scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
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

// Handle file upload
Chat.handleFileUpload = async function(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.disabled = true;

  for (const file of files) {
    // Check file type
    if (!file.name.endsWith('.csv')) {
      this.displayMessage('error', `File ${file.name} is not a CSV file. Please upload CSV files only.`);
      continue;
    }

    // Check file size (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      this.displayMessage('error', `File ${file.name} is too large. Maximum size is 10MB.`);
      continue;
    }

    // Show upload indicator
    this.displayMessage('system', `Uploading ${file.name}...`);

    // Parse CSV using PapaParse
    try {
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

      if (data.length === 0) {
        this.displayMessage('error', `File ${file.name} is empty or could not be parsed.`);
        continue;
      }

      // Compute basic statistics for numeric columns
      const headers = Object.keys(data[0] || {});
      const stats = {};

      headers.forEach(header => {
        const values = data.map(row => row[header]).filter(val => typeof val === 'number' && !isNaN(val));

        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          const mean = sum / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);
          const sorted = [...values].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];

          stats[header] = {
            count: values.length,
            mean: mean.toFixed(2),
            median: median.toFixed(2),
            min: min.toFixed(2),
            max: max.toFixed(2)
          };
        }
      });

      // Format stats summary
      let summary = `I've uploaded ${file.name} (${data.length} rows). Here are the key statistics:\n\n`;

      const statEntries = Object.entries(stats);
      if (statEntries.length > 0) {
        statEntries.forEach(([column, columnStats]) => {
          summary += `${column}:\n`;
          summary += `  • Count: ${columnStats.count}\n`;
          summary += `  • Mean: ${columnStats.mean}\n`;
          summary += `  • Median: ${columnStats.median}\n`;
          summary += `  • Range: ${columnStats.min} - ${columnStats.max}\n\n`;
        });
      } else {
        summary += 'No numeric columns found for statistical analysis.\n\n';
      }

      summary += 'What would you like me to analyze from this data?';

      // Add as a user message and send to chat
      this.messages.push({ role: 'user', content: summary });
      this.displayMessage('user', summary);

      // Automatically send to get Prisma's response
      await this.sendMessage();

    } catch (error) {
      console.error('File parse error:', error);
      this.displayMessage('error', `Failed to parse ${file.name}. Please ensure it's a valid CSV file.`);
    }
  }

  // Re-enable send button
  if (sendBtn) sendBtn.disabled = false;

  // Clear the file input
  event.target.value = '';
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  Chat.init();
});
