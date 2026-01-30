'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  MoreVertical,
  X,
  Loader2,
  Bot,
  Zap,
  CheckCircle,
  AlertCircle,
  Trash2,
  Edit,
  Play,
  Link,
  Settings,
  Database,
  Mail,
  MessageSquare,
  FileText,
  Calendar,
  Users,
  Cloud,
  Send,
} from 'lucide-react'
import { callAIAgent } from '@/lib/aiAgent'
import type { NormalizedAgentResponse } from '@/lib/aiAgent'

// Agent IDs from workflow
const AGENT_BUILDER_ID = "697d331ed36f070193f5c929" // For creating agents
const CHAT_ASSISTANT_ID = "697d3787066158e77fde4f85" // For testing/chatting with agents

// TypeScript interfaces based on actual_test_response
interface AgentConfiguration {
  model: string
  temperature: number
  integrations: string[]
}

interface AgentResult {
  agent_created: boolean
  agent_id: string
  agent_name: string
  agent_role: string
  agent_goal: string
  agent_instructions: string
  extracted_connectors: string[]
  capabilities: string[]
  configuration: AgentConfiguration
  summary: string
}

interface AgentBuilderResponse {
  status: 'success' | 'error'
  result: AgentResult
  metadata?: {
    agent_name: string
    timestamp: string
  }
}

// Local agent data structure for dashboard
interface LocalAgent {
  id: string
  name: string
  role?: string
  goal?: string
  instructions?: string
  status: 'active' | 'inactive'
  connectors: string[]
  capabilities: string[]
  lastModified: string
  summary: string
}

// Chat message structure
interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
}

// Connector data structure
interface Connector {
  id: string
  service: string
  status: 'connected' | 'disconnected'
  account: string
  icon: string
}

// Available connector services with icons
const AVAILABLE_CONNECTORS = [
  { id: 'slack', name: '@Slack', icon: 'MessageSquare', color: 'bg-purple-500' },
  { id: 'gmail', name: '@Gmail', icon: 'Mail', color: 'bg-red-500' },
  { id: 'notion', name: '@Notion', icon: 'FileText', color: 'bg-gray-700' },
  { id: 'calendar', name: '@Calendar', icon: 'Calendar', color: 'bg-blue-500' },
  { id: 'drive', name: '@Drive', icon: 'Database', color: 'bg-yellow-500' },
  { id: 'teams', name: '@Teams', icon: 'Users', color: 'bg-indigo-500' },
  { id: 'dropbox', name: '@Dropbox', icon: 'Cloud', color: 'bg-blue-600' },
]

// Icon mapping
const getConnectorIcon = (service: string) => {
  const icons: Record<string, any> = {
    MessageSquare,
    Mail,
    FileText,
    Calendar,
    Database,
    Users,
    Cloud,
  }
  const connector = AVAILABLE_CONNECTORS.find(c =>
    c.name.toLowerCase().includes(service.toLowerCase().replace('@', ''))
  )
  return connector ? icons[connector.icon] : Link
}

const getConnectorColor = (service: string) => {
  const connector = AVAILABLE_CONNECTORS.find(c =>
    c.name.toLowerCase().includes(service.toLowerCase().replace('@', ''))
  )
  return connector?.color || 'bg-gray-500'
}

