# ME 3050 Interactive Explorers

Interactive web visualizations for **ME 3050 — Dynamic Modeling and Controls**.

The repository is designed as one static Netlify site with multiple explorer pages. Each explorer can be embedded independently in Canvas using its stable Netlify URL.

## Current structure

```text
me3050-interactive/
├── index.html
├── netlify.toml
├── linear-system/
├── first-order-response/
├── second-order-response/
├── frequency-response/
├── state-space/
└── pid-control/
```

Each explorer directory contains its own `index.html`, `styles.css`, and `app.js` so page text, styling, and simulation logic can be edited independently.

## Explorer pages

### Linear System Explorer

Current sequence:

1. Input decomposition — sine wave approximated by midpoint rectangular pulses.
2. Single-pulse response — select one pulse and view its first-order response.
3. Superposition — sum all individual pulse responses and compare against the response to the summed pulse input.
4. Planned: pulse-to-impulse transition.
5. Planned: convolution sum to convolution integral.

### First-Order Response Explorer

Explores system gain, time constant, step amplitude, initial condition, steady-state response, and settling behavior.

### Second-Order Response Explorer

Explores natural frequency, damping ratio, damping regimes, transient-response metrics, and pole locations in the s-plane.

### Frequency Response Explorer

Connects first- and second-order transfer functions to Bode magnitude, phase, characteristic frequencies, resonance, and sinusoidal steady-state response.

### State-Space & Stability Explorer

Connects a second-order state model to the state matrix, eigenvalues, stability classification, phase-plane trajectories, and state time histories. The damping-ratio range includes negative damping so students can directly compare stable, marginal, and unstable dynamics.

### PID Control Explorer

Provides P, PI, PD, and PID tuning for a first-order plant. Students can compare steady-state error, overshoot, settling time, tracking response, and control effort.

## Netlify

Connect this repository to one Netlify site and publish the repository root. Pushes to the production branch automatically redeploy the site.

Typical page URLs are:

```text
https://<site-name>.netlify.app/
https://<site-name>.netlify.app/linear-system/
https://<site-name>.netlify.app/first-order-response/
https://<site-name>.netlify.app/second-order-response/
https://<site-name>.netlify.app/frequency-response/
https://<site-name>.netlify.app/state-space/
https://<site-name>.netlify.app/pid-control/
```

Any explorer URL can be embedded directly in a Canvas iframe.

## Editing

Within each explorer directory:

- `index.html` — page text and structure
- `styles.css` — typography, spacing, colors, and layout
- `app.js` — sliders, plots, calculations, and interaction

For larger changes, development can be done on a Git branch and merged to `main` only when ready, limiting production deploys while retaining Netlify preview capability.
