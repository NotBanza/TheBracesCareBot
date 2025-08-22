// BracesCareBot Frontend JavaScript
class BracesCareBot {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatMessages = document.getElementById('chat-messages');
        this.consentCheck = document.getElementById('consentCheck');
        this.charCount = document.getElementById('charCount');
        this.welcomeCard = document.getElementById('welcome-card');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.deleteDataBtn = document.getElementById('deleteDataBtn');
        this.languageSelect = document.getElementById('languageSelect');
        this.micButton = document.getElementById('micButton');
        this.imageUploadBtn = document.getElementById('imageUploadBtn');
        this.fileInput = document.getElementById('fileInput');
        this.imagePreview = document.getElementById('imagePreview');
        this.previewImg = document.getElementById('previewImg');
        this.removeImageBtn = document.getElementById('removeImageBtn');
        this.speechIndicator = document.getElementById('speechIndicator');
        
        // Speech recognition setup
        this.recognition = null;
        this.isRecording = false;
        this.currentImage = null;
        
        this.initializeEventListeners();
        this.initializeApp();
        this.initializeSpeechRecognition();
    }
    
    initializeApp() {
        // Focus on input
        this.messageInput.focus();
        
        // Load chat history from localStorage
        this.loadChatHistory();
        
        // Load saved language preference
        const savedLang = localStorage.getItem('bracescarebot_language');
        if (savedLang && this.languageSelect) {
            this.languageSelect.value = savedLang;
        }
    }
    
    initializeEventListeners() {
        // Send button click
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Enter key press (Shift+Enter for new line, Enter to send)
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Character counter and auto-resize
        this.messageInput.addEventListener('input', () => {
            const length = this.messageInput.value.length;
            this.charCount.textContent = length;
            
            // Update character counter color
            if (length > 480) {
                this.charCount.style.color = 'var(--danger-red)';
            } else if (length > 450) {
                this.charCount.style.color = 'var(--warning-orange)';
            } else {
                this.charCount.style.color = 'var(--text-muted)';
            }
            
            // Auto-resize textarea
            this.autoResizeInput();
        });
        
        // Delete data button
        if (this.deleteDataBtn) {
            this.deleteDataBtn.addEventListener('click', () => this.deleteAllData());
        }
        
        // Language selector
        if (this.languageSelect) {
            this.languageSelect.addEventListener('change', () => this.changeLanguage());
        }
        
        // Microphone button
        if (this.micButton) {
            this.micButton.addEventListener('click', () => this.toggleSpeechRecognition());
        }
        
        // Image upload button
        if (this.imageUploadBtn) {
            this.imageUploadBtn.addEventListener('click', () => this.fileInput.click());
        }
        
        // File input change
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }
        
        // Remove image button
        if (this.removeImageBtn) {
            this.removeImageBtn.addEventListener('click', () => this.removeImage());
        }
    }
    
    autoResizeInput() {
        // Auto-resize textarea
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
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
        this.autoResizeInput();
        this.setLoading(true);
        
        // Hide welcome card if this is the first message
        if (this.welcomeCard) {
            this.welcomeCard.style.display = 'none';
        }
        
        // Add user message to chat
        this.addMessage(message, 'user');
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            const response = await this.callChatAPI(message, consent);
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Clear image if it was sent
            if (this.currentImage) {
                this.removeImage();
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
            this.hideTypingIndicator();
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
            '<i class="fas fa-teeth"></i>';
        
        let warningHtml = '';
        if (metadata.redFlags && metadata.redFlags.length > 0) {
            warningHtml = `
                <div class="red-flag-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Important:</strong> You mentioned concerning symptoms. Please contact your orthodontist or seek medical attention immediately.
                </div>
            `;
        }
        
        let knowledgeHtml = '';
        if (metadata.knowledgeUsed) {
            knowledgeHtml = `
                <div class="knowledge-indicator">
                    <i class="fas fa-book"></i>
                    <span>Based on orthodontic knowledge base</span>
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
        this.sendButton.disabled = isLoading;
        this.messageInput.disabled = isLoading;
        
        if (isLoading) {
            this.sendButton.style.opacity = '0.6';
        } else {
            this.sendButton.style.opacity = '1';
        }
    }
    
    showTypingIndicator() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'flex';
            this.scrollToBottom();
        }
    }
    
    hideTypingIndicator() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'none';
        }
    }
    
    showError(message) {
        // Create a temporary toast-like notification
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--danger-red);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;
        
        alertDiv.innerHTML = `
            <i class="fas fa-exclamation-circle me-2"></i>
            ${message}
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            alertDiv.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => alertDiv.remove(), 300);
        }, 5000);
    }
    
    showSuccess(message) {
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--success-green);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;
        
        alertDiv.innerHTML = `
            <i class="fas fa-check-circle me-2"></i>
            ${message}
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            alertDiv.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => alertDiv.remove(), 300);
        }, 3000);
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
            '<i class="fas fa-teeth"></i>';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-bubble">
                <div class="message-content">${content}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
    }
    
    deleteAllData() {
        if (confirm('Are you sure you want to delete all chat history? This action cannot be undone.')) {
            // Clear local storage
            localStorage.removeItem('bracescarebot_history');
            
            // Clear chat messages
            this.chatMessages.innerHTML = '';
            
            // Show welcome card again
            if (this.welcomeCard) {
                this.welcomeCard.style.display = 'block';
            }
            
            // Show success message
            this.showSuccess('Chat history deleted successfully!');
        }
    }
    
    changeLanguage() {
        const selectedLang = this.languageSelect.value;
        // For now, just show a message - full i18n would require more setup
        this.showSuccess(`Language changed to ${this.languageSelect.options[this.languageSelect.selectedIndex].text}`);
        
        // Store language preference
        localStorage.setItem('bracescarebot_language', selectedLang);
    }
    
    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
            
            this.recognition.onstart = () => {
                this.isRecording = true;
                this.micButton.classList.add('recording');
                this.speechIndicator.classList.add('active');
            };
            
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.messageInput.value = transcript;
                this.charCount.textContent = transcript.length;
                this.autoResizeInput();
            };
            
            this.recognition.onend = () => {
                this.isRecording = false;
                this.micButton.classList.remove('recording');
                this.speechIndicator.classList.remove('active');
            };
            
            this.recognition.onerror = (event) => {
                this.showError('Speech recognition error: ' + event.error);
                this.isRecording = false;
                this.micButton.classList.remove('recording');
                this.speechIndicator.classList.remove('active');
            };
        } else {
            // Hide mic button if speech recognition is not supported
            if (this.micButton) {
                this.micButton.style.display = 'none';
            }
        }
    }
    
    toggleSpeechRecognition() {
        if (!this.recognition) {
            this.showError('Speech recognition is not supported in your browser');
            return;
        }
        
        if (this.isRecording) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    }
    
    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showError('Image file is too large. Please choose a file smaller than 5MB.');
            return;
        }
        
        // Check file type
        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.previewImg.src = e.target.result;
            this.imagePreview.style.display = 'block';
            this.currentImage = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    removeImage() {
        this.imagePreview.style.display = 'none';
        this.previewImg.src = '';
        this.currentImage = null;
        this.fileInput.value = '';
    }
    
    async callChatAPI(message, consent) {
        const payload = {
            message: message,
            consent: consent
        };
        
        // Add image if present
        if (this.currentImage) {
            payload.image = this.currentImage;
        }
        
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
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
            // Reset textarea height
            input.style.height = 'auto';
        }
    }
});

// Add slide animations CSS
const style = document.createElement('style');
style.textContent = `
@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes slideOutRight {
    from {
        opacity: 1;
        transform: translateX(0);
    }
    to {
        opacity: 0;
        transform: translateX(100%);
    }
}
`;
document.head.appendChild(style);