from flask import Flask, render_template, request, jsonify, Response
import json
import os
from datetime import datetime
import uuid
import openai
import requests
import time
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Ensure chat history directory exists
os.makedirs('chat_history', exist_ok=True)
os.makedirs('text_notes', exist_ok=True)

def extract_text_from_file(file_path):
    """Extract text content from file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except:
        try:
            with open(file_path, 'r', encoding='latin-1') as f:
                return f.read()
        except:
            return f"[Could not read file: {os.path.basename(file_path)}]"

def process_uploaded_files(files):
    """Process uploaded files and extract text content"""
    file_contents = []
    for file in files:
        if file.filename:
            content = file.read().decode('utf-8', errors='ignore')
            file_contents.append({
                'name': file.filename,
                'content': content
            })
    return file_contents

def load_credentials():
    """Load credentials from credentials.json file"""
    try:
        with open('credentials.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def load_behavior_instructions():
    """Load behavior instructions from text_notes directory"""
    behavior_file = os.path.join('text_notes', 'behavior.txt')
    try:
        with open(behavior_file, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        return ""

def save_chat_history(chat_id, messages, title="New Chat", folder_name='check'):
    """Save chat history to JSON file"""
    chat_data = {
        'id': chat_id,
        'title': title,
        'folder_name': folder_name,
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
                            'folder_name': chat.get('folder_name'),
                            'updated_at': chat['updated_at']
                        })
                except:
                    continue
    
    # Sort by updated_at descending
    chats.sort(key=lambda x: x['updated_at'], reverse=True)
    return chats

def call_openai_api(messages, model, api_key, stream=False):
    """Call OpenAI API"""
    openai.api_key = api_key
    
    # Add behavior instructions to messages
    behavior_instructions = load_behavior_instructions()
    if behavior_instructions:
        enhanced_messages = [{'role': 'system', 'content': behavior_instructions}] + messages
    else:
        enhanced_messages = messages
    
    try:
        response = openai.ChatCompletion.create(
            model=model,
            messages=enhanced_messages,
            temperature=0.7,
            max_tokens=2000,
            stream=stream
        )
        if stream:
            return response
        return response.choices[0].message.content
    except Exception as e:
        return f"Error: {str(e)}"

def call_anthropic_api(messages, model, api_key, stream=False):
    """Call Anthropic API (Claude)"""
    headers = {
        'Content-Type': 'application/json',
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01'
    }
    
    # Convert messages format for Anthropic
    system_message = ""
    claude_messages = []
    
    # Add behavior instructions
    behavior_instructions = load_behavior_instructions()
    
    for msg in messages:
        if msg['role'] == 'system':
            system_message = msg['content']
        else:
            claude_messages.append(msg)
    
    # Combine behavior instructions with existing system message
    if behavior_instructions:
        if system_message:
            system_message = behavior_instructions + "\n\n" + system_message
        else:
            system_message = behavior_instructions
    
    data = {
        'model': model,
        'max_tokens': 2000,
        'messages': claude_messages,
        'stream': stream
    }
    
    if system_message:
        data['system'] = system_message
    
    try:
        response = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers=headers,
            json=data,
            stream=stream
        )
        response.raise_for_status()
        if stream:
            return response
        return response.json()['content'][0]['text']
    except Exception as e:
        return f"Error: {str(e)}"


def call_coforge_api(messages, model, api_key, stream=False):
    headers = {
        "Content-Type": "application/json",
        "X-API-KEY": api_key
    }
    
    # Add behavior instructions to messages
    behavior_instructions = load_behavior_instructions()
    if behavior_instructions:
        enhanced_messages = [{'role': 'system', 'content': behavior_instructions}] + messages
    else:
        enhanced_messages = messages
    
    data = {
        'model': model,
        'messages': enhanced_messages,
        "temperature": 0.7,
        "max_tokens": 2000,
        "stream": stream
    }
    
    try:
        response = requests.post(
            'https://quasarmarket.coforge.com/qag/llmrouter-api/v2/chat/completions',
            headers=headers,
            json=data,
            stream=stream
        )
        response.raise_for_status()
        if stream:
            return response
        return response.json()['choices'][0]['message']['content']
    except Exception as e:
        return f"Error: {str(e)}"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat/<chat_id>')
def chat_view(chat_id):
    """Render chat page with specific chat ID"""
    return render_template('index.html', chat_id=chat_id)

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
    """Send message to LLM(s)"""
    data = request.json
    message = data.get('message')
    chat_id = data.get('chat_id')
    folder_name = data.get('folder_name')
    selected_models = data.get('selected_models', [])
    
    # Handle backward compatibility for single model
    if not selected_models:
        provider = data.get('provider')
        model = data.get('model')
        if provider and model:
            selected_models = [{'provider': provider, 'model': model}]
    
    if not selected_models:
        return jsonify({'error': 'No models selected'}), 400
    
    credentials = load_credentials()
    
    # Load existing chat or create new one
    if chat_id:
        chat_data = load_chat_history(chat_id)
        if chat_data:
            messages = chat_data['messages']
            title = chat_data['title']
            folder_name = chat_data.get('folder_name')
        else:
            messages = []
            title = message[:50] + "..." if len(message) > 50 else message
    else:
        chat_id = str(uuid.uuid4())
        messages = []
        title = message[:50] + "..." if len(message) > 50 else message
        # folder_name already defined from request data
    
    # Add user message
    messages.append({'role': 'user', 'content': message})
    
    # Handle single model (backward compatibility)
    if len(selected_models) == 1:
        model_info = selected_models[0]
        provider = model_info['provider']
        model = model_info['model']
        
        if provider not in credentials:
            return jsonify({'error': f'Provider {provider} not found in credentials'}), 400
        
        provider_config = credentials[provider]
        
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
            save_chat_history(chat_id, messages, title, folder_name)
            
            return jsonify({
                'response': response,
                'chat_id': chat_id,
                'title': title,
                'is_multi': False
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # Handle multiple models
    else:
        responses = []
        
        for model_info in selected_models:
            provider = model_info['provider']
            model = model_info['model']
            
            if provider not in credentials:
                responses.append({
                    'provider': provider,
                    'model': model,
                    'response': f'Error: Provider {provider} not found in credentials',
                    'success': False
                })
                continue
            
            provider_config = credentials[provider]
            
            try:
                if provider == 'openai':
                    response = call_openai_api(messages, model, provider_config['api_key'])
                elif provider == 'anthropic':
                    response = call_anthropic_api(messages, model, provider_config['api_key'])
                elif provider == 'coforge':
                    response = call_coforge_api(messages, model, provider_config['api_key'])
                else:
                    response = f'Error: Unsupported provider {provider}'
                    responses.append({
                        'provider': provider,
                        'model': model,
                        'response': response,
                        'success': False
                    })
                    continue
                
                responses.append({
                    'provider': provider,
                    'model': model,
                    'response': response,
                    'success': True
                })
                
            except Exception as e:
                responses.append({
                    'provider': provider,
                    'model': model,
                    'response': f'Error: {str(e)}',
                    'success': False
                })
        
        # Create combined response for chat history
        combined_response = "\n\n---\n\n".join([
            f"**{resp['provider']} - {resp['model']}:**\n{resp['response']}"
            for resp in responses
        ])
        
        # Add assistant response to chat history
        messages.append({'role': 'assistant', 'content': combined_response})
        
        # Save chat history
        save_chat_history(chat_id, messages, title, folder_name)
        
        return jsonify({
            'responses': responses,
            'chat_id': chat_id,
            'title': title,
            'is_multi': True
        })

@app.route('/api/chat/stream', methods=['POST'])
def stream_message():
    """Stream message response using Server-Sent Events"""
    data = request.json
    message = data.get('message')
    chat_id = data.get('chat_id')
    folder_name = data.get('folder_name')
    selected_models = data.get('selected_models', [])
    
    if not selected_models:
        provider = data.get('provider')
        model = data.get('model')
        if provider and model:
            selected_models = [{'provider': provider, 'model': model}]
    
    if not selected_models:
        return jsonify({'error': 'No models selected'}), 400
    
    credentials = load_credentials()
    
    def generate():
        # Use folder_name from outer scope
        current_folder_name = folder_name
        
        # Load existing chat or create new one
        if chat_id:
            chat_data = load_chat_history(chat_id)
            if chat_data:
                messages = chat_data['messages']
                title = chat_data['title']
                current_folder_name = chat_data.get('folder_name')
            else:
                messages = []
                title = message[:50] + "..." if len(message) > 50 else message
                # Keep current_folder_name from request data
        else:
            new_chat_id = str(uuid.uuid4())
            messages = []
            title = message[:50] + "..." if len(message) > 50 else message
            # Keep current_folder_name from request data
            yield f"data: {json.dumps({'type': 'chat_id', 'chat_id': new_chat_id, 'title': title})}\n\n"
        
        # Add user message
        messages.append({'role': 'user', 'content': message})
        
        if len(selected_models) == 1:
            # Single model streaming
            model_info = selected_models[0]
            provider = model_info['provider']
            model = model_info['model']
            
            if provider not in credentials:
                yield f"data: {json.dumps({'type': 'error', 'error': f'Provider {provider} not found'})}\n\n"
                return
            
            provider_config = credentials[provider]
            full_response = ""
            
            try:
                if provider == 'openai':
                    stream = call_openai_api(messages, model, provider_config['api_key'], stream=True)
                    for chunk in stream:
                        if chunk.choices[0].delta.get('content'):
                            content = chunk.choices[0].delta.content
                            full_response += content
                            yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                elif provider == 'anthropic':
                    stream = call_anthropic_api(messages, model, provider_config['api_key'], stream=True)
                    for line in stream.iter_lines():
                        if line:
                            line = line.decode('utf-8')
                            if line.startswith('data: '):
                                try:
                                    chunk_data = json.loads(line[6:])
                                    if chunk_data.get('type') == 'content_block_delta':
                                        content = chunk_data.get('delta', {}).get('text', '')
                                        if content:
                                            full_response += content
                                            yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                                except json.JSONDecodeError:
                                    continue
                elif provider == 'coforge':
                    stream = call_coforge_api(messages, model, provider_config['api_key'], stream=True)
                    for line in stream.iter_lines():
                        if line:
                            line = line.decode('utf-8')
                            if line.startswith('data: '):
                                try:
                                    chunk_data = json.loads(line[6:])
                                    if chunk_data.get('choices') and chunk_data['choices'][0].get('delta', {}).get('content'):
                                        content = chunk_data['choices'][0]['delta']['content']
                                        full_response += content
                                        yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                                except json.JSONDecodeError:
                                    continue
                
                # Add assistant response and save
                messages.append({'role': 'assistant', 'content': full_response})
                save_chat_history(chat_id or new_chat_id, messages, title, current_folder_name)
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
        else:
            # Multi-model streaming
            responses = []
            for model_info in selected_models:
                provider = model_info['provider']
                model = model_info['model']
                
                yield f"data: {json.dumps({'type': 'model_start', 'provider': provider, 'model': model})}\n\n"
                
                if provider not in credentials:
                    error_msg = f'Provider {provider} not found'
                    responses.append({'provider': provider, 'model': model, 'response': f'Error: {error_msg}', 'success': False})
                    yield f"data: {json.dumps({'type': 'model_error', 'provider': provider, 'model': model, 'error': error_msg})}\n\n"
                    continue
                
                provider_config = credentials[provider]
                full_response = ""
                
                try:
                    if provider == 'openai':
                        stream = call_openai_api(messages, model, provider_config['api_key'], stream=True)
                        for chunk in stream:
                            if chunk.choices[0].delta.get('content'):
                                content = chunk.choices[0].delta.content
                                full_response += content
                                yield f"data: {json.dumps({'type': 'model_content', 'provider': provider, 'model': model, 'content': content})}\n\n"
                    elif provider == 'anthropic':
                        stream = call_anthropic_api(messages, model, provider_config['api_key'], stream=True)
                        for line in stream.iter_lines():
                            if line:
                                line = line.decode('utf-8')
                                if line.startswith('data: '):
                                    try:
                                        chunk_data = json.loads(line[6:])
                                        if chunk_data.get('type') == 'content_block_delta':
                                            content = chunk_data.get('delta', {}).get('text', '')
                                            if content:
                                                full_response += content
                                                yield f"data: {json.dumps({'type': 'model_content', 'provider': provider, 'model': model, 'content': content})}\n\n"
                                    except json.JSONDecodeError:
                                        continue
                    elif provider == 'coforge':
                        stream = call_coforge_api(messages, model, provider_config['api_key'], stream=True)
                        for line in stream.iter_lines():
                            if line:
                                line = line.decode('utf-8')
                                if line.startswith('data: '):
                                    try:
                                        chunk_data = json.loads(line[6:])
                                        if chunk_data.get('choices') and chunk_data['choices'][0].get('delta', {}).get('content'):
                                            content = chunk_data['choices'][0]['delta']['content']
                                            full_response += content
                                            yield f"data: {json.dumps({'type': 'model_content', 'provider': provider, 'model': model, 'content': content})}\n\n"
                                    except json.JSONDecodeError:
                                        continue
                    
                    responses.append({'provider': provider, 'model': model, 'response': full_response, 'success': True})
                    yield f"data: {json.dumps({'type': 'model_done', 'provider': provider, 'model': model})}\n\n"
                    
                except Exception as e:
                    error_msg = str(e)
                    responses.append({'provider': provider, 'model': model, 'response': f'Error: {error_msg}', 'success': False})
                    yield f"data: {json.dumps({'type': 'model_error', 'provider': provider, 'model': model, 'error': error_msg})}\n\n"
            
            # Create combined response for chat history
            combined_response = "\n\n---\n\n".join([
                f"**{resp['provider']} - {resp['model']}:**\n{resp['response']}"
                for resp in responses
            ])
            
            messages.append({'role': 'assistant', 'content': combined_response})
            save_chat_history(chat_id or new_chat_id, messages, title, current_folder_name)
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
    
    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/upload', methods=['POST'])
def upload_files():
    """Handle file uploads"""
    if 'files' not in request.files:
        return jsonify({'error': 'No files uploaded'}), 400
    
    files = request.files.getlist('files')
    file_contents = process_uploaded_files(files)
    
    return jsonify({'files': file_contents})

@app.route('/api/chat/<chat_id>/folder', methods=['PUT'])
def update_chat_folder(chat_id):
    """Update chat folder"""
    data = request.json
    folder_name = data.get('folder_name')
    
    try:
        chat_data = load_chat_history(chat_id)
        if not chat_data:
            return jsonify({'error': 'Chat not found'}), 404
        
        chat_data['folder_name'] = folder_name
        chat_data['updated_at'] = datetime.now().isoformat()
        
        with open(f'chat_history/{chat_id}.json', 'w') as f:
            json.dump(chat_data, f, indent=2)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/<chat_id>/title', methods=['PUT'])
def update_chat_title(chat_id):
    """Update chat title"""
    data = request.json
    title = data.get('title')
    
    try:
        chat_data = load_chat_history(chat_id)
        if not chat_data:
            return jsonify({'error': 'Chat not found'}), 404
        
        chat_data['title'] = title
        chat_data['updated_at'] = datetime.now().isoformat()
        
        with open(f'chat_history/{chat_id}.json', 'w') as f:
            json.dump(chat_data, f, indent=2)
        
        return jsonify({'success': True})
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

@app.route('/api/notes')
def get_notes():
    """Get all text notes"""
    notes = []
    if os.path.exists('text_notes'):
        for filename in os.listdir('text_notes'):
            if filename.endswith('.txt'):
                filepath = os.path.join('text_notes', filename)
                try:
                    stat = os.stat(filepath)
                    notes.append({
                        'filename': filename,
                        'name': filename[:-4],
                        'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
                    })
                except:
                    continue
    notes.sort(key=lambda x: x['modified'], reverse=True)
    return jsonify(notes)

@app.route('/api/notes/<filename>')
def get_note(filename):
    """Get specific text note"""
    if not filename.endswith('.txt'):
        filename += '.txt'
    filepath = os.path.join('text_notes', filename)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'content': content, 'filename': filename})
    except FileNotFoundError:
        return jsonify({'error': 'Note not found'}), 404

@app.route('/api/notes', methods=['POST'])
def save_note():
    """Save text note"""
    data = request.json
    filename = data.get('filename', '').strip()
    content = data.get('content', '')
    if not filename:
        return jsonify({'error': 'Filename required'}), 400
    if not filename.endswith('.txt'):
        filename += '.txt'
    filename = "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_', '.')).rstrip()
    filepath = os.path.join('text_notes', filename)
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({'success': True, 'filename': filename})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/notes/<filename>', methods=['DELETE'])
def delete_note(filename):
    """Delete text note"""
    if not filename.endswith('.txt'):
        filename += '.txt'
    filepath = os.path.join('text_notes', filename)
    try:
        os.remove(filepath)
        return jsonify({'success': True})
    except FileNotFoundError:
        return jsonify({'error': 'Note not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)