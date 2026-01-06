import React from 'react';
import { ProForm, ProFormText, ProFormDatePicker, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { Button, message, Card } from 'antd';
import { useNavigate } from 'react-router-dom';

// This is a sample component demonstrating ProComponents usage
// It's not directly used in the application but shows how ProComponents can be used
const ProFormDemo: React.FC = () => {
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    console.log(values);
    message.success('提交成功');
    // In a real app, you would send the data to an API
    navigate('/home');
    return true;
  };

  return (
    <Card title="ProForm 示例">
      <ProForm 
        onFinish={onFinish}
        submitter={{
          searchConfig: {
            submitText: '提交',
            resetText: '重置',
          },
          render: (_, dom) => dom,
        }}
      >
        <ProFormText
          name="name"
          label="姓名"
          rules={[{ required: true, message: '请输入姓名!' }]}
          placeholder="请输入姓名"
        />
        
        <ProFormText
          name="email"
          label="邮箱"
          rules={[{ required: true, message: '请输入邮箱!' }]}
          placeholder="请输入邮箱"
        />
        
        <ProFormDatePicker
          name="date"
          label="日期"
          rules={[{ required: true, message: '请选择日期!' }]}
        />
        
        <ProFormSelect
          name="category"
          label="分类"
          options={[
            { label: '分类A', value: 'A' },
            { label: '分类B', value: 'B' },
            { label: '分类C', value: 'C' },
          ]}
          rules={[{ required: true, message: '请选择分类!' }]}
        />
        
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入描述"
        />
      </ProForm>
    </Card>
  );
};

export default ProFormDemo;