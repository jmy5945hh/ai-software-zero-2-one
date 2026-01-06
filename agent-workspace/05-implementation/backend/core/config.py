from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    PROJECT_NAME: str = "招财银行北京分行运营门户 API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Server configuration
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8000
    DEBUG: bool = False
    
    # Database configuration
    DB_TYPE: str = "mysql"
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_NAME: str = "zero_one"
    DB_USER: str = "root"
    DB_PASSWORD: str = "99912345"
    DB_CHARSET: str = "utf8mb4"
    
    @property
    def DATABASE_URL(self) -> str:
        return f"{self.DB_TYPE}://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset={self.DB_CHARSET}"
    
    # JWT configuration
    JWT_SECRET_KEY: str = "zero-one-test"
    JWT_ALGORITHM: str = "HS256"  # Using HS256 instead of SM2/SM3 for compatibility
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    
    # LLM Configuration
    LLM_API_BASE: str = "https://ark.cn-beijing.volces.com/api/v3"
    LLM_API_KEY: str = "d96aede4-f372-46c6-bde7-e98af9ac583b"
    LLM_MODEL_NAME: str = "d96aede4-f372-46c6-bde7-e98af9ac583b"
    LLM_TEMPERATURE: float = 0.5
    LLM_MAX_TOKENS: int = 65535
    LLM_STREAM: bool = True
    LLM_API_TIMEOUT: int = 60
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]  # In production, replace with specific origins
    
    # Environment
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()