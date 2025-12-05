// 模拟API实现 - 前端-only 版本

// Custom Error Classes
export class ApiError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ApiError';
    if (cause) this.cause = cause;
  }
}

export class NoAccessTokenAvailableError extends Error {
  constructor() {
    super('No access token available. Please sign in.');
    this.name = 'NoAccessTokenAvailableError';
  }
}

export class BillingError extends Error {
  constructor(
    public statusCode: number,
    public detail: { message: string },
    message?: string
  ) {
    super(message || detail.message || `Billing error (${statusCode})`);
    this.name = 'BillingError';
  }
}

// Types
export interface Project {
  id: string;
  name: string;
  description: string;
  account_id: string;
  created_at: string;
  updated_at?: string;
  sandbox?: {
    id: string;
    pass: string;
    vnc_preview: string;
    sandbox_url: string;
  };
  is_public?: boolean;
}

export interface Thread {
  thread_id: string;
  account_id: string;
  project_id: string;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, any>;
  is_public?: boolean;
}

export interface Message {
  id: string;
  thread_id: string;
  type: string;
  content: string;
  created_at: string;
  updated_at?: string;
  agent_id?: string;
  is_llm_message?: boolean;
  agents?: {
    name: string;
    avatar: string;
    avatar_color: string;
  };
}

export interface AgentRun {
  agent_run_id: string;
  thread_id: string;
  status: string;
  created_at: string;
  updated_at?: string;
  model_name?: string;
  finish_reason?: string;
}

export interface ToolCall {
  id: string;
  agent_run_id: string;
  tool_name: string;
  parameters: Record<string, any>;
  status: string;
  result?: string;
  created_at: string;
  updated_at?: string;
}

export interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  last_modified: number;
  content?: string;
}

// 模拟数据存储
let mockProjects: Project[] = [
  {
    id: '1',
    name: 'Suna AI Assistant',
    description: 'An intelligent AI assistant for development and productivity',
    account_id: 'user_1',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    is_public: true
  },
  {
    id: '2',
    name: 'E-commerce Platform',
    description: 'Full-stack e-commerce solution with payment integration',
    account_id: 'user_1',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    is_public: false
  },
  {
    id: '3',
    name: 'Task Management System',
    description: 'Collaborative task tracking and project management tool',
    account_id: 'user_1',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    is_public: true
  },
  {
    id: '4',
    name: 'Data Analytics Dashboard',
    description: 'Real-time analytics and visualization platform',
    account_id: 'user_1',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    is_public: false
  }
];

let mockThreads: Thread[] = [
  {
    thread_id: '1',
    account_id: 'user_1',
    project_id: '1',
    created_at: new Date().toISOString(),
    is_public: false
  }
];

let mockMessages: Message[] = [
  {
    id: '1',
    thread_id: '1',
    type: 'user',
    content: '你好，这是一个测试消息',
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    thread_id: '1',
    type: 'assistant',
    content: '你好！我是一个AI助手，可以帮助你完成各种任务。',
    created_at: new Date(Date.now() + 1000).toISOString(),
    is_llm_message: true,
    agents: {
      name: '默认助手',
      avatar: '🤖',
      avatar_color: '#4CAF50'
    }
  }
];

let mockAgentRuns: AgentRun[] = [];

// 模拟EventSource
class MockEventSource {
  private listeners: Map<string, Function[]> = new Map();
  private isOpen = true;
  private messageQueue: string[] = [];
  private messageInterval: NodeJS.Timeout | null = null;
  private agentRunId: string;

  constructor(url: string) {
    // 从URL中提取agentRunId
    this.agentRunId = url.split('/').pop() || 'unknown';
    
    // 模拟消息流
    this.setupMockStream();
    
    // 触发open事件
    setTimeout(() => {
      this.dispatchEvent('open');
    }, 100);
  }

