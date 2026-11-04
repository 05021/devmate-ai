import asyncio

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text

from app.api.routes import (
    action_drafts,
    auth,
    chat,
    ci,
    code_graph,
    conversations,
    evaluations,
    feedback,
    issues,
    knowledge,
    project_index,
    pull_requests,
    rag,
    repos,
    reports,
    search,
    skills,
    teams,
    webhooks,
    workspaces,
)
from app.api.deps import require_auth
from app.core.config import settings
from app.db.models import Base
from app.db.session import engine
from app.services.scheduler import periodic_repo_sync_loop
from app.services.rag.vector_store import MilvusUnavailableError


def _cors_origins() -> list[str]:
    return [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]


def _cors_origin_regex() -> str | None:
    if settings.app_env.lower() == "production":
        return None
    return r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"


def _migrate_legacy_data_to_default_team(db) -> None:
    """多团队改造的存量迁移：无归属的仓库/工作区/评测挂到默认团队。

    - 默认团队不存在时创建；若库中已有注册用户（含 email），其成为 Owner 成员
    - 幂等：重复启动不会产生重复团队或重复挂载
    """
    from app.db.models import EvalRun, Repository, Team, TeamMember, User, Workspace

    team = db.query(Team).order_by(Team.created_at.asc()).first()
    if team is None:
        owner_user = db.query(User).filter(User.email.isnot(None)).order_by(User.created_at.asc()).first()
        if owner_user is None:
            owner_user = db.query(User).order_by(User.created_at.asc()).first()
        team = Team(name="默认团队", created_by=owner_user.id if owner_user else None)
        db.add(team)
        db.flush()
        if owner_user is not None:
            db.add(TeamMember(team_id=team.id, user_id=owner_user.id, role="owner", invited_by=owner_user.id))

    migrated = 0
    orphan_repos = db.query(Repository).filter(Repository.team_id.is_(None)).all()
    for repo in orphan_repos:
        repo.team_id = team.id
        migrated += 1
    orphan_workspaces = db.query(Workspace).filter(Workspace.team_id.is_(None)).all()
    for workspace in orphan_workspaces:
        workspace.team_id = team.id
        migrated += 1
    orphan_evals = db.query(EvalRun).filter(EvalRun.team_id.is_(None)).all()
    for eval_run in orphan_evals:
        eval_run.team_id = team.id
        migrated += 1

    # 注册用户若无任何团队，挂入默认团队，保证登录后立即可用
    members_without_team = (
        db.query(User)
        .outerjoin(TeamMember, TeamMember.user_id == User.id)
        .filter(User.email.isnot(None), TeamMember.id.is_(None))
        .all()
    )
    for user in members_without_team:
        db.add(TeamMember(team_id=team.id, user_id=user.id, role="member"))
        migrated += 1

    if migrated:
        db.commit()


