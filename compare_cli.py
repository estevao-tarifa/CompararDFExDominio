import json
import sys
from pathlib import Path

from comparison_engine import compare_files


if len(sys.argv) != 4:
    raise SystemExit("Uso: compare_cli.py <dominio> <dfe> <saida.pdf>")

summary = compare_files(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
print(json.dumps(summary, ensure_ascii=False))
