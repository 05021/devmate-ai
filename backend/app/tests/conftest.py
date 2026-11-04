"""共享测试基建。

`bind_team_membership`：直调路由/service 函数的测试没有 HTTP 层 require_auth，
用本上下文管理器把“当前团队成员关系”绑定到请求上下文（ContextVar），
并在退出时还原，避免测试间状态泄漏。
"""

import contextlib
import uuid

from app.api import deps
from app.db.models import Team, TeamMember, User


@contextlib.contextmanager
def bind_team_membership(db, *, role: str = "owner", user: User | None = None, team: Team | None = None):
    """创建（或复用）用户/团队/成员关系，并绑定到当前请求上下文。"""
    user = user or User(
        name="tester",
        email=f"tester-{uuid.uuid4().hex[:8]}@test.dev",
        username=f"tester-{uuid.uuid4().hex[:8]}",
        password_hash="x",
        public_code=f"DM-{uuid.uuid4().hex[:6].upper()}",
    )
    db.add(user)
    db.flush()
    team = team or Team(name=f"测试团队-{uuid.uuid4().hex[:6]}")
    db.add(team)
    db.flush()
    member = TeamMember(team_id=team.id, user_id=user.id, role=role)
    db.add(member)
    db.flush()
    # 绑定脱离 session 的瞬态副本：避免后续 commit 使实例过期后
    # 上下文读取触发 DetachedInstanceError
    bound_member = TeamMember(team_id=team.id, user_id=user.id, role=role)
    membership_token = deps._membership_cv.set(bound_member)
    user_token = deps._user_cv.set(user)
    try:
        yield {"user": user, "team": team, "member": bound_member}
    finally:
        deps._membership_cv.reset(membership_token)
        deps._user_cv.reset(user_token)
