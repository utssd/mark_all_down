#!/usr/bin/env python3
import signal
import threading
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8081


class ReusableHTTPServer(HTTPServer):
    allow_reuse_address = True


def shutdown_handler(server, _signum, _frame):
    print("\nShutting down...")
    threading.Thread(target=server.shutdown).start()


def main():
    server = ReusableHTTPServer(("", PORT), SimpleHTTPRequestHandler)
    signal.signal(signal.SIGINT, partial(shutdown_handler, server))
    print(f"Serving on http://localhost:{PORT}  (Ctrl+C to stop)")
    server.serve_forever()
    server.server_close()


if __name__ == "__main__":
    main()
