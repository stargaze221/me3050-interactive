# ME 3050 Interactive Explorers

Interactive web visualizations for **ME 3050 — Dynamic Modeling and Controls**.

The repository is designed as one static Netlify site with multiple explorer pages. Each explorer can be embedded independently in Canvas using its stable Netlify URL.

## Current structure

```text
me3050-interactive/
├── index.html
├── netlify.toml
└── linear-system/
    ├── index.html
    ├── styles.css
    └── app.js
```

## Linear System Explorer

Current sequence:

1. Input decomposition — sine wave approximated by midpoint rectangular pulses.
2. Single-pulse response — select one pulse and view its first-order response.
3. Superposition — sum all individual pulse responses and compare against the response to the summed pulse input.
4. Planned: pulse-to-impulse transition.
5. Planned: convolution sum to convolution integral.

System used in the current explorer:

```text
tau * y_dot(t) + y(t) = u(t)
```

## Netlify

Connect this repository to one Netlify site and publish the repository root. After connection, pushes to the production branch can automatically redeploy the site.

Typical page URLs will be:

```text
https://<site-name>.netlify.app/
https://<site-name>.netlify.app/linear-system/
```

The second URL can be embedded directly in a Canvas iframe.

## Editing

For the Linear System Explorer:

- `linear-system/index.html` — page text and structure
- `linear-system/styles.css` — typography, spacing, colors, layout
- `linear-system/app.js` — sliders, plots, system-response calculations, and interaction
