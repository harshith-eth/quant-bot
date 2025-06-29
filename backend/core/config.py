"""
Configuration module for the quant-bot
"""
import os
from pydantic import BaseSettings


class Settings(BaseSettings):
    """Settings for the application"""
    # General
    DEBUG: bool = os.environ.get("DEBUG", "false").lower() == "true"
    
    # API Keys
    TWITTER_BEARER_TOKEN: str = os.environ.get("TWITTER_BEARER_TOKEN", "")
    HUGGINGFACE_API_KEY: str = os.environ.get("HUGGINGFACE_API_KEY", "")
    HELIUS_API_KEY: str = os.environ.get("HELIUS_API_KEY", "")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Singleton instance
settings = Settings()