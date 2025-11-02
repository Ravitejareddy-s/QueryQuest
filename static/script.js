class ChatInterface {
    constructor() {
        this.currentChatId = null;
        this.credentials = {};
        this.isLoading = false;
        this.isMultiMode = false;
        this.selectedModels = [];
        this.uploadedFiles = [];
        this.currentNoteFilename = null;
        
        this.initializeElements();
        this.bindEvents();
        this.loadCredentials();
        this.loadChatHistory();
        this.loadNotes();
        this.initializeFromURL();
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
        this.chatTitleInput = document.getElementById('chat-title-input');
        this.folderInput = document.getElementById('folder-input');
        this.scrollToBottomBtn = document.getElementById('scroll-to-bottom');
        
        // Multi-model elements
        this.toggleMultiBtn = document.getElementById('toggle-multi-select');
        this.singleModelMode = document.getElementById('single-model-mode');
        this.multiModelMode = document.getElementById('multi-model-mode');
        this.modelCheckboxes = document.getElementById('model-checkboxes');
        this.clearAllBtn = document.getElementById('clear-all');
        this.selectedCountSpan = document.getElementById('selected-count');
        
        // Upload elements
        this.uploadBtn = document.getElementById('upload-btn');
        this.fileInput = document.getElementById('file-input');
        this.uploadModal = document.getElementById('upload-modal');
        this.uploadFilesBtn = document.getElementById('upload-files-btn');
        this.uploadFolderBtn = document.getElementById('upload-folder-btn');
        this.closeModalBtn = document.getElementById('close-modal');
        this.uploadedFilesContainer = document.getElementById('uploaded-files');
        
        // Notes elements
        this.notesContainer = document.getElementById('notes-container');
        this.notesList = document.getElementById('notes-list');
        this.newNoteBtn = document.getElementById('new-note-btn');
        this.noteFilename = document.getElementById('note-filename');
        this.noteEditor = document.getElementById('note-editor');
        this.saveNoteBtn = document.getElementById('save-note-btn');
        this.deleteNoteBtn = document.getElementById('delete-note-btn');

    }
    
    bindEvents() {
        this.providerSelect.addEventListener('change', () => this.onProviderChange());
        this.modelSelect.addEventListener('change', () => this.onModelChange());
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
        this.deleteChatBtn.addEventListener('click', () => this.deleteCurrentChat());
        this.scrollToBottomBtn.addEventListener('click', () => this.manualScrollToBottom());
        
        // Multi-model events
        this.toggleMultiBtn.addEventListener('click', () => this.toggleMultiMode());
        this.clearAllBtn.addEventListener('click', () => this.clearAllModels());
        
        // Upload events
        this.uploadBtn.addEventListener('click', () => this.showUploadModal());
        this.uploadFilesBtn.addEventListener('click', () => this.selectFiles());
        this.uploadFolderBtn.addEventListener('click', () => this.selectFolder());
        this.closeModalBtn.addEventListener('click', () => this.hideUploadModal());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Notes events
        this.newNoteBtn.addEventListener('click', () => this.createNewNote());
        this.saveNoteBtn.addEventListener('click', () => this.saveCurrentNote());
        this.deleteNoteBtn.addEventListener('click', () => this.deleteCurrentNote());
        
        // Folder input events
        this.folderInput.addEventListener('blur', () => this.updateChatFolder());
        this.folderInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.folderInput.blur();
            }
        });
        
        // Title input events
        this.chatTitleInput.addEventListener('blur', () => this.updateChatTitle());
        this.chatTitleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.chatTitleInput.blur();
            }
        });
        
        this.messageInput.addEventListener('input', () => this.adjustTextareaHeight());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!this.isLoading) {
                    this.sendMessage();
                }
            }
        });
        
        // Handle window resize for responsive textarea
        window.addEventListener('resize', () => {
            this.adjustTextareaHeight();
        });
        
        // Show/hide scroll to bottom button based on scroll position
        this.messagesContainer.addEventListener('scroll', () => {
            this.handleScroll();
        });
    }
    
    adjustTextareaHeight() {
        const textarea = this.messageInput;
        textarea.style.height = 'auto';
        
        const maxHeight = Math.min(window.innerHeight * 0.5, 400);
        textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
        
        // Enable/disable send button
        const hasMessage = textarea.value.trim();
        const hasModel = this.isMultiMode ? this.selectedModels.length > 0 : this.modelSelect.value;
        this.sendBtn.disabled = !hasMessage || this.isLoading || !hasModel;
    }
    
    async loadCredentials() {
        try {
            const response = await fetch('/api/credentials');
            this.credentials = await response.json();
            this.populateProviderSelect();
            this.populateModelCheckboxes();
            
            // Set default provider and model
            this.providerSelect.value = 'coforge';
            this.onProviderChange();
            this.modelSelect.value = 'gpt-5-chat';
            this.onModelChange();
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
    
    toggleMultiMode() {
        this.isMultiMode = !this.isMultiMode;
        
        if (this.isMultiMode) {
            this.singleModelMode.style.display = 'none';
            this.multiModelMode.style.display = 'block';
            this.toggleMultiBtn.textContent = 'Single Select';
            this.toggleMultiBtn.classList.add('active');
        } else {
            this.singleModelMode.style.display = 'block';
            this.multiModelMode.style.display = 'none';
            this.toggleMultiBtn.textContent = 'Multi-Select';
            this.toggleMultiBtn.classList.remove('active');
            this.selectedModels = [];
        }
        
        this.adjustTextareaHeight();
    }
    
    populateModelCheckboxes() {
        if (!this.modelCheckboxes || Object.keys(this.credentials).length === 0) {
            return;
        }
        
        this.modelCheckboxes.innerHTML = '';
        
        Object.keys(this.credentials).forEach(provider => {
            const providerConfig = this.credentials[provider];
            if (!providerConfig || !providerConfig.models) return;
            
            const groupDiv = document.createElement('div');
            groupDiv.className = 'model-checkbox-group';
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'provider-header';
            headerDiv.textContent = providerConfig.name || provider;
            groupDiv.appendChild(headerDiv);
            
            providerConfig.models.forEach(model => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'model-checkbox-item';
                
                const checkboxId = `${provider}-${model.replace(/[^a-zA-Z0-9]/g, '-')}`;
                
                itemDiv.innerHTML = `
                    <input type="checkbox" id="${checkboxId}" value="${provider}:${model}">
                    <label for="${checkboxId}">${model}</label>
                `;
                
                const checkbox = itemDiv.querySelector('input');
                checkbox.addEventListener('change', (e) => {
                    this.onModelCheckboxChange(provider, model, e.target.checked);
                });
                
                // Also handle clicks on the entire item
                itemDiv.addEventListener('click', (e) => {
                    if (e.target.type !== 'checkbox') {
                        checkbox.checked = !checkbox.checked;
                        this.onModelCheckboxChange(provider, model, checkbox.checked);
                    }
                });
                
                groupDiv.appendChild(itemDiv);
            });
            
            this.modelCheckboxes.appendChild(groupDiv);
        });
        
        this.updateSelectedCount();
    }
    
    onModelCheckboxChange(provider, model, checked) {
        console.log(`Checkbox changed: ${provider} - ${model} = ${checked}`);
        const modelInfo = { provider, model };
        
        if (checked) {
            // Add to selected models if not already present
            if (!this.selectedModels.some(m => m.provider === provider && m.model === model)) {
                this.selectedModels.push(modelInfo);
                console.log('Added model:', modelInfo);
            }
        } else {
            // Remove from selected models
            const beforeLength = this.selectedModels.length;
            this.selectedModels = this.selectedModels.filter(m => !(m.provider === provider && m.model === model));
            console.log(`Removed model. Before: ${beforeLength}, After: ${this.selectedModels.length}`);
        }
        
        console.log('Selected models:', this.selectedModels);
        this.updateSelectedCount();
        this.adjustTextareaHeight();
    }
    
    updateSelectedCount() {
        const count = this.selectedModels.length;
        this.selectedCountSpan.textContent = `${count} model${count !== 1 ? 's' : ''} selected`;
        console.log(`Updated count: ${count}`);
    }
    
    clearAllModels() {
        this.selectedModels = [];
        this.modelCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateSelectedCount();
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
        
        // Group chats by folder
        const folders = {};
        const ungroupedChats = [];
        
        chats.forEach(chat => {
            if (chat.folder_name && chat.folder_name.trim()) {
                const folderName = chat.folder_name.trim();
                if (!folders[folderName]) {
                    folders[folderName] = [];
                }
                folders[folderName].push(chat);
            } else {
                ungroupedChats.push(chat);
            }
        });
        
        // Render folders first (at the top)
        Object.keys(folders).sort().forEach(folderName => {
            const folderDiv = this.createFolderGroup(folderName, folders[folderName]);
            this.chatList.appendChild(folderDiv);
        });
        
        // Render ungrouped chats as a collapsible section with day separations
        if (ungroupedChats.length > 0) {
            const ungroupedDiv = this.createUngroupedChatsSection(ungroupedChats);
            this.chatList.appendChild(ungroupedDiv);
        }
    }
    
    createChatItem(chat) {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chat.id;
        
        const date = new Date(chat.updated_at).toLocaleDateString();
        
        chatItem.innerHTML = `
            <div class="chat-item-title">${chat.title}</div>
            <div class="chat-item-date">${date}</div>
        `;
        
        chatItem.addEventListener('click', () => this.loadChat(chat.id));
        return chatItem;
    }
    
    createUngroupedChatsSection(chats) {
        const ungroupedGroup = document.createElement('div');
        ungroupedGroup.className = 'folder-group ungrouped-section';
        
        const ungroupedHeader = document.createElement('div');
        ungroupedHeader.className = 'folder-header collapsed';
        ungroupedHeader.innerHTML = `
            <span class="folder-icon">▼</span>
            <span class="folder-name">Chat History</span>
            <span class="folder-count">${chats.length}</span>
        `;
        
        const ungroupedChats = document.createElement('div');
        ungroupedChats.className = 'folder-chats collapsed';
        
        // Group chats by day
        const chatsByDay = this.groupChatsByDay(chats);
        
        // Render each day group with separator
        Object.keys(chatsByDay).forEach((dayKey, index) => {
            if (index > 0) {
                // Add day separator
                const separator = document.createElement('div');
                separator.className = 'day-separator';
                ungroupedChats.appendChild(separator);
            }
            
            // Add day header
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = dayKey;
            ungroupedChats.appendChild(dayHeader);
            
            // Add chats for this day
            chatsByDay[dayKey].forEach(chat => {
                ungroupedChats.appendChild(this.createChatItem(chat));
            });
        });
        
        ungroupedHeader.addEventListener('click', () => {
            ungroupedHeader.classList.toggle('collapsed');
            ungroupedChats.classList.toggle('collapsed');
        });
        
        ungroupedGroup.appendChild(ungroupedHeader);
        ungroupedGroup.appendChild(ungroupedChats);
        
        return ungroupedGroup;
    }
    
    createFolderGroup(folderName, chats) {
        const folderGroup = document.createElement('div');
        folderGroup.className = 'folder-group';
        
        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header collapsed';
        folderHeader.innerHTML = `
            <span class="folder-icon">▼</span>
            <span class="folder-name">${folderName}</span>
            <span class="folder-count">${chats.length}</span>
        `;
        
        const folderChats = document.createElement('div');
        folderChats.className = 'folder-chats collapsed';
        
        chats.forEach(chat => {
            folderChats.appendChild(this.createChatItem(chat));
        });
        
        folderHeader.addEventListener('click', () => {
            folderHeader.classList.toggle('collapsed');
            folderChats.classList.toggle('collapsed');
        });
        
        folderGroup.appendChild(folderHeader);
        folderGroup.appendChild(folderChats);
        
        return folderGroup;
    }
    
    async loadChat(chatId) {
        try {
            const response = await fetch(`/api/chat/${chatId}`);
            const chat = await response.json();
            
            this.currentChatId = chatId;
            this.chatTitleInput.value = chat.title;
            this.folderInput.value = chat.folder_name || '';
            this.deleteChatBtn.style.display = 'block';
            
            this.renderMessages(chat.messages);
            this.updateActiveChatItem(chatId);
            this.updateURL(chatId);
            this.showChatInterface();
            
        } catch (error) {
            console.error('Error loading chat:', error);
        }
    }
    
    renderMessages(messages) {
        this.messagesContainer.innerHTML = '';
        
        messages.forEach(message => {
            // Check if this is a multi-model response by looking for the separator
            if (message.role === 'assistant' && message.content.includes('---')) {
                // Try to parse as multi-model response
                const parts = message.content.split('\n\n---\n\n');
                if (parts.length > 1) {
                    const responses = parts.map(part => {
                        const match = part.match(/\*\*(.+?)\s-\s(.+?):\*\*\n([\s\S]+)/);
                        if (match) {
                            return {
                                provider: match[1],
                                model: match[2],
                                response: match[3].trim(),
                                success: !match[3].includes('Error:')
                            };
                        }
                        return null;
                    }).filter(r => r !== null);
                    
                    if (responses.length > 0) {
                        this.addMessageToUI(message.role, null, true, responses);
                        return;
                    }
                }
            }
            
            // Regular single response
            this.addMessageToUI(message.role, message.content);
        });
    }
    
    addMessageToUI(role, content, isMulti = false, responses = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        if (role === 'assistant' && isMulti && responses) {
            // Multi-model response
            const multiResponseDiv = document.createElement('div');
            multiResponseDiv.className = 'multi-response';
            
            responses.forEach(resp => {
                const modelResponseDiv = document.createElement('div');
                modelResponseDiv.className = 'model-response';
                
                const headerDiv = document.createElement('div');
                headerDiv.className = 'model-response-header';
                
                const modelNameSpan = document.createElement('span');
                modelNameSpan.className = 'model-name';
                modelNameSpan.textContent = `${resp.provider} - ${resp.model}`;
                
                const statusSpan = document.createElement('span');
                statusSpan.className = `response-status ${resp.success ? 'success' : 'error'}`;
                statusSpan.textContent = resp.success ? 'Success' : 'Error';
                
                const copyBtn = this.createCopyButton(resp.response);
                
                headerDiv.appendChild(modelNameSpan);
                headerDiv.appendChild(statusSpan);
                headerDiv.appendChild(copyBtn);
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'model-response-content';
                
                if (resp.success) {
                    const html = marked.parse(resp.response);
                    contentDiv.innerHTML = DOMPurify.sanitize(html);
                } else {
                    contentDiv.textContent = resp.response;
                }
                
                modelResponseDiv.appendChild(headerDiv);
                modelResponseDiv.appendChild(contentDiv);
                multiResponseDiv.appendChild(modelResponseDiv);
            });
            
            messageDiv.appendChild(multiResponseDiv);
        } else {
            // Single response
            const messageWrapper = document.createElement('div');
            messageWrapper.className = 'message-wrapper';
            
            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            
            // Parse markdown for both user and assistant messages
            const html = marked.parse(content);
            messageContent.innerHTML = DOMPurify.sanitize(html);
            
            const copyBtn = this.createCopyButton(content);
            
            messageWrapper.appendChild(messageContent);
            messageWrapper.appendChild(copyBtn);
            messageDiv.appendChild(messageWrapper);
        }
        
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
        this.chatTitleInput.value = 'New Chat';
        this.folderInput.value = '';
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
        this.updateURL(null);
        this.showChatInterface();
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
        
        if (!message || this.isLoading) return;
        
        const messageWithFiles = this.getMessageWithFiles(message);
        
        // Check if we have selected models
        let selectedModels = [];
        if (this.isMultiMode) {
            if (this.selectedModels.length === 0) return;
            selectedModels = this.selectedModels;
        } else {
            const provider = this.providerSelect.value;
            const model = this.modelSelect.value;
            if (!provider || !model) return;
            selectedModels = [{ provider, model }];
        }
        
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
        this.uploadedFiles = [];
        this.renderUploadedFiles();
        this.adjustTextareaHeight();
        
        // Start streaming response
        this.streamResponse(messageWithFiles, selectedModels);
    }
    
    streamResponse(message, selectedModels) {
        const folderName = this.folderInput.value.trim() || null;
        const requestBody = {
            message: message,
            chat_id: this.currentChatId,
            folder_name: folderName,
            selected_models: selectedModels
        };
        
        // Add backward compatibility fields
        if (selectedModels.length === 1) {
            requestBody.provider = selectedModels[0].provider;
            requestBody.model = selectedModels[0].model;
        }
        
        // Create response container
        const responseDiv = document.createElement('div');
        responseDiv.className = 'message assistant';
        
        if (selectedModels.length > 1) {
            // Multi-model streaming setup
            const multiResponseDiv = document.createElement('div');
            multiResponseDiv.className = 'multi-response';
            
            selectedModels.forEach(model => {
                const modelResponseDiv = document.createElement('div');
                modelResponseDiv.className = 'model-response';
                modelResponseDiv.dataset.provider = model.provider;
                modelResponseDiv.dataset.model = model.model;
                
                const headerDiv = document.createElement('div');
                headerDiv.className = 'model-response-header';
                
                const modelNameSpan = document.createElement('span');
                modelNameSpan.className = 'model-name';
                modelNameSpan.textContent = `${model.provider} - ${model.model}`;
                
                const statusSpan = document.createElement('span');
                statusSpan.className = 'response-status loading';
                statusSpan.textContent = 'Thinking...';
                
                headerDiv.appendChild(modelNameSpan);
                headerDiv.appendChild(statusSpan);
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'model-response-content streaming';
                
                modelResponseDiv.appendChild(headerDiv);
                modelResponseDiv.appendChild(contentDiv);
                multiResponseDiv.appendChild(modelResponseDiv);
            });
            
            responseDiv.appendChild(multiResponseDiv);
        } else {
            // Single model streaming setup
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content streaming';
            responseDiv.appendChild(contentDiv);
        }
        
        this.messagesContainer.appendChild(responseDiv);
        
        // Wrap single model content in message-wrapper for copy button
        if (selectedModels.length === 1) {
            const contentDiv = responseDiv.querySelector('.message-content');
            if (contentDiv) {
                const messageWrapper = document.createElement('div');
                messageWrapper.className = 'message-wrapper';
                responseDiv.appendChild(messageWrapper);
                messageWrapper.appendChild(contentDiv);
            }
        }
        
        // Start EventSource for streaming
        fetch('/api/chat/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            const readStream = () => {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        this.finishStreaming(responseDiv, selectedModels);
                        return;
                    }
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    
                    lines.forEach(line => {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                this.handleStreamData(data, responseDiv, selectedModels);
                            } catch (e) {
                                console.error('Error parsing stream data:', e);
                            }
                        }
                    });
                    
                    readStream();
                }).catch(error => {
                    console.error('Stream reading error:', error);
                    this.handleStreamError(error, responseDiv);
                });
            };
            
            readStream();
        })
        .catch(error => {
            console.error('Streaming error:', error);
            this.handleStreamError(error, responseDiv);
        });
    }
    
    handleStreamData(data, responseDiv, selectedModels) {
        switch (data.type) {
            case 'chat_id':
                if (!this.currentChatId) {
                    this.currentChatId = data.chat_id;
                    this.chatTitleInput.value = data.title;
                    this.deleteChatBtn.style.display = 'block';
                    this.updateURL(data.chat_id);
                }
                break;
                
            case 'content':
                // Single model content
                const contentDiv = responseDiv.querySelector('.message-content');
                if (contentDiv) {
                    contentDiv.innerHTML += this.escapeHtml(data.content);
                }
                break;
                
            case 'model_start':
                const modelDiv = responseDiv.querySelector(`[data-provider="${data.provider}"][data-model="${data.model}"]`);
                if (modelDiv) {
                    const statusSpan = modelDiv.querySelector('.response-status');
                    statusSpan.textContent = 'Generating...';
                    statusSpan.className = 'response-status generating';
                }
                break;
                
            case 'model_content':
                const targetModelDiv = responseDiv.querySelector(`[data-provider="${data.provider}"][data-model="${data.model}"]`);
                if (targetModelDiv) {
                    const modelContentDiv = targetModelDiv.querySelector('.model-response-content');
                    modelContentDiv.innerHTML += this.escapeHtml(data.content);
                }
                break;
                
            case 'model_done':
                const doneModelDiv = responseDiv.querySelector(`[data-provider="${data.provider}"][data-model="${data.model}"]`);
                if (doneModelDiv) {
                    const statusSpan = doneModelDiv.querySelector('.response-status');
                    statusSpan.textContent = 'Success';
                    statusSpan.className = 'response-status success';
                    
                    const contentDiv = doneModelDiv.querySelector('.model-response-content');
                    contentDiv.className = 'model-response-content';
                    contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(contentDiv.textContent));
                }
                break;
                
            case 'model_error':
                const errorModelDiv = responseDiv.querySelector(`[data-provider="${data.provider}"][data-model="${data.model}"]`);
                if (errorModelDiv) {
                    const statusSpan = errorModelDiv.querySelector('.response-status');
                    statusSpan.textContent = 'Error';
                    statusSpan.className = 'response-status error';
                    
                    const contentDiv = errorModelDiv.querySelector('.model-response-content');
                    contentDiv.textContent = data.error;
                    contentDiv.className = 'model-response-content error';
                }
                break;
                
            case 'done':
                this.finishStreaming(responseDiv, selectedModels);
                break;
                
            case 'error':
                this.handleStreamError(new Error(data.error), responseDiv);
                break;
        }
    }
    
    finishStreaming(responseDiv, selectedModels) {
        // Convert single model streaming content to markdown
        if (selectedModels.length === 1) {
            const contentDiv = responseDiv.querySelector('.message-content');
            if (contentDiv && contentDiv.classList.contains('streaming')) {
                const text = contentDiv.textContent;
                contentDiv.className = 'message-content';
                contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(text));
                
                // Add copy button for single model streaming
                const messageWrapper = responseDiv.querySelector('.message-wrapper');
                if (messageWrapper && !messageWrapper.querySelector('.copy-btn')) {
                    const copyBtn = this.createCopyButton(text);
                    messageWrapper.appendChild(copyBtn);
                }
            }
        }
        
        // Add copy buttons to multi-model responses
        if (selectedModels.length > 1) {
            selectedModels.forEach(model => {
                const modelDiv = responseDiv.querySelector(`[data-provider="${model.provider}"][data-model="${model.model}"]`);
                if (modelDiv) {
                    const headerDiv = modelDiv.querySelector('.model-response-header');
                    const contentDiv = modelDiv.querySelector('.model-response-content');
                    if (headerDiv && contentDiv && !headerDiv.querySelector('.copy-btn')) {
                        const copyBtn = this.createCopyButton(contentDiv.textContent);
                        headerDiv.appendChild(copyBtn);
                    }
                }
            });
        }
        
        this.isLoading = false;
        this.adjustTextareaHeight();
        
        // Refresh chat list if this was a new chat
        if (this.currentChatId) {
            this.loadChatHistory();
        }
    }
    
    handleStreamError(error, responseDiv) {
        responseDiv.innerHTML = `<div class="message-content error">Error: ${error.message}</div>`;
        this.isLoading = false;
        this.adjustTextareaHeight();
    }
    
    createCopyButton(content) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;
        copyBtn.title = 'Copy to clipboard';
        
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(content);
                copyBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                `;
                setTimeout(() => {
                    copyBtn.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    `;
                }, 1000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
        
        return copyBtn;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    scrollToBottom() {
        // Auto-scrolling disabled - user can manually scroll
        // this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    manualScrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        this.scrollToBottomBtn.style.display = 'none';
    }
    
    handleScroll() {
        const container = this.messagesContainer;
        const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50;
        
        if (isAtBottom) {
            this.scrollToBottomBtn.style.display = 'none';
        } else {
            // Only show button if there are messages (not just welcome message)
            const hasMessages = container.querySelectorAll('.message').length > 0;
            if (hasMessages) {
                this.scrollToBottomBtn.style.display = 'flex';
            }
        }
    }
    
    showUploadModal() {
        console.log('Showing upload modal');
        this.uploadModal.style.display = 'flex';
    }
    
    hideUploadModal() {
        this.uploadModal.style.display = 'none';
    }
    
    selectFiles() {
        this.fileInput.webkitdirectory = false;
        this.fileInput.multiple = true;
        this.fileInput.click();
        this.hideUploadModal();
    }
    
    selectFolder() {
        this.fileInput.webkitdirectory = true;
        this.fileInput.multiple = false;
        this.fileInput.click();
        this.hideUploadModal();
    }
    
    async handleFileSelect(event) {
        const files = Array.from(event.target.files);
        console.log('Files selected:', files.length);
        if (files.length === 0) return;
        
        const formData = new FormData();
        files.forEach(file => {
            console.log('Adding file:', file.name);
            formData.append('files', file);
        });
        
        try {
            console.log('Uploading files...');
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Upload result:', result);
            this.uploadedFiles.push(...result.files);
            this.renderUploadedFiles();
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed: ' + error.message);
        }
        
        event.target.value = '';
    }
    
    renderUploadedFiles() {
        this.uploadedFilesContainer.innerHTML = '';
        
        this.uploadedFiles.forEach((file, index) => {
            const fileTag = document.createElement('div');
            fileTag.className = 'file-tag';
            fileTag.innerHTML = `
                <span>${file.name}</span>
                <span class="remove-file" data-index="${index}">&times;</span>
            `;
            
            fileTag.querySelector('.remove-file').addEventListener('click', () => {
                this.uploadedFiles.splice(index, 1);
                this.renderUploadedFiles();
            });
            
            this.uploadedFilesContainer.appendChild(fileTag);
        });
    }
    
    getMessageWithFiles(message) {
        if (this.uploadedFiles.length === 0) return message;
        
        const fileContents = this.uploadedFiles.map(file => 
            `\n\n--- File: ${file.name} ---\n${file.content}`
        ).join('');
        
        return message + fileContents;
    }
    

    
    updateURL(chatId) {
        const url = chatId ? `/chat/${chatId}` : '/';
        window.history.pushState({ chatId }, '', url);
    }
    
    initializeFromURL() {
        // Check if there's an initial chat ID from the backend
        const initialChatId = window.initialChatId;
        
        if (initialChatId) {
            // Wait for chat history to load first
            setTimeout(() => {
                this.loadChat(initialChatId);
            }, 100);
        }
        
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.chatId) {
                this.loadChat(event.state.chatId);
            } else {
                this.startNewChat();
            }
        });
        
        // Add keyboard shortcuts
        this.addKeyboardShortcuts();
    }
    
    addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // '/' key to focus search/query input
            if (e.key === '/' && !this.isInputFocused()) {
                e.preventDefault();
                this.messageInput.focus();
            }
            
            // Ctrl+N (or Cmd+N on Mac) for new chat
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                this.startNewChat();
                this.messageInput.focus();
            }
            
            // Ctrl+S for save note
            if ((e.ctrlKey || e.metaKey) && e.key === 's' && this.notesContainer.style.display !== 'none') {
                e.preventDefault();
                this.saveCurrentNote();
            }
        });
    }

    
    async updateChatFolder() {
        if (!this.currentChatId) return;
        
        const folderName = this.folderInput.value.trim() || null;
        
        try {
            await fetch(`/api/chat/${this.currentChatId}/folder`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ folder_name: folderName })
            });
            
            this.loadChatHistory();
        } catch (error) {
            console.error('Error updating chat folder:', error);
        }
    }
    
    async updateChatTitle() {
        if (!this.currentChatId) return;
        
        const title = this.chatTitleInput.value.trim() || 'Untitled Chat';
        
        try {
            await fetch(`/api/chat/${this.currentChatId}/title`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title: title })
            });
            
            this.loadChatHistory();
        } catch (error) {
            console.error('Error updating chat title:', error);
        }
    }
    
    groupChatsByDay(chats) {
        const chatsByDay = {};
        
        chats.forEach(chat => {
            const date = new Date(chat.updated_at);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            let dayKey;
            if (date.toDateString() === today.toDateString()) {
                dayKey = 'Today';
            } else if (date.toDateString() === yesterday.toDateString()) {
                dayKey = 'Yesterday';
            } else {
                dayKey = date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            }
            
            if (!chatsByDay[dayKey]) {
                chatsByDay[dayKey] = [];
            }
            chatsByDay[dayKey].push(chat);
        });
        
        // Sort days (Today first, then Yesterday, then chronological)
        const sortedDays = Object.keys(chatsByDay).sort((a, b) => {
            if (a === 'Today') return -1;
            if (b === 'Today') return 1;
            if (a === 'Yesterday') return -1;
            if (b === 'Yesterday') return 1;
            return new Date(b) - new Date(a);
        });
        
        const sortedChatsByDay = {};
        sortedDays.forEach(day => {
            sortedChatsByDay[day] = chatsByDay[day];
        });
        
        return sortedChatsByDay;
    }
    
    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        );
    }
    
    async loadNotes() {
        try {
            const response = await fetch('/api/notes');
            const notes = await response.json();
            this.renderNotesList(notes);
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }
    
    renderNotesList(notes) {
        this.notesList.innerHTML = '';
        notes.forEach(note => {
            const noteItem = document.createElement('div');
            noteItem.className = 'note-item';
            noteItem.textContent = note.name;
            noteItem.addEventListener('click', () => this.loadNote(note.filename));
            this.notesList.appendChild(noteItem);
        });
    }
    
    async loadNote(filename) {
        try {
            const response = await fetch(`/api/notes/${filename}`);
            const note = await response.json();
            this.currentNoteFilename = filename;
            this.noteFilename.value = filename.replace('.txt', '');
            this.noteEditor.value = note.content;
            this.deleteNoteBtn.style.display = 'flex';
            this.showNotesInterface();
            this.updateActiveNoteItem(filename);
        } catch (error) {
            console.error('Error loading note:', error);
        }
    }
    
    createNewNote() {
        this.currentNoteFilename = null;
        this.noteFilename.value = '';
        this.noteEditor.value = '';
        this.deleteNoteBtn.style.display = 'none';
        this.showNotesInterface();
        this.noteFilename.focus();
    }
    
    async saveCurrentNote() {
        const filename = this.noteFilename.value.trim();
        const content = this.noteEditor.value;
        if (!filename) {
            alert('Please enter a filename');
            return;
        }
        
        // If renaming existing note, delete old file first
        if (this.currentNoteFilename && this.currentNoteFilename !== filename + '.txt') {
            try {
                await fetch(`/api/notes/${this.currentNoteFilename}`, { method: 'DELETE' });
            } catch (error) {
                console.error('Error deleting old note:', error);
            }
        }
        
        try {
            const response = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, content })
            });
            const result = await response.json();
            if (result.success) {
                this.currentNoteFilename = result.filename;
                this.loadNotes();
            } else {
                alert('Error saving note: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving note:', error);
            alert('Error saving note');
        }
    }
    
    showNotesInterface() {
        this.notesContainer.style.display = 'flex';
    }
    
    showChatInterface() {
        this.notesContainer.style.display = 'none';
    }
    
    async deleteCurrentNote() {
        if (!this.currentNoteFilename) return;
        if (confirm('Are you sure you want to delete this note?')) {
            try {
                await fetch(`/api/notes/${this.currentNoteFilename}`, { method: 'DELETE' });
                this.loadNotes();
                this.createNewNote();
            } catch (error) {
                console.error('Error deleting note:', error);
                alert('Error deleting note');
            }
        }
    }
    
    updateActiveNoteItem(filename) {
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = Array.from(document.querySelectorAll('.note-item'))
            .find(item => item.textContent === filename.replace('.txt', ''));
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
}

// Initialize the chat interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatInterface();
});