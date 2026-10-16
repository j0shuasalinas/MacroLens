from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    supabase_url: str = ''
    supabase_anon_key: str = ''
    supabase_service_role_key: str = ''
    gemini_api_key: str = ''
    gemini_model: str = 'gemini-3.1-flash-lite'
    gemini_fallback_model: str = ''
    ai_provider: str = 'gemini'
    usda_api_key: str = ''
    cors_origins: str = 'http://localhost:8081'
    environment: str = 'development'

settings = Settings()
