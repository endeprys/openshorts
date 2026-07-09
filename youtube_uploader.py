import os
import json
import time
import httpx
import urllib.parse

YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.upload"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"


def get_oauth_url(client_id: str, redirect_uri: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": YOUTUBE_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{AUTH_URL}?{urllib.parse.urlencode(params)}"


def exchange_code(client_id: str, client_secret: str, code: str, redirect_uri: str):
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }
    with httpx.Client() as client:
        resp = client.post(TOKEN_URL, data=data)
        resp.raise_for_status()
        return resp.json()


def refresh_access_token(client_id: str, client_secret: str, refresh_token: str):
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    with httpx.Client() as client:
        resp = client.post(TOKEN_URL, data=data)
        resp.raise_for_status()
        return resp.json()


def upload_video(
    file_path: str,
    access_token: str,
    title: str,
    description: str = "",
    privacy_status: str = "public",
    tags: list = None,
) -> dict:
    file_size = os.path.getsize(file_path)

    metadata = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags or [],
        },
        "status": {
            "privacyStatus": privacy_status,
            "selfDeclaredMadeForKids": False,
        },
    }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": str(file_size),
        "X-Upload-Content-Type": "video/mp4",
    }

    with httpx.Client() as client:
        # Step 1: Initiate resumable upload
        print(f"📤 Initiating YouTube upload: {title}")
        init_resp = client.post(
            f"{UPLOAD_URL}?uploadType=resumable&part=snippet,status",
            headers=headers,
            content=json.dumps(metadata).encode("utf-8"),
        )
        init_resp.raise_for_status()

        upload_url = init_resp.headers.get("Location")
        if not upload_url:
            raise Exception("No upload URL returned by YouTube API")

        # Step 2: Upload video binary
        print(f"📤 Uploading video data ({file_size} bytes)...")
        with open(file_path, "rb") as f:
            video_data = f.read()

        upload_headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "video/mp4",
            "Content-Length": str(file_size),
        }

        upload_resp = client.put(upload_url, headers=upload_headers, content=video_data)
        upload_resp.raise_for_status()

        result = upload_resp.json()
        video_id = result.get("id", "")
        print(f"✅ YouTube upload complete! Video ID: {video_id}")

        return result
