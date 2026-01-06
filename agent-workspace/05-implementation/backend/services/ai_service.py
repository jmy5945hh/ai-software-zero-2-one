from sqlalchemy.orm import Session
from datetime import datetime
from models import AIQuestion
from schemas import ChatRequest
import uuid


class AIService:
    @staticmethod
    def process_chat_request(
        db: Session,
        chat_request: ChatRequest,
        user_id: str
    ):
        """
        Process AI chat request
        """
        # Generate session ID if not provided
        session_id = chat_request.session_id or f"session-{uuid.uuid4()}"
        
        # In a real implementation, you would call an external AI service
        # For now, we'll return a mock response
        mock_response = f"Thank you for your question: '{chat_request.message}'. This is a mock response from the AI assistant. In a real implementation, this would connect to an external AI service."
        
        # Save the question and answer to the database
        ai_question = AIQuestion(
            user_id=user_id,
            question=chat_request.message,
            answer=mock_response,
            session_id=session_id,
            question_time=datetime.utcnow()
        )
        
        db.add(ai_question)
        db.commit()
        
        return {
            "response": mock_response,
            "session_id": session_id,
            "timestamp": datetime.utcnow()
        }