export function loader() {
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /game/",
      "Disallow: /api/",
      "",
      "Sitemap: https://kingscrib.tabledeck.us/sitemap.xml",
    ].join("\n"),
    { headers: { "Content-Type": "text/plain" } }
  );
}
