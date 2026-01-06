from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, Optional
from datetime import datetime
from core.security import get_current_active_user, require_any_role
from db.session import get_db
from schemas import HomepageCarousel, HomepageCarouselCreate, HomepageCarouselUpdate, News, NewsCreate, NewsUpdate, DataResponse, ListResponse, Pagination
from models import HomepageCarousel as CarouselModel, News as NewsModel, User
import logging

logger = logging.getLogger("zhaocai_portal")

router = APIRouter()

# Homepage Carousel endpoints
@router.get("/homepage/carousel", response_model=ListResponse)
async def get_carousel_list(
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get homepage carousel list
    """
    query = db.query(CarouselModel)
    
    if is_active is not None:
        query = query.filter(CarouselModel.is_active == is_active)
    
    # Order by sort_order
    carousels = query.order_by(CarouselModel.sort_order).all()
    
    carousels_data = []
    for carousel in carousels:
        carousel_data = {
            "carousel_id": str(carousel.carousel_id),
            "title": carousel.title,
            "image_url": carousel.image_url,
            "link_url": carousel.link_url,
            "sort_order": carousel.sort_order,
            "is_active": carousel.is_active,
            "created_at": carousel.created_at,
            "updated_at": carousel.updated_at
        }
        carousels_data.append(carousel_data)
    
    return ListResponse(
        success=True,
        data={
            "items": carousels_data,
            "pagination": {
                "page": 1,
                "size": len(carousels_data),
                "total": len(carousels_data),
                "total_pages": 1
            }
        },
        message="Get carousel list successful",
        code=200
    )


@router.post("/homepage/carousel", response_model=DataResponse)
async def create_carousel(
    carousel_create: HomepageCarouselCreate,
    current_user: User = Depends(require_any_role("operations_staff", "branch_manager")),
    db: Session = Depends(get_db)
) -> Any:
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
    
    logger.info(f"Carousel item created: {db_carousel.carousel_id} by {current_user.username}")
    
    carousel_data = {
        "carousel_id": str(db_carousel.carousel_id),
        "title": db_carousel.title,
        "image_url": db_carousel.image_url,
        "link_url": db_carousel.link_url,
        "sort_order": db_carousel.sort_order,
        "is_active": db_carousel.is_active,
        "created_at": db_carousel.created_at,
        "updated_at": db_carousel.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"homepage_carousel": carousel_data},
        message="Carousel item created successfully",
        code=201
    )


@router.put("/homepage/carousel/{carousel_id}", response_model=DataResponse)
async def update_carousel(
    carousel_id: str,
    carousel_update: HomepageCarouselUpdate,
    current_user: User = Depends(require_any_role("operations_staff", "branch_manager")),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update homepage carousel item
    """
    carousel = db.query(CarouselModel).filter(CarouselModel.carousel_id == carousel_id).first()
    if not carousel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carousel item not found"
        )
    
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
    
    logger.info(f"Carousel item updated: {carousel.carousel_id} by {current_user.username}")
    
    carousel_data = {
        "carousel_id": str(carousel.carousel_id),
        "title": carousel.title,
        "image_url": carousel.image_url,
        "link_url": carousel.link_url,
        "sort_order": carousel.sort_order,
        "is_active": carousel.is_active,
        "created_at": carousel.created_at,
        "updated_at": carousel.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"homepage_carousel": carousel_data},
        message="Carousel item updated successfully",
        code=200
    )


@router.delete("/homepage/carousel/{carousel_id}", response_model=DataResponse)
async def delete_carousel(
    carousel_id: str,
    current_user: User = Depends(require_any_role("operations_staff", "branch_manager")),
    db: Session = Depends(get_db)
) -> Any:
    """
    Delete homepage carousel item
    """
    carousel = db.query(CarouselModel).filter(CarouselModel.carousel_id == carousel_id).first()
    if not carousel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carousel item not found"
        )
    
    db.delete(carousel)
    db.commit()
    
    logger.info(f"Carousel item deleted: {carousel.carousel_id} by {current_user.username}")
    
    return DataResponse(
        success=True,
        message="Carousel item deleted successfully",
        code=200
    )


