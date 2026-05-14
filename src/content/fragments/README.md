# Combo Page Fragments

Fragment YAML files supply the paragraph-level text blocks assembled into combination pages
(e.g. "Can a Ford Ranger tow a Jayco Journey 17.55-3?").

## Schema

Each YAML file contains a list of fragment objects:

```yaml
- id: string           # Unique identifier, kebab-case, never reuse
  tags:
    vehicle_body_type: ute | suv | wagon | van | troopcarrier | any
    caravan_size_class: small | medium | large | any
    gvm_headroom_range: 0-100kg | 0-200kg | 100-300kg | 200-500kg | 500kg+ | any
    axle_config: single | tandem | triple | any
  body: |
    The prose text block. 50–100 words. Plain text only — no markdown.
    The assembly engine inserts these verbatim, so write complete sentences.
```

### Tag semantics

All tag fields are optional. Omit a field (or set it to `any`) to match that fragment against
all values of that dimension. The combo page assembler picks the most-specific matching fragment
for each content slot.

### Size classes

| Class | ATM range |
|-------|-----------|
| small | ≤ 1,800 kg |
| medium | 1,801–2,800 kg |
| large | > 2,800 kg |

### GVM headroom ranges

These are the vehicle's available headroom (GVM minus loaded vehicle weight):

| Range | Meaning |
|-------|---------|
| 0-100kg | Very tight — likely over or at limit |
| 0-200kg | Tight — marginal for most caravans |
| 100-300kg | Moderate — workable with careful loading |
| 200-500kg | Comfortable |
| 500kg+ | Ample headroom |

## Adding New Fragments

1. Add a new entry to the appropriate YAML file (or create a new thematic file)
2. Give it a unique `id` (format: `frag-{topic}-{n:03d}`, e.g. `frag-gvm-001`)
3. Keep `body` between 50 and 100 words
4. Run `npm run build` to confirm no schema errors

## File Organisation

Split fragments into logical files by theme:

- `gvm-headroom.yml` — GVM headroom commentary
- `caravan-size.yml` — caravan size class commentary
- `axle-config.yml` — axle configuration commentary
- `general.yml` — catch-all fragments that apply broadly