  private setupMockStream() {
    // 模拟一个典型的AI响应流程
    const mockResponses = [
      JSON.stringify({ type: 'status', status: 'running' }),
      JSON.stringify({ type: 'message_chunk', content: '我需要分析你的请求并提供帮助。' }),
      JSON.stringify({ type: 'message_chunk', content: '\n\n让我思考一下...' }),
      JSON.stringify({ type: 'tool_call', tool_name: 'browser_search', parameters: { query: '前端开发最佳实践' } }),
      JSON.stringify({ type: 'tool_result', tool_name: 'browser_search', result: '找到了前端开发的最佳实践，包括组件化、响应式设计和性能优化等内容。' }),
      JSON.stringify({ type: 'message_chunk', content: '\n\n基于搜索结果，我建议你考虑以下几点：\n1. 使用组件化架构\n2. 实现响应式设计\n3. 优化页面性能' }),
      JSON.stringify({ type: 'status', status: 'completed' })
    ];

    // 以一定时间间隔发送消息
    let index = 0;
    this.messageInterval = setInterval(() => {
      if (!this.isOpen || index >= mockResponses.length) {
        this.close();
        return;
      }
      
      const message = mockResponses[index];
      this.dispatchEvent('message', { data: message });
      index++;
    }, 1500);
  }

  private dispatchEvent(eventType: string, eventData?: any) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      for (const listener of listeners) {
        listener(eventData);
      }
    }
  }

  addEventListener(eventType: string, listener: Function) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  removeEventListener(eventType: string, listener: Function) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  close() {
    this.isOpen = false;
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }
    this.dispatchEvent('close');
  }
}

// 模拟API_URL
const API_URL = 'http://localhost:3000';

// 模拟文件系统数据
let mockFiles: FileInfo[] = [
  { name: 'README.md', path: '/README.md', is_dir: false, size: 1024, last_modified: Date.now() },
  { name: 'src', path: '/src', is_dir: true, size: 0, last_modified: Date.now() }
];

// 用于管理活动的流
const activeStreams = new Map<string, MockEventSource>();
const nonRunningAgentRuns = new Set<string>();

// 辅助函数：生成唯一ID
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// 辅助函数：延迟
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 项目相关API
export const getProjects = async (): Promise<Project[]> => {
  console.log('[MOCK API] 获取项目列表');
  await delay(200); // 模拟网络延迟
  return [...mockProjects];
};

export const getProject = async (projectId: string): Promise<Project | null> => {
  console.log(`[MOCK API] 获取项目: ${projectId}`);
  await delay(200);
  const project = mockProjects.find(p => p.id === projectId);
  return project || null;
};

export const createProject = async (project: Omit<Project, 'id' | 'created_at'>): Promise<Project> => {
  console.log('[MOCK API] 创建项目');
  await delay(300);
  const newProject: Project = {
    ...project,
    id: generateId(),
    created_at: new Date().toISOString()
  };
  mockProjects.push(newProject);
  return newProject;
};

export const updateProject = async (projectId: string, updates: Partial<Project>): Promise<Project | null> => {
  console.log(`[MOCK API] 更新项目: ${projectId}`);
  await delay(300);
  const index = mockProjects.findIndex(p => p.id === projectId);
  if (index === -1) return null;
  
  mockProjects[index] = { ...mockProjects[index], ...updates, updated_at: new Date().toISOString() };
  return mockProjects[index];
};

export const deleteProject = async (projectId: string): Promise<boolean> => {
  console.log(`[MOCK API] 删除项目: ${projectId}`);
  await delay(300);
  const initialLength = mockProjects.length;
  mockProjects = mockProjects.filter(p => p.id !== projectId);
  return mockProjects.length !== initialLength;
};

// 线程相关API
export const getThreads = async (projectId?: string): Promise<Thread[]> => {
  console.log(`[MOCK API] 获取线程列表`, projectId ? `项目: ${projectId}` : '所有项目');
  await delay(200);
  let threads = [...mockThreads];
  if (projectId) {
    threads = threads.filter(t => t.project_id === projectId);
  }
  return threads;
};

export const getThread = async (threadId: string): Promise<Thread | null> => {
  console.log(`[MOCK API] 获取线程: ${threadId}`);
  await delay(200);
  const thread = mockThreads.find(t => t.thread_id === threadId);
  return thread || null;
};

export const createThread = async (thread: Omit<Thread, 'thread_id' | 'created_at'>): Promise<Thread> => {
  console.log('[MOCK API] 创建线程');
  await delay(300);
  const newThread: Thread = {
    ...thread,
    thread_id: generateId(),
    created_at: new Date().toISOString()
  };
  mockThreads.push(newThread);
  return newThread;
};

