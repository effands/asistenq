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
from typing import Any, Dict, List, Optional


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
DEFAULT_PRODUCT = os.environ.get("ASISTENQ_DEFAULT_PRODUCT", "vjstudio")
PLAN_CHOICES = ["1M", "3M", "6M", "12M", "LIFETIME"]


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
            return parse_json_response(raw, url)
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            message = json.loads(raw).get("message", raw)
        except json.JSONDecodeError:
            message = raw
        raise RuntimeError(f"API {error.code}: {message}") from error


def parse_json_response(raw: str, url: str) -> Any:
    if not raw or not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        preview = raw.replace("\n", " ").strip()[:160]
        raise RuntimeError(f"Respons bukan JSON dari {url}: {preview}") from error


def telegram(method: str, body: Optional[Dict[str, Any]] = None) -> Any:
    return request_json(f"https://api.telegram.org/bot{BOT_TOKEN}/{method}", "POST", body or {})


def api(path: str, method: str = "GET", body: Optional[Dict[str, Any]] = None) -> Any:
    return request_json(f"{API_BASE}{path}", method, body, {
        "x-asistenq-bot-secret": BOT_SECRET
    })


def keyboard(rows: List[List[Dict[str, str]]]) -> Dict[str, Any]:
    return {"inline_keyboard": rows}


def main_menu() -> Dict[str, Any]:
    return keyboard([
        [{"text": "📦 Order Pending", "callback_data": "orders"}, {"text": "✅ Cek Pembayaran", "callback_data": "orders"}],
        [{"text": "🔐 Buat/Kirim Lisensi", "callback_data": "license_menu"}],
        [{"text": "🚫 Ban HWID", "callback_data": "ban_start"}, {"text": "♻️ Unban HWID", "callback_data": "unban_menu"}],
        [{"text": "🎟️ Voucher", "callback_data": "voucher_menu"}, {"text": "📊 Status", "callback_data": "status"}],
        [{"text": "⚙️ Bantuan", "callback_data": "help"}],
    ])


def send(chat_id: int, text: str, reply_markup: Optional[Dict[str, Any]] = None) -> None:
    body: Dict[str, Any] = {"chat_id": chat_id, "text": text}
    if reply_markup:
        body["reply_markup"] = reply_markup
    telegram("sendMessage", body)


def answer_callback(callback_id: str) -> None:
    telegram("answerCallbackQuery", {"callback_query_id": callback_id})


def command_help() -> str:
    return (
        "AsistenQ License Bot\n\n"
        "Pakai tombol menu agar lebih cepat.\n\n"
        "Command cepat tetap tersedia:\n"
        "/status\n"
        "/orders\n"
        "/paid <invoice>\n"
        "/sendlicense <invoice> <HWID> [paket]\n"
        "/generate <produk> <paket> <email> <HWID>\n"
        "/activate <produk> <token> <HWID>\n"
        "/verify <produk> <token> <HWID>"
    )


def load_state() -> Dict[str, Any]:
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
    except (FileNotFoundError, ValueError, json.JSONDecodeError):
        pass
    return {"offset": 0, "pending": {}}


def save_state(state: Dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state), encoding="utf-8")


def set_pending(chat_id: int, action: Dict[str, Any]) -> None:
    state = load_state()
    pending = state.get("pending") if isinstance(state.get("pending"), dict) else {}
    pending[str(chat_id)] = action
    state["pending"] = pending
    save_state(state)


def pop_pending(chat_id: int) -> Optional[Dict[str, Any]]:
    state = load_state()
    pending = state.get("pending") if isinstance(state.get("pending"), dict) else {}
    action = pending.pop(str(chat_id), None)
    state["pending"] = pending
    save_state(state)
    return action if isinstance(action, dict) else None


def load_offset() -> int:
    return int(load_state().get("offset", 0))


def save_offset(offset: int) -> None:
    state = load_state()
    state["offset"] = offset
    save_state(state)


def format_status() -> str:
    summary = api("/bot/admin-summary")
    return (
        f"AsistenQ aktif\nProduk: {summary['products']}\n"
        f"Member: {summary['members']}\nOrder: {summary['orders']}\n"
        f"Lisensi: {summary.get('licenses', 0)}\n"
        f"Langganan aktif: {summary.get('activeSubscriptions', 0)}"
    )


def pending_orders() -> List[Dict[str, Any]]:
    return api("/bot/orders").get("orders", [])