// Agent Chat Panel Component
function AgentChatPanel({
  isOpen,
  onClose,
  agent
}: {
  isOpen: boolean
  onClose: () => void
  agent: LocalAgent | null
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => `session-${Date.now()}`)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  // Reset messages when agent changes
  useEffect(() => {
    if (agent) {
      setMessages([])
    }
  }, [agent?.id])

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !agent || loading) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setLoading(true)

    try {
      // Use CHAT_ASSISTANT_ID for all chat interactions instead of agent.id
      const result = await callAIAgent(inputMessage, CHAT_ASSISTANT_ID, {
        session_id: sessionId,
        user_id: 'user-1',
      })

      let agentContent = ''
      if (result.success && result.response.status === 'success') {
        // Extract text from various possible fields
        if (result.response.message) {
          agentContent = result.response.message
        } else if (result.response.result?.text) {
          agentContent = result.response.result.text
        } else if (result.response.result?.answer) {
          agentContent = result.response.result.answer
        } else if (result.response.result?.response) {
          agentContent = result.response.result.response
        } else if (typeof result.response.result === 'string') {
          agentContent = result.response.result
        } else {
          agentContent = JSON.stringify(result.response.result, null, 2)
        }
      } else {
        agentContent = result.response?.message || result.error || 'No response from agent'
      }

      const agentMessage: ChatMessage = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        content: agentContent,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, agentMessage])
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'agent',
        content: 'Error: Failed to communicate with agent',
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!isOpen || !agent) return null

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{agent.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant={agent.status === 'active' ? 'default' : 'secondary'}
                className={
                  agent.status === 'active'
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-gray-200 text-gray-600'
                }
              >
                {agent.status === 'active' ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </>
                ) : (
                  'Inactive'
                )}
              </Badge>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 p-6">
          <div ref={scrollAreaRef} className="space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-gray-100 p-6 rounded-full mb-4">
                  <Bot className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Start a conversation
                </h3>
                <p className="text-sm text-gray-600 max-w-md">
                  Send a message to test your agent. All conversations are isolated per session.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.role === 'agent' && (
                      <Bot className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-600" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          message.role === 'user'
                            ? 'text-blue-100'
                            : 'text-gray-500'
                        }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-100">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                    <span className="text-sm text-gray-600">Agent is typing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={loading}
              className="flex-1 bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
            />
            <Button
              onClick={handleSendMessage}
              disabled={loading || !inputMessage.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}

