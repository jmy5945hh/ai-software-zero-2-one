from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from models import HomepageCarousel as CarouselModel, News as NewsModel
from schemas import HomepageCarouselCreate, HomepageCarouselUpdate, NewsCreate, NewsUpdate
from uuid import UUID


class ContentService:
    # Homepage Carousel methods
    @staticmethod
    def get_carousel_list(db: Session, is_active: Optional[bool] = None):
        """
        Get homepage carousel list
        """
        query = db.query(CarouselModel)
        
        if is_active is not None:
            query = query.filter(CarouselModel.is_active == is_active)
        
        # Order by sort_order
        carousels = query.order_by(CarouselModel.sort_order).all()
        
        return carousels
    
    @staticmethod
    def get_carousel_by_id(db: Session, carousel_id: str):
        """
        Get carousel by ID
        """
        return db.query(CarouselModel).filter(CarouselModel.carousel_id == carousel_id).first()
    
    @staticmethod
    def create_carousel(db: Session, carousel_create: HomepageCarouselCreate):
        """
        Create homepage carousel item
        """
        db_carousel = CarouselModel(
            title=carousel_create.title,
            image_url=carousel_create.image_url,
            link_url=carousel_create.link_url,
            sort_order=carousel_create.sort_order,
            is_active=carousel_create.is_active
        )
        
        db.add(db_carousel)
        db.commit()
        db.refresh(db_carousel)
        
        return db_carousel
    
    @staticmethod
    def update_carousel(db: Session, carousel_id: str, carousel_update: HomepageCarouselUpdate):
        """
        Update homepage carousel item
        """
        carousel = db.query(CarouselModel).filter(CarouselModel.carousel_id == carousel_id).first()
        if not carousel:
            return None
        
        # Update fields if provided
        if carousel_update.title is not None:
            carousel.title = carousel_update.title
        if carousel_update.image_url is not None:
            carousel.image_url = carousel_update.image_url
        if carousel_update.link_url is not None:
            carousel.link_url = carousel_update.link_url
        if carousel_update.sort_order is not None:
            carousel.sort_order = carousel_update.sort_order
        if carousel_update.is_active is not None:
            carousel.is_active = carousel_update.is_active
        
        db.commit()
        db.refresh(carousel)
        
        return carousel
    
    @staticmethod
    def delete_carousel(db: Session, carousel_id: str) -> bool:
        """
        Delete homepage carousel item
        """
        carousel = db.query(CarouselModel).filter(CarouselModel.carousel_id == carousel_id).first()
        if not carousel:
            return False
        
        db.delete(carousel)
        db.commit()
        
        return True
    
    # News methods
    @staticmethod
    def get_news_list(
        db: Session, 
        skip: int = 0, 
        limit: int = 100,
        status: Optional[str] = None
    ):
        """
        Get news list
        """
        query = db.query(NewsModel)
        
        if status:
            query = query.filter(NewsModel.status == status)
        
        # Apply pagination
        news_items = query.offset(skip).limit(limit).all()
        total = query.count()
        
        return news_items, total
    
    @staticmethod
    def get_news_by_id(db: Session, news_id: str):
        """
        Get news by ID
        """
        return db.query(NewsModel).filter(NewsModel.news_id == news_id).first()
    
    @staticmethod
    def create_news(db: Session, news_create: NewsCreate, author_id: str):
        """
        Create news item
        """
        db_news = NewsModel(
            title=news_create.title,
            content=news_create.content,
            summary=news_create.summary,
            author_id=author_id,
            status=news_create.status
        )
        
        # Set publish date if status is published
        if news_create.status == "published":
            db_news.publish_date = datetime.utcnow()
        
        db.add(db_news)
        db.commit()
        db.refresh(db_news)
        
        return db_news
    
    @staticmethod
    def update_news(db: Session, news_id: str, news_update: NewsUpdate):
        """
        Update news item
        """
        news = db.query(NewsModel).filter(NewsModel.news_id == news_id).first()
        if not news:
            return None
        
        # Update fields if provided
        if news_update.title is not None:
            news.title = news_update.title
        if news_update.content is not None:
            news.content = news_update.content
        if news_update.summary is not None:
            news.summary = news_update.summary
        if news_update.status is not None:
            news.status = news_update.status
            # Update publish date if status changes to published
            if news_update.status == "published" and not news.publish_date:
                news.publish_date = datetime.utcnow()
            elif news_update.status != "published":
                news.publish_date = None
        
        db.commit()
        db.refresh(news)
        
        return news