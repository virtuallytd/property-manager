from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://propertymanager:propertymanager@db:5432/propertymanager"
    secret_key: str = "change-me"

    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    upload_dir: str = "/app/uploads"

    # Admin seed user (created on first startup if no admin exists)
    admin_email: str = "admin@example.com"
    admin_password: str = "changeme123"
    admin_username: str = "admin"

    class Config:
        env_file = ".env"


settings = Settings()