export const deleteThread = async (threadId: string): Promise<boolean> => {
  console.log(`[MOCK API] 删除线程: ${threadId}`);
  await delay(300);
  const initialLength = mockThreads.length;
  mockThreads = mockThreads.filter(t => t.thread_id !== threadId);
  mockMessages = mockMessages.filter(m => m.thread_id !== threadId);
  return mockThreads.length !== initialLength;
};

// 消息相关API
export const getMessages = async (threadId: string): Promise<Message[]> => {
  console.log(`[MOCK API] 获取消息: ${threadId}`);
  await delay(200);
  return mockMessages.filter(m => m.thread_id === threadId).sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

export const addUserMessage = async (threadId: string, content: string): Promise<Message> => {
  console.log(`[MOCK API] 添加用户消息: ${threadId}`);
  await delay(300);
  const newMessage: Message = {
    id: generateId(),
    thread_id: threadId,
    type: 'user',
    content,
    created_at: new Date().toISOString()
  };
  mockMessages.push(newMessage);
  return newMessage;
};

// Agent相关API
export const startAgent = async (threadId: string): Promise<string> => {
  console.log(`[MOCK API] 启动代理: ${threadId}`);
  await delay(500);
  const agentRunId = generateId();
  const newAgentRun: AgentRun = {
    agent_run_id: agentRunId,
    thread_id: threadId,
    status: 'running',
    created_at: new Date().toISOString(),
    model_name: 'gpt-4'
  };
  mockAgentRuns.push(newAgentRun);
  return agentRunId;
};

export const getAgentStatus = async (agentRunId: string): Promise<{ status: string }> => {
  console.log(`[MOCK API] 获取代理状态: ${agentRunId}`);
  await delay(200);
  
  // 检查是否被标记为非运行状态
  if (nonRunningAgentRuns.has(agentRunId)) {
    return { status: 'stopped' };
  }
  
  const agentRun = mockAgentRuns.find(r => r.agent_run_id === agentRunId);
  return {
    status: agentRun?.status || 'agent_not_running'
  };
};

export const stopAgent = async (agentRunId: string): Promise<void> => {
  console.log(`[MOCK API] 停止代理: ${agentRunId}`);
  await delay(300);
  nonRunningAgentRuns.add(agentRunId);
  
  // 关闭任何现有的流
  const existingStream = activeStreams.get(agentRunId);
  if (existingStream) {
    existingStream.close();
    activeStreams.delete(agentRunId);
  }
  
  // 更新代理运行状态
  const agentRun = mockAgentRuns.find(r => r.agent_run_id === agentRunId);
  if (agentRun) {
    agentRun.status = 'stopped';
    agentRun.finish_reason = 'user_cancelled';
  }
};

export const getAgentRuns = async (threadId: string): Promise<AgentRun[]> => {
  console.log(`[MOCK API] 获取代理运行记录: ${threadId}`);
  await delay(200);
  return mockAgentRuns.filter(r => r.thread_id === threadId).sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

export const streamAgent = async (agentRunId: string, callbacks: {
  onMessage?: (data: any) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}): Promise<() => void> => {
  console.log(`[MOCK API] 启动代理流: ${agentRunId}`);
  
  try {
    // 模拟建立连接延迟
    await delay(500);
    
    // 检查代理运行是否有效
    const agentRun = mockAgentRuns.find(r => r.agent_run_id === agentRunId);
    if (!agentRun || nonRunningAgentRuns.has(agentRunId)) {
      throw new Error('Agent run not found or not running');
    }
    
    // 创建模拟EventSource
    const mockEventSource = new MockEventSource(`${API_URL}/agent/stream/${agentRunId}`);
    activeStreams.set(agentRunId, mockEventSource);
    
    // 设置事件监听器
    if (callbacks.onMessage) {
      mockEventSource.addEventListener('message', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          callbacks.onMessage!(data);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });
    }
    
    if (callbacks.onError) {
      mockEventSource.addEventListener('error', () => {
        callbacks.onError!('Stream error');
      });
    }
    
    if (callbacks.onClose) {
      mockEventSource.addEventListener('close', () => {
        callbacks.onClose!();
      });
    }
    
    // 返回清理函数
    return () => {
      console.log(`[MOCK STREAM] 清理流: ${agentRunId}`);
      const stream = activeStreams.get(agentRunId);
      if (stream) {
        stream.close();
        activeStreams.delete(agentRunId);
      }
    };
  } catch (error) {
    if (callbacks.onError) {
      callbacks.onError(error instanceof Error ? error.message : String(error));
    }
    return () => {};
  }
};

// 文件相关API
export const listSandboxFiles = async (projectId: string, path: string = '/'): Promise<FileInfo[]> => {
  console.log(`[MOCK API] 列出沙盒文件: ${projectId}, 路径: ${path}`);
  await delay(200);
  // 简单地返回模拟文件列表
  return mockFiles.filter(f => f.path.startsWith(path));
};

export const getSandboxFileContent = async (projectId: string, path: string): Promise<string> => {
  console.log(`[MOCK API] 获取文件内容: ${projectId}, 路径: ${path}`);
  await delay(300);
  // 返回模拟内容
  return `这是模拟的文件内容，路径: ${path}`;
};

export const createSandboxFile = async (projectId: string, path: string, content: string): Promise<void> => {
  console.log(`[MOCK API] 创建文件: ${projectId}, 路径: ${path}`);
  await delay(300);
  
  const existingFileIndex = mockFiles.findIndex(f => f.path === path);
  const fileInfo: FileInfo = {
    name: path.split('/').pop() || path,
    path,
    is_dir: false,
    size: content.length,
    last_modified: Date.now(),
    content
  };
  
  if (existingFileIndex >= 0) {
    mockFiles[existingFileIndex] = fileInfo;
  } else {
    mockFiles.push(fileInfo);
  }
};

// 模拟认证函数
export const getAccessToken = async (): Promise<string> => {
  console.log('[MOCK API] 获取访问令牌');
  // 在前端-only 模式下，返回一个模拟令牌
  return 'mock-access-token';
};

// 模拟其他常用函数
export const checkApiHealth = async (): Promise<{ status: string }> => {
  console.log('[MOCK API] 检查API健康状态');
  return { status: 'ok' };
};

export const getAgentBuilderChatHistory = async (agentId: string): Promise<any[]> => {
  console.log(`[MOCK API] 获取代理构建聊天历史: ${agentId}`);
  return [];
};

// 模拟billing API
export const createCheckoutSession = async (): Promise<{ sessionId: string, url: string }> => {
  console.log('[MOCK API] 创建结账会话');
  return {
    sessionId: generateId(),
    url: 'https://checkout.example.com/session/' + generateId()
  };
};

export const createPortalSession = async (): Promise<{ url: string }> => {
  console.log('[MOCK API] 创建门户会话');
  return {
    url: 'https://portal.example.com/session/' + generateId()
  };
};

export const getSubscription = async (): Promise<{ status: string }> => {
  console.log('[MOCK API] 获取订阅状态');
  return { status: 'active' };
};

// 模拟转录API
export const transcribeAudio = async (audioFile: File): Promise<{ text: string }> => {
  console.log('[MOCK API] 转录音频');
  await delay(2000); // 模拟长时间处理
  return {
    text: '这是模拟的音频转录结果。'
  };
};

// 模拟公共项目API
export const getPublicProjects = async (): Promise<Project[]> => {
  console.log('[MOCK API] 获取公共项目');
  await delay(200);
  return mockProjects.filter(p => p.is_public);
};

// 模拟initiateAgent API
export const initiateAgent = async (agentId: string): Promise<string> => {
  console.log(`[MOCK API] 初始化代理: ${agentId}`);
  await delay(500);
  return generateId();
};

// 导出API_URL供其他模块使用
export { API_URL };

export interface InitiateAgentResponse {
  agent_id: string;
  message?: string;
}

export interface HealthCheckResponse {
  status: string;
  version: string;
  uptime: number;
  timestamp: string;
}

// Mock data already defined above

// Mock data already defined above

// 模拟EventSource
class MockEventSource {
  private listeners: Map<string, Function[]> = new Map();
  private isOpen = true;
  private messageQueue: string[] = [];
  private messageInterval: NodeJS.Timeout | null = null;
  private agentRunId: string;

  constructor(url: string) {
    // 从URL中提取agentRunId
    this.agentRunId = url.split('/').pop() || 'unknown';
    
    // 模拟消息流
    this.setupMockStream();
    
    // 触发open事件
    setTimeout(() => {
      this.dispatchEvent('open');
    }, 100);
  }

  private setupMockStream() {
    // 模拟AI生成的响应
    const mockResponses = [
      '{"type":"message","content":"你好！我是一个模拟的AI助手。"}',
      '{"type":"message","content":" 很高兴能为您提供帮助。"}',
      '{"type":"message","content":" 在这个前端-only版本中，我正在模拟一个实时流。"}',
      '{"type":"status","status":"completed"}',
      '{"type":"status","status_type":"thread_run_end"}'
    ];

    this.messageQueue = [...mockResponses];
    
    // 每隔500ms发送一条消息
    this.messageInterval = setInterval(() => {
      if (this.messageQueue.length > 0 && this.isOpen) {
        const message = this.messageQueue.shift();
        if (message) {
          this.dispatchEvent('message', { data: message });
        }
      } else if (this.messageQueue.length === 0 && this.isOpen) {
        // 流结束
        this.close();
      }
    }, 500);
  }

  private dispatchEvent(type: string, event?: any) {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(listener => listener(event));
    }
  }

  addEventListener(type: string, listener: Function) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: Function) {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      this.listeners.set(type, typeListeners.filter(l => l !== listener));
    }
  }

  close() {
    if (this.isOpen) {
      this.isOpen = false;
      if (this.messageInterval) {
        clearInterval(this.messageInterval);
        this.messageInterval = null;
      }
      // 触发错误事件表示连接关闭
      this.dispatchEvent('error', { type: 'error' });
    }
  }

  // 为了兼容原始EventSource接口
  get onmessage() { return null; }
  set onmessage(callback: Function) { 
    this.listeners.set('message', [callback]); 
  }
  
  get onopen() { return null; }
  set onopen(callback: Function) { 
    this.listeners.set('open', [callback]); 
  }
  
  get onerror() { return null; }
  set onerror(callback: Function) { 
    this.listeners.set('error', [callback]); 
  }
}

