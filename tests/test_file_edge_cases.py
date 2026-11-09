"""File ingestion edge cases: formats, types, NULLs, dates, headers, limits, hostile names."""
import io
import json
import time

import pandas as pd
import pytest

from askql.data import FileSource, UnsafeSQLError


def q(src, sql):
    return src.run_query(sql, 1000, 10).df


def test_tsv_semicolon_pipe_delimiters_autodetected():
    src = FileSource()
    src.add_file("a.tsv", b"x\ty\n1\t2\n")
    src.add_file("b.csv", b"x;y\n3;4\n")  # European CSV
    src.add_file("c.txt", b"x|y\n5|6\n")
    assert q(src, "SELECT x + y AS s FROM a").s[0] == 3
    assert q(src, "SELECT x + y AS s FROM b").s[0] == 7
    assert q(src, "SELECT x + y AS s FROM c").s[0] == 11


def test_json_array_json_lines_and_nested_values():
    src = FileSource()
    src.add_file("arr.json", json.dumps([{"a": 1, "n": {"k": 1}}, {"a": 2, "n": {"k": 2}}]).encode())
    src.add_file("lines.json", b'{"a": 1}\n{"a": 2}\n')
    assert q(src, "SELECT SUM(a) s FROM arr").s[0] == 3
    assert q(src, "SELECT SUM(a) s FROM lines").s[0] == 3
    assert q(src, "SELECT n FROM arr ORDER BY a").n[0] == '{"k": 1}'  # nested -> JSON text, not a crash


def test_parquet_roundtrip_keeps_types():
    buf = io.BytesIO()
    pd.DataFrame({"d": pd.to_datetime(["2024-01-05", "2024-02-10"]), "v": [1.5, None]}).to_parquet(buf)
    src = FileSource()
    src.add_file("p.parquet", buf.getvalue())
    df = q(src, "SELECT strftime(d, '%Y-%m') m, v FROM p ORDER BY d")
    assert df.m.tolist() == ["2024-01", "2024-02"] and pd.isna(df.v[1])


def test_nulls_empty_rows_and_empty_columns_dropped():
    src = FileSource()
    src.add_file("t.csv", b"a,b,c\n1,,\n,,\n3,x,\n")
    df = q(src, "SELECT * FROM t ORDER BY a")
    assert list(df.columns) == ["a", "b"] and len(df) == 2  # all-empty row and column removed
    assert q(src, "SELECT COUNT(*) c, COUNT(b) nn FROM t").to_dict("records") == [{"c": 2, "nn": 1}]


def test_duplicate_and_messy_headers():
    src = FileSource()
    src.add_file("t.csv", b"Name,Name,Order Date,,Total ($)\nA,B,2024-01-01,x,5\n")
    assert [c.name for c in src.tables()[0].columns] == ["name", "name_1", "order_date", "unnamed_3", "total"]


def test_iso_dates_are_typed_but_ambiguous_dates_stay_text():
    src = FileSource()
    src.add_file("t.csv", b"iso,us\n2024-03-04,03/04/2024\n2024-12-31,12/31/2024\n")
    types = {c.name: c.type for c in src.tables()[0].columns}
    assert "TIMESTAMP" in types["iso"] and types["us"] == "VARCHAR"  # never silently guess d/m vs m/d


def test_leading_zero_ids_survive_and_grouped_numbers_convert():
    src = FileSource()
    src.add_file("t.csv", b'zip,amount\n01234,"1,500.50"\n90210,"2,000"\n')
    assert q(src, "SELECT zip FROM t ORDER BY zip").zip.tolist() == ["01234", "90210"]
    assert q(src, "SELECT SUM(amount) s FROM t").s[0] == 3500.5


def test_excel_mixed_type_column_does_not_crash_and_blank_sheet_skipped():
    buf = io.BytesIO()
    with pd.ExcelWriter(buf) as xl:
        pd.DataFrame({"mix": [1, "two", 3.5, None], "ok": [1, 2, 3, 4]}).to_excel(xl, sheet_name="Data", index=False)
        pd.DataFrame().to_excel(xl, sheet_name="Blank", index=False)
    src = FileSource()
    assert src.add_file("b.xlsx", buf.getvalue()) == ["b_data"]
    assert q(src, "SELECT COUNT(mix) c FROM b_data").c[0] == 3


