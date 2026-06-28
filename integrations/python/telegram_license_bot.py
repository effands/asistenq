"""Telegram operator bot for the AsistenQ licensing API.

No secret is stored in this file. Configure TELEGRAM_BOT_TOKEN,
TELEGRAM_OWNER_ID, and ASISTENQ_BOT_SECRET. When the bot is started from
the AsistenQ admin panel, those values are passed automatically.
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional


def local_deployment_settings() -> Dict[str, Any]:
    try:
        data = json.loads(Path("data/asistenq.json").read_text(encoding="utf-8"))
        return data.get("deploymentSettings", {})
    except (FileNotFoundError, ValueError, json.JSONDecodeError):
        return {}


LOCAL_SETTINGS = local_deployment_settings()
API_BASE = os.environ.get("ASISTENQ_API_BASE", "https://asistenq.com/api").rstrip("/")
BOT_TOKEN = (os.environ.get("TELEGRAM_BOT_TOKEN") or LOCAL_SETTINGS.get("telegramBotToken") or "").strip()
OWNER_ID = (os.environ.get("TELEGRAM_OWNER_ID") or LOCAL_SETTINGS.get("telegramOwnerId") or "").strip()
BOT_SECRET = (os.environ.get("ASISTENQ_BOT_SECRET") or LOCAL_SETTINGS.get("botApiSecret") or "").strip()
STATE_FILE = Path(os.environ.get("ASISTENQ_BOT_STATE", "data/telegram-bot-state.json"))


def request_json(url: str, method: str = "GET", body: Optional[Dict[str, Any]] = None,
                 headers: Optional[Dict[str, str]] = None) -> Any:
    payload = json.dumps(body).encode("utf-8") if body is not None else None
    request_headers = {"Accept": "application/json", **(headers or {})}
    if payload is not None:
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=payload, headers=request_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            message = json.loads(raw).get("message", raw)
        except json.JSONDecodeError:
            message = raw
        raise RuntimeError(f"API {error.code}: {message}") from error


def telegram(method: str, body: Optional[Dict[str, Any]] = None) -> Any:
    return request_json(f"https://api.telegram.org/bot{BOT_TOKEN}/{method}", "POST", body or {})


def api(path: str, method: str = "GET", body: Optional[Dict[str, Any]] = None) -> Any:
    return request_json(f"{API_BASE}{path}", method, body, {
        "x-asistenq-bot-secret": BOT_SECRET
    })


def send(chat_id: int, text: str) -> None:
    telegram("sendMessage", {"chat_id": chat_id, "text": text})


def command_help() -> str:
    return (
        "AsistenQ License Bot\n\n"
        "/status\n"
        "/generate <produk> <paket> <email> <HWID>\n"
        "/activate <produk> <token> <HWID>\n"
        "/verify <produk> <token> <HWID>\n\n"
        "Contoh:\n/generate vjstudio 1M pembeli@email.com ABCD1234EFGH5678"
    )


def handle(text: str) -> str:
    parts = text.strip().split()
    command = parts[0].split("@")[0].lower() if parts else "/help"
    if command in {"/start", "/help"}:
        return command_help()
    if command == "/status":
        summary = api("/bot/admin-summary")
        return (
            f"AsistenQ aktif\nProduk: {summary['products']}\n"
            f"Member: {summary['members']}\nOrder: {summary['orders']}\n"
            f"Lisensi: {summary.get('licenses', 0)}"
        )
    if command == "/generate" and len(parts) == 5:
        result = api("/bot/license-generate", "POST", {
            "productSlug": parts[1], "planCode": parts[2],
            "email": parts[3], "hwid": parts[4],
        })
        return f"Lisensi dibuat\n{result['key']}\nStatus: {result['status']}"
    if command in {"/activate", "/verify"} and len(parts) == 4:
        result = request_json(f"{API_BASE}/license/{command[1:]}", "POST", {
            "productSlug": parts[1], "token": parts[2], "hwid": parts[3],
        })
        return json.dumps(result, ensure_ascii=False)
    return "Format perintah tidak dikenali.\n\n" + command_help()


def validate_config() -> None:
    missing = [name for name, value in {
        "TELEGRAM_BOT_TOKEN": BOT_TOKEN,
        "TELEGRAM_OWNER_ID": OWNER_ID,
        "ASISTENQ_BOT_SECRET": BOT_SECRET,
    }.items() if not value]
    if missing:
        raise RuntimeError("Environment belum lengkap: " + ", ".join(missing))


def load_offset() -> int:
    try:
        return int(json.loads(STATE_FILE.read_text(encoding="utf-8")).get("offset", 0))
    except (FileNotFoundError, ValueError, json.JSONDecodeError):
        return 0


def save_offset(offset: int) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps({"offset": offset}), encoding="utf-8")


def main() -> None:
    validate_config()
    offset = load_offset()
    while True:
        try:
            query = urllib.parse.urlencode({"offset": offset, "timeout": 25})
            updates = request_json(f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates?{query}")
            for update in updates.get("result", []):
                offset = int(update["update_id"]) + 1
                save_offset(offset)
                message = update.get("message") or {}
                chat_id = int((message.get("chat") or {}).get("id", 0))
                if str(chat_id) != OWNER_ID:
                    continue
                try:
                    send(chat_id, handle(str(message.get("text", ""))))
                except Exception as error:  # Keep polling after an API error.
                    send(chat_id, f"Gagal: {error}")
        except Exception as error:
            print(f"Bot polling error: {error}", flush=True)
            time.sleep(5)


if __name__ == "__main__":
    main()
