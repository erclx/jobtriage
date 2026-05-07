"""FastAPI HTTP layer wrapping the jobtriage Python tools."""

from jobtriage.api.app import app_factory

__all__ = ['app_factory']
