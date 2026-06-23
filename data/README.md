# Data files

## Included in submission (safe to ship)

| File | Purpose |
|------|---------|
| `programs.csv` | Programme definitions |
| `modules.csv` | Module definitions |
| `program_module_associations.csv` | Programme–module links |

Load with:

```bash
python manage.py load_programmes
```

## Local only (not in Git — may contain PII)

Excel/CSV student and results exports used by `load_students`, `load_results`, and `update_employers`. Keep these on your machine only. Do not commit or zip them for submission.
