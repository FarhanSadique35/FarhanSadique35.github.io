# Farhan Sadique portfolio

The portfolio is a static site. It runs locally with Python and has no package installation or build step. Open PowerShell in this folder and run:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Visit [http://127.0.0.1:8000/](http://127.0.0.1:8000/). Keep the terminal open while you preview, then press Ctrl+C to stop it. Use the HTTP address so JavaScript modules and image sampling load correctly.

- `index.html` holds the portfolio sections, images, and contact link. `experience.html` has the three role descriptions.
- `styles.css` contains the near-black theme, Instrument Serif and DM Sans, glass navigation, layouts, and fallback shapes.
- `site.js` handles the navigation, motion preferences, reveals, scroll effects, filter, and portrait viewer. Edit the `disciplines` and `skillSets` entries here when changing the interactive copy.
- `particles.js` renders the portrait and the two 2,400-point panels. Plan selects Structure, Teach selects Ripples, and Design selects Constellation.
- `assets/` holds the supplied photographs, artwork, favicon, and fonts. `portrait-signal.jpg` is the hero’s source image and static fallback. For live effects, use a same-origin image with a dark background and clear contrast.

Live effects start automatically on desktop and larger tablets when WebGL and motion are available. On compact touch screens, use **Enable live effects** to activate the portrait and both particle panels. **Motion Off** restores the static portrait and CSS shapes. The site also starts in static mode for visitors who prefer reduced motion.

The reference site’s filterable video section is represented here by a filterable portrait gallery and image viewer using the supplied photographs. The work cards use illustrations made from text and CSS and lead to the experience page.
