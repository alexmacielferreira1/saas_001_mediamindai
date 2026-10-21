"""Protection against spreadsheet formula injection (CSV/XLSX exports).

Cells starting with ``= + - @``, tab or carriage return are interpreted as formulas
by Excel/LibreOffice/Sheets. Prefixing ``'`` makes them literal text. Apply to every
user-controlled value written into an exported spreadsheet.
"""

import csv
import io
from collections.abc import Iterable, Mapping
from typing import Any

FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def neutralize_formula(value: Any) -> Any:
    if isinstance(value, str) and value.startswith(FORMULA_PREFIXES):
        return f"'{value}"
    return value


def safe_csv_row(row: Mapping[str, Any]) -> dict[str, Any]:
    return {key: neutralize_formula(value) for key, value in row.items()}


def rows_to_safe_csv(fieldnames: list[str], rows: Iterable[Mapping[str, Any]]) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(safe_csv_row(row))
    return output.getvalue()
