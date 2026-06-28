from asistenq_license_client import AsistenQError, AsistenQLicenseClient, get_hwid


PRODUCT_SLUG = "vjstudio"


def main() -> None:
    client = AsistenQLicenseClient(product_slug=PRODUCT_SLUG)
    print(f"HWID tool ini: {get_hwid()}")

    token = input("Masukkan token lisensi: ").strip()
    try:
        activation = client.activate_license(token)
        print(f"Aktivasi: {activation.get('message', activation)}")

        result = client.require_valid_license(token)
        print(f"Lisensi valid. Status: {result.get('status')}")

        client.send_tool_event("license_verified", message="Example tool berhasil verifikasi lisensi")
    except AsistenQError as error:
        print(f"Lisensi gagal: {error}")
        client.send_tool_event("license_failed", message=str(error))


if __name__ == "__main__":
    main()