// 存储活动流和非运行的代理运行
const activeStreams = new Map<string, MockEventSource>();
const nonRunningAgentRuns = new Set<string>();

// 辅助函数生成唯一ID
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to handle API errors
function handleApiError(
  error: Error,
  context: {
    operation: string;
    resource?: string;
    silent?: boolean;
  }
): void {
  const { operation, resource, silent = false } = context;
  const message = `${operation} ${resource ? `for ${resource}` : ''} failed: ${error.message}`;
  
  // Log all errors
  console.error(message, error);
  
  // Dispatch a custom event for UI to handle
  if (typeof window !== 'undefined' && !silent) {
    window.dispatchEvent(
      new CustomEvent('api-error', {
        detail: { error, context },
      })
    );
  }
}

// 项目相关API
export const getProjects = async (): Promise<Project[]> => {
  console.log('[MOCK API] 获取项目列表');
  return mockProjects;
};

export const getProject = async (projectId: string): Promise<Project> => {
  console.log(`[MOCK API] 获取项目: ${projectId}`);
  const project = mockProjects.find(p => p.id === projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  return project;
};

export const createProject = async (projectData: Partial<Project>): Promise<Project> => {
  console.log('[MOCK API] 创建项目', projectData);
  const newProject: Project = {
    id: generateId('proj'),
    name: projectData.name || '新项目',
    description: projectData.description || '',
    account_id: 'user-1',
    created_at: new Date().toISOString(),
    sandbox: projectData.sandbox || {
      id: '',
      pass: '',
      vnc_preview: '',
      sandbox_url: '',
    },
  };
  mockProjects.push(newProject);
  return newProject;
};

export const updateProject = async (projectId: string, projectData: Partial<Project>): Promise<Project> => {
  console.log(`[MOCK API] 更新项目: ${projectId}`, projectData);
  const index = mockProjects.findIndex(p => p.id === projectId);
  if (index === -1) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  mockProjects[index] = {
    ...mockProjects[index],
    ...projectData,
    updated_at: new Date().toISOString(),
  };
  
  // 模拟事件调度
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('project-updated', {
        detail: {
          projectId,
          updatedData: {
            id: mockProjects[index].id,
            name: mockProjects[index].name,
            description: mockProjects[index].description,
          },
        },
      }),
    );
  }
  
  return mockProjects[index];
};

