from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from core.config import settings
from db.session import Base, engine
import logging

logger = logging.getLogger("zhaocai_portal")


def init_db():
    """
    Initialize the database by creating all tables
    """
    try:
        # Create all tables in the database
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except SQLAlchemyError as e:
        logger.error(f"Error creating database tables: {e}")
        raise


def get_db_session():
    """
    Get a database session
    """
    Session = sessionmaker(bind=engine)
    return Session()


if __name__ == "__main__":
    init_db()