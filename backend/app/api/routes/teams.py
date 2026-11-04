"""团队：创建 / 加入（邀请码）/ 我的团队 / 成员列表。

一期范围：邀请链接与按编号搜索邀请在二期扩展，此处先提供邀请码通道。
"""

import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership, get_current_user
from app.core.security import generate_invite_code
from app.db.session import get_db
from app.db.models import Team, TeamMember, User

router = APIRouter()


class CreateTeamRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class JoinTeamRequest(BaseModel):
    invite_code: str = Field(min_length=4, max_length=12)


def _require_role(membership: TeamMember, roles: set[str], action: str) -> None:
    if membership.role not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"需要 {'/'.join(roles)} 权限才能{action}")


def _member_payload(db: Session, team_id) -> list[dict]:
    rows = (
        db.query(TeamMember, User)
        .join(User, TeamMember.user_id == User.id)
        .filter(TeamMember.team_id == team_id)
        .all()
    )
    return [
        {
            "user_id": str(user.id),
            "username": user.username,
            "name": user.name,
            "public_code": user.public_code,
            "role": member.role,
            "joined_at": member.created_at.isoformat() if member.created_at else None,
        }
        for member, user in rows
    ]


def _team_payload(team: Team, role: str) -> dict:
    return {
        "team_id": str(team.id),
        "team_name": team.name,
        "role": role,
        "allow_member_review": team.allow_member_review,
        "invite_code": team.invite_code,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_team(
    payload: CreateTeamRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    team = Team(name=payload.name.strip(), invite_code=generate_invite_code(), created_by=user.id)
    db.add(team)
    db.flush()
    db.add(TeamMember(team_id=team.id, user_id=user.id, role="owner", invited_by=user.id))
    user.last_active_team_id = team.id
    db.commit()
    db.refresh(team)
    return _team_payload(team, "owner")


@router.get("/me")
def my_teams(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = (
        db.query(TeamMember, Team)
        .join(Team, TeamMember.team_id == Team.id)
        .filter(TeamMember.user_id == user.id)
        .all()
    )
    return [_team_payload(team, member.role) for member, team in rows]


@router.post("/join")
def join_team(
    payload: JoinTeamRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    team = db.query(Team).filter(Team.invite_code == payload.invite_code.strip().upper()).first()
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="邀请码无效或已失效")
    existing = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team.id, TeamMember.user_id == user.id)
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="已是该团队成员")
    db.add(TeamMember(team_id=team.id, user_id=user.id, role="member"))
    user.last_active_team_id = team.id
    db.commit()
    return _team_payload(team, "member")


@router.get("/{team_id}/members")
def list_members(
    team_id: str,
    membership: TeamMember = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> list[dict]:
    if str(membership.team_id) != str(team_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="不属于该团队")
    return _member_payload(db, membership.team_id)


@router.post("/{team_id}/invite-code/rotate")
def rotate_invite_code(
    team_id: str,
    membership: TeamMember = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> dict:
    _require_role(membership, {"owner", "admin"}, "重置邀请码")
    if str(membership.team_id) != str(team_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="不属于该团队")
    team = db.get(Team, membership.team_id)
    team.invite_code = generate_invite_code()
    db.commit()
    return {"team_id": str(team.id), "invite_code": team.invite_code}
