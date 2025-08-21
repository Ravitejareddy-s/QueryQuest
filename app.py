from flask import Flask, render_template, request, jsonify
import json
import os
from datetime import datetime
import uuid
import openai
import requests

app = Flask(__name__)

# Ensure chat history directory exists
os.makedirs('chat_history', exist_ok=True)

def load_credentials():
    """Load credentials from credentials.json file"""
    try:
        with open('credentials.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_chat_history(chat_id, messages, title="New Chat"):
    """Save chat history to JSON file"""
    chat_data = {
        'id': chat_id,
        'title': title,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
        'messages': messages
    }
    
    with open(f'chat_history/{chat_id}.json', 'w') as f:
        json.dump(chat_data, f, indent=2)

def load_chat_history(chat_id):
    """Load chat history from JSON file"""
    try:
        with open(f'chat_history/{chat_id}.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return None

def get_all_chats():
    """Get all chat histories"""
    chats = []
    if os.path.exists('chat_history'):
        for filename in os.listdir('chat_history'):
            if filename.endswith('.json'):
                try:
                    with open(f'chat_history/{filename}', 'r') as f:
                        chat = json.load(f)
                        chats.append({
                            'id': chat['id'],
                            'title': chat['title'],
                            'updated_at': chat['updated_at']
                        })
                except:
                    continue
    
    # Sort by updated_at descending
    chats.sort(key=lambda x: x['updated_at'], reverse=True)
    return chats

def call_openai_api(messages, model, api_key):
    """Call OpenAI API"""
    openai.api_key = api_key
    
    try:
        response = openai.ChatCompletion.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=2000
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error: {str(e)}"

def call_anthropic_api(messages, model, api_key):
    """Call Anthropic API (Claude)"""
    headers = {
        'Content-Type': 'application/json',
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01'
    }
    
    # Convert messages format for Anthropic
    system_message = ""
    claude_messages = []
    
    for msg in messages:
        if msg['role'] == 'system':
            system_message = msg['content']
        else:
            claude_messages.append(msg)
    
    data = {
        'model': model,
        'max_tokens': 2000,
        'messages': claude_messages
    }
    
    if system_message:
        data['system'] = system_message
    
    try:
        response = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers=headers,
            json=data
        )
        response.raise_for_status()
        return response.json()['content'][0]['text']
    except Exception as e:
        return f"Error: {str(e)}"


def call_coforge_api(messages, model, api_key):
    headers = {
        "Content-Type": "application/json",
        "X-API-KEY": api_key
    }
    
    data = {
        'model': model,
        'messages': messages,
        "temperature": 0.7,
        "max_tokens": 2000
    }
    
    try:
        response = requests.post(
            'https://quasarmarket.coforge.com/aistudio-llmrouter-api/api/v2/chat/completions',
            headers=headers,
            json=data
        )
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content']
    except Exception as e:
        return f"Error: {str(e)}"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/credentials')
def get_credentials():
    """Get available credentials and models"""
    credentials = load_credentials()
    return jsonify(credentials)

@app.route('/api/chats')
def get_chats():
    """Get all chat histories"""
    chats = get_all_chats()
    return jsonify(chats)

@app.route('/api/chat/<chat_id>')
def get_chat(chat_id):
    """Get specific chat history"""
    chat = load_chat_history(chat_id)
    if chat:
        return jsonify(chat)
    return jsonify({'error': 'Chat not found'}), 404

@app.route('/api/chat', methods=['POST'])
def send_message():
    """Send message to LLM"""
    data = request.json
    message = data.get('message')
    chat_id = data.get('chat_id')
    provider = data.get('provider')
    model = data.get('model')
    
    credentials = load_credentials()
    
    if provider not in credentials:
        return jsonify({'error': 'Provider not found in credentials'}), 400
    
    provider_config = credentials[provider]
    
    # Load existing chat or create new one
    if chat_id:
        chat_data = load_chat_history(chat_id)
        if chat_data:
            messages = chat_data['messages']
            title = chat_data['title']
        else:
            messages = []
            title = message[:50] + "..." if len(message) > 50 else message
    else:
        chat_id = str(uuid.uuid4())
        messages = []
        title = message[:50] + "..." if len(message) > 50 else message
    
    # Add user message
    messages.append({'role': 'user', 'content': message})
    
    # Call appropriate API
    try:
        if provider == 'openai':
            response = call_openai_api(messages, model, provider_config['api_key'])
        elif provider == 'anthropic':
            response = call_anthropic_api(messages, model, provider_config['api_key'])
        elif provider == 'coforge':
            response = call_coforge_api(messages, model, provider_config['api_key'])
        else:
            return jsonify({'error': 'Unsupported provider'}), 400
        
        # Add assistant response
        messages.append({'role': 'assistant', 'content': response})
        
        # Save chat history
        save_chat_history(chat_id, messages, title)
        
        return jsonify({
            'response': response,
            'chat_id': chat_id,
            'title': title
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/<chat_id>', methods=['DELETE'])
def delete_chat(chat_id):
    """Delete a chat"""
    try:
        os.remove(f'chat_history/{chat_id}.json')
        return jsonify({'success': True})
    except FileNotFoundError:
        return jsonify({'error': 'Chat not found'}), 404

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)