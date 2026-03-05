#!/usr/bin/env python3
"""
Server tạm để chạy YouTube Tags Generator ở local.
Chạy: python server.py
Sau đó mở trình duyệt: http://localhost:8080
"""

import http.server
import socketserver
import webbrowser
import os

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        print(f"  [{self.address_string()}] {format % args}")

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 40)
        print("  YouTube Tags Generator")
        print("=" * 40)
        print(f"  Đang chạy tại: {url}")
        print("  Nhấn Ctrl+C để dừng")
        print("=" * 40)
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Server đã dừng.")