def orders_keyboard(orders: List[Dict[str, Any]]) -> Dict[str, Any]:
    rows = []
    for order in orders[:10]:
        invoice = order.get("invoiceNumber") or order.get("id")
        total = order.get("formattedTotalAmount") or order.get("totalAmount") or "-"
        rows.append([{"text": f"{invoice} • {total}", "callback_data": f"order:{invoice}"}])
    rows.append([{"text": "⬅️ Menu Utama", "callback_data": "menu"}])
    return keyboard(rows)


def show_orders(chat_id: int) -> None:
    orders = pending_orders()
    if not orders:
        send(chat_id, "Belum ada order pending.", main_menu())
        return
    send(chat_id, "Pilih invoice yang mau diproses:", orders_keyboard(orders))


def find_order(invoice: str) -> Optional[Dict[str, Any]]:
    for order in pending_orders():
        if str(order.get("invoiceNumber")) == invoice:
            return order
    return None


def show_order_detail(chat_id: int, invoice: str) -> None:
    order = find_order(invoice)
    if not order:
        send(chat_id, f"Invoice {invoice} tidak ditemukan di pending order.", main_menu())
        return
    text = (
        f"Invoice: {invoice}\n"
        f"Member: {order.get('memberName') or '-'}\n"
        f"Email: {order.get('memberEmail') or '-'}\n"
        f"Produk: {order.get('productName') or '-'}\n"
        f"Total: {order.get('formattedTotalAmount') or '-'}\n"
        f"Batas bayar: {order.get('expiresAt') or '-'}"
    )
    send(chat_id, text, keyboard([
        [{"text": "✅ Tandai Paid", "callback_data": f"paid:{invoice}"}],
        [{"text": "🔐 Buat & Kirim Lisensi", "callback_data": f"license:{invoice}"}],
        [{"text": "⬅️ Order Pending", "callback_data": "orders"}, {"text": "🏠 Menu", "callback_data": "menu"}],
    ]))


def send_plan_choices(chat_id: int, invoice: str, hwid: str) -> None:
    rows = [[{"text": plan, "callback_data": f"sendlic:{invoice}:{hwid}:{plan}"}] for plan in PLAN_CHOICES]
    rows.append([{"text": "Pakai paket order", "callback_data": f"sendlic:{invoice}:{hwid}:"}])
    send(chat_id, "Pilih paket lisensi:", keyboard(rows))


def handle_pending_text(chat_id: int, text: str) -> bool:
    pending = pop_pending(chat_id)
    if not pending:
        return False
    action = pending.get("action")
    value = text.strip()
    if action == "await_license_hwid":
        invoice = str(pending.get("invoice"))
        if len(value) != 16 or not value.isalnum():
            send(chat_id, "HWID harus 16 karakter huruf/angka. Klik Buat/Kirim Lisensi lagi lalu masukkan HWID yang benar.", main_menu())
            return True
        send_plan_choices(chat_id, invoice, value)
        return True
    if action == "await_ban_hwid":
        if not value:
            send(chat_id, "HWID kosong. Silakan ulangi dari menu Ban HWID.", main_menu())
            return True
        result = api("/bot/ban-hwid", "POST", {"productSlug": DEFAULT_PRODUCT, "hwid": value, "reason": "Dari Telegram bot"})
        send(chat_id, f"HWID dibanned\nProduk: {DEFAULT_PRODUCT}\nHWID: {result.get('hwid', value)}", main_menu())
        return True
    return False


