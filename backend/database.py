"""
database.py — SQLAlchemy engine setup.

Reads DATABASE_URL from the .env file (Neon Postgres connection string).
SessionLocal is used as a dependency in route handlers via get_db().
Base is the declarative base that all ORM models inherit from.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# psycopg2 requires 'postgresql://' not 'postgres://' (Neon gives the latter).
# This fixes the scheme transparently so the .env works as-is from Neon.
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

# autocommit=False and autoflush=False are safe defaults for web request scoping.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