# News endpoints
@router.get("/news", response_model=ListResponse)
async def get_news_list(
    page: int = 1,
    size: int = 10,
    status_param: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get news list
    """
    query = db.query(NewsModel).join(User, NewsModel.author_id == User.user_id)
    
    if status_param:
        query = query.filter(NewsModel.status == status_param)
    
    # Calculate pagination
    total = query.count()
    total_pages = (total + size - 1) // size
    
    # Apply pagination
    news_items = query.offset((page - 1) * size).limit(size).all()
    
    news_data = []
    for news in news_items:
        news_item = {
            "news_id": str(news.news_id),
            "title": news.title,
            "summary": news.summary,
            "author_id": str(news.author_id),
            "author_name": news.author.real_name if news.author else None,
            "publish_date": news.publish_date,
            "status": news.status,
            "created_at": news.created_at,
            "updated_at": news.updated_at
        }
        news_data.append(news_item)
    
    return ListResponse(
        success=True,
        data={
            "items": news_data,
            "pagination": {
                "page": page,
                "size": size,
                "total": total,
                "total_pages": total_pages
            }
        },
        message="Get news list successful",
        code=200
    )


@router.post("/news", response_model=DataResponse)
async def create_news(
    news_create: NewsCreate,
    current_user: User = Depends(require_any_role("operations_staff", "branch_manager")),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create news item
    """
    db_news = NewsModel(
        title=news_create.title,
        content=news_create.content,
        summary=news_create.summary,
        author_id=current_user.user_id,
        status=news_create.status
    )
    
    # Set publish date if status is published
    if news_create.status == "published":
        db_news.publish_date = datetime.utcnow()
    
    db.add(db_news)
    db.commit()
    db.refresh(db_news)
    
    logger.info(f"News item created: {db_news.news_id} by {current_user.username}")
    
    news_data = {
        "news_id": str(db_news.news_id),
        "title": db_news.title,
        "content": db_news.content,
        "summary": db_news.summary,
        "author_id": str(db_news.author_id),
        "author_name": current_user.real_name,
        "publish_date": db_news.publish_date,
        "status": db_news.status,
        "created_at": db_news.created_at,
        "updated_at": db_news.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"news": news_data},
        message="News item created successfully",
        code=201
    )


@router.get("/news/{news_id}", response_model=DataResponse)
async def get_news_detail(
    news_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get news detail
    """
    news = db.query(NewsModel).filter(NewsModel.news_id == news_id).first()
    if not news:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News item not found"
        )
    
    news_data = {
        "news_id": str(news.news_id),
        "title": news.title,
        "content": news.content,
        "summary": news.summary,
        "author_id": str(news.author_id),
        "author_name": news.author.real_name if news.author else None,
        "publish_date": news.publish_date,
        "status": news.status,
        "created_at": news.created_at,
        "updated_at": news.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"news": news_data},
        message="Get news detail successful",
        code=200
    )


@router.put("/news/{news_id}", response_model=DataResponse)
async def update_news(
    news_id: str,
    news_update: NewsUpdate,
    current_user: User = Depends(require_any_role("operations_staff", "branch_manager")),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update news item
    """
    news = db.query(NewsModel).filter(NewsModel.news_id == news_id).first()
    if not news:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News item not found"
        )
    
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
    
    logger.info(f"News item updated: {news.news_id} by {current_user.username}")
    
    news_data = {
        "news_id": str(news.news_id),
        "title": news.title,
        "content": news.content,
        "summary": news.summary,
        "author_id": str(news.author_id),
        "author_name": news.author.real_name if news.author else None,
        "publish_date": news.publish_date,
        "status": news.status,
        "created_at": news.created_at,
        "updated_at": news.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"news": news_data},
        message="News item updated successfully",
        code=200
    )