export const deleteProject = async (projectId: string): Promise<void> => {
  console.log(`[MOCK API] 删除项目: ${projectId}`);
  const index = mockProjects.findIndex(p => p.id === projectId);
  if (index === -1) {
    throw new Error(`Project ${projectId} not found`);
  }
  mockProjects.splice(index, 1);
};

// 线程相关API
export const getThreads = async (projectId?: string): Promise<Thread[]> => {
  console.log(`[MOCK API] 获取线程列表`, projectId ? `项目: ${projectId}` : '所有项目');
  let threads = [...mockThreads];
  if (projectId) {
    threads = threads.filter(t => t.project_id === projectId);
  }
  return threads;
};

export const getThread = async (threadId: string): Promise<Thread> => {
  console.log(`[MOCK API] 获取线程: ${threadId}`);
  const thread = mockThreads.find(t => t.thread_id === threadId);
  if (!thread) {
    throw new Error(`Thread ${threadId} not found`);
  }
  return thread;
};

export const createThread = async (projectId: string): Promise<Thread> => {
  console.log(`[MOCK API] 创建线程, 项目: ${projectId}`);
  const newThread: Thread = {
    thread_id: generateId('thread'),
    account_id: 'user-1',
    project_id: projectId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {},
  };
  mockThreads.push(newThread);
  return newThread;
};