def handle_callback(chat_id: int, callback_id: str, data: str) -> None:
    answer_callback(callback_id)
    if data == "menu":
        send(chat_id, "Menu utama AsistenQ:", main_menu())
        return
    if data == "help":
        send(chat_id, command_help(), main_menu())
        return
    if data == "status":
        send(chat_id, format_status(), main_menu())
        return
    if data == "orders":
        show_orders(chat_id)
        return
    if data.startswith("order:"):
        show_order_detail(chat_id, data.split(":", 1)[1])
        return
    if data.startswith("paid:"):
        invoice = data.split(":", 1)[1]
        result = api("/bot/orders/paid", "POST", {"invoiceNumber": invoice})
        order = result["order"]
        send(chat_id, f"Order sudah ditandai paid\n{order.get('invoiceNumber')}\n{order.get('memberEmail')} | {order.get('formattedTotalAmount')}", keyboard([
            [{"text": "🔐 Buat & Kirim Lisensi", "callback_data": f"license:{invoice}"}],
            [{"text": "🏠 Menu", "callback_data": "menu"}],
        ]))
        return
    if data == "license_menu":
        orders = pending_orders()
        if not orders:
            send(chat_id, "Belum ada order pending untuk dibuatkan lisensi.", main_menu())
            return
        send(chat_id, "Pilih invoice untuk dibuatkan lisensi:", orders_keyboard(orders))
        return
    if data.startswith("license:"):
        invoice = data.split(":", 1)[1]
        set_pending(chat_id, {"action": "await_license_hwid", "invoice": invoice})
        send(chat_id, f"Kirim HWID member untuk invoice {invoice}.\nHWID harus 16 karakter huruf/angka.")
        return
    if data.startswith("sendlic:"):
        _, invoice, hwid, plan = data.split(":", 3)
        body = {"invoiceNumber": invoice, "hwid": hwid}
        if plan:
            body["planCode"] = plan
        result = api("/bot/license-send", "POST", body)
        send(chat_id, (
            "Lisensi sudah dibuat dan dikirim ke email member.\n"
            f"Invoice: {invoice}\nEmail: {result['email']}\nHWID: {result['hwid']}\nToken: {result['key']}"
        ), main_menu())
        return
    if data == "ban_start":
        set_pending(chat_id, {"action": "await_ban_hwid"})
        send(chat_id, f"Kirim HWID yang mau dibanned untuk produk {DEFAULT_PRODUCT}.")
        return
    if data == "unban_menu":
        banned = api("/bot/banned").get("bannedHwids", [])
        rows = []
        for item in banned[:20]:
            rows.append([{"text": f"{item.get('productSlug')} • {item.get('hwid')}", "callback_data": f"unban:{item.get('productSlug')}:{item.get('hwid')}"}])
        rows.append([{"text": "⬅️ Menu Utama", "callback_data": "menu"}])
        send(chat_id, "Pilih HWID yang mau di-unban:" if banned else "Belum ada HWID banned.", keyboard(rows))
        return
    if data.startswith("unban:"):
        _, product, hwid = data.split(":", 2)
        api("/bot/unban-hwid", "POST", {"productSlug": product, "hwid": hwid})
        send(chat_id, f"HWID sudah di-unban\nProduk: {product}\nHWID: {hwid}", main_menu())
        return
    if data == "voucher_menu":
        send(chat_id, "Menu voucher sudah disiapkan sebagai tahap berikutnya. Untuk sekarang voucher tetap lewat panel admin.", main_menu())
        return
    send(chat_id, command_help(), main_menu())


def handle(text: str) -> str:
    parts = text.strip().split()
    command = parts[0].split("@")[0].lower() if parts else "/help"
    if command in {"/start", "/help"}:
        return command_help()
    if command == "/status":
        return format_status()
    if command == "/orders":
        orders = pending_orders()
        if not orders:
            return "Belum ada order pending."
        lines = ["Order pending:"]
        for order in orders:
            expires = order.get("expiresAt") or "-"
            lines.append(
                f"{order['invoiceNumber']} | {order['productName']} | "
                f"{order['memberEmail']} | {order['formattedTotalAmount']} | batas {expires}"
            )
        return "\n".join(lines)
    if command == "/paid" and len(parts) == 2:
        result = api("/bot/orders/paid", "POST", {"invoiceNumber": parts[1]})
        order = result["order"]
        return f"Order paid\n{order.get('invoiceNumber')}\n{order.get('memberEmail')} | {order.get('formattedTotalAmount')}"
    if command == "/sendlicense" and len(parts) in {3, 4}:
        body = {"invoiceNumber": parts[1], "hwid": parts[2]}
        if len(parts) == 4:
            body["planCode"] = parts[3]
        result = api("/bot/license-send", "POST", body)
        return (
            "Lisensi dibuat dari invoice dan dikirim ke email member.\n"
            f"Invoice: {parts[1]}\nEmail: {result['email']}\nHWID: {result['hwid']}\nToken: {result['key']}"
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
                callback = update.get("callback_query")
                if callback:
                    message = callback.get("message") or {}
                    chat_id = int((message.get("chat") or {}).get("id", 0))
                    if str(chat_id) != OWNER_ID:
                        continue
                    try:
                        handle_callback(chat_id, str(callback.get("id", "")), str(callback.get("data", "")))
                    except Exception as error:
                        send(chat_id, f"Gagal: {error}", main_menu())
                    continue

                message = update.get("message") or {}
                chat_id = int((message.get("chat") or {}).get("id", 0))
                if str(chat_id) != OWNER_ID:
                    continue
                text = str(message.get("text", ""))
                try:
                    if handle_pending_text(chat_id, text):
                        continue
                    reply_markup = main_menu() if text.strip().split(" ")[0].split("@")[0].lower() in {"/start", "/help"} else None
                    send(chat_id, handle(text), reply_markup)
                except Exception as error:
                    send(chat_id, f"Gagal: {error}", main_menu())
        except Exception as error:
            print(f"Bot polling error: {error}", flush=True)
            time.sleep(5)


if __name__ == "__main__":
    main()
