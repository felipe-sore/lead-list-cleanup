---
name: lead-list-cleanup
description: >
  Clean, standardize, segment and safely enrich B2B prospect lists (CSV). Removes duplicates,
  fixes name casing, formats phones to E.164, maps messy headers (English, Portuguese, Spanish),
  segments contacts by seniority, flags generic and disposable emails, keeps one contact per
  company on request, and runs an integrity check after any LinkedIn or job title enrichment.
  Optional adapters for mailbox verification, WhatsApp lookup and company website metadata use
  the user's own providers. Use when the user shares a prospect list or asks to clean, dedupe,
  segment, validate or enrich leads.
---

# Lead list cleanup

You clean prospect lists so a sales or outbound team can use them the same day. The deterministic
work runs in `bin/lead-clean.js`. Your job is to understand the request, pick the right options,
run the script, handle the parts that need judgment (web enrichment), and explain the result.

## Ground rules

1. **Wrong data is worse than missing data.** Never fill a name, title or LinkedIn URL you are not
   sure about. Use the status columns instead (see "Confidence statuses").
2. **Flag, do not delete.** Generic mailboxes, disposable domains and invalid phones are flagged.
   Only true duplicates (and, when asked, extra contacts of the same company) are removed, and the
   report says why.
3. **Never overwrite the input.** Output goes to `<input>_clean.csv` and `<input>_report.md`.
4. **Ask before spending.** Any step that calls a paid or rate-limited service (mailbox
   verification, WhatsApp lookup, Firecrawl, web search in bulk) needs the user's explicit OK, with
   the expected volume.
5. **Secrets stay in environment variables.** Never write an API key into a file, a command you
   show, or the output.
6. **Clean up personal data.** Delete temporary files you created with phone numbers or emails
   when the job is done.

## First run: setup

On the first use in a project, check with the user:

- **Their market.** Review `config/` with them: `seniority.json` (titles in their languages),
  `role_prefixes.txt` and `disposable_domains.txt` (what counts as generic or disposable for
  them), `free_providers.txt`, `name_particles.txt` and, optionally, `first_names.txt`. These
  files are meant to be edited. `LEAD_CLEANUP_CONFIG_DIR` points to a custom copy.
- **Their providers** (all optional, see README "Providers"): `EMAIL_VERIFIER` for mailbox
  verification, `WHATSAPP_CHECK_URL` for WhatsApp lookup, `FIRECRAWL_API_KEY` for websites behind
  anti-bot walls. Without them, the offline checks still run.
- Run `npm install` once (one dependency: `libphonenumber-js`). Node 18 or newer.

## Workflow

1. **Inspect the file first.** Read the header row and a few lines. Confirm the delimiter, the
   columns and the country mix before choosing options.
2. **Translate the request into options.** Natural language maps to flags:

   | The user says | Run with |
   |---|---|
   | "remove duplicates", "clean this list" | defaults |
   | "one contact per company" | `--one-per-company` |
   | "split by seniority" | `--split-segments` |
   | phones without country code, single-country list | `--default-country XX` |
   | "check if the emails are real" | `--check-mx` (free), then `--verify-email` if configured and approved |
   | "which ones have WhatsApp" | `--check-whatsapp` (configured and approved) |
   | "add what the company does" | `--scrape` |

3. **Run** `node bin/lead-clean.js <input.csv> [options]`. For lists with hundreds of rows and any
   network step, run it in the background and report when done.
4. **Read the report** and check it against the request before answering.
5. **Answer** with: what was done, the numbers (in, removed by reason, out), what was flagged, and
   anything that needs a human decision (for example, name suggestions in `Notes`).

## Names from emails

The script fills a missing name from the email only when it is reliable:

- `anna.smith@` or `anna_smith@` (two or more tokens): First and Last Name are filled.
- `anna@` (one token): filled only if `anna` is in `config/first_names.txt`.
- `asmith@` (one token, not a known first name): nothing is filled. `Notes` gets a suggestion
  ("possible initial + last name Smith, not confirmed") for a human to confirm. Splitting it
  automatically breaks on names like `kieran` or `daniil`.

## LinkedIn and job title enrichment (web search)

The script does not search the web. When the user asks for LinkedIn URLs or current titles:

1. Search `"Full Name" "Company" linkedin` once per contact. The result snippet usually shows the
   current title.
2. Write `LinkedIn URL`, `LinkedIn Status`, `Enriched Title`, `Enriched Title Status`.
3. For 100+ contacts, delegate to a subagent with the input path, the status definitions below and
   an instruction to save progress to a CSV every N rows, so a stopped run can resume instead of
   starting over.
4. Stop when search engines start blocking or asking for CAPTCHA. Never try to bypass a CAPTCHA.
   Mark the remaining rows `not_searched` and tell the user.
5. **Always finish with the integrity check:**
   `node bin/lead-clean.js <enriched.csv> --integrity-only`. It finds the same "confirmed" URL on
   two different people (a merge shifted the results), keeps the URL only with the person whose
   name matches the profile slug, clears the others, and clears titles that do not mention the
   contact's own company.

## Confidence statuses

| status | meaning |
|---|---|
| `confirmed` | name and company clearly match in the source |
| `to_confirm` | plausible but ambiguous (common name, company not shown, several profiles) |
| `not_found` | searched, nothing reliable found |
| `not_searched` | the search did not run (limit or block). Not the same as `not_found` |

Never upgrade `to_confirm` to `confirmed` just because something was found.

## Output columns added

`Segment`, `Email Domain`, `Email Status` (`syntax_ok`, `domain_ok`, `no_mail_server`,
`invalid_syntax`, `disposable`, `missing`), `Generic Email`, `Disposable Email`, `Free Provider`,
`Phone Status` (`valid`, `invalid`, `missing`), `Notes`, and, when the matching step runs,
`Email Verification`, `WhatsApp`, `Company Info`, `Website Status`. Unknown input columns are kept
at the end, untouched.

## Responsible use

Prospect lists hold personal data. Process only lists the user has a lawful basis to use (GDPR,
LGPD, CAN-SPAM, and local rules), keep lookups proportional (verification, not continuous mass
scraping), respect websites' terms, and do not keep copies of the data outside the output files.
