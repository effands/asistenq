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


if __name__ == "__main__":
    unittest.main()
