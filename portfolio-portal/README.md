# Hariforreal Content Portal

A small standalone editor for the portfolio’s projects, songs, artists, and photographs.

It does not modify the live website. Content is stored in the browser’s local storage and can be exported or imported as JSON. To use it locally:

```bash
cd portfolio-portal
python3 -m http.server 8766
```

Open <http://localhost:8766>.

The exported JSON is the bridge to the website. The next integration step would be to have the portfolio read this JSON from a content repository or CMS, while keeping this editor separate from the public site.
