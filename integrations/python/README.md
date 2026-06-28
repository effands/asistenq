# AsistenQ Python License Client

Folder ini berisi file Python reusable untuk menghubungkan tools desktop ke lisensi AsistenQ.

## Pakai Di Tool Baru

Copy `asistenq_license_client.py` ke folder tool baru, lalu import:

```python
from asistenq_license_client import AsistenQLicenseClient, get_hwid

client = AsistenQLicenseClient(product_slug="vjstudio")
result = client.require_valid_license("TOKEN_DARI_MEMBER_AREA")
print(result)
```

## Localhost

Saat development lokal:

```powershell
$env:ASISTENQ_API_BASE="http://127.0.0.1:3000/api"
python integrations/python/asistenq_license_client.py --product vjstudio packages
```

## Hosting

Saat sudah live, arahkan ke domain web AsistenQ:

```powershell
$env:ASISTENQ_API_BASE="https://domain-kamu.com/api"
```

## Telegram operator bot

`telegram_license_bot.py` mengelola lisensi melalui API AsistenQ, bukan database
terpisah. Salin `telegram-bot.env.example` menjadi file environment di server,
isi token baru dan Owner ID, lalu jalankan bot sebagai proses terpisah.

Kalau bot dijalankan dari panel admin, `ASISTENQ_BOT_SECRET` dibuat otomatis.
Token Telegram, bot secret, dan token GitHub tidak boleh disimpan di Git.

## Event Ke Web / Telegram

`send_tool_event()` mengirim event tool ke web AsistenQ. Token Telegram jangan ditaruh di tool desktop. Nanti web AsistenQ yang meneruskan event ke Telegram dari server.

Jika ingin endpoint event lebih aman, set env di server:

```bash
TOOL_EVENT_SECRET=isi-secret-panjang
```

Lalu di tool:

```powershell
$env:ASISTENQ_TOOL_EVENT_SECRET="isi-secret-panjang"
```
