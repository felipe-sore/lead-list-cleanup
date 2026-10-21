# lead-list-cleanup

![tests](https://github.com/felipe-sore/lead-list-cleanup/actions/workflows/test.yml/badge.svg)

A [Claude Code](https://docs.claude.com/en/docs/claude-code) skill plus a small Node.js CLI that turns a messy prospect export into a list an outbound team can use the same day.

The CLI does the deterministic work, so every run gives the same result. The skill tells the agent how to read the request, which options to use, how to enrich with web search without inventing data, and how to check its own work at the end.

## What it does

- **Maps messy headers** from CRM and spreadsheet exports in English, Portuguese and Spanish to one set of columns. Unknown columns are kept.
- **Removes duplicates** by email and by name plus company, and on request keeps **one contact per company** (the most senior one, then the one with a usable email and phone).
- **Fixes names**: `JOÃO DOS SANTOS` becomes `João dos Santos`, mixed case like `McDonald` is left alone, and a missing name is taken from the email only when it is reliable.
- **Formats phones to E.164** using the row's country (`Brasil`, `Brazil`, `BR` all work) or a default country.
- **Segments by seniority** from the job title (decision maker, management, coordination, individual contributor), with "Assistant to the CEO" correctly not treated as a decision maker.
- **Checks emails offline, no API key**: syntax, generic mailboxes (`info@`, `sales@`), disposable domains, free providers, and optionally whether the domain accepts mail (DNS MX).
- **Integrity check after enrichment**: when two contacts end up with the same "confirmed" LinkedIn URL, only the person whose name matches the profile keeps it. Built after this exact bug showed up in a real enrichment run.
- **Report** in Markdown: contacts in, removed by reason, out, and the distribution of every status.

## Quick start

```bash
git clone https://github.com/felipe-sore/lead-list-cleanup.git
cd lead-list-cleanup
npm install
node bin/lead-clean.js examples/sample_input.csv --one-per-company --default-country US
```

See [`examples/`](examples) for the input, the cleaned output and the report.

### Use it as a Claude Code skill

Copy or clone the folder into `~/.claude/skills/lead-list-cleanup/`, run `npm install` inside it, and ask Claude Code something like *"clean this list and keep one contact per company"*. The agent reads [`SKILL.md`](SKILL.md) and runs the CLI.

## Options

```
lead-clean <input.csv> [options]

  --out <file>             output CSV (default: <input>_clean.csv)
  --report <file>          report in Markdown (default: <input>_report.md)
  --one-per-company        keep only the most senior contact per company
  --default-country <XX>   ISO country for phones without country code (e.g. US, BR)
  --split-segments         also write one CSV per segment
  --check-mx               DNS check that each email domain accepts mail (no API key)
  --verify-email           mailbox verification through your provider
  --check-whatsapp         WhatsApp lookup through your gateway
  --scrape                 company title and description from each company domain
  --integrity-only         only run the LinkedIn/title cross-contamination check
```

## Make it yours: `config/`

Everything market-specific is a plain file you edit, not code:

| file | what it controls |
|---|---|
| `headers.json` | header aliases mapped to each column |
| `seniority.json` | title keywords per segment and their rank |
| `role_prefixes.txt` | what counts as a generic mailbox |
| `disposable_domains.txt` | disposable domains (starter list, swap in a maintained one) |
| `free_providers.txt` | personal email providers |
| `name_particles.txt` | particles kept lowercase (`da`, `van`, `del`...) |
| `first_names.txt` | optional first-name list to confirm `anna@`-style emails |

Set `LEAD_CLEANUP_CONFIG_DIR` to keep your own copy outside the repository.

## Providers (optional)

The offline checks need nothing. For deeper checks, plug in **your own** providers through environment variables. No key is ever stored in the repository.

| feature | variables |
|---|---|
| Mailbox verification, self-hosted [Reacher](https://github.com/reacherhq/check-if-email-exists) | `EMAIL_VERIFIER=reacher`, `REACHER_URL`, optional `REACHER_HEADER` |
| Mailbox verification, any HTTP API | `EMAIL_VERIFIER=http`, `EMAIL_VERIFIER_URL` (with `{email}`), `EMAIL_VERIFIER_HEADER`, `EMAIL_VERIFIER_FIELD` |
| WhatsApp lookup, any gateway | `WHATSAPP_CHECK_URL` (with `{phone}`), `WHATSAPP_CHECK_HEADER`, `WHATSAPP_CHECK_FIELD`, `WHATSAPP_CHECK_DELAY_MS` |
| Websites behind anti-bot walls | `FIRECRAWL_API_KEY` (otherwise a plain HTTP fetch is used) |

Example with a commercial verifier that answers `{"state": "deliverable"}`:

```bash
export EMAIL_VERIFIER=http
export EMAIL_VERIFIER_URL='https://api.your-provider.com/verify?email={email}'
export EMAIL_VERIFIER_HEADER='Authorization: Bearer <your key>'
export EMAIL_VERIFIER_FIELD=state
node bin/lead-clean.js leads.csv --check-mx --verify-email
```

## Design choices

- **Wrong data is worse than missing data.** Uncertain names go to `Notes` as suggestions; enrichment uses explicit statuses (`confirmed`, `to_confirm`, `not_found`, `not_searched`).
- **Flag, do not delete.** Only duplicates are removed, and every removal has a reason in the report.
- **One dependency** (`libphonenumber-js`). CSV parsing, DNS checks and tests use Node's standard library.
- **Adapters are injected**, so the tests never touch the network.

## Tests

```bash
npm test
```

Runs on Node 18, 20 and 22 in GitHub Actions on every push.

## Responsible use

Prospect lists hold personal data. Use lists you have a lawful basis to process (GDPR, LGPD, CAN-SPAM and local rules), keep lookups proportional, and respect websites' terms. Never bypass CAPTCHAs.

## About

Built by [Felipe Sore](https://linkedin.com/in/felipesore) with Claude Code. It started as the list-cleaning agent I use in my own outbound work and grew into a tested tool.
