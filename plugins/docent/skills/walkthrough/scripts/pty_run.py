"""Run a shell command inside a pseudo-terminal of a given size and relay its output.

Usage: pty_run.py COLS ROWS COMMAND
Gives recorded commands a real TTY so they emit colors and progress output,
without needing a native Node module.
"""
import fcntl
import os
import pty
import struct
import sys
import termios

cols, rows, command = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]

pid, fd = pty.fork()
if pid == 0:
    try:
        fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    except OSError:
        pass
    # Use a shell that supports pipefail so a failing command is not hidden by a later pipe stage.
    shell = os.environ.get("SHELL") or ""
    if os.path.basename(shell) not in ("bash", "zsh"):
        shell = "/bin/bash" if os.path.exists("/bin/bash") else "/bin/sh"
    if os.path.basename(shell) in ("bash", "zsh"):
        command = "set -o pipefail\n" + command
    os.execvp(shell, [shell, "-c", command])

out = sys.stdout.buffer
while True:
    try:
        data = os.read(fd, 65536)
    except OSError:
        break
    if not data:
        break
    out.write(data)
    out.flush()

_, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status) % 256)
