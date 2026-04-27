#!/usr/bin/env python3
"""
Sales Dashboard — Local Server
Run: python server.py
Then open: http://localhost:8080
"""
import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080
if len(sys.argv) > 1:
    try:
        PORT = int(sys.argv[1])
    except ValueError:
        pass

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"  {self.address_string()} → {format % args}")

os.chdir(os.path.dirname(os.path.abspath(__file__)))

print(f"\n  Sales Dashboard")
print(f"  ───────────────────────────────")
print(f"  Running at: http://localhost:{PORT}")
print(f"  Press Ctrl+C to stop\n")

webbrowser.open(f"http://localhost:{PORT}")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
