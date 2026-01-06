import React, { useState, useRef, useEffect } from 'react';
import { 
  Button, 
  Input, 
  List, 
  Card, 
  Space, 
  Typography,
  FloatButton
} from 'antd';
import { 
  SendOutlined, 
  MessageOutlined,
  CloseOutlined,
  RobotOutlined,
  UserOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Text } = Typography;

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: '您好！我是招财银行运营门户的AI助手，可以为您解答系统使用相关问题。请问有什么可以帮助您的吗？',
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      // Simulate AI response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock AI response based on user input
      let aiResponse = '';
      const lowerInput = inputValue.toLowerCase();
      
      if (lowerInput.includes('登录') || lowerInput.includes('login')) {
        aiResponse = '登录时请使用您的员工账号和密码。如果忘记密码，请联系系统管理员重置。';
      } else if (lowerInput.includes('拜访') || lowerInput.includes('visit')) {
        aiResponse = '客户拜访记录可以在“客户拜访管理”模块中创建和查看。记得填写客户ID、企业名称和拜访方式等必填信息。';
      } else if (lowerInput.includes('礼品') || lowerInput.includes('gift')) {
        aiResponse = '礼品申请需要填写领用人、礼品清单、目的类型和计划领用日期。提交后需要审批人员审批才能生效。';
      } else if (lowerInput.includes('数据') || lowerInput.includes('dashboard')) {
        aiResponse = '运营数据大屏展示了拜访次数、礼品支出等关键指标，您可以按天、周、月维度查看趋势图表。';
      } else {
        aiResponse = '感谢您的提问！招财银行运营门户系统主要用于客户拜访记录、礼品申请审批和运营数据展示。您可以根据角色权限访问相应功能。';
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '抱歉，AI助手暂时无法响应，请稍后重试。',
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVisible = () => {
    setVisible(!visible);
  };

  const closeAssistant = () => {
    setVisible(false);
  };

  return (
    <>
      <FloatButton 
        icon={<MessageOutlined />} 
        onClick={toggleVisible}
        tooltip="AI助手"
        type="primary"
      />
      
      {visible && (
        <Card 
          title={
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <RobotOutlined style={{ color: '#1890ff' }} />
                <Text strong>AI助手</Text>
              </Space>
              <Button 
                type="text" 
                icon={<CloseOutlined />} 
                onClick={closeAssistant}
              />
            </Space>
          }
          style={{
            position: 'fixed',
            bottom: 100,
            right: 24,
            width: 400,
            height: 500,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              marginBottom: 16,
              maxHeight: 350
            }}
          >
            <List
              dataSource={messages}
              renderItem={message => (
                <List.Item 
                  style={{ 
                    display: 'flex', 
                    justifyContent: message.sender === 'ai' ? 'flex-start' : 'flex-end',
                    padding: '8px 0'
                  }}
                >
                  <div 
                    style={{
                      maxWidth: '80%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      backgroundColor: message.sender === 'ai' ? '#f0f2f5' : '#e6f7ff',
                      border: message.sender === 'ai' ? '1px solid #d9d9d9' : '1px solid #91d5ff'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      {message.sender === 'ai' ? (
                        <RobotOutlined style={{ color: '#1890ff', marginTop: 2 }} />
                      ) : (
                        <UserOutlined style={{ color: '#52c41a', marginTop: 2 }} />
                      )}
                      <div>
                        <Text>{message.content}</Text>
                        <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 4 }}>
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
            />
            <div ref={messagesEndRef} />
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            <TextArea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入您的问题..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={loading}
            />
            <Button 
              type="primary" 
              icon={<SendOutlined />} 
              onClick={handleSend}
              loading={loading}
              disabled={!inputValue.trim() || loading}
            />
          </div>
        </Card>
      )}
    </>
  );
};

export default AIAssistant;