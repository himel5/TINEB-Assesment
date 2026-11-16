# Representative Directory

An offline-first responsive directory for browsing the supplied Lok Sabha representative dataset. The frontend loads and parses `data/representatives.csv` in the browser; it generates state and constituency options from the data, supports name/constituency search, and provides email links and copy buttons. The API is a small dependency-free Node HTTP server and exposes the same normalized records.

## Run locally

```text
npm install
npm run start
```

The frontend opens at the webpack development URL. To run the API separately:

```text
npm run api
```

The API listens on `http://localhost:3000`; documentation is at `/api-docs` and machine-readable OpenAPI is at `/openapi.json`.

## Example requests

`GET /states` returns `[{"state":"Tamil Nadu"}]` (along with the other states).

`GET /constituencies?state=Tamil%20Nadu` returns `[{"constituency":"Dharmapuri","state":"Tamil Nadu"}]`.

`GET /representatives?state=tamil%20nadu` returns normalized representative objects with `emails` and `terms` arrays and `phone: null` when unavailable. `GET /representatives/1` returns one record; `GET /representatives?search=mani` searches by name or constituency.

## Creative contribution and notes

The interface uses a location-first search flow, compact fact cards, accessible status messaging, responsive layouts, and one-click email copying. Approximate implementation time: 3 hours. Known limitation: the client requires a web server (rather than opening `index.html` directly) so that browser `fetch` can load the CSV. Phone strings are intentionally preserved as supplied.

No external tutorials or code snippets were adapted. The CSV parser is a small original quote-aware implementation written for this dataset. No AI chat conversation was used as an implementation reference.
