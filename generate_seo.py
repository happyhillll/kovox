#!/usr/bin/env python3
"""
Generate static SEO HTML files and sitemap.xml for KoVox.
Reads RDB data from kovox/data/kovox-rdb.js and creates:
  - /performance/{id}/index.html for each performance
  - /work/{id}/index.html for each work
  - /person/{id}/index.html for each person
  - /composer/{name}/index.html for each unique composer
  - /sitemap.xml
"""

import json
import os
import re
import html
from datetime import datetime
from urllib.parse import quote

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_URL = "https://happyhillll.github.io"
DATA_FILE = os.path.join(BASE_DIR, "kovox", "data", "kovox-rdb.js")


def load_data():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    # Parse JSON after the `=` sign
    json_str = content.split("=", 1)[1].strip()
    # Remove trailing semicolons if any
    json_str = json_str.rstrip().rstrip(";")
    return json.loads(json_str)


def esc(text):
    """Escape text for HTML attribute and content."""
    if text is None:
        return ""
    return html.escape(str(text), quote=True)


def make_html(title, description, canonical_url, redirect_hash, og_image, json_ld, noscript_content, og_type="website"):
    """Generate a full SEO HTML page."""
    og_image_tag = ""
    if og_image:
        og_image_tag = f'    <meta property="og:image" content="{esc(og_image)}" />\n'

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{esc(title)} | KoVox</title>
    <meta name="description" content="{esc(description)}" />
    <link rel="canonical" href="{esc(canonical_url)}" />

    <!-- Open Graph -->
    <meta property="og:title" content="{esc(title)} | KoVox" />
    <meta property="og:description" content="{esc(description)}" />
    <meta property="og:url" content="{esc(canonical_url)}" />
    <meta property="og:type" content="{esc(og_type)}" />
    <meta property="og:site_name" content="KoVox" />
{og_image_tag}
    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
{json.dumps(json_ld, ensure_ascii=False, indent=4)}
    </script>

    <script>
        window.location.replace('{redirect_hash}');
    </script>
</head>
<body>
    <noscript>
        <h1>{esc(title)}</h1>
        {noscript_content}
        <p><a href="{esc(canonical_url)}">View on KoVox</a></p>
    </noscript>
</body>
</html>
"""


def write_file(rel_path, content):
    """Write content to file, creating directories as needed."""
    full_path = os.path.join(BASE_DIR, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)


def generate_performances(data):
    urls = []
    count = 0
    for perf in data.get("performances", []):
        perf_id = perf["performance_id"]
        short_id = perf_id.replace("PERF_", "")
        title = perf.get("performance_title") or f"Performance {short_id}"
        venue = perf.get("venue_name") or ""
        date = perf.get("performance_date") or ""
        description = f"{title} - {venue}, {date}".strip(" -,")
        canonical = f"{BASE_URL}/performance/{short_id}/"
        redirect = f"/#/detail/{perf_id}"
        og_image = f"{BASE_URL}/viewer/data/thumbnails/{short_id}.gif"

        json_ld = {
            "@context": "https://schema.org",
            "@type": "MusicEvent",
            "name": title,
            "startDate": date,
            "location": {
                "@type": "Place",
                "name": venue
            } if venue else None,
            "url": canonical,
            "image": og_image,
        }
        # Remove None values
        json_ld = {k: v for k, v in json_ld.items() if v is not None}

        noscript = f"""
        <p><strong>Date:</strong> {esc(date)}</p>
        <p><strong>Venue:</strong> {esc(venue)}</p>
"""
        if perf.get("start_time"):
            noscript += f'        <p><strong>Start Time:</strong> {esc(perf["start_time"])}</p>\n'
        if perf.get("host_organization"):
            noscript += f'        <p><strong>Host:</strong> {esc(perf["host_organization"])}</p>\n'
        if perf.get("duration_minutes"):
            noscript += f'        <p><strong>Duration:</strong> {perf["duration_minutes"]} minutes</p>\n'

        page = make_html(title, description, canonical, redirect, og_image, json_ld, noscript, og_type="music.event")
        write_file(f"performance/{short_id}/index.html", page)
        urls.append(canonical)
        count += 1
    return count, urls


def generate_works(data):
    urls = []
    count = 0
    for work in data.get("works", []):
        work_id = work["work_id"]
        short_id = work_id.replace("WRK_", "")
        title = work.get("mb_title") or work.get("title_variant") or f"Work {short_id}"
        composer = work.get("mb_composer") or "Unknown"
        language = work.get("mb_language") or ""
        desc_parts = [title, f"by {composer}"]
        if language:
            desc_parts.append(f"- {language}")
        description = " ".join(desc_parts)
        canonical = f"{BASE_URL}/work/{short_id}/"
        redirect = f"/#/detail/{work_id}"

        json_ld = {
            "@context": "https://schema.org",
            "@type": "MusicComposition",
            "name": title,
            "composer": {
                "@type": "Person",
                "name": composer
            },
            "inLanguage": language if language else None,
            "url": canonical,
        }
        json_ld = {k: v for k, v in json_ld.items() if v is not None}

        noscript = f"""
        <p><strong>Title:</strong> {esc(title)}</p>
        <p><strong>Composer:</strong> {esc(composer)}</p>
