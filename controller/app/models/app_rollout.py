"""App Store rollouts: which app version each site runs, and the batches that change it."""
import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.models.types import EncryptedString


class SiteApp(Base):
    """What a site actually runs for one app, as last read from the site (or recorded by a rollout)."""
    __tablename__ = 'site_apps'
    __table_args__ = (UniqueConstraint('site_id', 'app_name'),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('sites.id', ondelete='CASCADE'), index=True)
    app_name: Mapped[str] = mapped_column(String(100), index=True)
    version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    commit: Mapped[str | None] = mapped_column(String(40), nullable=True)
    branch: Mapped[str | None] = mapped_column(String(120), nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AppRollout(Base):
    """One request to install or update an app on a chosen set of sites."""
    __tablename__ = 'app_rollouts'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_name: Mapped[str] = mapped_column(String(100), index=True)
    repo_url: Mapped[str] = mapped_column(String(255))
    branch: Mapped[str] = mapped_column(String(120))
    target_commit: Mapped[str] = mapped_column(String(40))
    target_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    action: Mapped[str] = mapped_column(String(10))                      # install | update
    status: Mapped[str] = mapped_column(String(12), default='running')   # running | completed | partial | failed
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # A private repository is fetched with the connected GitHub account on the worker, never inside the image.
    private: Mapped[bool] = mapped_column(default=False, server_default='false')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sites = relationship('AppRolloutSite', back_populates='rollout', cascade='all, delete-orphan', order_by='AppRolloutSite.site_slug')


class AppRolloutSite(Base):
    """The outcome of a rollout on one site."""
    __tablename__ = 'app_rollout_sites'
    __table_args__ = (UniqueConstraint('rollout_id', 'site_id'),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rollout_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('app_rollouts.id', ondelete='CASCADE'), index=True)
    site_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('sites.id', ondelete='CASCADE'), index=True)
    site_slug: Mapped[str] = mapped_column(String(48))
    status: Mapped[str] = mapped_column(String(10), default='pending')   # pending | running | success | failed | skipped
    step: Mapped[str | None] = mapped_column(String(200), nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    from_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    from_commit: Mapped[str | None] = mapped_column(String(40), nullable=True)
    to_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    to_commit: Mapped[str | None] = mapped_column(String(40), nullable=True)
    backup_stamp: Mapped[str | None] = mapped_column(String(32), nullable=True)
    rolled_back: Mapped[bool] = mapped_column(default=False, server_default='false')
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    log: Mapped[str | None] = mapped_column(Text, nullable=True)
    operation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rollout = relationship('AppRollout', back_populates='sites')


class GithubAccount(Base):
    """The GitHub account the platform uses for the App Store. At most one row; connecting again replaces it."""
    __tablename__ = 'github_accounts'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    login: Mapped[str] = mapped_column(String(100))
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    html_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    scopes: Mapped[str | None] = mapped_column(String(300), nullable=True)
    token: Mapped[str] = mapped_column(EncryptedString)
    connected_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    connected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
