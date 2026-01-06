from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from typing import Union
import logging

logger = logging.getLogger("zhaocai_portal")

class APIException(HTTPException):
    """
    Custom API exception class
    """
    def __init__(self, status_code: int, code: str, message: str, details: list = None):
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message
        self.details = details or []


class ValidationException(APIException):
    """
    Validation error exception
    """
    def __init__(self, message: str = "Validation error", details: list = None):
        super().__init__(
            status_code=400,
            code="VALIDATION_ERROR",
            message=message,
            details=details or []
        )


class AuthenticationException(APIException):
    """
    Authentication error exception
    """
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(
            status_code=401,
            code="NOT_AUTHENTICATED",
            message=message
        )


class AuthorizationException(APIException):
    """
    Authorization error exception
    """
    def __init__(self, message: str = "Permission denied"):
        super().__init__(
            status_code=403,
            code="PERMISSION_DENIED",
            message=message
        )


class ResourceNotFoundException(APIException):
    """
    Resource not found exception
    """
    def __init__(self, message: str = "Resource not found"):
        super().__init__(
            status_code=404,
            code="RESOURCE_NOT_FOUND",
            message=message
        )


async def http_exception_handler(request: Request, exc: HTTPException):
    """
    HTTP exception handler
    """
    logger.error(f"HTTP Exception: {exc.status_code} - {exc.detail}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": "HTTP_ERROR",
                "message": str(exc.detail),
                "details": []
            },
            "code": exc.status_code
        }
    )


async def validation_exception_handler(request: Request, exc: ValidationException):
    """
    Validation exception handler
    """
    logger.warning(f"Validation error: {exc.message}")
    
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details
            },
            "code": 400
        }
    )


async def api_exception_handler(request: Request, exc: APIException):
    """
    API exception handler
    """
    logger.error(f"API Exception: {exc.code} - {exc.message}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details
            },
            "code": exc.status_code
        }
    )


async def general_exception_handler(request: Request, exc: Exception):
    """
    General exception handler
    """
    logger.error(f"General exception: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Internal server error",
                "details": []
            },
            "code": 500
        }
    )