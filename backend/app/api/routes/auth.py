"""认证与账号：注册 / 登录 / 登出 / 当前用户 / 改密 / 切换团队。"""

import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.deps import SESSION_COOKIE, get_current_user
from app.core.config import settings
from app.core.security import (
    create_session_token,
    generate_public_code,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.db.session import get_db
from app.db.models import Team, TeamMember, User

router = APIRouter()

MAX_LOGIN_ATTEMPTS = 5
LOGIN_LOCK_SECONDS = 900  # 15 分钟

# 进程内失败计数：{account: (fail_count, lock_until_ts)}；单进程部署足够，多实例部署应换 Redis
_login_failures: dict[str, tuple[int, float]] = {}


def _check_login_lock(account: str) -> None:
    entry = _login_failures.get(account)
    if entry and entry[0] >= MAX_LOGIN_ATTEMPTS and time.monotonic() < entry[1]:
        remaining = int((entry[1] - time.monotonic()) / 60) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"登录失败次数过多，请约 {remaining} 分钟后重试",
        )


def _record_login_failure(account: str) -> None:
    fail_count, lock_until = _login_failures.get(account, (0, 0.0))
    if time.monotonic() >= lock_until:
        fail_count = 0
    fail_count += 1
    lock_until = time.monotonic() + LOGIN_LOCK_SECONDS if fail_count >= MAX_LOGIN_ATTEMPTS else 0.0
    _login_failures[account] = (fail_count, lock_until)


def _clear_login_failures(account: str) -> None:
    _login_failures.pop(account, None)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    display_name: str | None = Field(default=None, max_length=200)
    # 可选：携带有效邀请码则注册后直接加入对应团队
    invite_code: str | None = Field(default=None, max_length=12)


class LoginRequest(BaseModel):
    account: str = Field(min_length=1, max_length=320)  # 用户名或邮箱
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)


class SwitchTeamRequest(BaseModel):
    team_id: uuid.UUID


def _unique_public_code(db: Session) -> str:
    for _ in range(20):
        code = generate_public_code()
        if not db.query(User).filter(User.public_code == code).first():
            return code
    raise HTTPException(status_code=500, detail="个人编号生成失败，请重试")


def _membership_payload(db: Session, user: User) -> list[dict]:
    rows = (
        db.query(TeamMember, Team)
        .join(Team, TeamMember.team_id == Team.id)
        .filter(TeamMember.user_id == user.id)
        .all()
    )
    return [
        {
            "team_id": str(team.id),
            "team_name": team.name,
            "role": member.role,
            "is_last_active": user.last_active_team_id == team.id,
        }
        for member, team in rows
    ]


def _user_payload(db: Session, user: User) -> dict:
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "name": user.name,
        "public_code": user.public_code,
        "last_active_team_id": str(user.last_active_team_id) if user.last_active_team_id else None,
        "memberships": _membership_payload(db, user),
    }


def _set_session_cookie(response: Response, user: User) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=create_session_token(user.id),
        max_age=settings.session_expire_days * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=settings.app_env.lower() == "production",
        path="/",
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> dict:
    error = validate_password_strength(payload.password)
    if error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error)
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该邮箱已注册")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该用户名已被占用")

    user = User(
        username=payload.username,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        name=payload.display_name or payload.username,
        public_code=_unique_public_code(db),
    )
    db.add(user)

    # 携带邀请码注册 → 直接加入对应团队
    joined_team: Team | None = None
    if payload.invite_code:
        joined_team = (
            db.query(Team)
            .filter(Team.invite_code == payload.invite_code.strip().upper())
            .first()
        )
        if joined_team is None:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="邀请码无效或已失效")
        db.add(TeamMember(team_id=joined_team.id, user_id=user.id, role="member"))
        user.last_active_team_id = joined_team.id

    db.commit()
    db.refresh(user)
    _set_session_cookie(response, user)
    return _user_payload(db, user)


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> dict:
    account = payload.account.strip().lower()
    _check_login_lock(account)
    user = db.query(User).filter((User.email == account) | (User.username == account.lower())).first()
    # 统一错误信息，不区分“账号不存在”与“密码错误”，避免账号枚举
    if user is None or not verify_password(payload.password, user.password_hash):
        _record_login_failure(account)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")
    _clear_login_failures(account)
    _set_session_cookie(response, user)
    return _user_payload(db, user)


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(key=SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return _user_payload(db, user)


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="原密码错误")
    error = validate_password_strength(payload.new_password)
    if error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error)
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}


@router.post("/switch-team")
def switch_team(
    payload: SwitchTeamRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    membership = (
        db.query(TeamMember)
        .filter(TeamMember.user_id == user.id, TeamMember.team_id == payload.team_id)
        .first()
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="不属于该团队")
    user.last_active_team_id = payload.team_id
    db.commit()
    return {"ok": True, "active_team_id": str(payload.team_id)}
