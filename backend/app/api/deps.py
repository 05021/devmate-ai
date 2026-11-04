"""认证依赖：全局锁 require_auth + 路由级 get_current_user + 团队上下文。

团队上下文通过 ContextVar 在请求作用域内传递：
- require_auth（全局锁）解析会话后顺带缓存当前团队成员关系
- 路由可通过 TeamScope 注解显式注入，或在 helper 内用 current_membership() 读取
- ensure_repo_in_team 是仓库隔离的统一校验入口
"""

import uuid
from contextvars import ContextVar
from typing import Annotated

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

# 请求作用域的团队成员关系缓存（require_auth 填充；白名单路径为 None）
_membership_cv: ContextVar[TeamMember | None] = ContextVar("current_membership", default=None)
_user_cv: ContextVar[User | None] = ContextVar("current_request_user", default=None)


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


def _resolve_membership(request: Request, db: Session, user: User) -> TeamMember | None:
    """解析当前活动团队成员关系；不合法的 X-Team-Id 视为无团队上下文。"""
    cached = getattr(request.state, "current_membership", None)
    if cached is not None:
        return cached
    requested_team_id = request.headers.get("X-Team-Id")
    memberships = db.query(TeamMember).filter(TeamMember.user_id == user.id).all()
    if not memberships:
        return None
    membership: TeamMember | None = None
    if requested_team_id:
        try:
            requested = uuid.UUID(requested_team_id)
        except ValueError:
            return None
        membership = next((m for m in memberships if m.team_id == requested), None)
    if membership is None and user.last_active_team_id:
        membership = next((m for m in memberships if m.team_id == user.last_active_team_id), None)
    if membership is None:
        membership = memberships[0]
    request.state.current_membership = membership
    return membership


def _is_whitelisted(path: str) -> bool:
    return path in AUTH_WHITELIST_PATHS or path.startswith(AUTH_WHITELIST_PREFIXES)


def require_auth(request: Request, db: Session = Depends(get_db)) -> None:
    """全局认证锁：白名单放行，其余一律要求有效会话；并缓存团队上下文。"""
    if _is_whitelisted(request.url.path):
        return
    user = _resolve_user(request, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录或会话已过期",
        )
    membership = _resolve_membership(request, db, user)
    _membership_cv.set(membership)
    _user_cv.set(user)


def current_membership() -> TeamMember | None:
    """helper 内读取当前团队成员关系（require_auth 已解析；白名单路径为 None）。"""
    return _membership_cv.get()


def current_user() -> User | None:
    """helper 内读取当前登录用户（require_auth 已解析；白名单路径为 None）。"""
    return _user_cv.get()


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
    if requested_team_id:
        try:
            requested = uuid.UUID(requested_team_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="X-Team-Id 格式错误") from exc
        memberships = db.query(TeamMember).filter(TeamMember.user_id == user.id).all()
        membership = next((m for m in memberships if m.team_id == requested), None)
        if membership is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="不属于该团队")
    else:
        membership = _resolve_membership(request, db, user)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="尚未加入任何团队，请先创建或加入团队")
    # 缓存当前团队，供后续依赖复用
    request.state.current_team = db.get(Team, membership.team_id)
    return membership


# 路由注入别名：membership: TeamScope 即可获得当前团队成员关系
TeamScope = Annotated[TeamMember, Depends(get_current_membership)]


def ensure_repo_in_team(db: Session, repo, membership: TeamMember | None = None, not_found_detail: str = "仓库不存在"):
    """团队隔离校验：仓库不存在或属于其他团队时统一返回 404（不暴露资源存在性）。

    membership 缺省时从请求上下文（ContextVar）读取。
    """
    m = membership or current_membership()
    if m is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="尚未加入任何团队，请先创建或加入团队")
    if repo is None or repo.team_id != m.team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=not_found_detail)
    return repo