"""
        if work.get("title_variant") and work.get("mb_title") and work["title_variant"] != work["mb_title"]:
            noscript += f'        <p><strong>Variant Title:</strong> {esc(work["title_variant"])}</p>\n'
        if language:
            noscript += f'        <p><strong>Language:</strong> {esc(language)}</p>\n'
        if work.get("mb_type"):
            noscript += f'        <p><strong>Type:</strong> {esc(work["mb_type"])}</p>\n'
        if work.get("mb_lyricist"):
            noscript += f'        <p><strong>Lyricist:</strong> {esc(work["mb_lyricist"])}</p>\n'

        page = make_html(title, description, canonical, redirect, None, json_ld, noscript)
        write_file(f"work/{short_id}/index.html", page)
        urls.append(canonical)
        count += 1
    return count, urls


def generate_persons(data):
    urls = []
    count = 0
    for person in data.get("persons", []):
        person_id = person["person_id"]
        short_id = person_id.replace("PERSON_", "")
        name = person.get("person_name") or f"Person {short_id}"
        role = person.get("person_role") or ""
        medium = person.get("person_medium") or ""
        desc_parts = [name]
        if role:
            desc_parts.append(f"- {role}")
        if medium:
            desc_parts.append(f"({medium})")
        description = " ".join(desc_parts)
        canonical = f"{BASE_URL}/person/{short_id}/"
        redirect = f"/#/detail/{person_id}"

        json_ld = {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": name,
            "url": canonical,
        }
        if role:
            json_ld["jobTitle"] = role
        if person.get("person_isni"):
            json_ld["sameAs"] = f"https://isni.org/isni/{person['person_isni']}"

        noscript = f"""
        <p><strong>Name:</strong> {esc(name)}</p>
"""
        if role:
            noscript += f'        <p><strong>Role:</strong> {esc(role)}</p>\n'
        if medium:
            noscript += f'        <p><strong>Medium:</strong> {esc(medium)}</p>\n'
        if person.get("person_profile"):
            # Truncate long profiles for noscript
            profile = person["person_profile"]
            if len(profile) > 500:
                profile = profile[:500] + "..."
            noscript += f'        <p><strong>Profile:</strong> {esc(profile)}</p>\n'

        page = make_html(name, description, canonical, redirect, None, json_ld, noscript)
        write_file(f"person/{short_id}/index.html", page)
        urls.append(canonical)
        count += 1
    return count, urls


def generate_composers(data):
    urls = []
    count = 0
    # Collect unique composers from works
    composers = {}
    for work in data.get("works", []):
        composer = work.get("mb_composer")
        if composer and composer not in composers:
            composers[composer] = {
                "name": composer,
                "birth_year": work.get("mb_composer_birth_year"),
                "death_year": work.get("mb_composer_death_year"),
                "works": []
            }
        if composer:
            composers[composer]["works"].append(
                work.get("mb_title") or work.get("title_variant") or ""
            )

    for composer_name, info in composers.items():
        # Use URL-safe slug for directory name
        slug = quote(composer_name, safe="")
        description = f"Works by {composer_name} performed in Korean recitals"
        canonical = f"{BASE_URL}/composer/{slug}/"
        redirect = f"/#/composer/{slug}"

        json_ld = {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": composer_name,
            "url": canonical,
        }
        if info["birth_year"]:
            json_ld["birthDate"] = str(info["birth_year"])
        if info["death_year"]:
            json_ld["deathDate"] = str(info["death_year"])

        # List a sample of works in noscript
        work_list = info["works"][:20]
        works_html = "\n".join(f"            <li>{esc(w)}</li>" for w in work_list)
        more = f"\n            <li>... and {len(info['works']) - 20} more works</li>" if len(info["works"]) > 20 else ""

        noscript = f"""
        <p><strong>Composer:</strong> {esc(composer_name)}</p>
"""
        if info["birth_year"]:
            years = str(info["birth_year"])
            if info["death_year"]:
                years += f" - {info['death_year']}"
            noscript += f'        <p><strong>Years:</strong> {esc(years)}</p>\n'
        noscript += f"""        <p><strong>Works ({len(info['works'])}):</strong></p>
        <ul>
{works_html}{more}
        </ul>
"""

        page = make_html(composer_name, description, canonical, redirect, None, json_ld, noscript)
        write_file(f"composer/{slug}/index.html", page)
        urls.append(canonical)
        count += 1
    return count, urls


def generate_sitemap(all_urls):
    now = datetime.now().strftime("%Y-%m-%d")
    entries = []
    # Add homepage
    entries.append(f"""  <url>
    <loc>{BASE_URL}/</loc>
    <lastmod>{now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>""")

    for url in all_urls:
        entries.append(f"""  <url>
    <loc>{esc(url)}</loc>
    <lastmod>{now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>""")

    sitemap = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(entries)}
</urlset>
"""
    write_file("sitemap.xml", sitemap)


def main():
    print("Loading RDB data...")
    data = load_data()

    print("Generating performance pages...")
    perf_count, perf_urls = generate_performances(data)
    print(f"  -> {perf_count} performance pages")

    print("Generating work pages...")
    work_count, work_urls = generate_works(data)
    print(f"  -> {work_count} work pages")

    print("Generating person pages...")
    person_count, person_urls = generate_persons(data)
    print(f"  -> {person_count} person pages")

    print("Generating composer pages...")
    composer_count, composer_urls = generate_composers(data)
    print(f"  -> {composer_count} composer pages")

    all_urls = perf_urls + work_urls + person_urls + composer_urls
    print(f"\nGenerating sitemap.xml with {len(all_urls) + 1} URLs...")
    generate_sitemap(all_urls)

    total = perf_count + work_count + person_count + composer_count
    print(f"\n=== Summary ===")
    print(f"Performances: {perf_count}")
    print(f"Works:        {work_count}")
    print(f"Persons:      {person_count}")
    print(f"Composers:    {composer_count}")
    print(f"Total HTML:   {total}")
    print(f"Sitemap URLs: {len(all_urls) + 1}")
    print("Done!")


if __name__ == "__main__":
    main()
