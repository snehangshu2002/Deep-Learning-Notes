/**
 * Mistral AI Chatbot Integration
 */

const chatFab = document.getElementById('chat-fab');
const chatPanel = document.getElementById('chat-panel-widget');
const chatCloseBtn = document.getElementById('chat-close-btn');
const chatConfigBtn = document.getElementById('chat-config-btn');
const chatConfigPanel = document.getElementById('chat-config-panel');
const mistralApiKeyInput = document.getElementById('mistral-api-key');
const saveKeyBtn = document.getElementById('save-key-btn');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const noteFrame = document.getElementById('note-frame');

const STORAGE_KEY = 'mistral_api_key';

// Check for existing API key
function initApiKey() {
    const key = localStorage.getItem(STORAGE_KEY);
    if (key) {
        mistralApiKeyInput.value = key;
        chatConfigPanel.classList.add('hidden');
    } else {
        chatConfigPanel.classList.remove('hidden');
    }
}

// UI Toggles
function toggleChat() {
    chatPanel.classList.toggle('open');
}

chatFab.addEventListener('click', toggleChat);
chatCloseBtn.addEventListener('click', () => chatPanel.classList.remove('open'));

chatConfigBtn.addEventListener('click', () => {
    chatConfigPanel.classList.toggle('hidden');
});

// Save API Key
saveKeyBtn.addEventListener('click', () => {
    const key = mistralApiKeyInput.value.trim();
    if (key) {
        localStorage.setItem(STORAGE_KEY, key);
        chatConfigPanel.classList.add('hidden');
    }
});

// Add message to chat DOM
function appendMessage(role, content) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role}`;

    // Simple markdown parsing for the response (bold and code blocks)
    let parsedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');

    msgDiv.innerHTML = `<div class="message-content">${parsedContent}</div>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgDiv;
}

// Extract content from currently loaded iframe for RAG context
async function getNoteContext() {
    try {
        const src = noteFrame.src || '';

        // Check if current note is a PDF
        if (src.toLowerCase().endsWith('.pdf') || (noteFrame.contentDocument && noteFrame.contentDocument.contentType === 'application/pdf')) {
            console.log("Extracting text from PDF...");
            if (typeof pdfjsLib === 'undefined') {
                console.warn("pdf.js is not loaded.");
                return "PDF context extraction failed because pdf.js is not loaded.";
            }

            const loadingTask = pdfjsLib.getDocument(src);
            const pdf = await loadingTask.promise;

            let fullText = '';
            // Extract from first 10 pages maximum to avoid massive context
            const maxPages = Math.min(pdf.numPages, 10);

            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + ' ';
            }

            const cleanText = fullText.replace(/\s+/g, ' ').trim();
            console.log(`Extracted ${cleanText.length} characters from PDF.`);
            return cleanText.substring(0, 8000); // Limit context length to avoid huge payload
        }

        // Fallback to normal HTML extraction
        const iframeDoc = noteFrame.contentDocument || noteFrame.contentWindow.document;
        // Basic extraction of readable text
        const text = Array.from(iframeDoc.body.childNodes)
            .filter(node => node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE')
            .map(node => node.textContent || node.innerText || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        return text.substring(0, 8000); // Limit context length to avoid huge payload
    } catch (e) {
        console.warn("Could not extract iframe context", e);
        return "No specific note context available. Answer generally about deep learning.";
    }
}

// Handle sending message
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    const apiKey = localStorage.getItem(STORAGE_KEY);
    if (!apiKey) {
        chatConfigPanel.classList.remove('hidden');
        appendMessage('assistant', 'Please enter your Mistral API key first.');
        return;
    }

    // Disable input
    chatInput.value = '';
    chatInput.disabled = true;
    chatSendBtn.disabled = true;

    // Show user message
    appendMessage('user', text);

    // Show typing indicator
    const typingMsg = appendMessage('assistant', '...');

    const context = await getNoteContext();

    try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'mistral-tiny',
                messages: [
                    {
                        role: 'system',
                        content: `You are a helpful AI assistant specialized in Deep Learning. You answer questions strictly based on the provided context from the user's study notes. Keep answers concise. Formatting: Use **bold** for emphasis and \`code\` for technical terms.\n\nContext:\n${context}`
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        const data = await response.json();

        // Remove typing indicator
        typingMsg.remove();

        if (response.ok) {
            appendMessage('assistant', data.choices[0].message.content);
        } else {
            appendMessage('assistant', `Error: ${data.error?.message || 'Failed to reach Mistral API.'}`);
        }
    } catch (err) {
        typingMsg.remove();
        appendMessage('assistant', `Error connecting to API: ${err.message}`);
    } finally {
        // Re-enable input
        chatInput.disabled = false;
        chatSendBtn.disabled = false;
        chatInput.focus();
    }
}

// Event listeners for sending
chatSendBtn.addEventListener('click', sendMessage);

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// ── AI Fallback Logic ──
const fallbackChatGptBtn = document.getElementById('fallback-chatgpt-btn');
const fallbackClaudeBtn = document.getElementById('fallback-claude-btn');
const chatToast = document.getElementById('chat-toast');

function showToast() {
    if (!chatToast) return;
    chatToast.classList.add('show');
    setTimeout(() => {
        chatToast.classList.remove('show');
    }, 2500);
}

function assembleFallbackPrompt(contextText) {
    let prompt = "I am studying deep learning notes. Here is the context of the current document I am reading:\n\n=== DOCUMENT CONTEXT ===\n";
    prompt += contextText ? contextText : "No specific document context.";
    prompt += "\n=====================\n\n";

    // Gather conversation history
    const messageElements = chatMessages.querySelectorAll('.chat-message:not(:first-child)'); // Skip greeting

    if (messageElements.length > 0) {
        prompt += "Here is our recent conversation history:\n";
        messageElements.forEach(msg => {
            const role = msg.classList.contains('user') ? 'Me' : 'AI Assistant';
            // Exclude typing indicator "..." or errors
            const text = msg.querySelector('.message-content').innerText;
            if (text !== '...' && !text.startsWith('Error')) {
                prompt += `[${role}]: ${text}\n`;
            }
        });
        prompt += "\n";
    }

    // Add current unsent input if any
    const currentInput = chatInput.value.trim();
    if (currentInput) {
        prompt += `My current question/input is:\n[Me]: ${currentInput}\n`;
    } else {
        prompt += `Please help me understand the document context or answer my last question above.`;
    }

    return prompt;
}

async function triggerFallback(targetUrl) {
    const context = await getNoteContext();
    const prompt = assembleFallbackPrompt(context);

    try {
        await navigator.clipboard.writeText(prompt);
        showToast();
        // Slight delay to see the toast before switching tabs
        setTimeout(() => {
            window.open(targetUrl, '_blank');
        }, 600);
    } catch (err) {
        console.error("Failed to copy to clipboard", err);
        alert("Failed to copy text to clipboard. Please allow clipboard permissions.");
    }
}

if (fallbackChatGptBtn) {
    fallbackChatGptBtn.addEventListener('click', () => triggerFallback('https://chatgpt.com/'));
}

if (fallbackClaudeBtn) {
    fallbackClaudeBtn.addEventListener('click', () => triggerFallback('https://claude.ai/new'));
}

// Initialize
initApiKey();
