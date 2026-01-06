from pydantic import BaseModel, Field
from typing import Optional


class AIChatRequest(BaseModel):
    message: str = Field(..., description="用户消息")
    sessionId: Optional[str] = Field(None, description="会话ID，用于保持对话上下文")


class AIChatResponse(BaseModel):
    message: str = Field(..., description="AI回复")
    sessionId: str = Field(..., description="会话ID，用于保持对话上下文")
