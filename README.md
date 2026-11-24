# Cookie Consent Banner

A CookieYes-style cookie consent banner. Frontend only — banner text and cookie categories are read from a local `config.json` file.

## Installation

Add this one line anywhere in your site's HTML (before `</body>` is a safe default):

```html
<script src="https://cookieconsentbanner.netlify.app/src/consent-widget.js"></script>
```

That's it. The script automatically loads its own stylesheet and `config.json` from the same folder it's served from — no other tags or setup needed.

## Customising banner text and cookie categories

Edit `src/config.json`:

- `banner.title`, `banner.message`, `banner.privacyPolicyUrl`, `banner.privacyPolicyText` — control the first-visit banner's text and link.
- `categories` — an array of cookie categories (Necessary, Functional, Analytics, Performance, Advertisement by default). Each category has:
  - `id` — a short internal key (used to store the visitor's choice)
  - `name`, `description` — shown in the Customise popup
  - `required` — set `true` only for categories that must always stay on (e.g. Necessary); these can't be toggled off
  - `cookies` — a list of `{ name, duration, description }` shown when a category is expanded

No code changes are needed to add, remove, or edit a category — the banner and popup render entirely from this file.

## How visitor choices are stored

The visitor's choice is saved as a single cookie (1-year expiry). Once saved, the banner won't show again — a small floating icon appears instead, which reopens the preferences popup at any time so the visitor can change their mind.

## Known limitations (not yet implemented)

- **Script blocking:** the planned mechanism for blocking tracking scripts (e.g. Google Analytics) until a category is allowed — via tagging scripts as `<script type="text/plain" data-category="analytics">` — has not been built yet. Currently, saving a consent choice only stores the preference; it does not yet start/stop any tracking scripts.
