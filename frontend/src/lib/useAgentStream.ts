import { useState, useCallback, useRef, useEffect } from 'react';
import { streamAgent, stopAgent } from './api';

export const useAgentStream = (agentRunId?: string) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{
    type: 'status' | 'message_chunk' | 'tool_call' | 'tool_result';
    content?: string;
    tool_name?: string;
    parameters?: Record<string, any>;
    result?: string;
    status?: string;
  }>>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const streamRef = useRef<() => void | null>(null);
  const isMountedRef = useRef(true);
  const isFrontendOnlyMode = true; // 标记为前端-only 模式

  console.log('[MOCK AGENT STREAM] 初始化 useAgentStream hook', { agentRunId });

  // Clean up when component unmounts
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      // Clean up stream if it exists
      if (streamRef.current) {
        streamRef.current();
        streamRef.current = null;
      }
    };
  }, []);

  // Clean up stream when agentRunId changes
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current();
        streamRef.current = null;
      }
    };
  }, [agentRunId]);

  const stop = useCallback(async () => {
    if (!agentRunId) return;
    
    try {
      console.log('[MOCK AGENT STREAM] 停止流:', agentRunId);
      if (isMountedRef.current) {
        setIsStreaming(false);
      }
      
      await stopAgent(agentRunId);
      
      if (streamRef.current) {
        streamRef.current();
        streamRef.current = null;
      }
    } catch (err) {
      console.error('[MOCK AGENT STREAM] 停止流错误:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to stop agent');
      }
    }
  }, [agentRunId]);

  const start = useCallback(async () => {
    if (!agentRunId) return;
    
    try {
      console.log('[MOCK AGENT STREAM] 启动流:', agentRunId);
      if (isMountedRef.current) {
        setIsStreaming(true);
        setError(null);
        setMessages([]);
        setCurrentMessage('');
      }
      
      // Clean up any existing stream
      if (streamRef.current) {
        streamRef.current();
        streamRef.current = null;
      }
      
      // 使用模拟的 streamAgent 函数
      streamRef.current = await streamAgent(agentRunId, {
        onMessage: (data) => {
          if (!isMountedRef.current) return;
          
          console.log('[MOCK AGENT STREAM] 收到消息:', data);
          
          // Process different message types
          switch (data.type) {
            case 'status':
              setMessages(prev => [...prev, { type: 'status', status: data.status }]);
              break;
            case 'message_chunk':
              setMessages(prev => [...prev, { type: 'message_chunk', content: data.content }]);
              setCurrentMessage(prev => prev + (data.content || ''));
              break;
            case 'tool_call':
              setMessages(prev => [...prev, { 
                type: 'tool_call', 
                tool_name: data.tool_name, 
                parameters: data.parameters 
              }]);
              break;
            case 'tool_result':
              setMessages(prev => [...prev, { 
                type: 'tool_result', 
                tool_name: data.tool_name, 
                result: data.result 
              }]);
              break;
          }
          
          // Stop streaming when agent completes
          if (data.status === 'completed') {
            console.log('[MOCK AGENT STREAM] 流完成');
            setIsStreaming(false);
          }
        },
        onError: (error) => {
          console.error('[MOCK AGENT STREAM] 流错误:', error);
          if (isMountedRef.current) {
            setError(error);
            setIsStreaming(false);
          }
        },
        onClose: () => {
          console.log('[MOCK AGENT STREAM] 流关闭');
          if (isMountedRef.current) {
            setIsStreaming(false);
          }
        }
      });
    } catch (err) {
      console.error('[MOCK AGENT STREAM] 启动流错误:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to start stream');
        setIsStreaming(false);
      }
    }
  }, [agentRunId]);

  // 在前端-only 模式下，自动开始流
  useEffect(() => {
    if (isFrontendOnlyMode && agentRunId && !isStreaming) {
      console.log('[MOCK AGENT STREAM] 前端-only 模式，自动启动流');
      start();
    }
  }, [agentRunId, isFrontendOnlyMode, isStreaming, start]);

  return {
    isStreaming,
    error,
    messages,
    currentMessage,
    start,
    stop,
  };
};