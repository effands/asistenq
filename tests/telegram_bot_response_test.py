import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path(__file__).resolve().parents[1] / "integrations" / "python" / "telegram_license_bot.py"
spec = importlib.util.spec_from_file_location("telegram_license_bot", MODULE_PATH)
bot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bot)


class TelegramBotResponseTest(unittest.TestCase):
    def test_http_timeout_is_longer_than_telegram_poll_timeout(self):
        self.assertGreater(bot.HTTP_TIMEOUT_SECONDS, bot.TELEGRAM_POLL_TIMEOUT_SECONDS)

    def test_parse_json_response_reports_non_json_body(self):
        with self.assertRaises(RuntimeError) as error:
            bot.parse_json_response("<html>Cannot GET /api/bot/orders</html>", "https://asistenq.com/api/bot/orders")

        self.assertIn("Respons bukan JSON", str(error.exception))
        self.assertIn("/api/bot/orders", str(error.exception))

    def test_parse_json_response_allows_empty_body(self):
        self.assertEqual(bot.parse_json_response("", "https://api.telegram.org/test"), {})

    def test_main_menu_includes_deploy_update_action(self):
        menu = bot.main_menu()
        buttons = [button for row in menu["inline_keyboard"] for button in row]

        self.assertIn({"text": "🚀 Update Website", "callback_data": "deploy_update"}, buttons)

    def test_deploy_command_calls_bot_deploy_endpoint(self):
        calls = []
        original_api = bot.api
        try:
            def fake_api(path, method="GET", body=None, timeout=bot.HTTP_TIMEOUT_SECONDS):
                calls.append((path, method, body, timeout))
                return {"message": "Update selesai. NodeJS akan restart otomatis."}

            bot.api = fake_api

            reply = bot.handle("/deployupdate")
        finally:
            bot.api = original_api

        self.assertEqual(calls, [("/bot/deploy-update", "POST", None, bot.DEPLOY_HTTP_TIMEOUT_SECONDS)])
        self.assertIn("Update selesai", reply)

    def test_generate_command_reads_direct_license_response(self):
        original_api = bot.api
        try:
            bot.api = lambda *_args, **_kwargs: {"license": {"key": "TOKEN-1", "status": "generated"}, "reused": False}
            reply = bot.handle("/generate vjstudio 1M buyer@example.com CA00E2C30BA61C8D")
        finally:
            bot.api = original_api
        self.assertIn("TOKEN-1", reply)


if __name__ == "__main__":
    unittest.main()
