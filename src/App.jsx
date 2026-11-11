import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Layers,
  Lock,
  Unlock,
  MessageSquare,
  Send,
  Plus,
  RefreshCw,
  Cpu,
  FolderLock,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Radio,
  FileCode2,
  AlertTriangle,
  StopCircle,
  Wrench,
  ChevronDown,
  ChevronRight,
  Bot,
  Trash2,
  History,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Paperclip,
  Loader2,
  Check,
  X,
  File,
  FileText,
  Image as ImageIcon,
  UploadCloud
} from 'lucide-react';

const STORAGE_KEY_CONVS = 'agy_desktop_conversations';
const STORAGE_KEY_ACTIVE_ID = 'agy_desktop_active_conv_id';

function loadSavedConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONVS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading conversations from localStorage', e);
  }
  return [];
}

export default function App() {
  const [telemetry, setTelemetry] = useState({ activeSessionsCount: 0, sessions: [], locks: [] });
  const [models, setModels] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'dashboard' | 'locks' | 'mesh'
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [sidebarTab, setSidebarTab] = useState('history'); // 'history' | 'mesh'
  const [savedConversations, setSavedConversations] = useState(loadSavedConversations);
  
  const [activeConversationId, setActiveConversationId] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
    if (saved) return saved;
    const convs = loadSavedConversations();
    return convs.length > 0 ? convs[0].id : 'conv-' + Date.now();
  });

  // In-App Interactive Chat & Streaming State (Persisted in localStorage)
  const [chatMessages, setChatMessages] = useState(() => {
    try {
      const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
      const convs = loadSavedConversations();
      if (activeId && convs.length > 0) {
        const found = convs.find(c => c.id === activeId);
        if (found && found.messages && found.messages.length > 0) {
          return found.messages;
        }
      }
      if (convs.length > 0 && convs[0].messages && convs[0].messages.length > 0) {
        return convs[0].messages;
      }
    } catch (e) {}
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: '¡Hola Jorge! Soy tu asistente de Antigravity CLI integrado directamente en AGY Desktop. Todo corre aquí adentro sin necesidad de abrir ventanas de terminal externas. ¿En qué podemos avanzar hoy?',
        tools: [],
        thinking: ''
      }
    ];
  });
  const [chatInput, setChatInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash-high');
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [streamingThought, setStreamingThought] = useState('');
  const [streamingResponse, setStreamingResponse] = useState('');
  const [currentTools, setCurrentTools] = useState([]);
  const [showThinking, setShowThinking] = useState(true);

  // Keep activeConversationId synchronized in a ref
  const activeConversationIdRef = useRef(activeConversationId);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Auto-persist active conversation to localStorage
  useEffect(() => {
    if (!chatMessages || chatMessages.length === 0) return;
    try {
      const currentId = activeConversationId || 'conv-default';
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, currentId);

      const firstUserMsg = chatMessages.find(m => m.role === 'user');
      const title = firstUserMsg
        ? (firstUserMsg.content.slice(0, 36) + (firstUserMsg.content.length > 36 ? '...' : ''))
        : 'Nueva Conversación';

      setSavedConversations(prev => {
        const existingIdx = prev.findIndex(c => c.id === currentId);
        const updated = {
          id: currentId,
          title,
          cliConversationId: currentId.startsWith('conv-') ? null : currentId,
          updatedAt: new Date().toISOString(),
          messages: chatMessages
        };

        let next;
        if (existingIdx !== -1) {
          next = [...prev];
          next[existingIdx] = updated;
        } else {
          next = [updated, ...prev];
        }
        localStorage.setItem(STORAGE_KEY_CONVS, JSON.stringify(next));
        return next;
      });
    } catch (e) {
      console.error('Error al persistir conversación en localStorage', e);
    }
  }, [chatMessages, activeConversationId]);

  // Voice Recording & Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const currentAudioElementRef = useRef(null);

  // File Attachments & Drag-and-Drop State
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  // Locks inputs
  const [lockPathInput, setLockPathInput] = useState('');
  const [lockReasonInput, setLockReasonInput] = useState('');

  // Mesh Chat
  const [meshMessage, setMeshMessage] = useState('');
  const [meshLog, setMeshLog] = useState([
    { id: 1, sender: 'Sistema', text: 'Plugin Session Mesh conectado y operativo.', time: '10:00' }
  ]);

  const messagesEndRef = useRef(null);
  const streamingResponseRef = useRef('');
  const streamingThoughtRef = useRef('');
  const currentToolsRef = useRef([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, streamingResponse, currentTools, streamingThought]);

  // Fetch telemetry from session-mesh
  const fetchTelemetry = async () => {
    try {
      if (window.agy) {
        const data = await window.agy.getTelemetry();
        setTelemetry(data);
        if (!selectedSessionId && data.sessions && data.sessions.length > 0) {
          setSelectedSessionId(data.sessions[0].conversationId);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    if (window.agy) {
      window.agy.getModels().then(m => {
        if (m && m.length) {
          setModels(m);
          setSelectedModel(m[0].id);
        }
      });

      // Listen for streaming events from background agy process (mounted once)
      const unsubStream = window.agy.onStreamEvent(event => {
        if (!event) return;

        if (event.event === 'init') {
          if (event.conversation_id) {
            const cliId = event.conversation_id;
            const prevId = activeConversationIdRef.current;
            setActiveConversationId(cliId);
            setSavedConversations(prev => {
              const next = prev.map(c => {
                if (c.id === prevId || c.id === cliId) {
                  return { ...c, id: cliId, cliConversationId: cliId };
                }
                return c;
              });
              localStorage.setItem(STORAGE_KEY_CONVS, JSON.stringify(next));
              localStorage.setItem(STORAGE_KEY_ACTIVE_ID, cliId);
              return next;
            });
          }
        }

        if (event.event === 'step_update' && event.step_update) {
          const update = event.step_update;

          if (update.step_type === 'agent_response' && update.text_delta) {
            streamingResponseRef.current += update.text_delta;
            setStreamingResponse(streamingResponseRef.current);
          } else if (update.step_type === 'thinking' && (update.text_delta || update.thought)) {
            streamingThoughtRef.current += (update.text_delta || update.thought);
            setStreamingThought(streamingThoughtRef.current);
          }

          if (update.step_type === 'tool') {
            const toolName = update.tool_name || (update.tool_info && update.tool_info.name) || 'herramienta';
            const params = update.tool_info ? update.tool_info.parameters : null;
            const state = update.state || 'ACTIVE';

            const existingIdx = currentToolsRef.current.findIndex(t => t.index === update.step_index);
            if (existingIdx !== -1) {
              currentToolsRef.current[existingIdx] = {
                ...currentToolsRef.current[existingIdx],
                state,
                params: params || currentToolsRef.current[existingIdx].params
              };
            } else {
              currentToolsRef.current.push({ index: update.step_index, name: toolName, state, params });
            }
            setCurrentTools([...currentToolsRef.current]);
          }
        }

        if (event.event === 'result' && event.result) {
          const finalResp = event.result.response || '';
          if (finalResp) {
            streamingResponseRef.current = finalResp;
            setStreamingResponse(finalResp);
          }
        }
      });

      const unsubFinished = () => {
        setIsAgentRunning(false);
        const finalContent = streamingResponseRef.current || '(Turno finalizado sin respuesta de texto)';
        const finalTools = [...currentToolsRef.current];
        const finalThought = streamingThoughtRef.current;

        setChatMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: finalContent,
            tools: finalTools,
            thinking: finalThought
          }
        ]);
        streamingResponseRef.current = '';
        streamingThoughtRef.current = '';
        currentToolsRef.current = [];
        setStreamingResponse('');
        setStreamingThought('');
        setCurrentTools([]);
        fetchTelemetry();
      };

      const unsubFinishedCall = window.agy.onTurnFinished(unsubFinished);

      return () => {
        if (unsubStream) unsubStream();
        if (unsubFinishedCall) unsubFinishedCall();
      };
    }
  }, []);

  useEffect(() => {
    let interval = null;
    if (autoRefresh) {
      interval = setInterval(fetchTelemetry, 3000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Handle in-app turn submission with file attachments support
  const handleSendPrompt = async () => {
    if ((!chatInput.trim() && attachedFiles.length === 0) || isAgentRunning || !window.agy) return;

    const userText = chatInput.trim();
    const currentAttachments = [...attachedFiles];

    setChatInput('');
    setAttachedFiles([]);
    setIsAgentRunning(true);
    streamingResponseRef.current = '';
    streamingThoughtRef.current = '';
    currentToolsRef.current = [];
    setStreamingResponse('');
    setStreamingThought('');
    setCurrentTools([]);

    // Add user message to UI immediately with attachments
    setChatMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        content: userText || '(Archivos adjuntos para análisis)',
        attachments: currentAttachments
      }
    ]);

    // Build prompt with attached file paths
    let fullPrompt = userText;
    if (currentAttachments.length > 0) {
      const fileList = currentAttachments.map(f => `- ${f.path} (${formatFileSize(f.size)})`).join('\n');
      const attachHeader = `[Archivos adjuntos por el usuario]:\n${fileList}\n\n`;
      fullPrompt = attachHeader + (userText ? `Instrucción: ${userText}` : 'Por favor analiza y revisa los archivos adjuntos provistos.');
    }

    // Call startTurn directly inside Electron (zero external windows!)
    await window.agy.startTurn({
      prompt: fullPrompt,
      model: selectedModel,
      conversationId: activeConversationId || undefined,
      workspace: 'C:\\Proyectos\\yoguidev'
    });
  };

  const handleCancelTurn = async () => {
    if (window.agy) {
      await window.agy.cancelTurn();
      setIsAgentRunning(false);
    }
  };

  const handleNewConversation = () => {
    if (isAgentRunning) return;
    const newId = 'conv-' + Date.now();
    setActiveConversationId(newId);
    setSelectedSessionId(null);
    const welcome = [
      {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        content: '¡Nueva conversación iniciada! Todo corre aquí dentro de AGY Desktop sin ventanas de terminal externas. ¿En qué podemos avanzar hoy?',
        tools: [],
        thinking: ''
      }
    ];
    setChatMessages(welcome);
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, newId);
    setActiveTab('chat');
  };

  const handleSelectConversation = (conv) => {
    if (isAgentRunning) return;
    setActiveConversationId(conv.id);
    setSelectedSessionId(conv.cliConversationId || null);
    setChatMessages(conv.messages || []);
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, conv.id);
    setActiveTab('chat');
  };

  const handleDeleteConversation = (e, convId) => {
    e.stopPropagation();
    if (isAgentRunning) return;
    setSavedConversations(prev => {
      const filtered = prev.filter(c => c.id !== convId);
      localStorage.setItem(STORAGE_KEY_CONVS, JSON.stringify(filtered));
      if (activeConversationId === convId) {
        if (filtered.length > 0) {
          setTimeout(() => handleSelectConversation(filtered[0]), 0);
        } else {
          setTimeout(() => handleNewConversation(), 0);
        }
      }
      return filtered;
    });
  };

  // Voice Recording & Audio Functions
  const startRecording = async () => {
    if (isRecording || isAgentRunning) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

        setIsTranscribing(true);
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const result = await window.agy.transcribeAudio(uint8Array, 'audio/webm');

          if (result && result.text) {
            setChatInput(prev => (prev ? prev + ' ' + result.text : result.text));
          } else if (result && result.error) {
            alert(`Error al transcribir: ${result.error}`);
          }
        } catch (err) {
          console.error(err);
          alert(`Error al procesar audio: ${err.message}`);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      alert(`No se pudo acceder al micrófono: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;
    clearInterval(recordingTimerRef.current);
    audioChunksRef.current = [];
    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const handleAttachAudioFile = async () => {
    if (isTranscribing || isAgentRunning || !window.agy) return;
    setIsTranscribing(true);
    try {
      const res = await window.agy.selectAudioFile();
      if (res && res.text) {
        setChatInput(prev => {
          const prefix = prev ? prev + '\n' : '';
          return `${prefix}[Audio: ${res.fileName}]: "${res.text}"`;
        });
      } else if (res && res.error) {
        alert(res.error);
      }
    } catch (err) {
      alert(`Error al transcribir archivo: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSpeakMessage = async (msgId, text) => {
    if (speakingMessageId === msgId) {
      if (currentAudioElementRef.current) {
        currentAudioElementRef.current.pause();
        currentAudioElementRef.current = null;
      }
      setSpeakingMessageId(null);
      return;
    }

    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.pause();
      currentAudioElementRef.current = null;
    }

    setSpeakingMessageId(msgId);
    try {
      const res = await window.agy.speakText(text);
      if (res && res.audioBase64) {
        const audio = new Audio('data:audio/mp3;base64,' + res.audioBase64);
        currentAudioElementRef.current = audio;
        audio.onended = () => {
          setSpeakingMessageId(null);
          currentAudioElementRef.current = null;
        };
        audio.onerror = () => {
          setSpeakingMessageId(null);
          currentAudioElementRef.current = null;
        };
        audio.play();
      } else {
        setSpeakingMessageId(null);
        if (res && res.error) console.error(res.error);
      }
    } catch (e) {
      console.error(e);
      setSpeakingMessageId(null);
    }
  };

  const formatRecordingTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // File Attachments Helper Functions
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileCategoryIcon = (ext) => {
    const e = (ext || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(e)) {
      return <ImageIcon className="w-3.5 h-3.5 text-purple-400" />;
    }
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'json', 'html', 'css', 'sql', 'sh', 'md', 'yml', 'yaml', 'toml', 'env'].includes(e)) {
      return <FileCode2 className="w-3.5 h-3.5 text-amber-400" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'csv', 'xlsx'].includes(e)) {
      return <FileText className="w-3.5 h-3.5 text-blue-400" />;
    }
    return <File className="w-3.5 h-3.5 text-gray-400" />;
  };

  const handleSelectFiles = async () => {
    if (isAgentRunning || !window.agy) return;
    try {
      const files = await window.agy.selectFiles();
      if (files && files.length > 0) {
        setAttachedFiles(prev => {
          const existingPaths = new Set(prev.map(f => f.path));
          const newFiles = files.filter(f => !existingPaths.has(f.path));
          return [...prev, ...newFiles];
        });
      }
    } catch (err) {
      console.error(err);
      alert('Error al seleccionar archivos: ' + err.message);
    }
  };

  const handleRemoveAttachedFile = (pathToRemove) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== pathToRemove));
  };

  // Drag-and-Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDropFiles = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const dropped = e.dataTransfer.files;
    if (!dropped || dropped.length === 0) return;

    const filesToAdd = [];
    for (let i = 0; i < dropped.length; i++) {
      const file = dropped[i];
      let realPath = '';
      if (window.agy && window.agy.getPathForFile) {
        realPath = window.agy.getPathForFile(file);
      } else {
        realPath = file.path || '';
      }

      if (realPath && window.agy && window.agy.getFileInfo) {
        const info = await window.agy.getFileInfo(realPath);
        if (info) filesToAdd.push(info);
      } else if (realPath) {
        filesToAdd.push({
          path: realPath,
          name: file.name,
          size: file.size,
          ext: file.name.split('.').pop() || ''
        });
      }
    }

    if (filesToAdd.length > 0) {
      setAttachedFiles(prev => {
        const existingPaths = new Set(prev.map(f => f.path));
        const newFiles = filesToAdd.filter(f => !existingPaths.has(f.path));
        return [...prev, ...newFiles];
      });
    }
  };

  const handleLock = async () => {
    if (!lockPathInput.trim() || !window.agy) return;
    await window.agy.lockPath(lockPathInput.trim(), lockReasonInput.trim(), selectedSessionId);
    setLockPathInput('');
    setLockReasonInput('');
    fetchTelemetry();
  };

  const handleUnlock = async (path, convId) => {
    if (!window.agy) return;
    await window.agy.unlockPath(path, convId);
    fetchTelemetry();
  };

  const handleSendMesh = async (isBroadcast = false) => {
    if (!meshMessage.trim() || !window.agy) return;
    const msg = meshMessage.trim();
    if (isBroadcast) {
      await window.agy.broadcastMessage(msg, selectedSessionId);
      setMeshLog(prev => [...prev, { id: Date.now(), sender: 'Tú (Broadcast)', text: msg, time: new Date().toLocaleTimeString() }]);
    } else if (selectedSessionId) {
      await window.agy.sendMessage(selectedSessionId, msg, 'Mensaje desde AGY Desktop');
      setMeshLog(prev => [...prev, { id: Date.now(), sender: `Tú -> ${selectedSessionId.slice(0, 8)}`, text: msg, time: new Date().toLocaleTimeString() }]);
    }
    setMeshMessage('');
    fetchTelemetry();
  };

  return (
    <div className="flex h-screen w-screen bg-[#0d1117] text-gray-200 overflow-hidden font-sans">
      {/* SIDEBAR */}
      <aside className="w-80 border-r border-[#30363d] bg-[#161b22] flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-wide text-white">AGY DESKTOP</h1>
                <p className="text-[10px] text-gray-400">Embedded Control Plane</p>
              </div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" title="Motor Conectado" />
          </div>

          {/* Navigation Tabs */}
          <div className="p-2 border-b border-[#30363d] grid grid-cols-4 gap-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`py-1.5 text-xs rounded-md font-medium flex items-center justify-center gap-1 transition ${
                activeTab === 'chat' ? 'bg-[#21262d] text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-1.5 text-xs rounded-md font-medium flex items-center justify-center gap-1 transition ${
                activeTab === 'dashboard' ? 'bg-[#21262d] text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Panel
            </button>
            <button
              onClick={() => setActiveTab('locks')}
              className={`py-1.5 text-xs rounded-md font-medium flex items-center justify-center gap-1 transition ${
                activeTab === 'locks' ? 'bg-[#21262d] text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <FolderLock className="w-3.5 h-3.5" />
              Locks
            </button>
            <button
              onClick={() => setActiveTab('mesh')}
              className={`py-1.5 text-xs rounded-md font-medium flex items-center justify-center gap-1 transition ${
                activeTab === 'mesh' ? 'bg-[#21262d] text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Mesh
            </button>
          </div>

          {/* Subtabs for Sidebar: Historial vs Sesiones Vivas */}
          <div className="px-3 pt-2 pb-2 flex border-b border-[#30363d] gap-1.5">
            <button
              onClick={() => setSidebarTab('history')}
              className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded-md transition flex items-center justify-center gap-1.5 ${
                sidebarTab === 'history'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 border border-transparent'
              }`}
            >
              <History className="w-3 h-3" />
              Historial ({savedConversations.length})
            </button>
            <button
              onClick={() => setSidebarTab('mesh')}
              className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded-md transition flex items-center justify-center gap-1.5 ${
                sidebarTab === 'mesh'
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 border border-transparent'
              }`}
            >
              <Radio className="w-3 h-3" />
              Mesh ({telemetry.activeSessionsCount})
            </button>
          </div>

          {/* List Content */}
          <div className="p-3">
            {sidebarTab === 'history' ? (
              <div>
                <button
                  onClick={handleNewConversation}
                  disabled={isAgentRunning}
                  className="w-full mb-3 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition shadow disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Conversación
                </button>

                <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-290px)] pr-1">
                  {savedConversations.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-xs">
                      No hay conversaciones previas guardadas.
                    </div>
                  ) : (
                    savedConversations.map(conv => {
                      const isActive = conv.id === activeConversationId;
                      const dateStr = conv.updatedAt
                        ? new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '';
                      return (
                        <div
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv)}
                          className={`p-2.5 rounded-lg border cursor-pointer transition relative group ${
                            isActive
                              ? 'bg-[#21262d] border-blue-500/60 shadow-md'
                              : 'bg-[#161b22] border-[#30363d] hover:border-gray-500'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs text-white truncate max-w-[180px]">
                              {conv.title || 'Conversación'}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400 font-mono">{dateStr}</span>
                              <button
                                onClick={e => handleDeleteConversation(e, conv.id)}
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 p-0.5 rounded transition cursor-pointer"
                                title="Borrar conversación"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-400 truncate font-mono">
                            {conv.messages ? `${conv.messages.length} msgs` : ''}
                            {conv.cliConversationId ? ` • ID: ${conv.cliConversationId.slice(0, 8)}...` : ''}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Sesiones Vivas ({telemetry.activeSessionsCount})
                  </span>
                  <button
                    onClick={fetchTelemetry}
                    className="text-gray-400 hover:text-white transition"
                    title="Refrescar"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-290px)] pr-1">
                  {/* Option: Current In-App Chat Session */}
                  <div
                    onClick={() => {
                      setActiveTab('chat');
                      setSelectedSessionId(activeConversationId);
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition relative ${
                      activeTab === 'chat' && !selectedSessionId
                        ? 'bg-[#21262d] border-blue-500/60 shadow-md'
                        : 'bg-[#161b22] border-[#30363d] hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        <span className="font-mono text-xs font-bold text-white">
                          💬 Sesión In-App (Actual)
                        </span>
                      </div>
                      {isAgentRunning && (
                        <span className="px-1.5 py-0.5 text-[9px] rounded bg-blue-500/20 text-blue-300 font-mono animate-pulse">
                          EJECUTANDO
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">
                      {activeConversationId ? `ID: ${activeConversationId.slice(0, 8)}...` : 'Listo para interactuar'}
                    </p>
                  </div>

                  {/* External / Background Active Sessions */}
                  {telemetry.sessions.map((sess, idx) => {
                    const isSelected = sess.conversationId === selectedSessionId;
                    const hasLocks = sess.locks && sess.locks.length > 0;
                    const hasTasks = sess.activeTasks && sess.activeTasks.length > 0;

                    return (
                      <div
                        key={sess.conversationId}
                        onClick={() => {
                          setSelectedSessionId(sess.conversationId);
                          setActiveConversationId(sess.conversationId);
                          setActiveTab('chat');
                        }}
                        className={`p-3 rounded-lg border cursor-pointer transition relative ${
                          isSelected
                            ? 'bg-[#21262d] border-emerald-500/60 shadow-md'
                            : 'bg-[#161b22] border-[#30363d] hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="font-mono text-xs font-semibold text-gray-200">
                              #{idx + 1} {sess.conversationId.slice(0, 8)}
                            </span>
                          </div>
                          {hasTasks && (
                            <span className="px-1.5 py-0.5 text-[9px] rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono animate-pulse">
                              TASK
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                          {sess.lastUserPrompt}
                        </p>

                        {hasLocks && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                            <Lock className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{sess.locks.map(l => l.target).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User Auth Footer */}
        <div className="p-3 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-[11px] font-medium text-white">CLI Login Sincronizado</p>
              <p className="text-[9px] text-gray-400 font-mono">gemini:antigravity (0 Terminals)</p>
            </div>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">
            En App
          </span>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 border-b border-[#30363d] bg-[#161b22] px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">
              {activeTab === 'chat' && 'Agente Interactivo In-App (Sin Terminales Externas)'}
              {activeTab === 'dashboard' && 'Panel de Sesiones & Telemetría en Vivo'}
              {activeTab === 'locks' && 'Gestor de Bloqueos de Rutas (Path Locks)'}
              {activeTab === 'mesh' && 'Tablón de Mensajes Inter-Agente'}
            </span>
          </div>

          {/* Model Selector & Status */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewConversation}
              disabled={isAgentRunning}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d] transition disabled:opacity-50 cursor-pointer"
              title="Iniciar una nueva conversación limpia"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              Nueva Conversación
            </button>

            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              disabled={isAgentRunning}
              className="bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            >
              {models.length > 0 ? (
                models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="gemini-3.8-flash-high">Gemini 3.8 Flash (High)</option>
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Thinking)</option>
                </>
              )}
            </select>
            {activeConversationId && (
              <span className="text-[11px] text-gray-400 font-mono bg-[#0d1117] px-2 py-1 rounded border border-[#30363d]">
                Conv: {activeConversationId.slice(0, 8)}...
              </span>
            )}
          </div>
        </header>

        {/* TAB: EMBEDDED IN-APP CHAT */}
        {activeTab === 'chat' && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropFiles}
            className="flex-1 flex flex-col overflow-hidden relative"
          >
            {/* Drag & Drop Visual Overlay */}
            {isDragging && (
              <div className="absolute inset-0 z-50 bg-[#0d1117]/95 backdrop-blur-md border-2 border-dashed border-blue-500 rounded-xl m-4 flex flex-col items-center justify-center gap-3 pointer-events-none animate-fade-in shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-blue-600/20 border border-blue-500/50 flex items-center justify-center animate-bounce">
                  <UploadCloud className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-base font-bold text-white tracking-wide">
                  Suelta los archivos aquí para adjuntarlos al chat
                </p>
                <p className="text-xs text-gray-400 font-mono">
                  Código, Documentos, Imágenes, PDFs o cualquier archivo de tu equipo
                </p>
              </div>
            )}

            {/* Conversation Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-4xl ${
                    msg.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0 mt-1">
                      <Cpu className="w-4 h-4 text-blue-400" />
                    </div>
                  )}

                  <div
                    className={`rounded-xl p-4 text-xs leading-relaxed max-w-3xl shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white font-mono'
                        : 'bg-[#161b22] border border-[#30363d] text-gray-200'
                    }`}
                  >
                    {/* Render attached files chips in user message */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-2.5 pb-2 border-b border-blue-400/30 space-y-1.5">
                        <span className="text-[10px] text-blue-100 font-semibold uppercase tracking-wider block">
                          Archivos adjuntos ({msg.attachments.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.attachments.map((att, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-700/80 border border-blue-400/50 text-[11px] text-white shadow-sm"
                              title={att.path}
                            >
                              {getFileCategoryIcon(att.ext)}
                              <span className="font-medium truncate max-w-[200px]">{att.name}</span>
                              <span className="text-[9px] text-blue-200 font-mono">({formatFileSize(att.size)})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Render tool executions if any */}
                    {msg.tools && msg.tools.length > 0 && (
                      <div className="mb-3 space-y-1.5 border-b border-[#30363d] pb-2">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                          Herramientas ejecutadas en este turno:
                        </span>
                        {msg.tools.map((t, idx) => (
                          <div
                            key={idx}
                            className="bg-[#0d1117] border border-[#30363d] rounded px-2.5 py-1 text-[11px] font-mono flex items-center justify-between text-gray-300"
                          >
                            <span className="flex items-center gap-1.5">
                              <Wrench className="w-3 h-3 text-amber-400" />
                              {t.name}
                            </span>
                            <span className="text-[9px] text-emerald-400 font-bold uppercase">{t.state}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                    {/* Speaker button on assistant message */}
                    {msg.role === 'assistant' && msg.content && (
                      <div className="mt-2.5 pt-2 border-t border-[#30363d]/60 flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                          <Volume2 className="w-3 h-3 text-gray-500" />
                          Voz Catalina (Chile)
                        </span>
                        <button
                          onClick={() => handleSpeakMessage(msg.id, msg.content)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0d1117] hover:bg-[#21262d] text-gray-300 hover:text-blue-300 border border-[#30363d] transition cursor-pointer text-[11px]"
                          title={speakingMessageId === msg.id ? "Detener reproducción" : "Escuchar respuesta en voz alta"}
                        >
                          {speakingMessageId === msg.id ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                              <span className="text-blue-400 font-semibold text-[10px]">Detener</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-[10px]">Escuchar</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Live Streaming Turn (When running) */}
              {isAgentRunning && (
                <div className="flex gap-3 max-w-4xl mr-auto justify-start animate-fade-in">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0 mt-1">
                    <Cpu className="w-4 h-4 text-blue-400 animate-pulse" />
                  </div>

                  <div className="bg-[#161b22] border border-blue-500/40 rounded-xl p-4 text-xs leading-relaxed max-w-3xl shadow-md w-full">
                    {/* Tools in progress */}
                    {currentTools.length > 0 && (
                      <div className="mb-3 space-y-1.5 border-b border-[#30363d] pb-2">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                          Ejecución de herramientas en vivo:
                        </span>
                        {currentTools.map((t, idx) => (
                          <div
                            key={idx}
                            className="bg-[#0d1117] border border-[#30363d] rounded px-2.5 py-1 text-[11px] font-mono flex items-center justify-between text-gray-300"
                          >
                            <span className="flex items-center gap-1.5">
                              <Wrench className="w-3 h-3 text-amber-400 animate-spin" />
                              {t.name}
                            </span>
                            <span className="text-[9px] text-blue-400 animate-pulse font-bold uppercase">{t.state}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Text streaming */}
                    <div className="whitespace-pre-wrap text-gray-100 font-sans">
                      {streamingResponse || (
                        <span className="text-gray-400 italic flex items-center gap-2">
                          <Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                          El agente está procesando la solicitud...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* In-App Chat Input Bar with File Attachments & Microphone */}
            <div className="p-4 border-t border-[#30363d] bg-[#161b22]">
              {/* Attachment Chips Tray */}
              {attachedFiles.length > 0 && (
                <div className="mb-3 p-2.5 rounded-xl bg-[#0d1117] border border-[#30363d] flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-gray-400 flex items-center gap-1.5 mr-1">
                    <Paperclip className="w-3.5 h-3.5 text-blue-400" />
                    Adjuntos ({attachedFiles.length}):
                  </span>
                  {attachedFiles.map(file => (
                    <div
                      key={file.path}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161b22] border border-[#30363d] text-xs text-gray-200 shadow-sm"
                      title={file.path}
                    >
                      {getFileCategoryIcon(file.ext)}
                      <span className="font-mono text-[11px] font-medium truncate max-w-[180px]">{file.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono">({formatFileSize(file.size)})</span>
                      <button
                        onClick={() => handleRemoveAttachedFile(file.path)}
                        className="ml-1 text-gray-400 hover:text-red-400 p-0.5 rounded transition cursor-pointer"
                        title="Quitar archivo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleSelectFiles}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-medium px-2 py-0.5 rounded hover:bg-[#161b22] transition cursor-pointer"
                  >
                    + Agregar más
                  </button>
                </div>
              )}

              {isRecording ? (
                // Dedicated Active Recording Bar
                <div className="flex items-center justify-between bg-[#0d1117] border border-red-500/50 rounded-xl p-3.5 shadow-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                    <span className="font-semibold text-xs text-red-400 tracking-wide">
                      Grabando audio desde tu micrófono...
                    </span>
                    <span className="font-mono text-xs text-white px-2.5 py-0.5 bg-red-950/40 rounded border border-red-500/40">
                      {formatRecordingTime(recordingSeconds)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={cancelRecording}
                      className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs flex items-center gap-1 transition cursor-pointer"
                      title="Cancelar grabación"
                    >
                      <X className="w-3.5 h-3.5 text-red-400" />
                      Cancelar
                    </button>
                    <button
                      onClick={stopRecording}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow cursor-pointer"
                      title="Terminar y transcribir con Whisper"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Terminar y Entender
                    </button>
                  </div>
                </div>
              ) : isTranscribing ? (
                // Transcribing status
                <div className="flex items-center justify-center gap-3 bg-[#0d1117] border border-blue-500/40 rounded-xl p-4 text-xs text-blue-300">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Transcribiendo audio con Whisper (IA)...</span>
                </div>
              ) : (
                // Standard Input Bar with File Attachment, Mic & Send buttons
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleSelectFiles}
                    disabled={isAgentRunning}
                    className="p-3 rounded-xl bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] text-gray-400 hover:text-white transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    title="Adjuntar archivos (código, imágenes, PDFs, documentos)"
                  >
                    <Paperclip className="w-4 h-4" />
                    <span className="text-[11px] font-semibold hidden md:inline">Adjuntar</span>
                  </button>

                  <button
                    onClick={startRecording}
                    disabled={isAgentRunning}
                    className="p-3 rounded-xl bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 hover:text-blue-200 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    title="Grabar nota de voz desde el micrófono"
                  >
                    <Mic className="w-4 h-4 text-blue-400" />
                    <span className="text-[11px] font-semibold hidden sm:inline">Grabar</span>
                  </button>

                  <textarea
                    rows={2}
                    placeholder="Escribe tu instrucción, arrastra archivos aquí o graba con el micrófono..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendPrompt();
                      }
                    }}
                    disabled={isAgentRunning}
                    className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono resize-none"
                  />

                  {isAgentRunning ? (
                    <button
                      onClick={handleCancelTurn}
                      className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-2 transition shadow-md"
                    >
                      <StopCircle className="w-4 h-4" />
                      Detener
                    </button>
                  ) : (
                    <button
                      onClick={handleSendPrompt}
                      disabled={!chatInput.trim() && attachedFiles.length === 0}
                      className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold text-xs flex items-center gap-2 transition shadow-md cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      Ejecutar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: DASHBOARD DE SESIONES */}
        {activeTab === 'dashboard' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {telemetry.sessions.map((sess, idx) => (
                <div
                  key={sess.conversationId}
                  className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <span className="font-mono text-sm font-bold text-white">Sesión #{idx + 1}</span>
                        <span className="font-mono text-[10px] text-gray-400">{sess.conversationId.slice(0, 8)}...</span>
                      </div>
                      {sess.activeTasks.length > 0 && (
                        <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-900/40 text-purple-300 border border-purple-500/40 font-mono">
                          {sess.activeTasks.join(', ')}
                        </span>
                      )}
                    </div>

                    <div className="mb-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Última Petición:</p>
                      <div className="bg-[#0d1117] border border-[#30363d] rounded p-2.5 text-xs text-gray-200 font-mono max-h-20 overflow-y-auto">
                        {sess.lastUserPrompt}
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Pensamiento / Estado:</p>
                      <div className="bg-[#0d1117]/60 border border-[#30363d] rounded p-2.5 text-xs text-blue-200/90 max-h-20 overflow-y-auto">
                        {sess.lastModelStatus}
                      </div>
                    </div>

                    {sess.locks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {sess.locks.map((l, lIdx) => (
                          <span key={lIdx} className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {l.target}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#30363d] flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setSelectedSessionId(sess.conversationId);
                        setActiveConversationId(sess.conversationId);
                        setActiveTab('chat');
                      }}
                      className="px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 transition"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      Continuar en Chat
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: LOCKS */}
        {activeTab === 'locks' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Reservar / Bloquear Ruta en Workspace
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Ruta (ej. cerebro-digital o src/api)"
                  value={lockPathInput}
                  onChange={e => setLockPathInput(e.target.value)}
                  className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Motivo del bloqueo"
                  value={lockReasonInput}
                  onChange={e => setLockReasonInput(e.target.value)}
                  className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleLock}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center gap-2 transition"
                >
                  <Lock className="w-4 h-4" />
                  Bloquear Ruta
                </button>
              </div>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow">
              <div className="px-5 py-3 border-b border-[#30363d]">
                <span className="text-xs font-bold text-gray-300">Rutas Bloqueadas Activas ({telemetry.locks.length})</span>
              </div>

              {telemetry.locks.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  No hay rutas bloqueadas actualmente en el workspace.
                </div>
              ) : (
                <div className="divide-y divide-[#30363d]">
                  {telemetry.locks.map((lock, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between hover:bg-[#21262d]/50 transition">
                      <div>
                        <p className="font-mono text-sm font-semibold text-white">{lock.target}</p>
                        <p className="text-xs text-gray-400">Motivo: "{lock.reason}"</p>
                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                          Dueño: {lock.conversationId.slice(0, 8)}... • {new Date(lock.acquiredAt).toLocaleTimeString()}
                        </p>
                      </div>

                      <button
                        onClick={() => handleUnlock(lock.target, lock.conversationId)}
                        className="px-3 py-1.5 text-xs rounded-md bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 flex items-center gap-1.5 transition"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Liberar Lock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: MESH CHAT */}
        {activeTab === 'mesh' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex-1 bg-[#161b22] border border-[#30363d] rounded-xl flex flex-col overflow-hidden shadow">
              <div className="px-5 py-3 border-b border-[#30363d] flex items-center justify-between bg-[#21262d]/40">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold text-white">Tablón de Comunicación Inter-Agente</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {meshLog.map(msg => (
                  <div key={msg.id} className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-blue-400 font-mono">{msg.sender}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{msg.time}</span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed font-mono">{msg.text}</p>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-[#30363d] bg-[#0d1117] flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enviar mensaje reactivo a sesiones..."
                  value={meshMessage}
                  onChange={e => setMeshMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMesh(false)}
                  className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  onClick={() => handleSendMesh(false)}
                  className="px-4 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar
                </button>
                <button
                  onClick={() => handleSendMesh(true)}
                  className="px-3 py-2 text-xs rounded-lg bg-[#21262d] hover:bg-[#30363d] text-gray-300 font-medium flex items-center gap-1.5 transition"
                  title="Broadcast a todas las terminales"
                >
                  <Radio className="w-3.5 h-3.5 text-amber-400" />
                  Broadcast
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
