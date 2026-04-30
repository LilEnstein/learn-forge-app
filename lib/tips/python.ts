export const pythonTips = [
  "Python lists are dynamic arrays — appending is amortized O(1) but insertion at index 0 is O(n).",
  "Use `enumerate()` instead of `range(len(x))` to get both index and value in a loop.",
  "`collections.defaultdict` prevents KeyError and removes the need for `if key not in dict` guards.",
  "List comprehensions are faster than equivalent for-loops because they avoid repeated attribute lookups.",
  "The walrus operator `:=` lets you assign and test in one expression: `if n := len(a): ...`",
  "f-strings (Python 3.6+) are faster than `.format()` and `%` formatting at runtime.",
  "`is` tests identity (same object), `==` tests equality (same value). Never use `is` for string comparison.",
  "`functools.lru_cache` turns a recursive function into a memoized one with one decorator line.",
  "Python's GIL means CPU-bound threads don't run in parallel — use `multiprocessing` for that.",
  "Generator expressions (`(x for x in y)`) are lazy — they compute values only when consumed.",
]
