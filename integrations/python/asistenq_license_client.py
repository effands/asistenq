"""
Reusable AsistenQ license client for Python desktop tools.

Copy this file into any tool project, or import it from this folder while
developing locally. It uses only Python standard library modules.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional


DEFAULT_API_BASE = "http://127.0.0.1:3000/api"


class AsistenQError(RuntimeError):
    """Raised when AsistenQ API returns an error or cannot be reached."""


def get_hwid() -> str:
    raw = f"{platform.node()}-{platform.processor()}-{uuid.getnode()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16].upper()


def _default_cache_path(product_slug: str) -> Path:
    safe_slug = "".join(ch for ch in product_slug if ch.isalnum() or ch in ("-", "_")) or "tool"
    return Path.home() / ".asistenq" / f"{safe_slug}_license.json"


class AsistenQLicenseClient:
    def __init__(
        self,
        product_slug: str,
        api_base: Optional[str] = None,
        tool_event_secret: Optional[str] = None,
        timeout: int = 8,
        cache_path: Optional[Path] = None,
    ) -> None:
        self.product_slug = product_slug
        self.api_base = (api_base or os.environ.get("ASISTENQ_API_BASE") or DEFAULT_API_BASE).rstrip("/")
        self.tool_event_secret = tool_event_secret or os.environ.get("ASISTENQ_TOOL_EVENT_SECRET")
        self.timeout = timeout
        self.cache_path = cache_path or _default_cache_path(product_slug)

    def request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Any:
        url = f"{self.api_base}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json", "User-Agent": "AsistenQ-Python-Tool/1.0"}
        if self.tool_event_secret:
            headers["X-AsistenQ-Tool-Secret"] = self.tool_event_secret

        req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
                if not raw:
                    return {}
                content_type = response.headers.get("Content-Type", "")
                return raw if "text/plain" in content_type else json.loads(raw)
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(message)
                message = parsed.get("message", message)
            except json.JSONDecodeError:
                pass
            raise AsistenQError(f"AsistenQ API error {exc.code}: {message}") from exc
        except urllib.error.URLError as exc:
            raise AsistenQError(f"AsistenQ API unavailable: {exc.reason}") from exc

    def get_packages(self) -> List[Dict[str, Any]]:
        return self.request("GET", f"/license/packages?product={urllib.parse.quote(self.product_slug)}")

    def get_announcement(self) -> Dict[str, Any]:
        return self.request("GET", f"/license/announcement?product={urllib.parse.quote(self.product_slug)}")

    def get_banned(self) -> List[str]:
        response = self.request("GET", f"/license/banned?product={urllib.parse.quote(self.product_slug)}")
        if isinstance(response, str):
            return [line.strip().upper() for line in response.splitlines() if line.strip()]
        return []

    def activate_license(self, token: str, hwid: Optional[str] = None) -> Dict[str, Any]:
        return self.request("POST", "/license/activate", {
            "productSlug": self.product_slug,
            "token": token.strip(),
            "hwid": (hwid or get_hwid()).upper(),
        })

    def verify_license(self, token: str, hwid: Optional[str] = None) -> Dict[str, Any]:
        return self.request("POST", "/license/verify", {
            "productSlug": self.product_slug,
            "token": token.strip(),
            "hwid": (hwid or get_hwid()).upper(),
        })

    def send_tool_event(
        self,
        event_type: str,
        email: Optional[str] = None,
        hwid: Optional[str] = None,
        message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self.request("POST", "/tool-events", {
            "productSlug": self.product_slug,
            "eventType": event_type,
            "email": email,
            "hwid": (hwid or get_hwid()).upper(),
            "message": message,
            "metadata": metadata or {},
        })

    def load_cached_license(self) -> Dict[str, str]:
        if not self.cache_path.exists():
            return {}
        try:
            return json.loads(self.cache_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}

    def save_cached_license(self, token: str, email: str = "", hwid: Optional[str] = None) -> None:
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(json.dumps({
            "token": token.strip(),
            "email": email.strip(),
            "hwid": (hwid or get_hwid()).upper(),
            "savedAt": int(time.time()),
        }, indent=2), encoding="utf-8")

    def require_valid_license(self, token: Optional[str] = None, email: str = "", hwid: Optional[str] = None) -> Dict[str, Any]:
        resolved_hwid = (hwid or get_hwid()).upper()
        resolved_token = token or self.load_cached_license().get("token", "")
        if not resolved_token:
            raise AsistenQError("License token is required.")

        result = self.verify_license(resolved_token, resolved_hwid)
        if not result.get("valid"):
            raise AsistenQError(result.get("message") or "License is not valid.")

        self.save_cached_license(resolved_token, email=email, hwid=resolved_hwid)
        return result


def main() -> None:
    parser = argparse.ArgumentParser(description="AsistenQ reusable license client")
    parser.add_argument("--product", default=os.environ.get("ASISTENQ_PRODUCT", "vjstudio"))
    parser.add_argument("--api-base", default=os.environ.get("ASISTENQ_API_BASE", DEFAULT_API_BASE))
    parser.add_argument("--token", default="")
    parser.add_argument("--email", default="")
    parser.add_argument("--hwid", default=get_hwid())
    parser.add_argument("action", choices=["hwid", "packages", "banned", "announcement", "activate", "verify", "event"])
    args = parser.parse_args()

    client = AsistenQLicenseClient(product_slug=args.product, api_base=args.api_base)

    if args.action == "hwid":
        print(args.hwid)
    elif args.action == "packages":
        print(json.dumps(client.get_packages(), indent=2))
    elif args.action == "banned":
        print("\n".join(client.get_banned()))
    elif args.action == "announcement":
        print(json.dumps(client.get_announcement(), indent=2))
    elif args.action == "activate":
        print(json.dumps(client.activate_license(args.token, args.hwid), indent=2))
    elif args.action == "verify":
        print(json.dumps(client.verify_license(args.token, args.hwid), indent=2))
    elif args.action == "event":
        print(json.dumps(client.send_tool_event("test", email=args.email, hwid=args.hwid, message="Python client test"), indent=2))


if __name__ == "__main__":
    main()
