class ChatInterface {
    constructor() {
        this.currentChatId = null;
        this.credentials = {};
        this.isLoading = false;
        
        this.initializeElements();
        this.bindEvents();
        this.loadCredentials();
        this.loadChatHistory();
    }
    
    initializeElements() {
        this.providerSelect = document.getElementById('provider-select');
        this.modelSelect = document.getElementById('model-select');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.messagesContainer = document.getElementById('messages');
        this.chatList = document.getElementById('chat-list');
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.deleteChatBtn = document.getElementById('delete-chat-btn');
        this.chatTitle = document.getElementById('chat-title');
    }
    
    bindEvents() {
        this.providerSelect.addEventListener('change', () => this.onProviderChange());
        this.modelSelect.addEventListener('change', () => this.onModelChange());
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
        this.deleteChatBtn.addEventListener('click', () => this.deleteCurrentChat());
        
        this.messageInput.addEventListener('input', () => this.adjustTextareaHeight());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }
    
    adjustTextareaHeight() {
        const textarea = this.messageInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        
        // Enable/disable send button
        this.sendBtn.disabled = !textarea.value.trim() || this.isLoading || !this.modelSelect.value;
    }
    
    async loadCredentials() {
        try {
            const response = await fetch('/api/credentials');
            this.credentials = await response.json();
            this.populateProviderSelect();
        } catch (error) {
            console.error('Error loading credentials:', error);
        }
    }
    
    populateProviderSelect() {
        this.providerSelect.innerHTML = '<option value="">Select Provider</option>';
        
        Object.keys(this.credentials).forEach(provider => {
            const option = document.createElement('option');
            option.value = provider;
            option.textContent = this.credentials[provider].name;
            this.providerSelect.appendChild(option);
        });
    }
    
    onProviderChange() {
        const provider = this.providerSelect.value;
        this.modelSelect.innerHTML = '<option value="">Select Model</option>';
        
        if (provider && this.credentials[provider]) {
            this.credentials[provider].models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                this.modelSelect.appendChild(option);
            });
        }
        
        this.adjustTextareaHeight();
    }
    
    onModelChange() {
        this.adjustTextareaHeight();
    }
    
    async loadChatHistory() {
        try {
            const response = await fetch('/api/chats');
            const chats = await response.json();
            this.renderChatList(chats);
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }
    
    renderChatList(chats) {
        this.chatList.innerHTML = '';
        
        chats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.dataset.chatId = chat.id;
            
            const date = new Date(chat.updated_at).toLocaleDateString();
            
            chatItem.innerHTML = `
                <div class="chat-item-title">${chat.title}</div>
                <div class="chat-item-date">${date}</div>
            `;
            
            chatItem.addEventListener('click', () => this.loadChat(chat.id));
            this.chatList.appendChild(chatItem);
        });
    }
    
    async loadChat(chatId) {
        try {
            const response = await fetch(`/api/chat/${chatId}`);
            const chat = await response.json();
            
            this.currentChatId = chatId;
            this.chatTitle.textContent = chat.title;
            this.deleteChatBtn.style.display = 'block';
            
            this.renderMessages(chat.messages);
            this.updateActiveChatItem(chatId);
            
        } catch (error) {
            console.error('Error loading chat:', error);
        }
    }
    
    renderMessages(messages) {
        this.messagesContainer.innerHTML = '';
        
        messages.forEach(message => {
            this.addMessageToUI(message.role, message.content);
        });
        
        this.scrollToBottom();
    }
    
    addMessageToUI(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (role === 'assistant') {
            // Parse markdown for assistant messages
            const html = marked.parse(content);
            messageContent.innerHTML = DOMPurify.sanitize(html);
        } else {
            messageContent.textContent = content;
        }
        
        messageDiv.appendChild(messageContent);
        this.messagesContainer.appendChild(messageDiv);
    }
    
    updateActiveChatItem(chatId) {
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
    
    startNewChat() {
        this.currentChatId = null;
        this.chatTitle.textContent = 'New Chat';
        this.deleteChatBtn.style.display = 'none';
        this.messagesContainer.innerHTML = `
            <div class="welcome-message">
                <h2>New Chat</h2>
                <p>Start typing to begin a new conversation!</p>
            </div>
        `;
        
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
    }
    
    async deleteCurrentChat() {
        if (!this.currentChatId) return;
        
        if (confirm('Are you sure you want to delete this chat?')) {
            try {
                await fetch(`/api/chat/${this.currentChatId}`, {
                    method: 'DELETE'
                });
                
                this.startNewChat();
                this.loadChatHistory();
                
            } catch (error) {
                console.error('Error deleting chat:', error);
            }
        }
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        const provider = this.providerSelect.value;
        const model = this.modelSelect.value;
        
        if (!message || !provider || !model || this.isLoading) return;
        
        this.isLoading = true;
        this.sendBtn.disabled = true;
        
        // Clear welcome message if it exists
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        // Add user message to UI
        this.addMessageToUI('user', message);
        this.messageInput.value = '';
        this.adjustTextareaHeight();
        
        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message assistant';
        loadingDiv.innerHTML = '<div class="message-content loading">Thinking...</div>';
        this.messagesContainer.appendChild(loadingDiv);
        this.scrollToBottom();
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    chat_id: this.currentChatId,
                    provider: provider,
                    model: model
                })
            });
            
            const data = await response.json();
            
            // Remove loading indicator
            loadingDiv.remove();
            
            if (response.ok) {
                // Add assistant response
                this.addMessageToUI('assistant', data.response);
                
                // Update current chat ID and title
                if (!this.currentChatId) {
                    this.currentChatId = data.chat_id;
                    this.chatTitle.textContent = data.title;
                    this.deleteChatBtn.style.display = 'block';
                    this.loadChatHistory(); // Refresh chat list
                }
                
            } else {
                this.addMessageToUI('assistant', `Error: ${data.error}`);
            }
            
        } catch (error) {
            loadingDiv.remove();
            this.addMessageToUI('assistant', `Error: ${error.message}`);
        }
        
        this.isLoading = false;
        this.adjustTextareaHeight();
        this.scrollToBottom();
    }
    
    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
}

// Initialize the chat interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatInterface();
});