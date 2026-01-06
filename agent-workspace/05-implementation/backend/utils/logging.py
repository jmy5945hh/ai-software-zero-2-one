import logging
import sys
from logging.handlers import RotatingFileHandler
from core.config import settings


def setup_logging():
    # Create logger
    logger = logging.getLogger("zhaocai_portal")
    logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    
    # Prevent adding handlers multiple times
    if logger.handlers:
        return
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    
    # Create file handler with rotation
    file_handler = RotatingFileHandler(
        "app.log", 
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    file_handler.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)
    
    # Add handlers to logger
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    # Set root logger level
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    
    # Add handlers to root logger as well
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)