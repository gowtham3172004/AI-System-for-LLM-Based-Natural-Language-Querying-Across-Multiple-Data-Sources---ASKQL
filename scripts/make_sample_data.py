"""Generate a small, deterministic e-commerce dataset (CSV + Excel + SQLite)."""
from __future__ import annotations

import random
import sqlite3
from pathlib import Path

import pandas as pd

OUT = Path(__file__).resolve().parent.parent / "sample_data"
OUT.mkdir(exist_ok=True)
rng = random.Random(42)

regions = ["North", "South", "East", "West"]
categories = {"Electronics": (50, 900), "Home": (10, 250), "Fashion": (15, 180), "Books": (5, 40), "Sports": (12, 300)}

customers = pd.DataFrame(
    {
        "customer_id": range(1, 201),
        "name": [f"Customer {i}" for i in range(1, 201)],
        "region": [rng.choice(regions) for _ in range(200)],
        "signup_date": [pd.Timestamp("2023-01-01") + pd.Timedelta(days=rng.randint(0, 700)) for _ in range(200)],
        "tier": [rng.choices(["Free", "Pro", "Enterprise"], [6, 3, 1])[0] for _ in range(200)],
    }
)
products = pd.DataFrame(
    [
        {"product_id": i, "product_name": f"{cat} Item {i}", "category": cat, "unit_price": round(rng.uniform(*rng_), 2)}
        for i, (cat, rng_) in enumerate([(c, categories[c]) for c in categories for _ in range(8)], start=1)
    ]
)
rows = []
for oid in range(1, 1501):
    cust = rng.choice(customers["customer_id"].tolist())
    prod = products.sample(1, random_state=rng.randint(0, 10**6)).iloc[0]
    qty = rng.randint(1, 5)
    rows.append(
        {
            "order_id": oid,
            "customer_id": cust,
            "product_id": int(prod["product_id"]),
            "quantity": qty,
            "order_date": pd.Timestamp("2024-01-01") + pd.Timedelta(days=rng.randint(0, 540)),
            "status": rng.choices(["completed", "returned", "cancelled"], [85, 8, 7])[0],
            "total_amount": round(float(prod["unit_price"]) * qty, 2),
        }
    )
orders = pd.DataFrame(rows)

customers.to_csv(OUT / "customers.csv", index=False)
products.to_csv(OUT / "products.csv", index=False)
orders.to_csv(OUT / "orders.csv", index=False)
with pd.ExcelWriter(OUT / "shop.xlsx") as xl:
    customers.to_excel(xl, sheet_name="Customers", index=False)
    products.to_excel(xl, sheet_name="Products", index=False)
    orders.to_excel(xl, sheet_name="Orders", index=False)

db = OUT / "shop.db"
db.unlink(missing_ok=True)
con = sqlite3.connect(db)
con.executescript(
    """
    CREATE TABLE customers (customer_id INTEGER PRIMARY KEY, name TEXT, region TEXT, signup_date TEXT, tier TEXT);
    CREATE TABLE products (product_id INTEGER PRIMARY KEY, product_name TEXT, category TEXT, unit_price REAL);
    CREATE TABLE orders (order_id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(customer_id),
        product_id INTEGER REFERENCES products(product_id), quantity INTEGER, order_date TEXT, status TEXT, total_amount REAL);
    """
)
for name, df in (("customers", customers), ("products", products), ("orders", orders)):
    d = df.copy()
    for c in d.columns[d.dtypes.astype(str).str.startswith("datetime")]:
        d[c] = d[c].dt.strftime("%Y-%m-%d")
    d.to_sql(name, con, if_exists="append", index=False)
con.commit()
con.close()
print("Sample data written to", OUT)