// Agent Creation Slide-over Panel Component
function AgentCreationPanel({
  isOpen,
  onClose,
  onAgentCreated
}: {
  isOpen: boolean
  onClose: () => void
  onAgentCreated: (agent: LocalAgent) => void
}) {
  const [agentName, setAgentName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [detectedConnectors, setDetectedConnectors] = useState<string[]>([])
  const [detectedCapabilities, setDetectedCapabilities] = useState<string[]>([])
  const [showConnectorDropdown, setShowConnectorDropdown] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extract @mentions from instructions
  useEffect(() => {
    const mentions = instructions.match(/@\w+/g) || []
    const uniqueMentions = Array.from(new Set(mentions))
    setDetectedConnectors(uniqueMentions)

    // Simple capability detection based on keywords
    const capabilityKeywords = {
      send_messages: ['send', 'message', 'notify', 'alert'],
      notification: ['notify', 'alert', 'reminder'],
      data_sync: ['sync', 'update', 'fetch', 'retrieve'],
      automation: ['automate', 'schedule', 'trigger'],
      analysis: ['analyze', 'report', 'summarize'],
    }

    const detected: string[] = []
    const lowerInstructions = instructions.toLowerCase()

    Object.entries(capabilityKeywords).forEach(([capability, keywords]) => {
      if (keywords.some(keyword => lowerInstructions.includes(keyword))) {
        detected.push(capability)
      }
    })

    setDetectedCapabilities(Array.from(new Set(detected)))
  }, [instructions])

  // Handle @ character to show dropdown
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const position = e.target.selectionStart

    setInstructions(value)
    setCursorPosition(position)

    // Check if user just typed @
    const textBeforeCursor = value.substring(0, position)
    const lastChar = textBeforeCursor[textBeforeCursor.length - 1]

    if (lastChar === '@') {
      setShowConnectorDropdown(true)
    } else {
      setShowConnectorDropdown(false)
    }
  }

  const insertConnector = (connectorName: string) => {
    const before = instructions.substring(0, cursorPosition)
    const after = instructions.substring(cursorPosition)
    const newText = before + connectorName.substring(1) + ' ' + after
    setInstructions(newText)
    setShowConnectorDropdown(false)
  }

  const removeConnector = (connector: string) => {
    const newInstructions = instructions.replace(new RegExp(connector, 'g'), '')
    setInstructions(newInstructions)
  }

  const handleCreateAgent = async () => {
    if (!agentName.trim() || !instructions.trim()) {
      setError('Please provide both agent name and instructions')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const message = `Create an agent named "${agentName}" with instructions: ${instructions}`
      const result = await callAIAgent(message, AGENT_BUILDER_ID)

      if (result.success && result.response.status === 'success') {
        const agentData = result.response.result as AgentResult

        // Create local agent object - use CHAT_ASSISTANT_ID for testing
        // since the response returns a simulated ID that's not a valid ObjectId
        const newAgent: LocalAgent = {
          id: CHAT_ASSISTANT_ID, // Use the General Chat Assistant for testing
          name: agentData.agent_name || agentName,
          role: agentData.agent_role,
          goal: agentData.agent_goal,
          instructions: agentData.agent_instructions,
          status: 'active',
          connectors: agentData.extracted_connectors || detectedConnectors,
          capabilities: agentData.capabilities || detectedCapabilities,
          lastModified: new Date().toISOString(),
          summary: agentData.summary || instructions.substring(0, 100),
        }

        onAgentCreated(newAgent)

        // Reset form
        setAgentName('')
        setInstructions('')
        setDetectedConnectors([])
        setDetectedCapabilities([])
        onClose()
      } else {
        setError(result.response?.message || result.error || 'Failed to create agent')
      }
    } catch (err) {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xl font-bold text-gray-900">Create New Agent</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6">
          {/* Agent Name */}
          <div className="space-y-2">
            <Label htmlFor="agent-name" className="text-gray-900 font-semibold">
              Agent Name
            </Label>
            <Input
              id="agent-name"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="My Awesome Agent"
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
            />
          </div>

          {/* Instructions */}
          <div className="space-y-2 relative">
            <Label htmlFor="instructions" className="text-gray-900 font-semibold">
              Instructions
            </Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={handleInstructionsChange}
              placeholder="Type @ to mention connectors. Example: Send a message to @Slack when..."
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 min-h-[200px] font-mono text-sm"
            />

            {/* Connector Autocomplete Dropdown */}
            {showConnectorDropdown && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-48 overflow-auto">
                {AVAILABLE_CONNECTORS.map((connector) => {
                  const Icon = getConnectorIcon(connector.name)
                  return (
                    <button
                      key={connector.id}
                      onClick={() => insertConnector(connector.name)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 text-gray-900"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{connector.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Detected Connectors */}
          {detectedConnectors.length > 0 && (
            <div className="space-y-2">
              <Label className="text-gray-900 font-semibold">Detected Connectors</Label>
              <div className="flex flex-wrap gap-2">
                {detectedConnectors.map((connector) => {
                  const Icon = getConnectorIcon(connector)
                  const color = getConnectorColor(connector)
                  return (
                    <Badge
                      key={connector}
                      className={`${color} text-white flex items-center gap-1 px-3 py-1`}
                    >
                      <Icon className="h-3 w-3" />
                      {connector}
                      <button
                        onClick={() => removeConnector(connector)}
                        className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          {/* Detected Capabilities */}
          {detectedCapabilities.length > 0 && (
            <div className="space-y-2">
              <Label className="text-gray-900 font-semibold">Auto-detected Capabilities</Label>
              <div className="flex flex-wrap gap-2">
                {detectedCapabilities.map((capability) => (
                  <Badge
                    key={capability}
                    variant="outline"
                    className="border-blue-500 text-blue-600 px-3 py-1"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    {capability.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3">
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </Button>
        <Button
          onClick={handleCreateAgent}
          disabled={loading || !agentName.trim() || !instructions.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// Connector Setup Modal Component
function ConnectorSetupModal({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [selectedService, setSelectedService] = useState<string | null>(null)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Connect Service</DialogTitle>
          <DialogDescription className="text-gray-600">
            Select a service to connect to your agents
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-4">
          {AVAILABLE_CONNECTORS.map((connector) => {
            const Icon = getConnectorIcon(connector.name)
            const isSelected = selectedService === connector.id
            return (
              <button
                key={connector.id}
                onClick={() => setSelectedService(connector.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400 bg-white'
                }`}
              >
                <div className={`${connector.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs text-gray-700">
                  {connector.name.replace('@', '')}
                </span>
              </button>
            )
          })}
        </div>

        {selectedService && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-700">Ready to connect</span>
            </div>
            <p className="text-xs text-gray-600">
              This will allow your agents to access and control this service on your behalf.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </Button>
          <Button
            disabled={!selectedService}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Agent Card Component
function AgentCard({
  agent,
  onEdit,
  onTest,
  onDelete
}: {
  agent: LocalAgent
  onEdit: () => void
  onTest: () => void
  onDelete: () => void
}) {
  return (
    <Card className="bg-white border-gray-200 hover:border-gray-300 transition-all shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-gray-900 text-lg">{agent.name}</CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Modified {new Date(agent.lastModified).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={agent.status === 'active' ? 'default' : 'secondary'}
              className={
                agent.status === 'active'
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'bg-gray-200 text-gray-600'
              }
            >
              {agent.status === 'active' ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </>
              ) : (
                'Inactive'
              )}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white border-gray-200 text-gray-900">
                <DropdownMenuItem
                  onClick={onEdit}
                  className="hover:bg-gray-100 cursor-pointer"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onTest}
                  className="hover:bg-gray-100 cursor-pointer"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Test
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
                  className="hover:bg-gray-100 cursor-pointer text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600">{agent.summary}</p>

        {/* Role & Goal */}
        {agent.role && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-1">Role</p>
              <p className="text-sm text-blue-900">{agent.role}</p>
            </div>
            {agent.goal && (
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-1">Goal</p>
                <p className="text-sm text-blue-900">{agent.goal}</p>
              </div>
            )}
          </div>
        )}

        {/* Instructions Preview */}
        {agent.instructions && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-700 mb-1">System Prompt</p>
            <p className="text-xs text-gray-600 line-clamp-3">{agent.instructions}</p>
          </div>
        )}

        {/* Connectors */}
        {agent.connectors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {agent.connectors.map((connector) => {
              const Icon = getConnectorIcon(connector)
              const color = getConnectorColor(connector)
              return (
                <Badge
                  key={connector}
                  className={`${color} text-white text-xs px-2 py-1`}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {connector}
                </Badge>
              )
            })}
          </div>
        )}

        {/* Capabilities */}
        {agent.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {agent.capabilities.slice(0, 3).map((capability) => (
              <Badge
                key={capability}
                variant="outline"
                className="border-gray-300 text-gray-600 text-xs"
              >
                {capability.replace('_', ' ')}
              </Badge>
            ))}
            {agent.capabilities.length > 3 && (
              <Badge variant="outline" className="border-gray-300 text-gray-600 text-xs">
                +{agent.capabilities.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Connector Card Component
function ConnectorCard({ connector }: { connector: Connector }) {
  const Icon = getConnectorIcon(connector.service)
  const color = getConnectorColor(connector.service)

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`${color} p-2 rounded-lg`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-gray-900 font-semibold">{connector.service}</h3>
              <p className="text-xs text-gray-500">{connector.account}</p>
            </div>
          </div>
          <Badge
            variant={connector.status === 'connected' ? 'default' : 'secondary'}
            className={
              connector.status === 'connected'
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-gray-200 text-gray-600'
            }
          >
            {connector.status === 'connected' ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              'Disconnected'
            )}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4 border-gray-300 text-gray-700 hover:bg-gray-100"
        >
          Disconnect
        </Button>
      </CardContent>
    </Card>
  )
}

// Empty State Component
function EmptyState({
  title,
  description,
  action
}: {
  title: string
  description: string
  action?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="bg-gray-100 p-6 rounded-full mb-4">
        <Bot className="h-12 w-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-4 max-w-md">{description}</p>
      {action && (
        <Button onClick={action} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Get Started
        </Button>
      )}
    </div>
  )
}

// Main Dashboard Component
export default function Home() {
  const [agents, setAgents] = useState<LocalAgent[]>([])
  const [connectors, setConnectors] = useState<Connector[]>([
    {
      id: '1',
      service: '@Slack',
      status: 'connected',
      account: 'workspace@company.com',
      icon: 'MessageSquare',
    },
    {
      id: '2',
      service: '@Gmail',
      status: 'connected',
      account: 'user@gmail.com',
      icon: 'Mail',
    },
  ])
  const [searchQuery, setSearchQuery] = useState('')
  const [showAgentPanel, setShowAgentPanel] = useState(false)
  const [showConnectorModal, setShowConnectorModal] = useState(false)
  const [showChatPanel, setShowChatPanel] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<LocalAgent | null>(null)

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.summary.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAgentCreated = (newAgent: LocalAgent) => {
    setAgents(prev => [newAgent, ...prev])
  }

  const handleDeleteAgent = (agentId: string) => {
    setAgents(prev => prev.filter(a => a.id !== agentId))
  }

  const handleTestAgent = (agent: LocalAgent) => {
    setSelectedAgent(agent)
    setShowChatPanel(true)
  }

  const handleCloseChatPanel = () => {
    setShowChatPanel(false)
    setSelectedAgent(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Agent Builder Studio</h1>
                <p className="text-xs text-gray-600">Build AI agents with natural language</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search agents..."
                  className="pl-9 w-64 bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
                />
              </div>
              <Button
                onClick={() => setShowAgentPanel(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Agent
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Agents Section (60%) */}
          <div className="col-span-12 lg:col-span-7">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">My Agents</h2>
                <p className="text-sm text-gray-600">
                  {agents.length} {agents.length === 1 ? 'agent' : 'agents'} created
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                <Settings className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>

            {filteredAgents.length === 0 ? (
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-0">
                  <EmptyState
                    title="No agents yet"
                    description="Create your first AI agent by clicking the button above. Agents can automate tasks, integrate with your tools, and more."
                    action={() => setShowAgentPanel(true)}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onEdit={() => {}}
                    onTest={() => handleTestAgent(agent)}
                    onDelete={() => handleDeleteAgent(agent.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Connectors Section (40%) */}
          <div className="col-span-12 lg:col-span-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Connectors</h2>
                <p className="text-sm text-gray-600">
                  {connectors.filter(c => c.status === 'connected').length} connected
                </p>
              </div>
              <Button
                onClick={() => setShowConnectorModal(true)}
                variant="outline"
                size="sm"
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="space-y-3">
              {connectors.map((connector) => (
                <ConnectorCard key={connector.id} connector={connector} />
              ))}
            </div>

            {/* Available Connectors */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Available Services</h3>
              <div className="grid grid-cols-4 gap-2">
                {AVAILABLE_CONNECTORS.filter(
                  ac => !connectors.some(c => c.service === ac.name)
                ).map((connector) => {
                  const Icon = getConnectorIcon(connector.name)
                  return (
                    <button
                      key={connector.id}
                      onClick={() => setShowConnectorModal(true)}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-all"
                    >
                      <div className={`${connector.color} p-2 rounded-lg`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-xs text-gray-600">
                        {connector.name.replace('@', '')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Agent Creation Panel */}
      <AgentCreationPanel
        isOpen={showAgentPanel}
        onClose={() => setShowAgentPanel(false)}
        onAgentCreated={handleAgentCreated}
      />

      {/* Agent Chat Panel */}
      <AgentChatPanel
        isOpen={showChatPanel}
        onClose={handleCloseChatPanel}
        agent={selectedAgent}
      />

      {/* Connector Setup Modal */}
      <ConnectorSetupModal
        isOpen={showConnectorModal}
        onClose={() => setShowConnectorModal(false)}
      />

      {/* Backdrop for slide-over panels */}
      {(showAgentPanel || showChatPanel) && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => {
            setShowAgentPanel(false)
            setShowChatPanel(false)
          }}
        />
      )}
    </div>
  )
}
