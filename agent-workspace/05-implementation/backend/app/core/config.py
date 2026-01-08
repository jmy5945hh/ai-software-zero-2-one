"""应用配置模块"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    """应用配置类"""

    # 数据库配置
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "99912345"
    DB_NAME: str = "zero_one"
    DB_CHARSET: str = "utf8mb4"

    # JWT 配置
    JWT_SECRET_KEY: str = "zero-one-test"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    # LLM 配置
    LLM_API_BASE: str = "https://ark.cn-beijing.volces.com/api/v3"
    LLM_API_KEY: str = ""
    LLM_MODEL_NAME: str = ""
    LLM_TEMPERATURE: float = 0.5
    LLM_MAX_TOKENS: int = 65535
    LLM_STREAM: bool = True
    LLM_API_TIMEOUT: int = 60

    # CORS 配置
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def database_url(self) -> str:
        """生成数据库连接 URL"""
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            f"?charset={self.DB_CHARSET}"
        )


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()
