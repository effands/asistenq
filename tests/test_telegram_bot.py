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

    def test_payment_photo_is_submitted_and_forwarded_to_owner(self):
        with patch.object(BOT, "load_state", return_value={"offset": 0, "pending": {"2002": {"action": "await_payment_proof", "invoice": "INV-1"}}}), \
             patch.object(BOT, "save_state"), patch.object(BOT, "api", return_value={"invoiceNumber": "INV-1"}) as api, \
             patch.object(BOT, "send_photo") as photo, patch.object(BOT, "send"):
            handled = BOT.handle_pending_photo(2002, [{"file_id": "small"}, {"file_id": "large"}])
        self.assertTrue(handled)
        api.assert_called_once_with("/bot/buyer/payment-proof", "POST", {"invoiceNumber": "INV-1", "fileId": "large"}, telegram_id="2002")
        self.assertEqual(str(photo.call_args.args[0]), "87394692")
        self.assertEqual(photo.call_args.args[1], "large")

    def test_paid_hwid_state_uses_buyer_fulfillment_route(self):
        state = {"action": "await_paid_hwid", "invoice": "INV-1"}
        with patch.object(BOT, "pop_pending", return_value=state), patch.object(BOT, "api", return_value={"email": "b@example.com", "hwid": "ABCDEF1234567890", "key": "KEY", "expiresAt": None}) as api, patch.object(BOT, "send"):
            self.assertTrue(BOT.handle_pending_text(2002, "ABCDEF1234567890"))
        api.assert_called_once_with("/bot/buyer/orders/INV-1/hwid", "POST", {"hwid": "ABCDEF1234567890"}, telegram_id="2002")

    def test_download_approval_renders_url_button_for_buyer(self):
        result = {"order": {"invoiceNumber": "INV-D"}, "buyerTelegramId": "2002", "fulfillmentType": "download", "download": {"downloadUrl": "https://asistenq.com/api/download/token", "expiresAt": "tomorrow", "remainingDownloads": 3}}
        with patch.object(BOT, "answer_callback"), patch.object(BOT, "api", return_value=result), patch.object(BOT, "send") as send:
            BOT.handle_callback(87394692, "cb", "proof_ok:INV-D")
        buyer_call = next(call for call in send.call_args_list if str(call.args[0]) == "2002")
        self.assertEqual(buyer_call.args[2]["inline_keyboard"][0][0]["url"], result["download"]["downloadUrl"])

    def test_owner_product_wizard_reaches_confirmation(self):
        state = BOT.new_product_state()
        for value in ["Mixer Pro", "mixer-pro", "license", "Mixer audio", "1M", "1 Bulan", "59000", "30", "draft"]:
            state = BOT.advance_product_wizard(state, value)
        self.assertEqual(state["step"], "confirm")
        self.assertEqual(state["values"]["plan"]["price"], 59000)

    def test_safe_error_hides_secrets_and_server_paths(self):
        message = BOT.safe_error(RuntimeError(r"token=secret C:\home\app stack trace"))
        self.assertEqual(message, "Operasi gagal. Silakan coba lagi atau hubungi admin.")


if __name__ == "__main__":
    unittest.main()
