// functions/documents/[[path]].js — the client documents portal, for Eichler Market files.
//
// Signing emails (tx-sign) end with "Every document on this file, any time: <market domain>/documents" and link
// /documents/?tx=<file>. The portal itself is served on the city and condo sites, and the file it opens names its own
// market, agent and brokerage, so an Eichler Market file opens there unchanged. This sends the link on, query and all.
// (Tim, 21 Oct 2026: letters of intent for Eichler buyers now go out for signature from the desk.)

export function onRequest({ request }) {
  const u = new URL(request.url);
  return Response.redirect('https://campbellrealestatemarket.com/documents/' + u.search, 302);
}
