from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Language used for invoice OCR
INVOICE_LANG = "eng"

# Backend URL (for use by frontend if needed)
BACKEND_URL = "http://localhost:5000"


class ApplicationConfig:
    SECRET_KEY = os.environ.get("SECRET_KEY", "default-secret-key")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = True
    SQLALCHEMY_DATABASE_URI = os.environ.get("SQLALCHEMY_DATABASE_URI", "sqlite:///local.db")
    SESSION_TYPE = "sqlalchemy"
    SESSION_PERMANENT = True
