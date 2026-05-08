# Internationalisation (i18n)

TravellingBuddy uses [next-intl](https://next-intl.dev) for all user-facing strings.

## Default locale

`en-AU` — Australian English. No additional locales at launch, but the infrastructure supports adding them.

## File structure

```
src/i18n/
  routing.ts           # Locale list, default locale, prefix strategy
  request.ts           # Per-request config (loads messages for the active locale)
  messages/
    en-AU.json         # Translation strings
```

## Adding a translation key

1. Add the key to `src/i18n/messages/en-AU.json` under the appropriate namespace.
2. Use it in a component:

**Server component (default):**

```tsx
import { useTranslations } from 'next-intl';

export default function MyComponent() {
  const t = useTranslations('namespace');
  return <p>{t('key')}</p>;
}
```

**Client component:**

```tsx
'use client';
import { useTranslations } from 'next-intl';

export default function MyClientComponent() {
  const t = useTranslations('namespace');
  return <button>{t('key')}</button>;
}
```

Client components receive messages via `NextIntlClientProvider` in the root layout.

## Message namespaces

- `common` — app-wide strings (name, tagline, generic labels)
- `navbar` — navigation labels
- `errors` — error messages

Add new namespaces as features are built (e.g. `calculator`, `profile`).

## Adding a new locale

1. Create `src/i18n/messages/{locale}.json` with all keys.
2. Add the locale to the `locales` array in `src/i18n/routing.ts`.
3. Update `localePrefix` strategy if locale-prefixed URLs are desired.
