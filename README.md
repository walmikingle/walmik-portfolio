# Walmik Ingle — Portfolio

An interactive, scroll-driven 3D portfolio built with vanilla JavaScript and Three.js.

## Highlights

- **WebGL background** — a tunnel of shader planes, wireframe solids and a particle
  field rendered on a fixed full-screen canvas. Scroll drives the camera dolly;
  the pointer drives parallax.
- **Monochrome design system** — black / white / grey palette, Bebas Neue display
  type, spring easing (`cubic-bezier(.34,1.56,.64,1)`) and pill buttons.
- **Theme-shifting scenes** — each section declares light or dark; the 3D scene
  lerps its colours to match as you scroll through.
- **Loader, full-screen frosted menu, scroll progress rail, reveal-on-scroll.**
- **Accessible & resilient** — honours `prefers-reduced-motion`, degrades to a CSS
  background if WebGL is unavailable, and pauses rendering on a hidden tab.

## Structure

```
index.html          markup + content
css/style.css       design system and layout
js/scene.js         Three.js WebGL layer
js/app.js           loader, scroll, themes, menu, reveals
vendor/three.min.js Three.js r152 (vendored so it runs offline)
```

## Running locally

Open `index.html` directly, or serve it:

```bash
npx serve .
```

## Deploying

Static site — no build step. On Vercel, import this repository and deploy with the
default settings (framework preset: **Other**, build command: none, output
directory: the repo root).

## Content

Sections are driven by the resume: About, Skills, Experience, Projects, Education,
Contact.
