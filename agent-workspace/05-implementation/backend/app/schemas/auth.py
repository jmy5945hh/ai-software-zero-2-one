from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码", format="password")


class UserInfo(BaseModel):
    id: int = Field(..., description="用户ID")
    username: str = Field(..., description="用户名")
    realName: str = Field(..., description="真实姓名")
    role: str = Field(..., description="用户角色")
    department: str = Field(..., description="所属部门")

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    token: str = Field(..., description="会话令牌")
    userInfo: UserInfo = Field(..., description="用户信息")
