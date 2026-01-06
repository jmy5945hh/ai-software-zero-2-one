from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Any
from core.security import get_current_active_user
from db.session import get_db
from schemas import ChatRequest, ChatResponse
from models import AIQuestion, User
import logging
from datetime import datetime
import uuid

logger = logging.getLogger("zhaocai_portal")

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    chat_request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    AI chat endpoint
    """
    # Generate session ID if not provided
    session_id = chat_request.session_id or f"session-{uuid.uuid4()}"
    
    # In a real implementation, you would call an external AI service
    # For now, we'll return a mock response
    mock_response = f"Thank you for your question: '{chat_request.message}'. This is a mock response from the AI assistant. In a real implementation, this would connect to an external AI service."
    
    # Save the question and answer to the database
    ai_question = AIQuestion(
        user_id=current_user.user_id,
        question=chat_request.message,
        answer=mock_response,
        session_id=session_id,
        question_time=datetime.utcnow()
    )
    
    db.add(ai_question)
    db.commit()
    
    response_data = {
        "response": mock_response,
        "session_id": session_id,
        "timestamp": datetime.utcnow()
    }
    
    return ChatResponse(
        success=True,
        data=response_data,
        message="Chat successful",
        code=200
    )