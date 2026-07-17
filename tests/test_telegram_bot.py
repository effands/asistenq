import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "integrations" / "python" / "telegram_license_bot.py"
SPEC = importlib.util.spec_from_file_location("telegram_license_bot", MODULE_PATH)
BOT = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(BOT)


class TelegramKeyboardMigrationTests(unittest.TestCase):
    def test_recognizes_buttons_left_by_the_legacy_reply_keyboard(self):
        self.assertTrue(BOT.is_legacy_reply_button("📋 Daftar Voucher"))
        self.assertTrue(BOT.is_legacy_reply_button("➕ Tambah/Edit Voucher"))
        self.assertTrue(BOT.is_legacy_reply_button("❌ Hapus Voucher"))
        self.assertTrue(BOT.is_legacy_reply_button("⬅️ Kembali ke Pengaturan"))
        self.assertFalse(BOT.is_legacy_reply_button("/status"))

    def test_builds_telegram_markup_that_removes_the_legacy_keyboard(self):
        self.assertEqual(BOT.remove_legacy_keyboard(), {"remove_keyboard": True})


if __name__ == "__main__":
    unittest.main()
