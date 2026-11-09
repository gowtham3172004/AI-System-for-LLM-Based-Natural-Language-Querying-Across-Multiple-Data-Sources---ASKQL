"""Dev tool: drive the preview UI with a real browser and save screenshots to ./ui_shots/ (git-ignored)."""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "ui_shots"
OUT.mkdir(exist_ok=True)
OK, FAIL = "http://localhost:8620", "http://localhost:8621"


def wait_idle(page, ms=900):
    page.wait_for_timeout(ms)
    page.wait_for_function("() => !document.querySelector('[data-testid=\"stStatusWidget\"]')", timeout=60000)
    page.wait_for_timeout(ms)


def main():
    problems = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))

        pg.goto(OK)
        pg.wait_for_selector("text=Ask your data", timeout=60000)
        wait_idle(pg)
        pg.screenshot(path=OUT / "01_landing.png", full_page=True)

        pg.get_by_role("button", name="Try the demo dataset").click()
        pg.wait_for_selector("text=What would you like to know?", timeout=60000)
        wait_idle(pg)
        pg.screenshot(path=OUT / "02_ask_empty.png")

        pg.get_by_role("button", name="Monthly revenue trend for completed orders").click()
        pg.wait_for_selector("text=Ask next", timeout=60000)
        wait_idle(pg, 1500)
        pg.screenshot(path=OUT / "03_answer_chart.png", full_page=True)

        pg.get_by_role("tab", name="Table").click()
        wait_idle(pg)
        pg.screenshot(path=OUT / "04_answer_table.png")

        box = pg.get_by_test_id("stChatInputTextArea")
        box.fill("How many orders and customers are there?")
        box.press("Enter")
        pg.wait_for_selector("text=Total Orders", timeout=60000)
        wait_idle(pg, 1500)
        pg.screenshot(path=OUT / "05_kpi.png", full_page=True)

        pg.get_by_role("radio", name="Explore data").click()
        wait_idle(pg)
        pg.screenshot(path=OUT / "06_explore.png", full_page=True)
        pg.get_by_role("radio", name="History").click()
        wait_idle(pg)
        pg.screenshot(path=OUT / "07_history.png")

        pg.get_by_role("button", name="Test connections").click()
        pg.wait_for_selector("text=working", timeout=60000)
        wait_idle(pg)
        pg.screenshot(path=OUT / "08_sidebar_check.png")

        pg.set_viewport_size({"width": 400, "height": 860})
        pg.get_by_role("radio", name="Ask").click()
        wait_idle(pg)
        pg.screenshot(path=OUT / "09_mobile.png")

        # ---- failing models: diagnostics
        pg2 = b.new_page(viewport={"width": 1440, "height": 900})
        pg2.goto(FAIL)
        pg2.wait_for_selector("text=Ask your data", timeout=60000)
        pg2.get_by_role("button", name="Try the demo dataset").click()
        pg2.wait_for_selector("text=What would you like to know?", timeout=60000)
        pg2.get_by_role("button", name="Top 5 customers by total spend").click()
        pg2.wait_for_selector("text=No AI model could answer right now", timeout=60000)
        wait_idle(pg2)
        pg2.screenshot(path=OUT / "10_error_diagnostics.png")
        pg2.get_by_role("button", name="Test connections").click()
        pg2.wait_for_selector("text=API key rejected", timeout=60000)
        wait_idle(pg2)
        pg2.screenshot(path=OUT / "11_error_check.png")
        body = pg2.inner_text("body")
        for need in ("API key rejected", "model not available"):
            if need not in body:
                problems.append(f"diagnostics missing: {need}")
        for leak in ("Invalid API Key", "NOT_FOUND"):
            if leak in body:
                problems.append(f"raw provider text leaked: {leak}")
        if errors:
            problems.append(f"browser JS errors: {errors[:3]}")
        b.close()
    print("PROBLEMS:", problems or "none")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
