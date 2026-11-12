"""
models.py — SQLAlchemy ORM models.

User  — stores credentials and role.
Task  — belongs to a User via user_id foreign key.

The 'role' column is the cornerstone of RBAC: it is set at signup time
and can only be changed directly in the database (no API endpoint promotes a
user to admin), satisfying the assignment requirement that new sign-ups always
get the normal 'user' role.
"""

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    # Role-Based Access Control (RBAC) field.
    # Default is 'user'. Only 'admin' bypasses user-isolation checks.
    # This value is embedded in the JWT payload so the backend can enforce
    # permissions without an extra DB round-trip on every request.
    role = Column(String, default="user", nullable=False)

    tasks = relationship("Task", back_populates="owner", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, default="")

    # Lifecycle status: 'pending' → 'in_progress' → 'done'
    status = Column(String, default="pending", nullable=False)

    # Foreign key that ties every task to exactly one user.
    # This is the data-isolation anchor: all CRUD endpoints filter by this column.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="tasks")
