import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).parents[1] / "integrations" / "python" / "telegram_license_bot.py"
SPEC = importlib.util.spec_from_file_location("telegram_license_bot", MODULE_PATH)
BOT = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(BOT)


class TelegramKeyboardMigrationTests(unittest.TestCase):
    def test_start_returns_only_a_short_menu_title(self):
        self.assertEqual(BOT.handle("/start"), "Pilih menu AsistenQ:")

    def test_help_keeps_the_command_reference(self):
        self.assertIn("Command cepat tetap tersedia:", BOT.handle("/help"))

    def test_recognizes_buttons_left_by_the_legacy_reply_keyboard(self):
        self.assertTrue(BOT.is_legacy_reply_button("📋 Daftar Voucher"))
        self.assertTrue(BOT.is_legacy_reply_button("➕ Tambah/Edit Voucher"))
        self.assertTrue(BOT.is_legacy_reply_button("❌ Hapus Voucher"))
        self.assertTrue(BOT.is_legacy_reply_button("⬅️ Kembali ke Pengaturan"))
        self.assertFalse(BOT.is_legacy_reply_button("/status"))

    def test_builds_telegram_markup_that_removes_the_legacy_keyboard(self):
        self.assertEqual(BOT.remove_legacy_keyboard(), {"remove_keyboard": True})


class TelegramCommerceTests(unittest.TestCase):
    def setUp(self):
        self.owner_id = BOT.OWNER_ID
        BOT.OWNER_ID = "87394692"

    def tearDown(self):
        BOT.OWNER_ID = self.owner_id

    def test_role_menu_hides_admin_actions_from_buyers(self):
        owner_labels = [button["text"] for row in BOT.menu_for("87394692")["inline_keyboard"] for button in row]
        buyer_labels = [button["text"] for row in BOT.menu_for("2002")["inline_keyboard"] for button in row]
        self.assertIn("➕ Tambah Produk", owner_labels)
        self.assertNotIn("🛍️ Lihat Produk", owner_labels)
        self.assertIn("🛍️ Lihat Produk", buyer_labels)
        self.assertNotIn("🚀 Update Website", buyer_labels)

    def test_api_sends_bot_secret_and_telegram_identity(self):
        with patch.object(BOT, "request_json", return_value={}) as request:
            BOT.api("/bot/buyer/products", telegram_id="2002")
        self.assertEqual(request.call_args.args[3]["x-telegram-user-id"], "2002")
        self.assertEqual(request.call_args.args[3]["x-asistenq-bot-secret"], BOT.BOT_SECRET)

    def test_registration_wizard_collects_name_email_and_whatsapp(self):
        state = {"action": "buyer_register", "step": "name", "values": {}}
        state = BOT.advance_registration(state, "Budi")
        state = BOT.advance_registration(state, "BUDI@example.com")
        state = BOT.advance_registration(state, "+62 812-3456-789")
        self.assertEqual(state["step"], "complete")
        self.assertEqual(state["values"]["email"], "budi@example.com")
        self.assertEqual(state["values"]["whatsapp"], "628123456789")

    def test_catalog_buttons_carry_product_and_plan_ids(self):
        products = [{"id": "p1", "name": "VJ Studio", "plans": [
            {"id": "plan3", "name": "3 Bulan", "formattedPrice": "Rp249.000"}
        ]}]
        markup = BOT.catalog_keyboard(products)
        self.assertEqual(markup["inline_keyboard"][0][0]["callback_data"], "buy:p1:plan3")

    def test_checkout_caption_contains_invoice_total_and_expiry(self):
        caption = BOT.checkout_caption({
            "invoiceNumber": "INV-1", "productName": "VJ Studio",
            "formattedAmount": "Rp249.000", "uniqueCode": 321,
            "formattedTotalAmount": "Rp249.321", "expiresAt": "2026-07-17T08:30:00.000Z"
        })
        self.assertIn("INV-1", caption)
        self.assertIn("Rp249.321", caption)
        self.assertIn("321", caption)

    def test_qris_data_url_decodes_to_png(self):
        self.assertEqual(BOT.decode_qris_data_url("data:image/png;base64,aGVsbG8="), b"hello")

    def test_buyer_callback_fetches_catalog_with_own_identity(self):
        products = [{"id": "p1", "name": "VJ Studio", "plans": []}]
        with patch.object(BOT, "answer_callback"), \
             patch.object(BOT, "api", return_value={"products": products}) as api, \
             patch.object(BOT, "send") as send:
            BOT.handle_callback(2002, "callback", "shop")
        api.assert_called_once_with("/bot/buyer/products", telegram_id="2002")
        self.assertEqual(send.call_args.args[2], BOT.catalog_keyboard(products))

    def test_buy_callback_uploads_decoded_qris_bytes(self):
        order = {
            "invoiceNumber": "INV-1", "product": {"name": "VJ Studio"},
            "formattedAmount": "Rp249.000", "uniqueCode": 321,
            "formattedTotalAmount": "Rp249.321", "expiresAt": "2026-07-17T08:30:00.000Z",
            "paymentQrUrl": "data:image/png;base64,aGVsbG8="
        }
        with patch.object(BOT, "answer_callback"), \
             patch.object(BOT, "api", return_value=order) as api, \
             patch.object(BOT, "send_photo_bytes") as upload:
            BOT.handle_callback(2002, "callback", "buy:p1:plan3")
        api.assert_called_once_with(
            "/bot/buyer/checkout", "POST", {"productId": "p1", "planId": "plan3"}, telegram_id="2002"
        )
        self.assertEqual(upload.call_args.args[1], b"hello")


if __name__ == "__main__":
    unittest.main()
