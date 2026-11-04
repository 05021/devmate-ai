"""认证依赖：全局锁 require_auth + 路由级 get_current_user。"""

import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import decode_session_token
from app.db.models import Team, TeamMember, User
from app.db.session import get_db

# 无需登录即可访问的路径（精确匹配）
AUTH_WHITELIST_PATHS = {
    "/api/auth/login",
    "/api/auth/register",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/favicon.ico",
}
# 前缀匹配：GitHub webhook 无法携带用户会话，由自身的 secret 校验保护
AUTH_WHITELIST_PREFIXES = ("/api/webhooks",)

SESSION_COOKIE = "dm_session"


def _resolve_user(request: Request, db: Session) -> User | None:
    cached = getattr(request.state, "current_user", None)
    if cached is not None:
        return cached
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    user_id = decode_session_token(token)
    if user_id is None:
        return None
    user = db.get(User, user_id)
    if user is not None:
        request.state.current_user = user
    return user


def _is_whitelisted(path: str) -> bool:
    return path in AUTH_WHITELIST_PATHS or path.startswith(AUTH_WHITELIST_PREFIXES)


def require_auth(request: Request, db: Session = Depends(get_db)) -> None:
    """全局认证锁：白名单放行，其余一律要求有效会话。"""
    if _is_whitelisted(request.url.path):
        return
    if _resolve_user(request, db) is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录或会话已过期",
        )


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = _resolve_user(request, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录或会话已过期",
        )
    return user


def get_current_membership(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TeamMember:
    """当前活动团队的成员关系。活动团队优先取请求头 X-Team-Id（前端切换器），
    否则回退到 user.last_active_team_id，再回退到唯一成员关系。"""
    requested_team_id = request.headers.get("X-Team-Id")
    query = db.query(TeamMember).filter(TeamMember.user_id == user.id)
    memberships = query.all()
    if not memberships:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="尚未加入任何团队，请先创建或加入团队")

    membership: TeamMember | None = None
    if requested_team_id:
        try:
            requested = uuid.UUID(requested_team_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="X-Team-Id 格式错误") from exc
        membership = next((m for m in memberships if m.team_id == requested), None)
        if membership is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="不属于该团队")
    elif user.last_active_team_id:
        membership = next((m for m in memberships if m.team_id == user.last_active_team_id), None)
    if membership is None:
        membership = memberships[0]
    # 缓存当前团队，供后续依赖复用
    request.state.current_team = db.get(Team, membership.team_id)
    return membership
