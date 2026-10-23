# KnowMe

A phone-first web app for remembering the people you care about: birthdays, favorite foods, gift ideas, dislikes, and the answers to “get to know you” questions. Notes stay on this device. GitHub Pages only hosts the app files.

## Features

- **People** — a profile for each loved one, with a photo from your camera or gallery
- **Category hub** — Dates, Family, Food, Movies & TV, Music, Hobbies, Vacations, Gifts, Dislikes, and Notes
- **Ask** — a built-in question bank (no internet, no AI). Answers land in the matching category
- **Home** — upcoming dates and a shortcut to ask something new
- **Backup** — export or import a JSON file when you switch phones

## Run it

Open the folder with a local server (needed for the camera/gallery picker and for installing as an app):

```
py -m http.server 8000
```

Then visit `http://localhost:8000`.

On your phone, after it is on GitHub Pages, use **Add to Home Screen** so it feels like a regular app.

## GitHub Pages

1. Create a GitHub repository and push these files
2. Settings → Pages → Deploy from the `main` branch, folder `/` (or `/docs` if you move the files there)
3. Open `https://yourusername.github.io/repository-name/`

Do not commit a backup JSON file. That file can include photos and personal notes.

## Privacy

Everything is stored in the browser’s local storage on that phone. There is no account and no cloud sync.
