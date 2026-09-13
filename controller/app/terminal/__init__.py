"""Isolated WebSocket service for the SSH terminal (xterm.js) feature.

Runs as its own process (ws_terminal_main.py), separate from the main
gunicorn app -- see app/terminal/auth.py's docstring for why. Never touches
the main app's WSGI/worker model.
"""
