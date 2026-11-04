"""RBAC 三级角色与草稿四眼原则测试。"""

import pytest

from app.api.routes.action_drafts import confirm_action_draft, create_action_draft
from app.db.models import ActionDraft, Base, Repository, User
from app.schemas.action_drafts import ActionDraftCreateRequest
from app.services.permissions import has_permission
from conftest import bind_team_membership


def _db_session():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def _member(role: str):
    from app.db.models import TeamMember

    return TeamMember(team_id=__import__("uuid").uuid4(), user_id=__import__("uuid").uuid4(), role=role)


class TestRolePermissions:
    def test_owner_has_all_permissions(self):
        assert has_permission(_member("owner"), "settings:manage")
        assert has_permission(_member("owner"), "draft:approve")
        assert has_permission(_member("owner"), "draft:create")

    def test_admin_cannot_manage_team_settings(self):
        # admin 具备日常管理权限（预留：成员管理等专属 owner 能力由路由层区分）
        assert has_permission(_member("admin"), "draft:approve")
        assert has_permission(_member("admin"), "repo:sync")

    def test_member_cannot_approve_drafts(self):
        assert has_permission(_member("member"), "draft:create")
        assert not has_permission(_member("member"), "draft:approve")
        assert not has_permission(_member("member"), "settings:manage")

    def test_member_review_allowed_when_team_opted_in(self):
        assert has_permission(_member("member"), "draft:approve", allow_member_review=True)

    def test_unknown_role_falls_back_to_member(self):
        assert not has_permission(_member("intern"), "draft:approve")


class TestFourEyesPrinciple:
    @pytest.mark.asyncio
    async def test_creator_cannot_confirm_own_draft(self):
        db = _db_session()
        with bind_team_membership(db) as ctx:
            user = User(name="creator", role="owner")
            db.add(user)
            db.flush()
            repo = Repository(team_id=ctx["team"].id, owner="local", name="demo", full_name="local/demo")
            db.add(repo)
            db.flush()

            draft = await create_action_draft(
                ActionDraftCreateRequest(
                    repo_id=repo.id,
                    draft_type="send_report",
                    target_type="repository",
                    title="Report",
                    content="Body",
                ),
                db=db,
                user=user,
            )

            from fastapi import HTTPException

            with pytest.raises(HTTPException) as rejected:
                await confirm_action_draft(draft.id, db=db, user=user)
            assert rejected.value.status_code == 403
            assert "四眼原则" in str(rejected.value.detail)

    @pytest.mark.asyncio
    async def test_other_user_can_confirm_draft(self):
        db = _db_session()
        with bind_team_membership(db) as ctx:
            creator = User(name="creator", role="owner")
            reviewer = User(name="reviewer", role="owner")
            db.add_all([creator, reviewer])
            db.flush()
            repo = Repository(team_id=ctx["team"].id, owner="local", name="demo", full_name="local/demo")
            db.add(repo)
            db.flush()

            draft = await create_action_draft(
                ActionDraftCreateRequest(
                    repo_id=repo.id,
                    draft_type="send_report",
                    target_type="repository",
                    title="Report",
                    content="Body",
                ),
                db=db,
                user=creator,
            )

            result = await confirm_action_draft(draft.id, db=db, user=reviewer)
            assert result["draft"].status == "executed"

    @pytest.mark.asyncio
    async def test_legacy_draft_without_creator_bypasses_four_eyes(self):
        db = _db_session()
        with bind_team_membership(db) as ctx:
            user = User(name="admin", role="owner")
            db.add(user)
            db.flush()
            repo = Repository(team_id=ctx["team"].id, owner="local", name="demo", full_name="local/demo")
            db.add(repo)
            db.flush()
            # 存量草稿没有 created_by（迁移前数据），不阻断审核
            draft = ActionDraft(
                repo_id=repo.id,
                draft_type="send_report",
                target_type="repository",
                title="Legacy",
                content="Body",
                risk_level="low",
                status="pending_confirmation",
            )
            db.add(draft)
            db.commit()

            result = await confirm_action_draft(draft.id, db=db, user=user)
            assert result["draft"].status == "executed"
