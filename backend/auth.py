"""
auth.py — JWT authentication and role enforcement.

Flow:
  1. User POSTs credentials to /auth/login.
  2. Backend verifies password, creates a JWT containing {sub: email, role: role}.
  3. Every subsequent request carries that JWT as 'Authorization: Bearer <token>'.
  4. get_current_user() decodes the token and returns the User row from the DB.
  5. require_admin() calls get_current_user() first, then checks role == 'admin'.
     If not, it raises HTTP 403 — the route handler never executes.

Why embed role in the JWT?
  Avoids an extra DB query on every request. The trade-off is that if a user's
  role is changed in the DB their old token stays valid until it expires (30 min).
  For this scope that is acceptable; production would use short-lived tokens or
  a token blacklist.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
from models import User

load_dotenv()

# --- Configuration ---------------------------------------------------------

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# bcrypt is intentionally slow (work factor ~12 rounds) to resist brute-force.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Tells FastAPI where to look for the token and shows the lock icon in /docs.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# --- Password helpers -------------------------------------------------------

def hash_password(plain: str) -> str:
    """Return bcrypt hash of a plain-text password. Never store plain text."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time comparison to prevent timing attacks."""
    return pwd_context.verify(plain, hashed)


# --- JWT helpers ------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT.

    'data' should contain at least {"sub": email, "role": role}.
    The token is signed with SECRET_KEY using HS256 so the server can verify
    it without storing session state (stateless auth).
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# --- FastAPI dependencies ---------------------------------------------------

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Decode the JWT and return the authenticated User from the database.

    Raises HTTP 401 if:
    - The token is missing or malformed.
    - The token signature is invalid (tampered).
    - The token has expired.
    - The email in the token doesn't match any DB user.

    This is attached to every protected endpoint via Depends(get_current_user).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Role-enforcement dependency for admin-only endpoints.

    INTERVIEW EXPLANATION:
    ----------------------
    This function is used as a FastAPI dependency on any route that should be
    restricted to admin users:

        @app.get("/admin/tasks")
        def admin_tasks(admin: User = Depends(require_admin)):
            ...

    FastAPI resolves `require_admin` before the route handler runs. If the user's
    role is not 'admin', we raise HTTP 403 Forbidden here and the route body is
    NEVER executed — not even partially. This guarantees that:
      - A regular user who calls the endpoint directly (e.g., via curl or Postman)
        gets a 403, regardless of what the frontend shows or hides.
      - Role enforcement lives entirely on the backend; the frontend is cosmetic.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user
