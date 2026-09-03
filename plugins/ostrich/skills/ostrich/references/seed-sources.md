# Seed sources

A seed is a small piece of the real world fetched from outside the model so
the tangent cannot start from the model's habits. The fetch doubles as
grounding: a seed's own page is its source.

## Contents

- Etiquette
- Sources: wikipedia random, on this day, geosearch, met museum, art institute of chicago, cleveland museum of art, poetrydb, loc newspaper, inaturalist, internet archive 78rpm, apod, xkcd, open library, open-meteo, iss
- Turning a seed into a tangent

## Etiquette

- Seeds are for the tangent only. Never fetch anything about the user's work.
- Send a descriptive `User-Agent`. Wikimedia and Nominatim require one.
- At most two fetches before the opening message. If a fetch fails or returns
  nothing useful, fall through to a parametric tangent or a creative format
  rather than retrying into a delay.
- Link the item page. Embed an image only when its license below allows it;
  otherwise link it.
- Cite live-data services by name in the source note. A raw API URL is not
  a page anyone wants to open.
- Read only the section below for the rolled seed source.
- Randomize with the values from `scripts/roll`: `date`, `recent-date`,
  `coordinates`, `integer`, and `letter`. Where an API exposes a result
  count, take `integer` modulo that count for a page or offset.

## Sources

Every source below responds without an API key.

### wikipedia random

```
GET https://en.wikipedia.org/api/rest_v1/page/random/summary
```

Follow redirects. Use `title`, `extract`, `content_urls.desktop.page`, and
`thumbnail.source` when present. The long tail of Wikipedia is the point:
a minor classical scholar, a railway halt, a moth. Find the one human detail
and build outward. License: CC BY-SA text; link the page.

### on this day

```
GET https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/MM/DD
```

Use the rolled `date` for `MM/DD`. Returns `events[]` with `year`, `text`,
and `pages[].content_urls.desktop.page`. Pick an entry by `integer` modulo
the count, then prefer the least famous event in the list over the most.

### geosearch

```
GET https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=LAT|LON&gsradius=10000&gslimit=10&format=json
```

Use the rolled `coordinates`. Returns `query.geosearch[]` with `title` and
`dist` in meters. Most rolls land in the ocean and return an empty list;
that is a valid answer. The empty sea, the nearest shipping lane, or the
depth below can be the subject. Pair with open-meteo for a live postcard.

### met museum

```
GET https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isPublicDomain=true&q=WORD
GET https://collectionapi.metmuseum.org/public/collection/v1/objects/ID
```

Search with a word drawn from the rolled domain, take an `objectIDs` entry by
`integer` modulo `total`, then fetch the object. Use `title`,
`artistDisplayName`, `objectDate`, `medium`, `primaryImageSmall`, and
`objectURL`. Public-domain objects are CC0; the image may be embedded or
linked.

### art institute of chicago

```
GET https://api.artic.edu/api/v1/artworks/search?q=WORD&query[term][is_public_domain]=true&fields=id,title,artist_display,date_display,image_id&limit=10
```

Send the URL literally; the square brackets are part of it. Image URL is
`https://www.artic.edu/iiif/2/IMAGE_ID/full/843,/0/default.jpg`. Item page
is `https://www.artic.edu/artworks/ID`. Public-domain works are CC0.

### cleveland museum of art

```
GET https://openaccess-api.clevelandart.org/api/artworks/?q=WORD&has_image=1&cc0=1&limit=10&skip=N
```

Use `info.total` with `integer` for `skip`. Each `data[]` entry has `title`,
`creators[].description`, `creation_date`, `url`, and `images.web.url`.
CC0; embed or link.

### poetrydb

```
GET https://poetrydb.org/random/1
```

Returns one poem with `title`, `author`, `linecount`, and `lines[]`. Public
domain. Quote at most a few lines and link `https://poetrydb.org/`. Good
spine for constrained verse and collaborative fiction.

### loc newspaper

```
GET https://www.loc.gov/collections/chronicling-america/?dates=YYYY-MM-DD&fo=json&c=10
```

Use the rolled `date`; coverage runs from the 1770s to 1963. Each
`results[]` entry has `title`, `date`, `url`, and `image_url[]`. Open the page
image or item page and read the small items: a lost dog, the price of eggs, a
lecture announcement. Public domain. This is the strongest long-tail source
in the list.

### inaturalist

```
GET https://api.inaturalist.org/v1/observations?per_page=1&quality_grade=research&photos=true&page=N
```

Use `integer` times one hundred for `page`; the pool is over two hundred
million observations and deep paging stops at ten thousand results. Each result has `taxon.name`,
`taxon.preferred_common_name`, `place_guess`, `observed_on`, `uri`, and
`photos[].url`. Photo licenses vary per observer, so link the observation
rather than embedding the photo.

### internet archive 78rpm

```
GET https://archive.org/advancedsearch.php?q=collection%3A78rpm&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=date&rows=1&page=N&output=json
```

Over three hundred thousand digitized shellac records. Use `integer` times
one hundred for `page`; deep paging stops at ten thousand results, so `page`
times `rows` must stay at or under 10000. Item page is
`https://archive.org/details/IDENTIFIER` and plays in the browser. Give the user one thing to listen for in the first
thirty seconds.

### apod

```
GET https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&date=YYYY-MM-DD
```

Use the rolled `recent-date`; coverage starts in June 1995. Returns `title`,
`explanation`, `media_type`, and `url`. Images are often copyrighted by the
photographer, so link rather than embed. The demo key is rate limited; one
call per tangent is fine.

### xkcd

```
GET https://xkcd.com/info.0.json
GET https://xkcd.com/N/info.0.json
```

The first call gives the latest `num`. Pick `N` from `integer` scaled into
that range. Use `title`, `img`, and `alt`. CC BY-NC 2.5; link the comic and
credit xkcd.

### open library

```
GET https://openlibrary.org/search.json?q=subject:WORD&limit=10&fields=title,author_name,first_publish_year,key
```

Search a subject drawn from the rolled domain. Work page is
`https://openlibrary.org` plus `key`. Good for the oldest or strangest title
on an unlikely subject.

### open-meteo

```
GET https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&current=temperature_2m,weather_code,wind_speed_10m
```

Use the rolled `coordinates`. Returns `current` with the three values and
`current_units`. Weather codes follow WMO: 0 clear, 1 to 3 cloud, 45 and 48
fog, 51 to 67 rain, 71 to 77 snow, 95 and up thunder. For a place name, use
geosearch or reverse geocode with
`https://nominatim.openstreetmap.org/reverse?lat=LAT&lon=LON&format=json&zoom=10`
and read `display_name`.

### iss

```
GET https://api.wheretheiss.at/v1/satellites/25544
GET https://api.wheretheiss.at/v1/coordinates/LAT,LON
```

The first returns `latitude`, `longitude`, `altitude` in km, `velocity` in
km/h, and `visibility`. The second maps a point to `timezone_id` and
`country_code`. Combine with geosearch to say what is directly beneath the
station right now.

## Turning a seed into a tangent

- Read the whole seed before deciding what it is about. The interesting thing
  is usually not the headline.
- Keep the seed's specific proper nouns, dates, and numbers. Specificity is
  what makes it feel found rather than generated.
- The seed is the spine, not the script. The rolled format and constraint
  decide how it is told.
- One seed per tangent. Two seeds combined can work when the constraint asks
  for it, never more.
