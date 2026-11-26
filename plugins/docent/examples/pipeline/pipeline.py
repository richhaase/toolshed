"""Tiny Orders: a three-stage pipeline that turns raw orders into daily totals."""
import csv
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
REGIONS = {"north", "south"}


def extract(path):
    """Read raw order rows exactly as they arrived."""
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def validate(rows):
    """Split rows into ones we can trust and ones we set aside, with a reason."""
    good, rejected = [], []
    for row in rows:
        try:
            amount = float(row["amount"])
        except ValueError:
            rejected.append({**row, "reason": "amount is not a number"})
            continue
        if amount <= 0:
            rejected.append({**row, "reason": "amount must be positive"})
        elif row["region"] not in REGIONS:
            rejected.append({**row, "reason": "unknown region"})
        else:
            good.append({**row, "amount": amount})
    return good, rejected


def aggregate(rows):
    """Sum order amounts per day and region."""
    totals = defaultdict(float)
    for row in rows:
        totals[(row["day"], row["region"])] += row["amount"]
    return [
        {"day": day, "region": region, "total": f"{total:.2f}"}
        for (day, region), total in sorted(totals.items())
    ]


def write(path, rows, fields):
    path.parent.mkdir(exist_ok=True)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main():
    rows = extract(HERE / "data" / "orders.csv")
    good, rejected = validate(rows)
    write(HERE / "out" / "daily_totals.csv", aggregate(good), ["day", "region", "total"])
    write(HERE / "out" / "rejects.csv", rejected, ["order_id", "day", "region", "amount", "reason"])
    print(f"read {len(rows)} orders: {len(good)} loaded, {len(rejected)} rejected")
    return 0


if __name__ == "__main__":
    sys.exit(main())
