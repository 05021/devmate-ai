"""基于团队角色的权限检查（一期 RBAC）。

角色来源：TeamMember.role（owner / admin / member），由全局认证锁
require_auth 解析并缓存到请求上下文。旧的全局 User.role 不再参与鉴权。
"""

from collections.abc import Callable

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import current_membership, current_user
from app.db.models import AuditLog, TeamMember, User
from app.db.session import get_db

# 团队角色 → 权限集合（四眼原则：member 默认无 draft:approve）
TEAM_ROLE_PERMISSIONS: dict[str, set[str]] = {
    "owner": {"repo:read", "repo:sync", "agent:run", "draft:create", "draft:approve", "eval:read", "settings:manage"},
    "admin": {"repo:read", "repo:sync", "agent:run", "draft:create", "draft:approve", "eval:read", "settings:manage"},
    "member": {"repo:read", "agent:run", "draft:create", "eval:read"},
}


def has_permission(membership: TeamMember, permission: str, *, allow_member_review: bool = False) -> bool:
    if permission in TEAM_ROLE_PERMISSIONS.get(membership.role or "member", set()):
        return True
    # 团队开启互审时，member 也可审核草稿（四眼原则另行限制）
    if permission == "draft:approve" and allow_member_review:
        return True
    return False


def require_permission(permission: str) -> Callable:
    def dependency(request: Request, db: Session = Depends(get_db)) -> User:
        user = current_user()
        if user is None:
            user = _resolve_user_fallback(request, db)
        membership = current_membership()
        if membership is None:
            raise HTTPException(status_code=403, detail="尚未加入任何团队，请先创建或加入团队")
        team = getattr(request.state, "current_team", None)
        allow_review = bool(team.allow_member_review) if team is not None else False
        if not has_permission(membership, permission, allow_member_review=allow_review):
            raise HTTPException(status_code=403, detail=f"需要权限：{permission}")
        return user

    return dependency


def _resolve_user_fallback(request: Request, db: Session) -> User:
    """require_permission 独立于 require_auth 使用时的兜底（正常请求已缓存）。"""
    from app.core.security import decode_session_token
    from app.api.deps import SESSION_COOKIE

    token = request.cookies.get(SESSION_COOKIE)
    user_id = decode_session_token(token) if token else None
    user = db.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(status_code=401, detail="未登录或会话已过期")
    return user


def write_audit_log(
    db: Session,
    *,
    user: User | None,
    repo_id=None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    status: str = "success",
    request_json: dict | None = None,
    result_json: dict | None = None,
) -> AuditLog:
    row = AuditLog(
        user_id=user.id if user else None,
        repo_id=repo_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        status=status,
        request_json=request_json or {},
        result_json=result_json or {},
    )
    db.add(row)
    db.flush()
    return row
