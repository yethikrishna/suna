"""
Centralized database connection management for AgentPress using Supabase.
"""

from typing import Optional
from supabase import create_async_client, AsyncClient
from utils.logger import logger
from utils.config import config
import base64
import uuid
from datetime import datetime

class DBConnection:
    """Singleton database connection manager using Supabase."""
    
    _instance: Optional['DBConnection'] = None
    _initialized = False
    _client: Optional[AsyncClient] = None
    _dynamic_supabase_url: Optional[str] = None
    _dynamic_supabase_key: Optional[str] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """No initialization needed in __init__ as it's handled in __new__"""
        pass

    async def initialize(self, supabase_url: Optional[str] = None, supabase_key: Optional[str] = None):
        """Initialize the database connection.
        Allows overriding environment variables with provided parameters.
        """
        # If dynamic credentials are provided, store them and force re-initialization
        if supabase_url and supabase_key:
            self._dynamic_supabase_url = supabase_url
            self._dynamic_supabase_key = supabase_key
            self._initialized = False # Force re-initialization

        if self._initialized:
            return
                
        try:
            final_supabase_url = self._dynamic_supabase_url or config.SUPABASE_URL
            # Use service role key preferentially for backend operations, or dynamic key
            final_supabase_key = self._dynamic_supabase_key or config.SUPABASE_SERVICE_ROLE_KEY or config.SUPABASE_ANON_KEY
            
            if not final_supabase_url or not final_supabase_key:
                logger.error("Missing required environment variables or dynamic credentials for Supabase connection")
                raise RuntimeError("SUPABASE_URL and a key (SERVICE_ROLE_KEY or ANON_KEY) environment variables, or dynamic credentials, must be set.")

            logger.debug("Initializing Supabase connection")
            self._client = await create_async_client(final_supabase_url, final_supabase_key)
            self._initialized = True
            key_type = "DYNAMIC_KEY" if self._dynamic_supabase_key else ("SERVICE_ROLE_KEY" if config.SUPABASE_SERVICE_ROLE_KEY else "ANON_KEY")
            logger.debug(f"Database connection initialized with Supabase using {key_type}")
        except Exception as e:
            logger.error(f"Database initialization error: {e}")
            raise RuntimeError(f"Failed to initialize database connection: {str(e)}")

    @classmethod
    async def disconnect(cls):
        """Disconnect from the database."""
        if cls._client:
            logger.info("Disconnecting from Supabase database")
            await cls._client.close()
            cls._initialized = False
            logger.info("Database disconnected successfully")

    @property
    async def client(self) -> AsyncClient:
        """Get the Supabase client instance.
        Ensures initialization with dynamic credentials if they were set.
        """
        if not self._initialized or (self._dynamic_supabase_url and not self._client):
            logger.debug("Supabase client not initialized or dynamic credentials present, initializing now")
            await self.initialize(self._dynamic_supabase_url, self._dynamic_supabase_key)
        if not self._client:
            logger.error("Database client is None after initialization")
            raise RuntimeError("Database not initialized")
        return self._client

    async def upload_base64_image(self, base64_data: str, bucket_name: str = "browser-screenshots") -> str:
        """Upload a base64 encoded image to Supabase storage and return the URL.
        
        Args:
            base64_data (str): Base64 encoded image data (with or without data URL prefix)
            bucket_name (str): Name of the storage bucket to upload to
            
        Returns:
            str: Public URL of the uploaded image
        """
        try:
            # Remove data URL prefix if present
            if base64_data.startswith('data:'):
                base64_data = base64_data.split(',')[1]
            
            # Decode base64 data
            image_data = base64.b64decode(base64_data)
            
            # Generate unique filename
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_id = str(uuid.uuid4())[:8]
            filename = f"image_{timestamp}_{unique_id}.png"
            
            # Upload to Supabase storage
            client = await self.client
            storage_response = await client.storage.from_(bucket_name).upload(
                filename,
                image_data,
                {"content-type": "image/png"}
            )
            
            # Get public URL
            public_url = await client.storage.from_(bucket_name).get_public_url(filename)
            
            logger.debug(f"Successfully uploaded image to {public_url}")
            return public_url
            
        except Exception as e:
            logger.error(f"Error uploading base64 image: {e}")
            raise RuntimeError(f"Failed to upload image: {str(e)}")