export const addUserMessage = async (threadId: string, content: string): Promise<void> => {
  console.log(`[MOCK API] 添加用户消息到线程: ${threadId}`, content);
  const thread = mockThreads.find(t => t.thread_id === threadId);
  if (!thread) {
    throw new Error(`Thread ${threadId} not found`);
  }
  
  const message = {
    id: generateId('msg'),
    thread_id: threadId,
    type: 'user',
    content: JSON.stringify({ role: 'user', content }),
    created_at: new Date().toISOString(),
    is_llm_message: true,
  };
  
  mockMessages.push(message);
  
  // 更新线程的updated_at
  thread.updated_at = new Date().toISOString();
};

export const getMessages = async (threadId: string): Promise<Message[]> => {
  console.log(`[MOCK API] 获取线程消息: ${threadId}`);
  return mockMessages.filter(m => m.thread_id === threadId);
};

// Agent相关API
export const startAgent = async (threadId: string, options?: any): Promise<{ agent_run_id: string }> => {
  console.log(`[MOCK API] 启动代理, 线程: ${threadId}`, options);
  const agentRunId = generateId('agent-run');
  
  const newAgentRun: AgentRun = {
    agent_run_id: agentRunId,
    thread_id: threadId,
    status: 'running',
    created_at: new Date().toISOString(),
    model_name: options?.model_name || 'claude-3-7-sonnet-latest',
  };
  
  mockAgentRuns.push(newAgentRun);
  
  // 添加一个模拟的助手消息
  const assistantMessage = {
    id: generateId('msg'),
    thread_id: threadId,
    type: 'assistant',
    content: JSON.stringify({ role: 'assistant', content: '思考中...' }),
    created_at: new Date().toISOString(),
    agent_id: agentRunId,
    is_llm_message: true,
    agents: {
      name: '模拟助手',
      avatar: '🤖',
      avatar_color: '#2196F3'
    }
  };
  mockMessages.push(assistantMessage);
  
  return { agent_run_id: agentRunId };
};

export const stopAgent = async (agentRunId: string): Promise<void> => {
  console.log(`[MOCK API] 停止代理: ${agentRunId}`);
  nonRunningAgentRuns.add(agentRunId);
  
  // 关闭任何现有的流
  const existingStream = activeStreams.get(agentRunId);
  if (existingStream) {
    existingStream.close();
    activeStreams.delete(agentRunId);
  }
  
  // 更新代理运行状态
  const agentRun = mockAgentRuns.find(r => r.agent_run_id === agentRunId);
  if (agentRun) {
    agentRun.status = 'stopped';
    agentRun.finish_reason = 'user_cancelled';
  }
};

export const getAgentStatus = async (agentRunId: string): Promise<AgentRun> => {
  console.log(`[MOCK API] 获取代理状态: ${agentRunId}`);
  
  if (nonRunningAgentRuns.has(agentRunId)) {
    throw new Error(`Agent run ${agentRunId} is not running`);
  }
  
  const agentRun = mockAgentRuns.find(r => r.agent_run_id === agentRunId);
  if (!agentRun) {
    throw new Error(`Agent run ${agentRunId} not found`);
  }
  
  return agentRun;
};

