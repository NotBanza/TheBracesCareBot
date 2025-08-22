// BracesCareBot Frontend JavaScript
class BracesCareBot {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatMessages = document.getElementById('chat-messages');
        this.consentCheck = document.getElementById('consentCheck');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.charCount = document.getElementById('charCount');
        this.welcomeCard = document.getElementById('welcome-card');
        
        this.initializeEventListeners();
        this.initializeApp();
    }
    
    initializeApp() {
        // Focus on input
        this.messageInput.focus();
        
        // Load chat history from localStorage
        this.loadChatHistory();
    }
    
    initializeEventListeners() {
        // Send button click
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Enter key press
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Character counter
        this.messageInput.addEventListener('input', () => {
            const length = this.messageInput.value.length;
            this.charCount.textContent = length;
            
            if (length > 450) {
                this.charCount.style.color = 'var(--bs-warning)';
            } else if (length > 480) {
                this.charCount.style.color = 'var(--bs-danger)';
            } else {
                this.charCount.style.color = '';
            }
        });
        
        // Auto-resize input (optional enhancement)
        this.messageInput.addEventListener('input', this.autoResizeInput.bind(this));
    }
    
    autoResizeInput() {
        // Simple auto-resize functionality
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 150) + 'px';
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message) {
            this.showError('Please enter a message');
            return;
        }
        
        if (message.length > 500) {
            this.showError('Message is too long. Please keep it under 500 characters.');
            return;
        }
        
        const consent = this.consentCheck.checked;
        
        // Clear input and disable controls
        this.messageInput.value = '';
        this.charCount.textContent = '0';
        this.setLoading(true);
        
        // Hide welcome card if this is the first message
        if (this.welcomeCard) {
            this.welcomeCard.style.display = 'none';
        }
        
        // Add user message to chat
        this.addMessage(message, 'user');
        
        try {
            const response = await this.callChatAPI(message, consent);
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            // Add bot response
            this.addMessage(response.response, 'bot', {
                redFlags: response.red_flags,
                knowledgeUsed: response.knowledge_used
            });
            
            // Save to local storage
            this.saveChatHistory();
            
        } catch (error) {
            console.error('Chat error:', error);
            this.addMessage(
                'I apologize, but I encountered an error. Please try again or contact your orthodontist if you have urgent concerns.',
                'bot',
                { error: true }
            );
        } finally {
            this.setLoading(false);
            this.messageInput.focus();
        }
    }
    
    async callChatAPI(message, consent) {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                consent: consent
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    addMessage(text, type, metadata = {}) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const timestamp = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const avatar = type === 'user' ? 
            '<i class="fas fa-user"></i>' : 
            '<i class="fas fa-robot"></i>';
        
        let warningHtml = '';
        if (metadata.redFlags && metadata.redFlags.length > 0) {
            warningHtml = `
                <div class="red-flag-warning alert alert-danger mt-2 mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Important:</strong> You mentioned concerning symptoms. Please contact your orthodontist or seek medical attention.
                </div>
            `;
        }
        
        let knowledgeHtml = '';
        if (metadata.knowledgeUsed) {
            knowledgeHtml = `
                <div class="knowledge-indicator">
                    <i class="fas fa-book text-info"></i>
                    <span>Based on orthodontic knowledge base</span>
                </div>
            `;
        }
        
        let errorHtml = '';
        if (metadata.error) {
            errorHtml = `
                <div class="alert alert-warning mt-2 mb-0">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    This is an error message. Please try again.
                </div>
            `;
        }
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-bubble">
                <div class="message-content">${this.formatMessageText(text)}</div>
                <div class="message-time">${timestamp}</div>
                ${warningHtml}
                ${knowledgeHtml}
                ${errorHtml}
            </div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    formatMessageText(text) {
        // Simple text formatting - convert newlines to breaks and handle basic markdown-like syntax
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }
    
    setLoading(isLoading) {
        if (isLoading) {
            this.sendButton.disabled = true;
            this.sendButton.classList.add('btn-loading');
            this.messageInput.disabled = true;
            this.loadingIndicator.style.display = 'block';
        } else {
            this.sendButton.disabled = false;
            this.sendButton.classList.remove('btn-loading');
            this.messageInput.disabled = false;
            this.loadingIndicator.style.display = 'none';
        }
    }
    
    showError(message) {
        // Create a temporary alert
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show';
        alertDiv.innerHTML = `
            <i class="fas fa-exclamation-circle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Insert before the chat container
        const chatContainer = document.querySelector('.chat-container');
        chatContainer.parentNode.insertBefore(alertDiv, chatContainer);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
    
    saveChatHistory() {
        try {
            const messages = Array.from(this.chatMessages.children).map(msg => {
                const isUser = msg.classList.contains('user');
                const content = msg.querySelector('.message-content').innerHTML;
                const time = msg.querySelector('.message-time').textContent;
                
                return {
                    type: isUser ? 'user' : 'bot',
                    content: content,
                    time: time
                };
            });
            
            localStorage.setItem('bracescarebot_history', JSON.stringify(messages.slice(-20))); // Keep last 20 messages
        } catch (error) {
            console.warn('Could not save chat history:', error);
        }
    }
    
    loadChatHistory() {
        try {
            const history = localStorage.getItem('bracescarebot_history');
            if (history) {
                const messages = JSON.parse(history);
                if (messages.length > 0) {
                    // Hide welcome card if there's chat history
                    if (this.welcomeCard) {
                        this.welcomeCard.style.display = 'none';
                    }
                    
                    messages.forEach(msg => {
                        this.addStoredMessage(msg.content, msg.type, msg.time);
                    });
                }
            }
        } catch (error) {
            console.warn('Could not load chat history:', error);
        }
    }
    
    addStoredMessage(content, type, time) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const avatar = type === 'user' ? 
            '<i class="fas fa-user"></i>' : 
            '<i class="fas fa-robot"></i>';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-bubble">
                <div class="message-content">${content}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BracesCareBot();
});

// Add some helpful keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to send message
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        document.getElementById('sendButton').click();
    }
    
    // Escape to clear input
    if (e.key === 'Escape') {
        const input = document.getElementById('messageInput');
        if (input.value) {
            input.value = '';
            document.getElementById('charCount').textContent = '0';
        }
    }
});
