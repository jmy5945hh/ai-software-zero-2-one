import React, { useState, useEffect, useRef } from 'react';
import { Drawer, List, Input, Button, message } from 'antd';
import { SendOutlined, LoadingOutlined } from '@ant-design/icons';
import apiClient from '../utils/apiClient';
import '../styles/AIAssistant.css';

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface AIAssistantProps {
  visible: boolean;
  onClose: () => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ visible, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: '您好！我是您的AI助手，有什么可以帮助您的吗？',
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const response = await apiClient.post('/ai/chat', {
        message: inputValue.trim(),
        sessionId,
      });

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: response.data.message,
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setSessionId(response.data.sessionId);
    } catch (error) {
      message.error('AI助手暂时无法响应，请稍后重试');
      // 添加错误提示消息
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        content: '抱歉，我暂时无法回答您的问题，请稍后重试。',
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Drawer
      title="AI助手"
      placement="right"
      onClose={onClose}
      open={visible}
      width={350}
      className="ai-assistant"
    >
      <div className="chat-container">
        <List
          dataSource={messages}
          renderItem={(message) => (
            <List.Item className={`chat-message ${message.sender}`}>
              <div className="message-content">{message.content}</div>
            </List.Item>
          )}
        />
        <div ref={messagesEndRef} />
      </div>
      <div className="input-container">
        <Input.TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="请输入您的问题..."
          autoSize={{ minRows: 2, maxRows: 4 }}
          className="message-input"
        />
        <Button
          type="primary"
          icon={loading ? <LoadingOutlined /> : <SendOutlined />}
          onClick={handleSendMessage}
          loading={loading}
          className="send-button"
        >
          发送
        </Button>
      </div>
    </Drawer>
  );
};

export default AIAssistant;
