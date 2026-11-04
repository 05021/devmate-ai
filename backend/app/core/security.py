"""密码哈希、会话令牌与 GitHub token 加密。"""

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _derive_demo_key(secret: str) -> bytes:
    # Fernet 需要 urlsafe base64 编码的 32 字节密钥。
    # 这里的确定性本地开发派生方式适合课程项目，不适合生产环境。
    import base64
    import hashlib

    return base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())


def encrypt_token(token: str, secret: str) -> str:
    return Fernet(_derive_demo_key(secret)).encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_token(encrypted: str, secret: str) -> str | None:
    try:
        return Fernet(_derive_demo_key(secret)).decrypt(encrypted.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return None

SESSION_ALGORITHM = "HS256"


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def validate_password_strength(plain: str) -> str | None:
    """返回错误信息；None 表示通过。"""
    if len(plain) < 8:
        return "密码至少 8 位"
    if len(plain) > 128:
        return "密码过长"
    return None


def create_session_token(user_id: uuid.UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=settings.session_expire_days),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.session_secret, algorithm=SESSION_ALGORITHM)


def decode_session_token(token: str) -> uuid.UUID | None:
    """校验并解析会话令牌；无效/过期返回 None。"""
    try:
        payload = jwt.decode(token, settings.session_secret, algorithms=[SESSION_ALGORITHM])
    except jwt.PyJWTError:
        return None
    subject = payload.get("sub")
    if not subject:
        return None
    try:
        return uuid.UUID(subject)
    except ValueError:
        return None


def generate_public_code() -> str:
    """个人编号：DM- + 6 位数字，全局唯一由调用方查重保证。"""
    import random

    return f"DM-{random.randint(100000, 999999)}"


def generate_invite_code() -> str:
    """团队邀请码：8 位大写字母数字，去除易混淆字符。"""
    import secrets

    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))
