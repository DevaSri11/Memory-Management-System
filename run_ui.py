import http.server
import socketserver
import webbrowser
import threading
import os
import sys

PORT = 8000

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Serve files from the directory where this script is located
        directory = os.path.dirname(os.path.abspath(__file__))
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, format, *args):
        # Suppress verbose standard logging to keep the console clean
        pass

def start_server():
    global PORT
    # Try to bind to PORT, incrementing it if it's already in use
    while True:
        try:
            # Use socket reuse to avoid "port already in use" errors during quick restarts
            socketserver.TCPServer.allow_reuse_address = True
            with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
                print(f"\n========================================================")
                print(f"[+] Custom Memory Allocator Visualizer is now active!")
                print(f"[+] Local Web Server: http://localhost:{PORT}")
                print(f"========================================================")
                print("[!] Press Ctrl+C in this terminal window to stop the server.\n")
                
                # Automatically open browser after a tiny delay
                url = f"http://localhost:{PORT}"
                threading.Timer(0.8, lambda: webbrowser.open(url)).start()
                
                httpd.serve_forever()
        except OSError:
            PORT += 1
        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    try:
        start_server()
    except KeyboardInterrupt:
        print("\nStopping visualizer web server. Goodbye!")
        sys.exit(0)