export const getAgentRuns = async (threadId: string): Promise<AgentRun[]> => {
  console.log(`[MOCK API] 获取线程的代理运行: ${threadId}`);
  return mockAgentRuns.filter(r => r.thread_id === threadId);
};

export const streamAgent = (agentRunId: string, callbacks: {
  onMessage: (content: string) => void;
  onError: (error: Error | string) => void;
  onClose: () => void;
}): (() => void) => {
  console.log(`[MOCK STREAM] 启动代理流: ${agentRunId}`);
  
  // 检查代理是否已知为非运行状态
  if (nonRunningAgentRuns.has(agentRunId)) {
    setTimeout(() => {
      callbacks.onError(`Agent run ${agentRunId} is not running`);
      callbacks.onClose();
    }, 0);
    return () => {};
  }
  
  // 检查是否已有活动流
  const existingStream = activeStreams.get(agentRunId);
  if (existingStream) {
    existingStream.close();
    activeStreams.delete(agentRunId);
  }
  
  // 创建模拟流
  const url = `https://mock-api/agent-run/${agentRunId}/stream`;
  const mockEventSource = new MockEventSource(url);
  activeStreams.set(agentRunId, mockEventSource);
  
  mockEventSource.onopen = () => {
    console.log(`[MOCK STREAM] 连接已打开: ${agentRunId}`);
  };
  
  mockEventSource.onmessage = (event: any) => {
    try {
      callbacks.onMessage(event.data);
      
      // 如果是完成消息，更新状态
      if (event.data.includes('"status":"completed"')) {
        nonRunningAgentRuns.add(agentRunId);
        const agentRun = mockAgentRuns.find(r => r.agent_run_id === agentRunId);
        if (agentRun) {
          agentRun.status = 'completed';
          agentRun.finish_reason = 'completed';
        }
      }
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : String(error));
    }
  };
  
  mockEventSource.onerror = () => {
    console.log(`[MOCK STREAM] 流错误: ${agentRunId}`);
    // 流结束时会触发此事件
  };
  
  // 返回清理函数
  return () => {
    console.log(`[MOCK STREAM] 清理流: ${agentRunId}`);
    const stream = activeStreams.get(agentRunId);
    if (stream) {
      stream.close();
      activeStreams.delete(agentRunId);
    }
  };
};

// Sandbox相关API (模拟实现)
export const createSandboxFile = async (sandboxId: string, filePath: string, content: string): Promise<void> => {
  console.log(`[MOCK API] 创建沙盒文件: ${sandboxId}/${filePath}`);
  // 模拟文件创建
};

export const createSandboxFileJson = async (sandboxId: string, filePath: string, content: string): Promise<void> => {
  console.log(`[MOCK API] 创建沙盒文件(JSON): ${sandboxId}/${filePath}`);
  // 模拟文件创建
};

export const listSandboxFiles = async (sandboxId: string, path: string): Promise<FileInfo[]> => {
  console.log(`[MOCK API] 列出沙盒文件: ${sandboxId}/${path}`);
  // 返回模拟文件列表
  return [
    {
      name: 'README.md',
      path: `${path}/README.md`,
      is_dir: false,
      size: 1024,
      last_modified: Date.now(),
      content: '# 模拟项目\n\n这是一个模拟的项目文件。'
    },
    {
      name: 'src',
      path: `${path}/src`,
      is_dir: true,
      size: 0,
      last_modified: Date.now()
    }
  ];
};

export const getSandboxFileContent = async (sandboxId: string, path: string): Promise<string | Blob> => {
  console.log(`[MOCK API] 获取沙盒文件内容: ${sandboxId}/${path}`);
  // 返回模拟文件内容
  return '# 模拟文件内容\n\n这是一个模拟的文件内容，用于前端-only版本。';
};

// 公共项目API
export const getPublicProjects = async (): Promise<Project[]> => {
  console.log('[MOCK API] 获取公共项目');
  return mockProjects.filter(p => p.is_public);
};

// 代理初始化API
export const initiateAgent = async (formData: FormData): Promise<InitiateAgentResponse> => {
  console.log('[MOCK API] 初始化代理');
  return {
    agent_id: generateId('agent'),
    message: '代理初始化成功（模拟）'
  };
};

