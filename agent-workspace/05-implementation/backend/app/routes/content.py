from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.schemas.content import BannerResponse, NewsResponse, NewsListResponse
from app.schemas.common import ErrorResponse
from app.models.banner import Banner
from app.models.news import News
from app.models.user import SysUser
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/banners", response_model=List[BannerResponse], responses={500: {"model": ErrorResponse}})
async def get_banners(
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取轮播图列表"""
    query = select(Banner).where(Banner.is_active == True).order_by(Banner.order_num)
    result = await db.execute(query)
    banners = result.scalars().all()
    
    return [BannerResponse(
        id=banner.id,
        title=banner.title,
        imageUrl=banner.image_url,
        linkUrl=banner.link_url,
        orderNum=banner.order_num,
        isActive=banner.is_active
    ) for banner in banners]


@router.get("/news", response_model=NewsListResponse, responses={500: {"model": ErrorResponse}})
async def get_news_list(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(10, ge=1, le=100, description="每页大小"),
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取新闻列表"""
    # 查询总记录数
    total_query = select(News).where(News.is_published == True)
    total_result = await db.execute(total_query)
    total = len(total_result.scalars().all())
    
    # 查询分页数据
    offset = (page - 1) * size
    query = select(News).where(News.is_published == True).order_by(News.publish_time.desc()).offset(offset).limit(size)
    result = await db.execute(query)
    news_list = result.scalars().all()
    
    # 转换为响应模型
    news_responses = []
    for news in news_list:
        news_responses.append(NewsResponse(
            id=news.id,
            title=news.title,
            content=news.content,
            author=news.author,
            publishTime=news.publish_time
        ))
    
    return NewsListResponse(
        total=total,
        page=page,
        size=size,
        data=news_responses
    )


@router.get("/news/{id}", response_model=NewsResponse, responses={404: {"model": ErrorResponse}})
async def get_news_detail(
    id: int,
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取新闻详情"""
    query = select(News).where(News.id == id, News.is_published == True)
    result = await db.execute(query)
    news = result.scalar_one_or_none()
    
    if not news:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News not found"
        )
    
    # 更新浏览次数
    news.view_count += 1
    await db.commit()
    await db.refresh(news)
    
    return NewsResponse(
        id=news.id,
        title=news.title,
        content=news.content,
        author=news.author,
        publishTime=news.publish_time
    )