def test_join_across_files_and_sheets():
    buf = io.BytesIO()
    with pd.ExcelWriter(buf) as xl:
        pd.DataFrame({"id": [1, 2], "name": ["a", "b"]}).to_excel(xl, sheet_name="People", index=False)
        pd.DataFrame({"id": [1, 1, 2], "amt": [5, 6, 7]}).to_excel(xl, sheet_name="Sales", index=False)
    src = FileSource()
    src.add_file("book.xlsx", buf.getvalue())
    src.add_file("targets.csv", b"id,target\n1,10\n2,5\n")
    df = q(src, "SELECT p.name, SUM(s.amt) total, MAX(t.target) target FROM book_people p "
                "JOIN book_sales s USING (id) JOIN targets t USING (id) GROUP BY p.name ORDER BY p.name")
    assert df.to_dict("records") == [{"name": "a", "total": 11, "target": 10}, {"name": "b", "total": 7, "target": 5}]


def test_duplicate_table_names_get_suffix():
    src = FileSource()
    assert src.add_file("x.csv", b"a\n1\n") == ["x"]
    assert src.add_file("x.csv", b"a\n2\n") == ["x_2"]


@pytest.mark.parametrize("name", ["../../etc/passwd.csv", "..\\..\\windows\\system32\\x.csv", "/abs/path/data.csv"])
def test_hostile_filenames_are_only_names(name):
    src = FileSource()
    (table,) = src.add_file(name, b"a\n1\n")
    assert "/" not in table and "\\" not in table and ".." not in table


@pytest.mark.parametrize("name", ["evil.exe", "noext", "x.xls", "x.csv.exe", "x.zip"])
def test_unsupported_types_rejected(name):
    with pytest.raises(ValueError):
        FileSource().add_file(name, b"a\n1\n")


@pytest.mark.parametrize("name,content", [("e.csv", b""), ("h.csv", b"a,b\n"), ("b.xlsx", b"not a zip"),
                                          ("b.json", b"{broken"), ("b.parquet", b"nope")])
def test_corrupt_or_empty_files_give_clean_errors(name, content):
    with pytest.raises((ValueError, Exception)) as e:
        FileSource().add_file(name, content)
    assert "Traceback" not in str(e.value)


def test_row_cap_enforced():
    src = FileSource(max_rows_per_file=5)
    with pytest.raises(ValueError, match="more than"):
        src.add_file("big.csv", ("a\n" + "1\n" * 50).encode())
    src.add_file("ok.csv", b"a\n1\n2\n")


def test_memory_limit_setting_is_validated():
    with pytest.raises(ValueError):
        FileSource(memory_limit="1GB'; DROP TABLE x; --")


def test_query_timeout_actually_cancels():
    src = FileSource()
    src.add_file("t.csv", ("a\n" + "\n".join(map(str, range(3000))) + "\n").encode())
    start = time.time()
    with pytest.raises(TimeoutError):
        src.run_query("SELECT COUNT(*) FROM t a, t b, t c, t d", 10, 1)
    assert time.time() - start < 15
    assert q(src, "SELECT COUNT(*) c FROM t").c[0] == 3000  # connection still usable afterwards


def test_external_file_access_is_blocked_at_engine_level_too():
    src = FileSource()
    src.add_file("t.csv", b"a\n1\n")
    with pytest.raises(Exception, match="(?i)permission|external|disabled"):
        src._execute("SELECT * FROM read_csv('sample_data/orders.csv')", 10, 5)


def test_summary_statistics_and_preview_do_not_hold_full_data():
    src = FileSource()
    src.add_file("t.csv", ("a\n" + "\n".join(map(str, range(1000))) + "\n").encode())
    assert len(src.preview("t", 10**6)) == 200  # only a bounded preview lives in Python memory
    assert src.summary("t")["count"][0] == 1000
    with pytest.raises(KeyError):
        src.summary("nope")


def test_sql_injection_style_strings_in_data_are_just_data():
    src = FileSource()
    src.add_file("t.csv", b"name\n\"x'; DROP TABLE t; --\"\n")
    assert q(src, "SELECT COUNT(*) c FROM t").c[0] == 1
    with pytest.raises(UnsafeSQLError):
        src.run_query("SELECT 1; DROP TABLE t", 10, 5)