def create_app() -> FastAPI:
    # 全局认证锁：除白名单（登录/注册/健康检查/文档/webhook）外全部要求会话
    app = FastAPI(title=settings.app_name, version="0.1.0", dependencies=[Depends(require_auth)])

    @app.exception_handler(MilvusUnavailableError)
    async def milvus_unavailable_handler(_request, exc: MilvusUnavailableError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={"detail": str(exc), "service": "milvus", "status": "degraded"},
        )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_origin_regex=_cors_origin_regex(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(teams.router, prefix="/api/teams", tags=["teams"])
    app.include_router(repos.router, prefix="/api/repos", tags=["repos"])
    app.include_router(conversations.router, prefix="/api/repos", tags=["conversations"])
    app.include_router(workspaces.router, prefix="/api/workspaces", tags=["workspaces"])
    app.include_router(issues.router, prefix="/api", tags=["issues"])
    app.include_router(pull_requests.router, prefix="/api", tags=["pull_requests"])
    app.include_router(ci.router, prefix="/api", tags=["ci"])
    app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
    app.include_router(feedback.router, prefix="/api/chat/feedback", tags=["chat_feedback"])
    app.include_router(action_drafts.router, prefix="/api/action-drafts", tags=["action_drafts"])
    app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
    app.include_router(search.router, prefix="/api/search", tags=["search"])
    app.include_router(skills.router, prefix="/api/skills", tags=["skills"])
    app.include_router(knowledge.router, prefix="/api/repos", tags=["knowledge"])
    app.include_router(project_index.router, prefix="/api/repos", tags=["project_index"])
    app.include_router(rag.router, prefix="/api/rag", tags=["rag"])
    app.include_router(code_graph.router, prefix="/api", tags=["code_graph"])
    app.include_router(evaluations.router, prefix="/api/evals", tags=["evaluations"])
    app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "app": settings.app_name}

    @app.on_event("startup")
    async def create_demo_tables() -> None:
        # 课程项目默认自动建表；生产风格流程会在后续加入 Alembic 迁移。
        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)
        if "users" in inspector.get_table_names():
            columns = {column["name"] for column in inspector.get_columns("users")}
            with engine.begin() as connection:
                if "role" not in columns:
                    connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(80) DEFAULT 'owner'"))
                if "email" not in columns:
                    connection.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(320)"))
                if "username" not in columns:
                    connection.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR(80)"))
                if "password_hash" not in columns:
                    connection.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(200)"))
                if "public_code" not in columns:
                    connection.execute(text("ALTER TABLE users ADD COLUMN public_code VARCHAR(40)"))
                if "last_active_team_id" not in columns:
                    connection.execute(text("ALTER TABLE users ADD COLUMN last_active_team_id UUID"))
        if "repositories" in inspector.get_table_names():
            columns = {column["name"] for column in inspector.get_columns("repositories")}
            with engine.begin() as connection:
                if "provider" not in columns:
                    connection.execute(text("ALTER TABLE repositories ADD COLUMN provider VARCHAR(80) DEFAULT 'github'"))
                if "api_base_url" not in columns:
                    connection.execute(text("ALTER TABLE repositories ADD COLUMN api_base_url TEXT"))
                if "clone_url" not in columns:
                    connection.execute(text("ALTER TABLE repositories ADD COLUMN clone_url TEXT"))
                if "local_path" not in columns:
                    connection.execute(text("ALTER TABLE repositories ADD COLUMN local_path TEXT"))
                if "checkout_mode" not in columns:
                    connection.execute(text("ALTER TABLE repositories ADD COLUMN checkout_mode VARCHAR(80) DEFAULT 'managed'"))
                if "github_token_encrypted" not in columns:
                    connection.execute(text("ALTER TABLE repositories ADD COLUMN github_token_encrypted TEXT"))
                if "sync_metadata" not in columns:
                    connection.execute(text("ALTER TABLE repositories ADD COLUMN sync_metadata JSON"))
        for table_name, column_defs in {
            "repositories": [("team_id", "UUID")],
            "workspaces": [("team_id", "UUID")],
            "eval_runs": [("team_id", "UUID")],
        }.items():
            if table_name in inspector.get_table_names():
                columns = {column["name"] for column in inspector.get_columns(table_name)}
                with engine.begin() as connection:
                    for column_name, ddl in column_defs:
                        if column_name not in columns:
                            connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}"))
        # 多团队改造：repositories.full_name 从全局唯一改为 (team_id, full_name) 唯一
        # （两个团队可接入同一个 GitHub 仓库）；仅生产 PostgreSQL 存量库需要替换
        if (
            engine.dialect.name == "postgresql"
            and "repositories" in inspector.get_table_names()
            and "teams" in inspector.get_table_names()
        ):
            existing_columns = {column["name"] for column in inspector.get_columns("repositories")}
            if "team_id" in existing_columns:
                with engine.begin() as connection:
                    connection.execute(text(
                        "ALTER TABLE repositories DROP CONSTRAINT IF EXISTS repositories_full_name_key"
                    ))
                    connection.execute(text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_repositories_team_full_name "
                        "ON repositories (team_id, full_name)"
                    ))
        if "workflow_runs" in inspector.get_table_names():
            columns = {column["name"] for column in inspector.get_columns("workflow_runs")}
            if "jobs" not in columns:
                with engine.begin() as connection:
                    connection.execute(text("ALTER TABLE workflow_runs ADD COLUMN jobs JSON"))
        for table_name in ["code_symbols", "code_relations"]:
            if table_name in inspector.get_table_names():
                columns = {column["name"] for column in inspector.get_columns(table_name)}
                with engine.begin() as connection:
                    if "pr_id" not in columns:
                        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN pr_id UUID"))
                    if "pr_number" not in columns:
                        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN pr_number INTEGER"))
        for table_name in ["chat_messages", "chat_sessions", "agent_runs", "evidence_items"]:
            if table_name in inspector.get_table_names():
                columns = {column["name"] for column in inspector.get_columns(table_name)}
                if "conversation_id" not in columns:
                    with engine.begin() as connection:
                        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN conversation_id UUID"))
        for table_name in ["thread_memories", "conversation_memories"]:
            if table_name in inspector.get_table_names():
                columns = {column["name"] for column in inspector.get_columns(table_name)}
                for column_name in ["facts", "tasks", "user_preferences", "repo_context", "citations"]:
                    if column_name not in columns:
                        with engine.begin() as connection:
                            connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} JSON"))
        if "documents" in inspector.get_table_names():
            document_columns = {column["name"] for column in inspector.get_columns("documents")}
            if "embedding" in document_columns:
                with engine.begin() as connection:
                    connection.execute(text("ALTER TABLE documents DROP COLUMN embedding"))
        from app.db.session import SessionLocal
        from app.services.conversations import backfill_all_default_conversations
        from app.services.code_analysis import purge_legacy_code_documents
        from app.services.rag.vector_store import delete_milvus_documents, milvus_runtime_status

        db = SessionLocal()
        try:
            backfill_all_default_conversations(db)
            if purge_legacy_code_documents(db):
                db.commit()
            _migrate_legacy_data_to_default_team(db)
        finally:
            db.close()
        app.state.rag_vector_status = milvus_runtime_status()
        delete_milvus_documents(source_types=["code_file"], strict=False)
        if settings.auto_sync_enabled:
            app.state.repo_sync_task = asyncio.create_task(periodic_repo_sync_loop())

    @app.on_event("shutdown")
    async def stop_background_tasks() -> None:
        task = getattr(app.state, "repo_sync_task", None)
        if task:
            task.cancel()

    return app


app = create_app()