// 健康检查API
export const checkApiHealth = async (): Promise<HealthCheckResponse> => {
  console.log('[MOCK API] 健康检查');
  return {
    status: 'ok',
    version: '1.0.0',
    uptime: 3600,
    timestamp: new Date().toISOString()
  };
};

// 账单相关API (模拟实现)
export interface CreateCheckoutSessionRequest {
  price_id: string;
  success_url: string;
  cancel_url: string;
  referral_id?: string;
}

export interface CreatePortalSessionRequest {
  return_url: string;
}

export interface SubscriptionStatus {
  status: string;
  plan_name?: string;
  price_id?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  trial_end?: string;
  minutes_limit?: number;
  cost_limit?: number;
  current_usage?: number;
  has_schedule: boolean;
  scheduled_plan_name?: string;
  scheduled_price_id?: string;
  scheduled_change_date?: string;
  schedule_effective_date?: string;
}

export interface BillingStatusResponse {
  can_run: boolean;
  message: string;
  subscription: {
    price_id: string;
    plan_name: string;
    minutes_limit?: number;
  };
}

export interface Model {
  id: string;
  display_name: string;
  short_name?: string;
  requires_subscription?: boolean;
  is_available?: boolean;
  input_cost_per_million_tokens?: number | null;
  output_cost_per_million_tokens?: number | null;
  max_tokens?: number | null;
}

export interface AvailableModelsResponse {
  models: Model[];
  subscription_tier: string;
  total_models: number;
}

export interface CreateCheckoutSessionResponse {
  status: string;
  subscription_id?: string;
  schedule_id?: string;
  session_id?: string;
  url?: string;
  effective_date?: string;
  message?: string;
  details?: any;
}

export const createCheckoutSession = async (request: CreateCheckoutSessionRequest): Promise<CreateCheckoutSessionResponse> => {
  console.log('[MOCK API] 创建结账会话', request);
  return {
    status: 'checkout_created',
    url: 'https://mock-checkout.example.com',
    session_id: generateId('session'),
    message: '模拟结账会话已创建'
  };
};

export const createPortalSession = async (request: CreatePortalSessionRequest): Promise<{ url: string }> => {
  console.log('[MOCK API] 创建门户会话', request);
  return {
    url: 'https://mock-portal.example.com'
  };
};

export const getSubscription = async (): Promise<SubscriptionStatus> => {
  console.log('[MOCK API] 获取订阅状态');
  return {
    status: 'active',
    plan_name: '免费计划',
    price_id: 'free-plan',
    current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    cancel_at_period_end: false,
    has_schedule: false,
    minutes_limit: 60,
    current_usage: 0
  };
};

export const getAvailableModels = async (): Promise<AvailableModelsResponse> => {
  console.log('[MOCK API] 获取可用模型');
  return {
    models: [
      {
        id: 'claude-3-7-sonnet-latest',
        display_name: 'Claude 3 Sonnet',
        short_name: 'Claude 3',
        requires_subscription: false,
        is_available: true
      },
      {
        id: 'gpt-4-turbo',
        display_name: 'GPT-4 Turbo',
        short_name: 'GPT-4',
        requires_subscription: true,
        is_available: false
      }
    ],
    subscription_tier: 'free',
    total_models: 2
  };
};

export const checkBillingStatus = async (): Promise<BillingStatusResponse> => {
  console.log('[MOCK API] 检查账单状态');
  return {
    can_run: true,
    message: '您的计划允许使用AI功能',
    subscription: {
      price_id: 'free-plan',
      plan_name: '免费计划',
      minutes_limit: 60
    }
  };
};

// 转录API (模拟实现)
export interface TranscriptionResponse {
  text: string;
}

export const transcribeAudio = async (audioFile: File): Promise<TranscriptionResponse> => {
  console.log('[MOCK API] 转录音频文件', audioFile.name);
  return {
    text: '这是一段模拟的音频转录文本。前端-only版本无法处理实际的音频转录。'
  };
};

// 代理构建器聊天历史API
export const getAgentBuilderChatHistory = async (agentId: string): Promise<{messages: Message[], thread_id: string | null}> => {
  console.log(`[MOCK API] 获取代理构建器聊天历史: ${agentId}`);
  return {
    messages: [],
    thread_id: null
  };
};
