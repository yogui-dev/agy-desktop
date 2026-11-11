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
  Bot
} from 'lucide-react';

export default function App() {
  const [telemetry, setTelemetry] = useState({ activeSessionsCount: 0, sessions: [], locks: [] });
  const [models, setModels] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'dashboard' | 'locks' | 'mesh'
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // In-App Interactive Chat & Streaming State
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola Jorge! Soy tu asistente de Antigravity CLI integrado directamente en AGY Desktop. Todo corre aquí adentro sin necesidad de abrir ventanas de terminal externas. ¿En qué podemos avanzar hoy?',
      tools: [],
      thinking: ''
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash-high');
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [streamingThought, setStreamingThought] = useState('');
  const [streamingResponse, setStreamingResponse] = useState('');
  const [currentTools, setCurrentTools] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [showThinking, setShowThinking] = useState(true);

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
            setActiveConversationId(event.conversation_id);
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

  // Handle in-app turn submission
  const handleSendPrompt = async () => {
    if (!chatInput.trim() || isAgentRunning || !window.agy) return;

    const userText = chatInput.trim();
    setChatInput('');
    setIsAgentRunning(true);
    streamingResponseRef.current = '';
    streamingThoughtRef.current = '';
    currentToolsRef.current = [];
    setStreamingResponse('');
    setStreamingThought('');
    setCurrentTools([]);

    // Add user message to UI immediately
    setChatMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        content: userText
      }
    ]);

    // Call startTurn directly inside Electron (zero external windows!)
    await window.agy.startTurn({
      prompt: userText,
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
    setActiveConversationId('');
    setSelectedSessionId(null);
    setChatMessages([
      {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        content: '¡Nueva sesión iniciada! Todo corre aquí dentro de AGY Desktop sin ventanas de terminal externas. ¿Qué deseas hacer?',
        tools: [],
        thinking: ''
      }
    ]);
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

          {/* Sessions List */}
          <div className="p-3">
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

            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-230px)] pr-1">
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
          <div className="flex-1 flex flex-col overflow-hidden">
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

            {/* In-App Chat Input Bar */}
            <div className="p-4 border-t border-[#30363d] bg-[#161b22] flex items-center gap-3">
              <textarea
                rows={2}
                placeholder="Escribe tu instrucción para el agente (ej. 'Revisa el archivo README' o 'Implementa una función')..."
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
                  disabled={!chatInput.trim()}
                  className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold text-xs flex items-center gap-2 transition shadow-md cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Ejecutar
                </button>
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
