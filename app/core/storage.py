import os
import boto3
from pathlib import Path
from typing import Union
from botocore.exceptions import ClientError
from app.core.config import settings

class FileStorage:
    def __init__(self):
        # Read environment variables
        self.endpoint_url = os.getenv("S3_ENDPOINT_URL")
        self.access_key = os.getenv("S3_ACCESS_KEY_ID")
        self.secret_key = os.getenv("S3_SECRET_ACCESS_KEY")
        self.bucket_name = os.getenv("S3_BUCKET_NAME")
        self.region_name = os.getenv("S3_REGION_NAME", "us-east-1")
        
        self.use_s3 = bool(self.bucket_name and self.access_key and self.secret_key)
        
        self.s3_client = None
        if self.use_s3:
            try:
                self.s3_client = boto3.client(
                    "s3",
                    endpoint_url=self.endpoint_url,
                    aws_access_key_id=self.access_key,
                    aws_secret_access_key=self.secret_key,
                    region_name=self.region_name
                )
                print(f"[Storage] S3 Cloud Storage enabled. Bucket: {self.bucket_name}")
            except Exception as e:
                print(f"[Storage Error] Failed to initialize S3 client: {e}. Falling back to Local Storage.")
                self.use_s3 = False

    def upload_file(self, source_path: Union[str, Path], destination_key: str) -> str:
        """
        Uploads local file to S3 (if enabled) or moves/saves it locally.
        Returns the stored file path / key identifier.
        """
        source_path = Path(source_path)
        if not source_path.exists():
            raise FileNotFoundError(f"Source file not found: {source_path}")

        if self.use_s3 and self.s3_client:
            try:
                # Standardize destination key (forward slashes)
                s3_key = destination_key.replace("\\", "/")
                self.s3_client.upload_file(
                    Filename=str(source_path),
                    Bucket=self.bucket_name,
                    Key=s3_key
                )
                # Return s3 URI identifier
                return f"s3://{self.bucket_name}/{s3_key}"
            except ClientError as e:
                print(f"[Storage Error] S3 upload failed: {e}. Falling back to local.")
        
        # Local fallback: Copy/move file to local uploads directory matching key structure
        local_destination = Path("uploads") / destination_key
        local_destination.parent.mkdir(parents=True, exist_ok=True)
        
        # Write bytes
        local_destination.write_bytes(source_path.read_bytes())
        return str(local_destination)

    def download_file(self, stored_path: str, local_destination_path: Union[str, Path]) -> str:
        """
        Downloads a file from S3 (if path is an s3 URI) to local_destination_path.
        If the path is already a local file path, verifies it exists and returns it.
        """
        local_dest = Path(local_destination_path)
        local_dest.parent.mkdir(parents=True, exist_ok=True)

        if stored_path.startswith("s3://") and self.use_s3 and self.s3_client:
            try:
                # Parse s3://bucket/key
                raw_path = stored_path[5:]
                bucket, key = raw_path.split("/", 1)
                self.s3_client.download_file(
                    Bucket=bucket,
                    Key=key,
                    Filename=str(local_dest)
                )
                return str(local_dest)
            except Exception as e:
                print(f"[Storage Error] Failed to download {stored_path} from S3: {e}")
                raise e

        # Local fallback: If path exists, copy to destination or return it
        local_src = Path(stored_path)
        if local_src.exists():
            if local_src.resolve() != local_dest.resolve():
                local_dest.write_bytes(local_src.read_bytes())
            return str(local_dest)
            
        raise FileNotFoundError(f"Stored file path not found: {stored_path}")

    def delete_file(self, stored_path: str) -> bool:
        """Deletes file from S3 bucket or local disk."""
        if not stored_path:
            return False

        if stored_path.startswith("s3://") and self.use_s3 and self.s3_client:
            try:
                raw_path = stored_path[5:]
                bucket, key = raw_path.split("/", 1)
                self.s3_client.delete_object(Bucket=bucket, Key=key)
                return True
            except Exception as e:
                print(f"[Storage Error] Failed to delete {stored_path} from S3: {e}")
                return False

        # Local file delete
        try:
            path = Path(stored_path)
            if path.exists():
                path.unlink()
                return True
        except Exception:
            pass
        return False

# Export singleton
storage_provider = FileStorage()
